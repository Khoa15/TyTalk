"""Local text-to-speech with tiny-voca (ONNX, CPU). English only.

Non-ASCII text (e.g. Vietnamese) returns None: the subtitle still shows, but no audio is made.
The model reads one utterance per call, so callers pass short sentences.
"""

import io
import os
import threading
import wave
from pathlib import Path
from typing import Any

SAMPLE_RATE = 24000
MAX_CHARS = 250


def is_english(text: str) -> bool:
    return text.isascii()


def to_wav_bytes(audio: Any) -> bytes:
    import numpy as np

    pcm = (np.clip(audio, -1.0, 1.0) * 32767).astype("<i2")
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(SAMPLE_RATE)
        wav.writeframes(pcm.tobytes())
    return buf.getvalue()


class TinyVocaSynth:
    def __init__(self, model_dir: str, voice: int = 0) -> None:
        import onnxruntime as ort
        import numpy as np  # noqa: F401

        base = Path(model_dir)
        os.environ.setdefault("DIZIONE_DATA", str(base / "phonemizer"))
        import dizione  # imported after DIZIONE_DATA is set

        self._dizione = dizione
        self._voice = voice  # 0 = F2 (female), 1 = M2 (male)
        self._session = ort.InferenceSession(
            str(base / "onnx" / "model.onnx"), providers=["CPUExecutionProvider"]
        )
        self._lock = threading.Lock()

    def synthesize(self, text: str) -> tuple[int, bytes] | None:
        """Returns (duration_ms, WAV bytes), or None when the text cannot be voiced."""
        text = text.strip()[:MAX_CHARS]
        if not text or not is_english(text):
            return None
        if text[-1] not in ".!?":
            text += "."  # the model cuts the last word off without an end mark

        import numpy as np

        phones = self._dizione.phonemize(text)
        one = lambda value: np.array([value], dtype=np.float32)  # noqa: E731
        with self._lock:
            audio, _ = self._session.run(
                None,
                {
                    "tokens": np.array([phones.ids], dtype=np.int64),
                    "stress": np.array([phones.stress], dtype=np.int64),
                    "voice": np.array([self._voice], dtype=np.int64),
                    "speed": one(1.0),
                    "pitch_shift": one(0.0),
                    "pitch_range": one(1.0),
                },
            )
        audio = audio[0]
        peak = float(np.abs(audio).max()) if audio.size else 0.0
        if peak == 0.0:
            return None
        audio = audio * min(1.0, 0.99 / peak)  # the model can peak slightly above 1.0
        duration_ms = int(len(audio) * 1000 / SAMPLE_RATE)
        return duration_ms, to_wav_bytes(audio)
