<div align="center">

[**English**](README.md) | [**中文**](README.zh.md)

<img src="assets/banner.png" alt="dsh-voice-input" width="100%"/>

**Streaming voice input for the [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) web composer.**
**Click the mic · speak · the transcript lands in your draft — live.**

[![version](https://img.shields.io/badge/version-0.1.0-4f7cff?style=flat-square&logo=github)](https://github.com/fingercd/dsh-voice-input)
[![license](https://img.shields.io/badge/license-MIT-22c55e?style=flat-square)](LICENSE)
[![platform](https://img.shields.io/badge/platform-Chrome%20%7C%20Edge-8b5cf6?style=flat-square&logo=googlechrome&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition)
[![engine](https://img.shields.io/badge/ASR-FunASR%20%2F%20Web%20Speech-f59e0b?style=flat-square&logo=python&logoColor=white)](https://github.com/alibaba-damo-academy/FunASR)
[![dsh](https://img.shields.io/badge/DeepSeek%20Harness-client%20plugin-0ea5e9?style=flat-square)](https://github.com/deepseek-ai/deepseek-harness)

</div>

---

A **client plugin** for the DSH web UI: one mic button in the composer tool row, streaming
speech-to-text with **automatic engine fallback** — speed first, accuracy when it matters.

| ⚡ **Web Speech API** *(default)* | 🎯 **Local FunASR** *(fallback)* |
|---|---|
| Native browser streaming · zero deployment · results appear while you talk | Paraformer-large-online · state-of-the-art Chinese ASR · CUDA-accelerated |
| Fastest — real-time, word by word | Most accurate — [FunASR](https://github.com/alibaba-damo-academy/FunASR) by Alibaba DAMO Academy (15k+ ⭐) |

If Web Speech errors out (e.g. the Google service is unreachable), the plugin **falls back to
your local FunASR server automatically** — or force one engine via `localStorage`.

---

## ✨ Features

- 🎤 **One-click mic** in the composer tool row (`conversation.input.left` slot) — no shell changes, pure plugin
- 📡 **Streaming transcription** — live preview panel while you talk, 320 ms incremental frames
- 🔀 **Auto engine fallback** — Web Speech → local FunASR on failure, zero user action
- 🖥️ **CUDA-accelerated local ASR** — real-time factor < 0.1 (5× faster than real time in testing)
- 📝 **Non-destructive draft writes** — transcript is *appended* to your draft; your edits are never overwritten
- 🧩 **Zero-build browser bundle** — hand-written `__ModuleLoader__.load` format, loads dynamically at boot

## 🏗️ How it works

<img src="assets/architecture.png" alt="architecture" width="100%"/>

1. Click the mic button → browser captures 16 kHz mono PCM
2. **Web Speech API** streams natively (Chrome/Edge); on failure the same audio path switches to
   **local FunASR** over WebSocket (`ws://127.0.0.1:8899/ws`)
3. Final text is appended to the composer draft via `inputActions.setDraft()`

## 📸 Screenshots

<img src="assets/screenshot-mockup.png" alt="screenshots" width="100%"/>

## 🚀 Quick start

### 1. Install the plugin

```powershell
# from the cloned repo directory:
dsh plugin --profile web add "<path-to-this-repo>"
```

### 2. Register the roster (one-time)

Append to `~/.dsh/profiles/web/cordis.patch.yml`:

```yaml
- insert:
    - id: voice-input
      name: 'dsh-voice-input'
```

### 3. Restart `dsh web`

Client plugins load dynamically at boot — **no frontend rebuild needed**. Refresh the page and
the mic button appears at the left end of the composer tool row.

## 🎯 Local FunASR engine (optional — maximum accuracy)

```powershell
# one-time dependency install (Python 3.10+; torch/torchaudio + CUDA recommended)
powershell -ExecutionPolicy Bypass -File scripts/install_funasr.ps1

# start the streaming service (first run downloads paraformer-large-online, ~840 MB)
python scripts/funasr_server.py
# optional: --port 8899 --device cuda:0   (GPU auto-detected by default)
```

### ⚙️ Configuration (browser console)

```js
localStorage.setItem("dsh.voice.input.engine", "auto");                        // "auto" | "webspeech" | "funasr"
localStorage.setItem("dsh.voice.input.funasrUrl", "ws://127.0.0.1:8899/ws");   // custom endpoint
```

## 🔌 FunASR streaming protocol

```
client → server:  {"type":"start","lang":"zh"} · binary Int16 PCM @16 kHz mono · {"type":"end"}
server → client:  {"type":"partial","text":<incremental tail>} · {"type":"final","text":<tail increment>}
                   {"type":"ok"} · {"type":"error","message":<str>}
```

The streaming model emits **incremental** text — clients accumulate frames (`scripts/funasr_server.py`
docstring has the full detail).

## 🧩 Plugin internals

| File | Role |
|---|---|
| `lib/index.js` | Host (node) half — empty `apply`, ensures the Loader roster entry |
| `lib/client.js` | Browser bundle — mic button, dual-engine orchestration, draft commits |
| `scripts/funasr_server.py` | Local streaming ASR service (FastAPI + WebSocket + FunASR) |
| `scripts/install_funasr.ps1` | One-shot dependency installer |

- Registered in the `conversation.input.left` slot; reads/writes the draft through the owner-provided
  `useInput` / `inputActions` props — no deep client-runtime coupling.
- The bundle requires only `react` from the shell's static externals table, so it survives version drift.

## 🤝 Contributing

PRs welcome! Ideas worth exploring: 2-pass mode for revision-safe streaming, audio level meter,
command (`/`) trigger integration, per-language model switching.

## 📄 License

[MIT](LICENSE) © fingercd
