from pathlib import Path
from types import ModuleType, SimpleNamespace
import sys
import wave

import app.main as voice_runtime
from app.main import APP_VERSION, MAX_AUDIO_BYTES, MAX_AUDIO_SECONDS, MAX_TEXT_CHARS, app


def test_service_contract_is_versioned_and_bounded():
    assert APP_VERSION
    assert MAX_AUDIO_BYTES <= 25 * 1024 * 1024
    assert 1 <= MAX_AUDIO_SECONDS <= 180
    assert 100 <= MAX_TEXT_CHARS <= 10000


def test_only_health_and_versioned_voice_routes_are_exposed():
    routes = {(method, route.path) for route in app.routes for method in (getattr(route, "methods", None) or set())}
    assert ("GET", "/healthz") in routes
    assert ("POST", "/v1/transcribe") in routes
    assert ("POST", "/v1/synthesize") in routes
    assert not any(path.startswith("/admin") for _, path in routes)


def test_health_reports_local_vendored_engines_and_voice_slots():
    import asyncio

    result = asyncio.run(voice_runtime.health())
    assert result["whisper_languages"] == ["fa", "ar", "auto"]
    assert set(result["piper_models_configured"]) == {"fa", "ar"}
    assert result["whisper_model_source"] == "local-vendored-code-and-local-weights"
    assert result["piper_engine_source"] == "SARINA-vendored-Piper"


def test_vendored_upstream_source_and_licenses_are_present():
    root = Path(__file__).resolve().parents[3]
    required = [
        "vendor/faster_whisper/transcribe.py",
        "vendor/faster_whisper/tokenizer.py",
        "vendor/faster_whisper/LICENSE",
        "vendor/piper/voice.py",
        "vendor/piper/phonemize_espeak.py",
        "vendor/piper/COPYING",
        "vendor/VOICE_ENGINE_NOTICES.md",
    ]
    assert all((root / path).is_file() for path in required)


def test_whisper_uses_multilingual_mode_and_language_hint(monkeypatch):
    fake_info = SimpleNamespace(language="ar", language_probability=0.98, duration=2.5)
    fake_segment = SimpleNamespace(text="مرحبا")

    class FakeModel:
        def transcribe(self, path, **kwargs):
            self.kwargs = kwargs
            return iter([fake_segment]), fake_info

    model = FakeModel()
    monkeypatch.setattr(voice_runtime, "_get_whisper_model", lambda: model)

    result = voice_runtime._transcribe_file("/tmp/sample.wav", "ar")

    assert model.kwargs["language"] == "ar"
    assert model.kwargs["multilingual"] is True
    assert model.kwargs["vad_filter"] is False
    assert result["language"] == "ar"
    assert result["transcript"] == "مرحبا"


def test_piper_uses_vendored_api_and_selected_local_voice(monkeypatch, tmp_path):
    model_path = tmp_path / "ar_JO-kareem-medium.onnx"
    model_path.write_bytes(b"model")
    output_path = tmp_path / "speech.wav"
    calls = {}

    class FakeVoice:
        def synthesize_wav(self, text, wav_file):
            calls["text"] = text
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(22050)
            wav_file.writeframes(bytes(128))

    class FakePiperVoice:
        @staticmethod
        def load(path, espeak_data_dir):
            calls["path"] = Path(path)
            calls["espeak_data_dir"] = espeak_data_dir
            return FakeVoice()

    piper_module = ModuleType("piper")
    piper_module.PiperVoice = FakePiperVoice
    phonemizer_module = ModuleType("piper.phonemize_espeak")
    phonemizer_module.ESPEAK_DATA_DIR = tmp_path
    monkeypatch.setitem(sys.modules, "piper", piper_module)
    monkeypatch.setitem(sys.modules, "piper.phonemize_espeak", phonemizer_module)
    monkeypatch.setattr(voice_runtime, "_piper_voices", {})

    voice_runtime._synthesize_file("مرحبا", str(output_path), model_path)

    assert calls["path"] == model_path
    assert calls["text"] == "مرحبا"
    with wave.open(str(output_path), "rb") as wav_file:
        assert wav_file.getnframes() == 64
