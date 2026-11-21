"""Offline ingest with LangChain: PDF -> pages -> chunks -> FAISS index on disk.

Run after the source PDFs or the embedding model change:
    PYTHONPATH=. .venv/bin/python -m app.harness.rag.ingest
"""

import hashlib
import json
from pathlib import Path

from langchain_community.document_loaders import PyMuPDFLoader
from langchain_community.embeddings import FastEmbedEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter

from app.core.config import Settings, get_settings
from app.harness.rag.paths import BACKEND_DIR, resolve

MANIFEST = "manifest.json"
INDEX_NAME = "corpus"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()


def load_pages(sources_dir: Path) -> tuple[list[Document], dict[str, str]]:
    """One Document per non-empty PDF page. Metadata: source (file stem), page (1-based)."""
    pages: list[Document] = []
    hashes: dict[str, str] = {}
    for path in sorted(sources_dir.glob("*.pdf")):
        hashes[path.name] = sha256(path)
        for doc in PyMuPDFLoader(str(path)).load():
            if not doc.page_content.strip():
                continue
            doc.metadata = {"source": path.stem, "page": int(doc.metadata.get("page", 0)) + 1}
            pages.append(doc)
    return pages, hashes


def split_pages(pages: list[Document], settings: Settings) -> list[Document]:
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=settings.rag_chunk_chars,
        chunk_overlap=settings.rag_chunk_overlap_chars,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    return splitter.split_documents(pages)


def embeddings(settings: Settings) -> FastEmbedEmbeddings:
    return FastEmbedEmbeddings(model_name=settings.rag_embed_model)


def build_index(settings: Settings | None = None) -> int:
    settings = settings or get_settings()
    sources_dir = resolve(settings.rag_sources_dir)
    index_dir = resolve(settings.rag_index_dir)

    pages, hashes = load_pages(sources_dir)
    if not pages:
        raise SystemExit(f"No text found under {sources_dir}")
    chunks = split_pages(pages, settings)

    store = FAISS.from_documents(chunks, embeddings(settings), normalize_L2=True)
    index_dir.mkdir(parents=True, exist_ok=True)
    store.save_local(str(index_dir), index_name=INDEX_NAME)

    manifest = {
        "embed_model": settings.rag_embed_model,
        "chunk_chars": settings.rag_chunk_chars,
        "chunk_overlap_chars": settings.rag_chunk_overlap_chars,
        "chunks": len(chunks),
        "sources": hashes,
    }
    (index_dir / MANIFEST).write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return len(chunks)


def main() -> None:
    count = build_index()
    print(f"Indexed {count} chunks under {BACKEND_DIR / get_settings().rag_index_dir}")


if __name__ == "__main__":
    main()
