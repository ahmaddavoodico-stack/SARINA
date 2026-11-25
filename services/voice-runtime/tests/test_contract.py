from pathlib import Path
from types import SimpleNamespace

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


def test_health_reports_persian_and_arabic_voice_slots():
    import asyncio

    result = asyncio.run(voice_runtime.health())
    assert result["whisper_languages"] == ["fa", "ar", "auto"]
    assert set(result["piper_models_configured"]) == {"fa", "ar"}


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
    assert result["language"] == "ar"
    assert result["transcript"] == "مرحبا"


def test_piper_uses_the_selected_voice_model(monkeypatch, tmp_path):
    model_path = tmp_path / "ar_JO-kareem-medium.onnx"
    model_path.write_bytes(b"model")
    output_path = tmp_path / "speech.wav"

    def fake_run(command, **kwargs):
        model_index = command.index("--model") + 1
        assert command[model_index] == str(model_path)
        Path(command[command.index("--output_file") + 1]).write_bytes(b"RIFF")
        return SimpleNamespace(returncode=0, stderr="", stdout="")

    monkeypatch.setattr(voice_runtime.subprocess, "run", fake_run)
    voice_runtime._synthesize_file("مرحبا", str(output_path), model_path)

    assert output_path.exists()
