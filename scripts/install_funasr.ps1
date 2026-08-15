# dsh-voice-input — FunASR 本地引擎安装脚本（可选）
# 用 python 环境安装 funasr（中文语音识别 SOTA 开源方案，阿里达摩院）
# 用法: powershell -ExecutionPolicy Bypass -File scripts/install_funasr.ps1
# 要求: Python 3.10+，推荐已装 torch+torchaudio 且带 CUDA 的环境
#       （可用环境变量 CONDA_PYTHON 指定解释器完整路径）

$ErrorActionPreference = "Stop"

if ($env:CONDA_PYTHON -and (Test-Path $env:CONDA_PYTHON)) {
    $Py = $env:CONDA_PYTHON
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
    $Py = (Get-Command python).Source
} else {
    throw "未找到 python，请设置 CONDA_PYTHON 环境变量指向解释器完整路径"
}
Write-Host "使用解释器: $Py" -ForegroundColor Cyan

Write-Host "==> 安装 funasr（模型运行时依赖 modelscope/torchaudio 会自动带上）" -ForegroundColor Cyan
& $Py -m pip install --upgrade funasr
if ($LASTEXITCODE -ne 0) { throw "funasr 安装失败" }

Write-Host "==> 安装 soundfile（音频 IO 兜底）" -ForegroundColor Cyan
& $Py -m pip install soundfile
if ($LASTEXITCODE -ne 0) { throw "soundfile 安装失败" }

Write-Host "==> 验证 import" -ForegroundColor Cyan
& $Py -c "import funasr; print('funasr', funasr.__version__)"

Write-Host ""
Write-Host "安装完成。首次启动 funasr_server.py 时会自动从 ModelScope 下载 paraformer-zh-streaming 模型（约 840MB）。" -ForegroundColor Green
