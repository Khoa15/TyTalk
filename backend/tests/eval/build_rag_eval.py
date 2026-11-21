"""Build rag_eval.json from golden.jsonl plus space questions with verified gold pages.

Run from backend/:  PYTHONPATH=. .venv/bin/python tests/eval/build_rag_eval.py
Writes rag_eval.json (a JSON array). All questions are in English.

Positives: a question, a source document and a phrase that must appear on the gold page.
The page is resolved from the PDF text, and the build fails if the phrase is missing.
Negatives: golden.jsonl rows that are off-topic for the corpus, plus injections.
"""

import json
from pathlib import Path

import fitz

HERE = Path(__file__).resolve().parent
SOURCES = HERE.parents[1] / "data" / "rag" / "sources"
GOLDEN = HERE / "golden.jsonl"
OUT = HERE / "rag_eval.json"

# (id, question, lang, source, phrase on the gold page)
POSITIVES = [
    ("r01", "Why does the Moon look different from night to night?", "en", "nasa_spotlite_moon_phases_4-8", "phase"),
    ("r02", "How does the Moon change shape?", "en", "nasa_spotlite_moon_phases_4-8", "phase"),
    ("r03", "What makes day and night happen?", "en", "esa_astronomy_primary_en", "days and nights"),
    ("r04", "Why do we have day and night?", "en", "esa_astronomy_primary_en", "days and nights"),
    ("r05", "What is a black hole made of?", "en", "chandra_black_hole_primer", "black hole"),
    ("r06", "What is a black hole?", "en", "chandra_black_hole_primer", "black hole"),
    ("r07", "How does the Moon block the light of the Sun?", "en", "esa_astronomy_primary_en", "eclipse"),
    ("r08", "What is a solar eclipse?", "en", "esa_astronomy_primary_en", "eclipse"),
    ("r09", "What is the Milky Way?", "en", "esa_astronomy_primary_en", "galax"),
    ("r10", "How many planets are in our solar system?", "en", "esa_our_solar_system_teacher_guide", "eight"),
    ("r11", "How do rockets launch into space?", "en", "chandra_fun_pad", "rocket"),
    ("r12", "What keeps the planets moving around the Sun?", "en", "esa_our_solar_system_teacher_guide", "gravity"),
    ("r13", "Where do new stars come from?", "en", "chandra_hot_stories_6-11", "Birth of a Star"),
    ("r14", "How are stars born?", "en", "chandra_hot_stories_6-11", "Birth of a Star"),
]

# Off-topic golden rows used as negatives: no document in the corpus should answer these.
NEGATIVE_CATEGORIES = {"greeting", "small_talk", "factual_fast", "injection", "visual_animal", "visual_history"}


def find_page(source: str, phrase: str) -> int:
    with fitz.open(SOURCES / f"{source}.pdf") as doc:
        for number, page in enumerate(doc, start=1):
            if phrase.lower() in page.get_text("text").lower():
                return number
    raise SystemExit(f"Gold phrase {phrase!r} not found in {source}. Fix the eval row.")


def main() -> None:
    rows = []
    for rid, question, lang, source, phrase in POSITIVES:
        rows.append({
            "id": rid,
            "kind": "positive",
            "lang": lang,
            "input": question,
            "gold": [{"source": source, "page": find_page(source, phrase), "phrase": phrase}],
        })

    for line in GOLDEN.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        golden = json.loads(line)
        if golden["category"] not in NEGATIVE_CATEGORIES:
            continue
        rows.append({
            "id": golden["id"],
            "kind": "negative",
            "lang": "en",
            "category": golden["category"],
            "input": golden["input"],
            "gold": [],
        })

    OUT.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    positives = sum(1 for r in rows if r["kind"] == "positive")
    print(f"Wrote {len(rows)} rows to {OUT.name}: {positives} positive, {len(rows) - positives} negative")


if __name__ == "__main__":
    main()
