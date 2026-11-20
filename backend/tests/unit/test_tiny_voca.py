import io
import wave

import pytest

from app.harness.tts.tiny_voca import is_english


def test_english_text_is_voiced_and_vietnamese_is_not():
    assert is_english("Hello there, how are you?")
    assert not is_english("Chào bạn, hôm nay bạn thế nào?")


def test_wav_helper_writes_mono_16bit_24khz():
    np = pytest.importorskip("numpy")

    from app.harness.tts.tiny_voca import to_wav_bytes

    data = to_wav_bytes(np.zeros(2400, dtype=np.float32))
    with wave.open(io.BytesIO(data)) as w:
        assert (w.getnchannels(), w.getsampwidth(), w.getframerate()) == (1, 2, 24000)
        assert w.getnframes() == 2400
