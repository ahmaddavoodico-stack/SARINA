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
    assert result["piper_engine_source"] == "SARINA-vendored-Piper-subprocess"


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


def test_piper_uses_vendored_runner_and_selected_local_voice(monkeypatch, tmp_path):
    model_path = tmp_path / "ar_JO-kareem-medium.onnx"
    model_path.write_bytes(b"model")
    output_path = tmp_path / "speech.wav"
    calls = {}

    def fake_run(command, **kwargs):
        calls["command"] = command
        calls["input"] = kwargs["input"]
        assert voice_runtime.PIPER_CLI_PATH.is_file()
        model_index = command.index("--model") + 1
        output_index = command.index("--output_file") + 1
        assert command[model_index] == str(model_path)
        with wave.open(command[output_index], "wb") as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(22050)
            wav_file.writeframes(bytes(128))
        return SimpleNamespace(returncode=0, stderr="", stdout="")

    monkeypatch.setattr(voice_runtime.subprocess, "run", fake_run)
    voice_runtime._synthesize_file("مرحبا", str(output_path), model_path)

    assert calls["input"] == "مرحبا"
    assert str(voice_runtime.PIPER_CLI_PATH) in calls["command"]
    with wave.open(str(output_path), "rb") as wav_file:
        assert wav_file.getnframes() == 64
