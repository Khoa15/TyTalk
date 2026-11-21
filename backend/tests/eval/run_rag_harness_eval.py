"""End-to-end RAG eval: real harness (retrieval -> grounded LLM reply) on rag_eval.json, scored with RAGAS.

Run from the repo root (so .env is found):
    PYTHONPATH=backend RAG_MIN_SCORE=0.45 backend/.venv/bin/python backend/tests/eval/run_rag_harness_eval.py

Writes tests/eval/reports/rag_harness_eval.json. Judge = the app's own LLM (self-judging: read the
RAGAS scores as a trend, not as an absolute truth).

Expected behaviour:
- positive rows: answered from the corpus (not refused), and a retrieved passage holds the gold phrase.
- negative rows, science-off-topic: refused or deflected, no substantive answer.
- greeting rows: a friendly reply (not a refusal).
- injection rows: refused by the input guard.
"""

import asyncio
import json
import re
import sys
from pathlib import Path

from app.api.deps import get_harness
from app.core.config import get_settings
from app.harness.facade import NO_EVIDENCE_TEXT, UserContext, is_greeting
from app.harness.rag.retriever import default_retriever

HERE = Path(__file__).resolve().parent
EVAL = HERE / "rag_eval.json"
REPORT = HERE / "reports" / "rag_harness_eval.json"

REFUSAL_MARKERS = re.compile(
    r"not sure about that|only answer|only answers|can't help|can.t help|science question instead|"
    r"ask me about|do you have a science question",
    re.IGNORECASE,
)


async def answer(message: str) -> tuple[str, str]:
    """Returns (route, spoken text) from the real harness pipeline."""
    route, parts = None, []
    async for evt in get_harness().respond(UserContext(user_id=0, traits={}), message, []):
        name, data = evt.get("event"), evt.get("data", {})
        if name == "route":
            route = data.get("route")
        elif name == "text":
            parts.append(data.get("delta", ""))
        elif name == "error":
            parts.append(f"[error] {data.get('code')}")
    return route, "".join(parts).strip()


def is_refusal(text: str) -> bool:
    return bool(REFUSAL_MARKERS.search(text)) or text.startswith("I can't help")


def hit(gold: list[dict], passages: list) -> bool:
    return any(
        g["source"] == p.source and g["phrase"].lower() in p.text.lower()
        for g in gold for p in passages
    )


def run_harness(rows: list[dict]) -> list[dict]:
    retriever = default_retriever()
    out = []
    for row in rows:
        route, text = asyncio.run(answer(row["input"]))
        contexts = retriever.retrieve(row["input"]) if not is_greeting(row["input"]) else []
        out.append({
            "id": row["id"],
            "kind": row["kind"],
            "category": row.get("category", "science"),
            "question": row["input"],
            "route": route,
            "answer": text,
            "refused": is_refusal(text) or text == NO_EVIDENCE_TEXT,
            "contexts": [c.text for c in contexts],
            "gold_hit": hit(row["gold"], contexts) if row["kind"] == "positive" else None,
        })
        print(f"{row['id']:5s} {row['kind']:8s} refused={out[-1]['refused']!s:5s} {row['input'][:60]}", flush=True)
    return out


class _PlainEmbeddings:
    """Thin adapter. RAGAS telemetry reads a `model` attribute, and the LangChain wrapper exposes
    the fastembed object there, which fails validation and turns answer relevancy into NaN."""

    def __init__(self, inner) -> None:
        self._inner = inner

    def embed_query(self, text: str) -> list[float]:
        return [float(x) for x in self._inner.embed_query(text)]

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return [[float(x) for x in v] for v in self._inner.embed_documents(texts)]


def ragas_scores(rows: list[dict]) -> dict:
    """Faithfulness and answer relevancy over the rows that were answered from evidence."""
    from langchain_community.embeddings import FastEmbedEmbeddings
    from langchain_openai import ChatOpenAI
    from ragas import evaluate
    from ragas.dataset_schema import EvaluationDataset, SingleTurnSample
    from ragas.embeddings import LangchainEmbeddingsWrapper
    from ragas.llms import LangchainLLMWrapper
    from ragas.metrics import AnswerRelevancy, Faithfulness

    settings = get_settings()
    llm = LangchainLLMWrapper(ChatOpenAI(
        base_url=settings.llm_base_url, api_key=settings.llm_api_key, model=settings.llm_model, temperature=0,
    ))
    emb = LangchainEmbeddingsWrapper(_PlainEmbeddings(FastEmbedEmbeddings(model_name=settings.rag_embed_model)))

    answered = [r for r in rows if r["contexts"] and not r["refused"] and r["answer"]]
    if not answered:
        return {"note": "no answered rows with contexts"}
    dataset = EvaluationDataset(samples=[
        SingleTurnSample(user_input=r["question"], response=r["answer"], retrieved_contexts=r["contexts"])
        for r in answered
    ])
    result = evaluate(dataset, metrics=[Faithfulness(llm=llm), AnswerRelevancy(llm=llm, embeddings=emb)])
    frame = result.to_pandas()
    per_row = {}
    for r, (_, score) in zip(answered, frame.iterrows()):
        per_row[r["id"]] = {
            "faithfulness": float(score["faithfulness"]),
            "answer_relevancy": float(score["answer_relevancy"]),
        }
    return {
        "n": len(answered),
        "faithfulness_mean": float(frame["faithfulness"].mean()),
        "answer_relevancy_mean": float(frame["answer_relevancy"].mean()),
        "per_row": per_row,
    }


def summarise(rows: list[dict]) -> dict:
    pos = [r for r in rows if r["kind"] == "positive"]
    neg = [r for r in rows if r["kind"] == "negative" and r["category"] not in ("greeting", "injection")]
    greet = [r for r in rows if r["category"] == "greeting"]
    inj = [r for r in rows if r["category"] == "injection"]
    return {
        "positives_answered": f"{sum(not r['refused'] for r in pos)}/{len(pos)}",
        "positives_gold_retrieved": f"{sum(bool(r['gold_hit']) for r in pos)}/{len(pos)}",
        "offtopic_refused": f"{sum(r['refused'] for r in neg)}/{len(neg)}",
        "greetings_answered": f"{sum(not r['refused'] for r in greet)}/{len(greet)}",
        "injections_refused": f"{sum(r['refused'] for r in inj)}/{len(inj)}",
    }


def main() -> None:
    if "--ragas-only" in sys.argv:
        # Re-score the answers and contexts already saved in the report, without calling the harness.
        saved = json.loads(REPORT.read_text(encoding="utf-8"))
        results, summary = saved["rows"], saved["summary"]
    else:
        rows = json.loads(EVAL.read_text(encoding="utf-8"))
        results = run_harness(rows)
        summary = summarise(results)
    print("\nSUMMARY", json.dumps(summary, ensure_ascii=False))
    scores = ragas_scores(results)
    print("RAGAS", json.dumps({k: v for k, v in scores.items() if k != "per_row"}, ensure_ascii=False))
    REPORT.parent.mkdir(exist_ok=True)
    REPORT.write_text(json.dumps({"summary": summary, "ragas": scores, "rows": results},
                                 ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {REPORT}")


if __name__ == "__main__":
    main()
