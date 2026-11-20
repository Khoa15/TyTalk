"""Answer-quality evaluation of the live API with RAGAS.

Calls POST /api/v1/talk for every non-blocked golden case, then judges the spoken text
with an LLM (RAGAS). Visual cases use the image captions as retrieved context for faithfulness.

Needs: the API running (localhost:8000), LLM_API_KEY/LLM_BASE_URL/LLM_MODEL in the environment
(the same provider as the app is used as judge; this is self-judging, so treat scores as a trend).
Run from backend/:  python tests/eval/run_ragas.py [--limit N]
"""

import argparse
import json
import os
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path

API = os.environ.get("EVAL_API", "http://localhost:8000/api/v1")
HERE = Path(__file__).parent
REPORTS = HERE / "reports"


def _post(path: str, body: dict, token: str | None = None) -> tuple[int, bytes]:
    req = urllib.request.Request(API + path, data=json.dumps(body).encode(), method="POST")
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            return resp.status, resp.read()
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read()


def signup_token() -> str:
    email = f"eval-{uuid.uuid4().hex[:8]}@example.com"
    status, body = _post("/auth/signup", {"email": email, "password": "correct-horse-1", "display_name": "Eval"})
    assert status == 201, body
    return json.loads(body)["access_token"]


def talk(token: str, message: str) -> dict:
    """Returns the spoken text, image captions and the raw event names."""
    status, raw = _post("/talk", {"message": message, "recent": []}, token)
    if status != 200:
        return {"status": status, "reply": "", "captions": [], "events": []}
    events, reply, captions = [], [], []
    event = None
    for line in raw.decode("utf-8").splitlines():
        if line.startswith("event: "):
            event = line[7:]
        elif line.startswith("data: ") and event:
            data = json.loads(line[6:])
            events.append(event)
            if event == "text":
                reply.append(data["delta"])
            if event == "image":
                captions.append(data["caption"])
            event = None
    return {"status": status, "reply": "".join(reply).strip(), "captions": captions, "events": events}


def judge_llm():
    from langchain_openai import ChatOpenAI
    from ragas.llms import LangchainLLMWrapper

    llm = ChatOpenAI(
        base_url=os.environ["LLM_BASE_URL"],
        api_key=os.environ["LLM_API_KEY"],
        model=os.environ["LLM_MODEL"],
        temperature=0,
    )
    return LangchainLLMWrapper(llm)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=0)
    args = parser.parse_args()

    rows = [json.loads(l) for l in (HERE / "golden.jsonl").read_text(encoding="utf-8").splitlines() if l.strip()]
    rows = [r for r in rows if not r["should_block"]]
    if args.limit:
        rows = rows[: args.limit]

    token = signup_token()
    answers = []
    for row in rows:
        result = talk(token, row["input"])
        answers.append({"id": row["id"], "category": row["category"], "input": row["input"],
                        "reference": row["reference"], **result})
        print(f"{row['id']} {row['category']:<18} status={result['status']} reply={result['reply'][:60]!r}", flush=True)
        time.sleep(0.5)

    REPORTS.mkdir(exist_ok=True)
    (REPORTS / "answers.jsonl").write_text("\n".join(json.dumps(a, ensure_ascii=False) for a in answers), encoding="utf-8")

    from ragas import EvaluationDataset, evaluate
    from ragas.dataset_schema import SingleTurnSample
    from ragas.metrics import AspectCritic, Faithfulness

    llm = judge_llm()
    samples = [
        SingleTurnSample(
            user_input=a["input"],
            response=a["reply"] or "(no reply)",
            retrieved_contexts=a["captions"] or None,
            reference=a["reference"],
        )
        for a in answers
    ]
    metrics = [
        AspectCritic(
            name="relevant_reply",
            definition="Does the response directly and helpfully answer or respond to the user's message?",
            llm=llm,
        ),
        AspectCritic(
            name="no_stage_directions",
            definition="Is the response free of stage directions or action descriptions such as *waves* or (smiles)?",
            llm=llm,
        ),
        AspectCritic(
            name="english_only",
            definition="Is the response written in English?",
            llm=llm,
        ),
    ]
    # Faithfulness needs retrieved context: only visual turns (image captions) have it.
    visual_idx = [i for i, a in enumerate(answers) if a["captions"]]
    result = evaluate(EvaluationDataset(samples=samples), metrics=metrics, llm=llm, raise_exceptions=False)
    df = result.to_pandas()
    df.to_csv(REPORTS / "ragas_scores.csv", index=False)

    summary = {}
    for col in ["relevant_reply", "no_stage_directions", "english_only"]:
        if col in df:
            summary[col] = float(df[col].dropna().mean()) if df[col].notna().any() else None
    if visual_idx:
        faith = evaluate(
            EvaluationDataset(samples=[samples[i] for i in visual_idx]),
            metrics=[Faithfulness(llm=llm)], llm=llm, raise_exceptions=False,
        ).to_pandas()
        summary["faithfulness_visual"] = float(faith["faithfulness"].dropna().mean()) if faith["faithfulness"].notna().any() else None
        faith.to_csv(REPORTS / "ragas_faithfulness.csv", index=False)
    summary["cases"] = len(answers)
    summary["visual_cases"] = len(visual_idx)
    (REPORTS / "summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
