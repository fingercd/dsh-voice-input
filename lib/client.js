/**
 * dsh-voice-input — browser half (client plugin bundle).
 *
 * Ships as a hand-written `window.__ModuleLoader__.load` bundle (same shape
 * the official tsdown pipeline emits), so it needs no build step. It requires
 * only shell-static modules: react.
 *
 * Surface: one mic button registered in the composer tool row
 * (`conversation.input.left`, id `voice-input`). Click to start streaming
 * speech-to-text, click again to stop and commit the transcript into the
 * composer draft.
 *
 * Engines (order of preference):
 *   1. Web Speech API  (SpeechRecognition / webkitSpeechRecognition) —
 *      streaming, lowest latency, zero deployment. Chrome/Edge.
 *   2. Local FunASR    (ws://127.0.0.1:8899/ws) — paraformer-zh-streaming
 *      served by scripts/funasr_server.py; most accurate for Chinese, GPU
 *      accelerated. Used automatically when Web Speech is unavailable or
 *      errors out.
 * Preference override: localStorage["dsh.voice.input.engine"] =
 *   "auto" | "webspeech" | "funasr"
 */
window.__ModuleLoader__.load({
	id: "dsh-voice-input",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		const { useCallback, useEffect, useRef, useState } = react;

		//#region styles
		const css = [
			".dvi_btn{width:28px;height:28px;color:var(--dsw-alias-label-tertiary);cursor:pointer;background:0 0;border:none;border-radius:999px;justify-content:center;align-items:center;padding:0;display:inline-flex;position:relative}",
			".dvi_btn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}",
			".dvi_btn:disabled{opacity:.45;cursor:default}",
			".dvi_btn[data-recording=true]{color:var(--dsw-alias-state-error-primary)}",
			".dvi_btn[data-recording=true]::after{content:\"\";position:absolute;inset:-3px;border-radius:999px;border:1px solid var(--dsw-alias-state-error-primary);animation:dvi_pulse 1.2s ease-out infinite}",
			".dvi_btn[data-recording=true]:hover{color:var(--dsw-alias-state-error-primary)}",
			"@keyframes dvi_pulse{0%{opacity:.9;transform:scale(.85)}70%{opacity:0;transform:scale(1.25)}100%{opacity:0;transform:scale(1.25)}}",
			".dvi_panel{position:fixed;bottom:120px;left:50%;transform:translateX(-50%);z-index:2000;box-sizing:border-box;width:min(92vw,640px);max-height:40vh;overflow-y:auto;background:var(--dsw-specific-input-major);border:1px solid var(--dsw-alias-border-l2);border-radius:14px;box-shadow:var(--dsw-shadow-lv2);padding:10px 14px;font-size:14px;line-height:22px;color:var(--dsw-alias-label-primary);display:flex;flex-direction:column;gap:6px}",
			".dvi_panel *{box-sizing:border-box}",
			".dvi_panelHead{display:flex;align-items:center;gap:8px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary);flex:none}",
			".dvi_dot{width:7px;height:7px;border-radius:50%;background:var(--dsw-alias-state-error-primary);flex:none;animation:dvi_blink 1s ease-in-out infinite}",
			"@keyframes dvi_blink{0%,100%{opacity:1}50%{opacity:.25}}",
			".dvi_engine{flex:1;text-align:right;font-family:var(--ds-font-family-code);color:var(--dsw-alias-label-caption)}",
			".dvi_text{min-height:22px;white-space:pre-wrap;word-break:break-word}",
			".dvi_hint{font-size:12px;line-height:18px;color:var(--dsw-alias-label-caption)}",
			".dvi_error{color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:18px}"
		].join("\n");
		const TAG_ID = "dsh-voice-input/styles.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(TAG_ID) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-voice-input";
			tag.dataset.pluginCss = TAG_ID;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		//#endregion

		//#region helpers
		const LS_ENGINE = "dsh.voice.input.engine";
		const LS_FUNASR_URL = "dsh.voice.input.funasrUrl";
		const DEFAULT_FUNASR_URL = "ws://127.0.0.1:8899/ws";

		const SPEECH_RECOGNITION = typeof window !== "undefined"
			? window.SpeechRecognition || window.webkitSpeechRecognition
			: undefined;

		/** Copy the composition of a line: insert `sep + text` unless draft empty or already ends with whitespace. */
		function appendToDraft(inputActions, draft, text) {
			if (text === "" || inputActions === undefined) return;
			const sep = draft === "" || /\s$/.test(draft) ? "" : " ";
			inputActions.setDraft(draft + sep + text);
		}
		//#endregion

		//#region engine: Web Speech API
		/**
		 * Streaming engine over the browser's native SpeechRecognition.
		 * @returns controller { stop, active }.
		 */
		function createWebSpeechEngine({ onInterim, onFinal, onError, onEnd, lang }) {
			const rec = new SPEECH_RECOGNITION();
			rec.lang = lang;
			rec.continuous = true;
			rec.interimResults = true;
			rec.maxAlternatives = 1;
			let finalText = "";
			let stopped = false;
			rec.onresult = (e) => {
				let interim = "";
				for (let i = e.resultIndex; i < e.results.length; i++) {
					const r = e.results[i];
					if (r.isFinal) finalText += r[0].transcript;
					else interim += r[0].transcript;
				}
				onInterim(interim, finalText);
				if (finalText !== "") onFinal(finalText);
			};
			rec.onerror = (e) => {
				if (e.error === "no-speech") return; // handled by onend
				onError(e.error || "speech-error");
			};
			rec.onend = () => {
				if (!stopped) onEnd(finalText);
			};
			rec.start();
			return {
				active: () => !stopped,
				stop: () => {
					stopped = true;
					try { rec.stop(); } catch (_) { /* already ended */ }
				}
			};
		}
		//#endregion

		//#region engine: local FunASR (websocket streaming)
		/** Linear resample of a Float32 chunk to 16 kHz mono. */
		function resampleTo16k(chunk, fromRate) {
			if (fromRate === 16000) return chunk;
			const ratio = fromRate / 16000;
			const outLen = Math.max(1, Math.floor(chunk.length / ratio));
			const out = new Float32Array(outLen);
			for (let i = 0; i < outLen; i++) {
				const pos = i * ratio;
				const i0 = Math.floor(pos);
				const i1 = Math.min(i0 + 1, chunk.length - 1);
				const frac = pos - i0;
				out[i] = chunk[i0] * (1 - frac) + chunk[i1] * frac;
			}
			return out;
		}
		/** Int16 little-endian bytes of a Float32 PCM chunk. */
		function pcmToInt16(pcm) {
			const bytes = new Int16Array(pcm.length);
			for (let i = 0; i < pcm.length; i++) {
				const s = Math.max(-1, Math.min(1, pcm[i]));
				bytes[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
			}
			return new Uint8Array(bytes.buffer);
		}

		/**
		 * Streaming engine over a local FunASR websocket service.
		 * Protocol (see scripts/funasr_server.py):
		 *   c→s {"type":"start","lang":"zh"}  · binary Int16 PCM @16k mono ·
		 *   c→s {"type":"end"} · s→c {"type":"partial"|"final","text"} ·
		 *   s→c {"type":"ok"} | {"type":"error","message"}
		 * @returns controller { stop, active }.
		 */
		function createFunasrEngine({ url, onInterim, onFinal, onError, onEnd }) {
			let ws = null;
			let audioCtx = null;
			let stream = null;
			let processor = null;
			let source = null;
			let pending = []; // Float32Array[] buffered at 16k
			let pendingLen = 0;
			let wsOpen = false;
			let sendTimer = null;
			let ended = false;
			let partialAcc = ""; // accumulated incremental partial text (preview)
			let finalAcc = "";   // accumulated incremental final text (committed)

			function sendBuffer() {
				if (!wsOpen || pendingLen === 0) return;
				const merged = new Float32Array(pendingLen);
				let off = 0;
				for (const p of pending) { merged.set(p, off); off += p.length; }
				pending = [];
				pendingLen = 0;
				ws.send(pcmToInt16(merged));
			}

			const BUFFER_MS = 320;
			const FIRST_CHUNK_SAMPLES = 960 * 16; // 960ms warm-up before first chunk

			ws = new WebSocket(url);
			ws.binaryType = "arraybuffer";
			ws.onopen = () => {
				wsOpen = true;
				ws.send(JSON.stringify({ type: "start", lang: "zh" }));
				sendTimer = setInterval(() => {
					if (pendingLen >= FIRST_CHUNK_SAMPLES) sendBuffer();
					else if (pendingLen >= 160 * 16) sendBuffer(); // small dribble after warm-up
				}, BUFFER_MS);
			};
			ws.onmessage = (ev) => {
				if (typeof ev.data !== "string") return;
				let msg;
				try { msg = JSON.parse(ev.data); } catch (_) { return; }
				if (msg.type === "partial") {
					// FunASR emits INCREMENTAL text — accumulate for the preview.
					partialAcc += msg.text;
					onInterim(partialAcc, finalAcc);
				} else if (msg.type === "final") {
					// Tail increment — accumulate and commit the delta.
					finalAcc += msg.text;
					onInterim("", finalAcc);
					onFinal(msg.text);
				} else if (msg.type === "error") {
					onError(msg.message || "funasr-error");
				} else if (msg.type === "ok") {
					// server flushed the tail; close the socket ourselves
					try { ws.close(); } catch (_) { /* noop */ }
				}
			};
			ws.onerror = () => {
				onError("funasr-connect");
			};
			ws.onclose = () => {
				if (sendTimer !== null) { clearInterval(sendTimer); sendTimer = null; }
				teardownAudio();
				if (!ended) onEnd(finalAcc);
			};

			function teardownAudio() {
				if (processor !== null) { try { processor.disconnect(); } catch (_) { /* noop */ } processor = null; }
				if (source !== null) { try { source.disconnect(); } catch (_) { /* noop */ } source = null; }
				if (stream !== null) { for (const t of stream.getTracks()) try { t.stop(); } catch (_) { /* noop */ } stream = null; }
				if (audioCtx !== null && audioCtx.state !== "closed") { try { audioCtx.close(); } catch (_) { /* noop */ } audioCtx = null; }
			}

			navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } })
				.then((s) => {
					if (ended) { for (const t of s.getTracks()) t.stop(); return; }
					stream = s;
					audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
					source = audioCtx.createMediaStreamSource(stream);
					processor = audioCtx.createScriptProcessor(4096, 1, 1);
					processor.onaudioprocess = (e) => {
						if (!wsOpen) return;
						const chunk = e.inputBuffer.getChannelData(0);
						const resampled = resampleTo16k(chunk, audioCtx.sampleRate);
						pending.push(resampled);
						pendingLen += resampled.length;
					};
					source.connect(processor);
					processor.connect(audioCtx.destination);
				})
				.catch(() => onError("mic-denied"));

			return {
				active: () => !ended && (wsOpen || ws.readyState === WebSocket.CONNECTING),
				stop: () => {
					if (ended) return;
					ended = true;
					// flush any buffered audio so the tail is transcribed
					sendBuffer();
					if (wsOpen) {
						ws.send(JSON.stringify({ type: "end" }));
					} else {
						try { ws.close(); } catch (_) { /* noop */ }
					}
					if (sendTimer !== null) { clearInterval(sendTimer); sendTimer = null; }
				}
			};
		}
		//#endregion

		//#region component
		/**
		 * The composer tool-row mic button. Owns the whole voice session:
		 * engine pick, streaming preview panel, commit-to-draft on stop.
		 */
		function VoiceButton({ useInput, inputActions, sessionId }) {
			const input = useInput((s) => s);
			const draft = input?.draft ?? "";
			const [recording, setRecording] = useState(false);
			const [preview, setPreview] = useState("");
			const [engineName, setEngineName] = useState("");
			const [error, setError] = useState(null);
			const draftRef = useRef(draft);
			const engineRef = useRef(null); // { stop, active }
			const appendedRef = useRef("");  // webspeech: already-committed final text
			draftRef.current = draft;

			const stopSession = useCallback(() => {
				const eng = engineRef.current;
				engineRef.current = null;
				if (eng && eng.active()) eng.stop();
			}, []);

			// unmount safety
			useEffect(() => stopSession, [stopSession]);

			const commitTail = useCallback((finalText) => {
				// webspeech path: append only the delta
				const appended = appendedRef.current;
				if (finalText.length > appended.length) {
					const delta = finalText.slice(appended.length);
					appendedRef.current = finalText;
					appendToDraft(inputActions, draftRef.current, delta);
				}
			}, [inputActions]);

			const startSession = useCallback(() => {
				setError(null);
				setPreview("");
				appendedRef.current = "";
				const prefer = (() => {
					try { return localStorage.getItem(LS_ENGINE) || "auto"; } catch (_) { return "auto"; }
				})();
				const useWeb = SPEECH_RECOGNITION !== undefined && prefer !== "funasr";
				const funasrUrl = (() => {
					try { return localStorage.getItem(LS_FUNASR_URL) || DEFAULT_FUNASR_URL; } catch (_) { return DEFAULT_FUNASR_URL; }
				})();

				const onInterim = (interim, finalText) => {
					setPreview(interim !== "" ? interim : finalText);
				};
				// Web Speech path: commitFinal receives the cumulative final text; only the delta is appended.
				const onFinal = (finalText) => commitTail(finalText);
				const onError = (code) => {
					// Web Speech failed (e.g. offline Google service): fall back to FunASR
					if (code === "funasr-connect" || code === "mic-denied") {
						setError("无法访问麦克风或本地识别服务（" + code + "）");
						setRecording(false);
						return;
					}
					stopSession();
					if (SPEECH_RECOGNITION !== undefined && useWeb) {
						setError("识别出错：" + code + "，已切换本地 FunASR");
						startFunasrFallback();
					} else {
						setError("识别出错：" + code);
						setRecording(false);
					}
				};
				const onEnd = (finalText) => {
					if (finalText !== "") commitTail(finalText);
					setRecording(false);
					setPreview("");
				};

				function startFunasrFallback() {
					setEngineName("FunASR");
					try {
						engineRef.current = createFunasrEngine({
							url: funasrUrl,
							onInterim,
							// FunASR sends one finished sentence per final frame; append it directly.
							onFinal: (sentence) => appendToDraft(inputActions, draftRef.current, sentence),
							onError,
							// The server already flushed every sentence before the socket closes.
							onEnd: () => {}
						});
					} catch (e) {
						setError("本地 FunASR 不可用：" + (e && e.message ? e.message : String(e)));
						setRecording(false);
					}
				}

				if (useWeb) {
					setEngineName("Web Speech");
					try {
						engineRef.current = createWebSpeechEngine({
							onInterim,
							onFinal,
							onError,
							onEnd,
							lang: "zh-CN"
						});
					} catch (e) {
						startFunasrFallback();
					}
				} else {
					startFunasrFallback();
				}
				setRecording(true);
			}, [commitTail, stopSession]);

			const onClick = () => {
				if (recording) {
					setPreview("");
					stopSession();
					setRecording(false);
				} else {
					startSession();
				}
			};

			return react.createElement(
				react.Fragment,
				null,
				react.createElement("button", {
					type: "button",
					className: "dvi_btn",
					"data-recording": recording ? "true" : "false",
					title: recording ? "点击停止并写入输入框" : "语音输入（点击开始）",
					"aria-label": recording ? "停止语音输入" : "开始语音输入",
					onClick
				}, react.createElement("svg", {
					width: 16,
					height: 16,
					viewBox: "0 0 24 24",
					fill: "none",
					stroke: "currentColor",
					strokeWidth: 2,
					strokeLinecap: "round",
					strokeLinejoin: "round"
				},
					react.createElement("path", { d: "M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" }),
					react.createElement("path", { d: "M19 10v2a7 7 0 0 1-14 0v-2" }),
					react.createElement("line", { x1: 12, y1: 19, x2: 12, y2: 22 })
				)),
				recording && react.createElement("div", { className: "dvi_panel", "data-dsh-voice-panel": "" },
					react.createElement("div", { className: "dvi_panelHead" },
						react.createElement("span", { className: "dvi_dot" }),
						react.createElement("span", null, "正在聆听…"),
						react.createElement("span", { className: "dvi_engine" }, engineName)
					),
					react.createElement("div", { className: "dvi_text" }, preview !== "" ? preview : "…"),
					react.createElement("div", { className: "dvi_hint" }, "再次点击麦克风按钮结束并写入输入框"),
					error !== null && react.createElement("div", { className: "dvi_error" }, error)
				)
			);
		}
		//#endregion

		//#region plugin entry
		const inject = ["slots"];
		/**
		 * Client plugin body: register the mic button in the composer tool row.
		 * @param ctx - client root context.
		 */
		function apply(ctx) {
			ctx.slots.inject("conversation.input.left", () => ctx.slots.register({
				name: "conversation.input.left",
				id: "voice-input",
				order: 50,
				label: "Voice input"
			}, VoiceButton));
		}
		//#endregion

		exports.apply = apply;
		exports.inject = inject;
		exports.VoiceButton = VoiceButton;
		return module.exports;
	}
});
