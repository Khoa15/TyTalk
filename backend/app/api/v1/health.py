from pathlib import Path

from fastapi import APIRouter

from app.core.config import get_settings

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict[str, object]:
    settings = get_settings()
    model_file = Path(settings.tts_model_dir) / "onnx" / "model.onnx"
    return {
        "status": "ok",
        "api_version": "1",
        # Diagnostics for voice: is TTS enabled, and is the bundled model file present at runtime?
        "tts_enabled": settings.tts_enabled,
        "tts_model_file_exists": model_file.exists(),
        "tts_model_dir": settings.tts_model_dir,
    }
