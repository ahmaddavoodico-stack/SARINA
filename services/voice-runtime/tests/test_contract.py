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
