"""Retrieval eval for the RAG corpus. No LLM calls.

Run from backend/ after building the index and the eval set:
    PYTHONPATH=. .venv/bin/python -m app.harness.rag.ingest
    PYTHONPATH=. .venv/bin/python tests/eval/build_rag_eval.py
    PYTHONPATH=. .venv/bin/python tests/eval/run_rag_eval.py

Compares three retrieval modes on the positive rows (does a top-k chunk contain the gold phrase?)
and reports the dense cosine separation between answerable and off-topic questions.
"""

import json
from pathlib import Path

import numpy as np
from langchain_core.documents import Document

from app.core.config import get_settings
from app.harness.rag.retriever import CorpusRetriever, FastEmbedReranker

EVAL = Path(__file__).with_name("rag_eval.json")
RERANK_MODEL = "jinaai/jina-reranker-v2-base-multilingual"


def hit(row: dict, doc: Document) -> bool:
    return any(
        g["source"] == doc.metadata.get("source") and g["phrase"].lower() in doc.page_content.lower()
        for g in row["gold"]
    )


def main() -> None:
    settings = get_settings()
    retriever = CorpusRetriever(settings)
    reranker = FastEmbedReranker(model_name=RERANK_MODEL, top_k=settings.rag_top_k)
    rows = json.loads(EVAL.read_text(encoding="utf-8"))
    positives = [r for r in rows if r["kind"] == "positive"]
    negatives = [r for r in rows if r["kind"] == "negative"]
    k = settings.rag_top_k

    recall = {m: {1: 0, k: 0} for m in ("dense", "hybrid", "hybrid+rerank")}
    misses: dict[str, list[str]] = {m: [] for m in recall}
    for row in positives:
        query = row["input"]
        hybrid = retriever.hybrid.invoke(query)
        modes = {
            "dense": retriever.store.similarity_search(query, k=k),
            "hybrid": hybrid[:k],
            "hybrid+rerank": reranker.compress_documents(hybrid, query),
        }
        for mode, docs in modes.items():
            for cut in (1, k):
                if any(hit(row, d) for d in docs[:cut]):
                    recall[mode][cut] += 1
            if not any(hit(row, d) for d in docs[:k]):
                misses[mode].append(row["id"])

    n = len(positives)
    print(f"Positives: {n}, top-k = {k}")
    for mode, counts in recall.items():
        print(f"  {mode:14s} recall@1={counts[1] / n:.2f}  recall@{k}={counts[k] / n:.2f}  missed={misses[mode]}")

    pos_cos = [retriever.top_similarity(r["input"]) for r in positives]
    neg_cos = [retriever.top_similarity(r["input"]) for r in negatives]
    print(f"\nTop-1 cosine, positives: min={min(pos_cos):.3f} median={np.median(pos_cos):.3f}")
    print(f"Top-1 cosine, negatives ({len(negatives)}): max={max(neg_cos):.3f} median={np.median(neg_cos):.3f}")
    for threshold in (0.3, 0.4, 0.5, 0.6):
        kept_neg = sum(c >= threshold for c in neg_cos)
        kept_pos = sum(c >= threshold for c in pos_cos)
        print(f"  threshold {threshold:.1f}: positives answered {kept_pos}/{n}, negatives wrongly answered {kept_neg}/{len(negatives)}")


if __name__ == "__main__":
    main()
