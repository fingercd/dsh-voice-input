# dsh-voice-input — DSH Web 语音输入插件

给 DeepSeek Harness Web GUI（dsh web）的输入框加一个麦克风按钮：
点击开始**流式语音识别**（边说边出字），再点结束，识别文本自动写入输入框。

## 引擎架构（准确 × 速度）

| 引擎 | 来源 | 速度 | 准确度 | 依赖 |
|---|---|---|---|---|
| **Web Speech API**（默认） | 浏览器原生（Chrome/Edge 内置服务） | 最快：边录边实时出字，零部署 | 好（服务商云端识别） | 无 |
| **本地 FunASR**（自动回退/可选） | [alibaba-damo-academy/FunASR](https://github.com/alibaba-damo-academy/FunASR)（阿里达摩院，中文 ASR 事实标准，15k+ star） | 快：GPU 流式（本机 CUDA 实时率 <0.1） | **最高**：Paraformer-large-online 中文 SOTA | Python + CUDA |

引擎选择逻辑：
1. 浏览器支持 `SpeechRecognition` → 用 Web Speech API（最快）
2. 识别报错（如 Chrome 国内无法连 Google 服务）→ **自动回退**本地 FunASR
3. 可用 `localStorage` 强制指定（见下文）

## 安装

```powershell
# 1. 克隆/下载本仓库后，安装插件包到 web profile（已装过可跳过）
dsh plugin --profile web add "<本仓库克隆路径>"

# 2. roster 注册（已做过：~/.dsh/profiles/web/cordis.patch.yml 已含 voice-input 行）
#    新环境需在 cordis.patch.yml 的 insert 列表追加：
#     - id: voice-input
#       name: 'dsh-voice-input'

# 3. 重启 dsh web（client 插件在启动时动态加载，无需重建前端）
```

## 本地 FunASR 引擎（可选，准确度优先）

```powershell
# 安装依赖（一次性，需 Python 3.10+ 且已装 torch/torchaudio，建议带 CUDA 的环境）
powershell -ExecutionPolicy Bypass -File scripts/install_funasr.ps1

# 启动服务（首次自动下载 paraformer-large-online 模型 ~840MB，之后秒启）
python scripts/funasr_server.py
# 可选: --port 8899 --device cuda:0（默认自动检测 GPU）
```

前端配置（localStorage，浏览器控制台执行）：
```js
localStorage.setItem("dsh.voice.input.engine", "auto");      // auto | webspeech | funasr
localStorage.setItem("dsh.voice.input.funasrUrl", "ws://127.0.0.1:8899/ws");
```

## 开发

- `lib/index.js` — 宿主侧（node）：空 apply，仅保证进入 Loader roster
- `lib/client.js` — 浏览器侧 bundle：手写 `window.__ModuleLoader__.load` 格式（与官方 tsdown 产物同构），零构建步骤；修改后**重启 dsh web** 生效
- 注册点：`conversation.input.left` slot（composer 工具行左端）；通过 owner props `useInput/inputActions` 读写 draft，不深依赖 client-runtime

### FunASR 流式协议（服务端 ↔ 前端）

```
c→s {"type":"start","lang":"zh"}   · binary Int16 PCM @16kHz mono（首块 960ms，此后 320ms 增量）
c→s {"type":"end"}
s→c {"type":"partial","text":累计转写} · {"type":"final","text":新增句} · {"type":"ok"} · {"type":"error","message"}
```

## 验证

```bash
# 浏览器端（Playwright + 系统 Chrome）：按钮渲染、点击状态、无 console 错误
node work/verify-plugin.mjs
node work/verify-interaction.mjs
# FunASR 端到端（真实中文 TTS 语音 → 流式识别）
python work/test_funasr_e2e.py
```

## 已知限制

- Web Speech API 在 Chrome 上依赖 Google 云服务（国内网络不可用时自动回退 FunASR）；Edge 走 Azure 国内可用
- FunASR 流式（online 模型）对长句首字有 ~1s 延迟（960ms 预热），符合流式模型特性；如需极致准确可换 2pass 模式（服务端扩展）
- draft 写入策略：识别句**实时追加**到输入框末尾，不会覆盖用户正在编辑的文本
