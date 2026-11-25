# Vendored voice engine notices

SARINA vendors the Python inference source for two upstream engines. The pinned revisions below are the source of the files in this directory.

## faster-whisper

- Upstream: https://github.com/SYSTRAN/faster-whisper
- Pinned upstream tree: `6cb639e70786aea42b9233006ae60eaf07190bdb`
- License: MIT; see `faster_whisper/LICENSE`.
- Files are retained with their upstream notices. SARINA's model/runtime integration is maintained separately.
- Runtime backend: CTranslate2, installed as a binary Python dependency (not vendored here).

## Piper

- Upstream: https://github.com/OHF-Voice/piper1-gpl
- Pinned upstream tree: `6aacdbc98eda4b1cb81d960bef7c7fae710b13fd`
- License: GNU GPL version 3 or later; see `piper/COPYING`.
- The vendored Python inference modules are executed by the standalone `vendor/piper_cli.py` process. The FastAPI service invokes this runner over stdin/output files rather than importing the Piper library into its own process.
- `piper/__init__.py` extends the package path so the native phonemizer extension and packaged espeak-ng/tashkeel data from the installed `piper-tts` distribution remain available.
- The vendored `piper/phonemize_espeak.py` resolves the packaged espeak-ng data directory from the extended package path.
- The Piper native extension, ONNX Runtime and phonemizer data are installed as runtime dependencies; their source/binaries are not duplicated here.

## Model assets

The Whisper Small CTranslate2 model and Persian/Arabic Piper voice models are separate model assets, not engine source code. They are kept outside Git in SARINA's mounted model directory because of their size. Provision them once, then the runtime loads them from local paths without model downloads during inference.

## Compliance note

Piper is GPL-3.0-or-later. The Piper component is distributed under GPL-3.0-or-later, with its source and license included here. It is invoked as a separate local process; whether a particular product distribution is an independent aggregation or a combined work depends on how it is packaged and distributed. Preserve this component boundary and its source/license notices, and obtain legal review before distributing a proprietary bundle. This notice is informational, not legal advice.
