from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[3]


def resolve(path: str) -> Path:
    """Relative paths in settings are relative to backend/; absolute paths are used as given."""
    p = Path(path)
    return p if p.is_absolute() else BACKEND_DIR / p
