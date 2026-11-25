"""Standalone SARINA runner for the vendored Piper GPL component.

This process boundary keeps the GPL-licensed Piper engine separate from the
FastAPI service. The parent sends text over stdin and receives a WAV file.
"""
from __future__ import annotations

import argparse
import sys
import wave
from pathlib import Path

from piper import PiperVoice
from piper.phonemize_espeak import ESPEAK_DATA_DIR


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True)
    parser.add_argument("--output_file", required=True)
    args = parser.parse_args()

    model_path = Path(args.model)
    if not model_path.is_file():
        raise FileNotFoundError(f"Piper model not found: {model_path}")

    text = sys.stdin.read().strip()
    if not text:
        raise ValueError("No text provided for synthesis")

    voice = PiperVoice.load(model_path, espeak_data_dir=ESPEAK_DATA_DIR)
    with wave.open(args.output_file, "wb") as wav_file:
        voice.synthesize_wav(text, wav_file)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
