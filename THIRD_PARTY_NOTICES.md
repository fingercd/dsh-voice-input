# Third-Party Notices

`dsh-voice-input` builds on the following open-source projects and models.
Their licenses and copyright notices are reproduced below as required by the
respective terms (MIT requires retaining the copyright notice; Apache-2.0
requires a NOTICE-style attribution).

| Component | Used for | License | Copyright |
|---|---|---|---|
| [FunASR](https://github.com/modelscope/FunASR) | Local streaming ASR engine (`scripts/funasr_server.py`) | [MIT](#funasr---mit-license) | © 2025 FunASR |
| [paraformer-zh-streaming](https://huggingface.co/funasr/paraformer-zh-streaming) | ASR model weights (auto-downloaded from ModelScope) | [Apache-2.0](#paraformer-zh-streaming-model---apache-20) | © Alibaba DAMO Academy |
| [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) | Host platform — plugin architecture, slot system, loader API | [MIT](#deepseek-harness---mit-license) | © DeepSeek |
| [Lucide](https://lucide.dev) | Mic icon path design (ISC) | [ISC](#lucide---isc-license) | © Lucide Contributors |

The browser **Web Speech API** is a web standard (W3C / WHATWG) implemented by
the browser vendor (Google Chrome / Microsoft Edge); it imposes no third-party
license obligations on this project.

---

## FunASR — MIT License

```
MIT License
Copyright (c) 2025 FunASR

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## paraformer-zh-streaming model — Apache-2.0

The streaming model weights (`speech_paraformer-large_asr_nat-zh-cn-16k-common-vocab8404-online`)
are distributed under the **Apache License 2.0** per the official model card
([HuggingFace](https://huggingface.co/funasr/paraformer-zh-streaming) /
[ModelScope](https://modelscope.cn/models/iic/speech_paraformer-large_asr_nat-zh-cn-16k-common-vocab8404-online)).
The full license text is available at
<https://www.apache.org/licenses/LICENSE-2.0>.

## DeepSeek Harness — MIT License

```
MIT License
Copyright (c) DeepSeek

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Lucide — ISC License

The mic icon path used in the browser bundle is derived from the Lucide icon
set. Lucide is licensed under the ISC License:

```
ISC License

Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part
of Feather (MIT). All other copyright (c) for Lucide are held by Lucide
Contributors.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
```
