# -*- coding: utf-8 -*-
"""
dsh-voice-input — local FunASR streaming STT service.

Serves one WebSocket endpoint that the dsh web plugin's browser half connects
to (default ws://127.0.0.1:8899/ws, overridable via localStorage
"dsh.voice.input.funasrUrl").

Engine: Alibaba FunASR paraformer-zh-streaming (state of the art for Chinese,
runs on CUDA when available). This script is a thin, self-contained re-hosting
of the official streaming protocol from
https://github.com/alibaba-damo-academy/FunASR (runtime/python/websocket),
adapted to a single-stream JSON protocol:

  client → server:
    {"type":"start","lang":"zh"}          (text)
    <binary Int16 PCM @16 kHz mono>       (chunks)
    {"type":"end"}                        (text)
  server → client:
    {"type":"partial","text":<incremental transcript tail>}
    {"type":"final","text":<final tail increment>}
    {"type":"ok"}
    {"type":"error","message":<str>}
  (the streaming model emits INCREMENTAL text — clients accumulate frames)

Usage:
  python scripts/funasr_server.py
  optional: --host 0.0.0.0 --port 8899 --device cuda:0 --model paraformer-zh-streaming
  (requires Python 3.10+ with funasr installed; CUDA optional but recommended)
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from typing import Any

import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
import uvicorn

SAMPLE_RATE = 16000
MIN_CHUNK_BYTES = 960 * SAMPLE_RATE * 2 // 1000  # 960ms × 16k × 2B = 30720
STEP_BYTES = 320 * SAMPLE_RATE * 2 // 1000        # 320ms = 10240
CHUNK_SIZE = [5, 10, 5]
ENC_LOOK_BACK = 4
DEC_LOOK_BACK = 1

app = FastAPI(title="dsh-voice-input FunASR streaming STT")

_model: Any = None
_device = "cpu"


def get_model(device: str) -> Any:
    global _model
    if _model is None:
        from funasr import AutoModel

        print(f"[funasr] loading paraformer-zh-streaming on {device} (first run downloads the model)...",
              flush=True)
        _model = AutoModel(
            model="paraformer-zh-streaming",
            trust_remote_code=True,
            device=device,
            disable_update=True,
        )
        print("[funasr] model ready", flush=True)
    return _model


class StreamSession:
    """One WebSocket conversation: accumulate PCM, pump 320ms increments."""

    def __init__(self, model: Any, ws: WebSocket) -> None:
        self.model = model
        self.ws = ws
        self.pending = b""
        # IMPORTANT: the streaming model mutates the SAME dict in place
        # (generate_chunk writes cache["encoder"]/["decoder"]/["frontend"]),
        # it never returns a new one — reuse this one dict for the whole
        # stream or every chunk is decoded independently.
        self.cache: dict[str, Any] = {}
        self.primed = False
        self.last_sent = ""  # cumulative text already announced (final deltas are relative)

    def _run(self, chunk: bytes, is_final: bool) -> str:
        pcm = np.frombuffer(chunk, dtype=np.int16).astype(np.float32) / 32768.0
        res = self.model.generate(
            input=pcm,
            is_final=is_final,
            chunk_size=CHUNK_SIZE,
            encoder_chunk_look_back=ENC_LOOK_BACK,
            decoder_chunk_look_back=DEC_LOOK_BACK,
            cache=self.cache,
        )
        return res[0].get("text", "") or ""

    async def pump(self) -> None:
        while True:
            if not self.primed:
                if len(self.pending) < MIN_CHUNK_BYTES:
                    return
                take, self.primed = MIN_CHUNK_BYTES, True
            else:
                take = STEP_BYTES
                if len(self.pending) < take:
                    return
            chunk, self.pending = self.pending[:take], self.pending[take:]
            text = self._run(chunk, is_final=False)
            if text and text != self.last_sent:
                self.last_sent = text
                await self.ws.send_json({"type": "partial", "text": text})

    async def finish(self) -> None:
        # The streaming model emits INCREMENTAL text: every generate() call
        # returns only the newly decoded tail. Partial frames carry those
        # increments; the client accumulates them. is_final=True returns the
        # last tail increment (the buffered <320ms remainder), which we send
        # as one final frame so the client can commit it.
        if self.pending:
            tail = self._run(self.pending, is_final=True)
            self.pending = b""
            if tail:
                await self.ws.send_json({"type": "final", "text": tail})
        await self.ws.send_json({"type": "ok"})


@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket) -> None:
    await ws.accept()
    model = get_model(_device)  # preloaded at startup; call is idempotent
    session = StreamSession(model, ws)
    try:
        while True:
            data = await ws.receive()
            kind = data.get("type")
            if kind == "websocket.disconnect":
                break
            if kind == "websocket.receive" and "text" in data:
                msg = json.loads(data["text"])
                mtype = msg.get("type")
                if mtype == "end":
                    await session.finish()
                    break
                # "start" is a no-op here (single language today)
            elif kind == "websocket.receive" and "bytes" in data:
                session.pending += data["bytes"]
                await session.pump()
    except WebSocketDisconnect:
        pass
    except Exception as exc:  # keep one bad stream from killing the server
        try:
            await ws.send_json({"type": "error", "message": str(exc)})
        except Exception:
            pass
    finally:
        try:
            await ws.close()
        except Exception:
            pass


def main() -> None:
    global _device
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8899)
    parser.add_argument("--device", default="cuda:0" if _cuda_available() else "cpu")
    args = parser.parse_args()
    _device = args.device
    # Preload the model BEFORE binding the port: first run downloads it
    # (~840MB), and a synchronous load inside a websocket handler would stall
    # every handshake while it runs. Service "up" therefore means ready.
    get_model(_device)
    print(f"[funasr] serving ws://{args.host}:{args.port}/ws (device={_device})", flush=True)
    uvicorn.run(app, host=args.host, port=args.port, log_level="warning")


def _cuda_available() -> bool:
    try:
        import torch

        return torch.cuda.is_available()
    except Exception:
        return False


if __name__ == "__main__":
    main()
