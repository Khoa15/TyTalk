"""Hybrid retrieval with LangChain: BM25 + FAISS dense, fused by RRF, optionally reranked.

An empty result means "no evidence": the caller must refuse instead of answering from memory.
The gate is the top dense cosine similarity (rag_min_score), not the reranker score.
"""

import re
from dataclasses import dataclass
from functools import lru_cache
from typing import Any, Sequence

import numpy as np
from pydantic import PrivateAttr

from langchain_classic.retrievers import ContextualCompressionRetriever, EnsembleRetriever
from langchain_community.retrievers import BM25Retriever
from langchain_community.vectorstores import FAISS
from langchain_core.callbacks import Callbacks
from langchain_core.documents import BaseDocumentCompressor, Document
from langchain_core.retrievers import BaseRetriever

from app.core.config import Settings, get_settings
from app.harness.rag.ingest import INDEX_NAME, embeddings
from app.harness.rag.paths import resolve

_WORD = re.compile(r"\w+", re.UNICODE)
_BM25_WEIGHT = 0.5
_DENSE_WEIGHT = 0.5


@dataclass(frozen=True)
class Evidence:
    source: str
    page: int
    text: str

    def citation(self) -> str:
        return f"{self.source} p.{self.page}"


def tokenize(text: str) -> list[str]:
    """Unicode word tokens, lowercased. Keeps Vietnamese diacritics intact."""
    return [t for t in _WORD.findall(text.lower()) if len(t) > 1]


class FastEmbedReranker(BaseDocumentCompressor):
    """Cross-encoder reranking through fastembed. Keeps the top_k documents by score."""

    model_name: str
    top_k: int
    _encoder: Any = PrivateAttr(default=None)

    def model_post_init(self, __context: Any) -> None:
        from fastembed.rerank.cross_encoder import TextCrossEncoder

        self._encoder = TextCrossEncoder(model_name=self.model_name)

    def compress_documents(
        self, documents: Sequence[Document], query: str, callbacks: Callbacks | None = None
    ) -> Sequence[Document]:
        if not documents:
            return []
        scores = list(self._encoder.rerank(query, [d.page_content for d in documents]))
        ranked = sorted(zip(scores, documents), key=lambda pair: -pair[0])[: self.top_k]
        out = []
        for score, doc in ranked:
            out.append(Document(page_content=doc.page_content, metadata={**doc.metadata, "rerank_score": float(score)}))
        return out


class CorpusRetriever:
    """Loads the FAISS index and builds the hybrid chain once per process."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        store = FAISS.load_local(
            str(resolve(settings.rag_index_dir)),
            embeddings(settings),
            index_name=INDEX_NAME,
            allow_dangerous_deserialization=True,  # index is built locally by ingest.py, never user input
        )
        self.store = store
        self.hybrid: BaseRetriever
        self._embedder = embeddings(settings)
        # Re-normalise every stored vector ourselves: some index vectors are not unit length,
        # which inflates inner-product scores above 1. The gate uses this matrix only.
        raw = store.index.reconstruct_n(0, store.index.ntotal)
        self._unit = raw / np.clip(np.linalg.norm(raw, axis=1, keepdims=True), 1e-12, None)
        docs = list(store.docstore._dict.values())  # every chunk, for BM25

        k = settings.rag_candidates
        bm25 = BM25Retriever.from_documents(docs, k=k, preprocess_func=tokenize)
        dense = store.as_retriever(search_kwargs={"k": k})
        base: BaseRetriever = EnsembleRetriever(retrievers=[bm25, dense], weights=[_BM25_WEIGHT, _DENSE_WEIGHT])

        if settings.rag_rerank_model:
            compressor = FastEmbedReranker(model_name=settings.rag_rerank_model, top_k=settings.rag_top_k)
            self.chain: BaseRetriever = ContextualCompressionRetriever(base_compressor=compressor, base_retriever=base)
        else:
            self.chain = base
        self.hybrid = base

    def top_similarity(self, query: str) -> float:
        """Cosine similarity of the best dense match, in [-1, 1]."""
        vec = np.asarray(self._embedder.embed_query(query), dtype=np.float32)
        vec /= max(float(np.linalg.norm(vec)), 1e-12)
        return float(np.max(self._unit @ vec))

    def retrieve(self, query: str) -> list[Evidence]:
        if not query.strip():
            return []
        if self.top_similarity(query) < self._settings.rag_min_score:
            return []  # no document is close enough: refuse instead of guessing
        docs = self.chain.invoke(query)[: self._settings.rag_top_k]
        return [Evidence(d.metadata["source"], int(d.metadata["page"]), d.page_content) for d in docs]


@lru_cache(maxsize=1)
def default_retriever() -> CorpusRetriever:
    return CorpusRetriever(get_settings())
