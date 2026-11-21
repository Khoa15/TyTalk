import os

# Vercel's filesystem is read-only except /tmp. Model caches (fastembed, huggingface_hub) must go there.
# Set before any submodule imports, because huggingface_hub reads HF_HOME at import time.
if os.environ.get("VERCEL"):
    os.environ.setdefault("HF_HOME", "/tmp/huggingface")
    os.environ.setdefault("FASTEMBED_CACHE_PATH", "/tmp/fastembed")
