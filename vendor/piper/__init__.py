"""Vendored Piper inference API; the native extension and voice data are supplied by piper-tts."""
from pkgutil import extend_path

# Keep the SARINA-vendored Python engine first while exposing the installed
# piper-tts distribution's native espeakbridge extension and packaged data.
__path__ = extend_path(__path__, __name__)

from .config import PhonemeType, PiperConfig, SynthesisConfig
from .voice import AudioChunk, PiperVoice

__all__ = [
    "AudioChunk",
    "PhonemeType",
    "PiperConfig",
    "PiperVoice",
    "SynthesisConfig",
]
