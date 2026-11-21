# TyTalk — Technical Overview

TyTalk is a voice-enabled AI conversation app for children. A space-themed animated character, **Orb**, answers questions with grounded, age-appropriate replies, speaks them aloud, and reacts with synchronized visuals (states, images, simulations).

This document describes the system design, the engineering decisions behind it, and the problems solved while shipping it to production.

## 1. Architecture

```
Browser (React, Vite)                     Backend (FastAPI, Vercel Python)
 ├─ talk page + Orb animation             ├─ Auth: JWT access + rotating refresh tokens
 ├─ SSE parser → TimelinePlayer           ├─ Harness: router → planner → LLM stream
 │    (text, audio, visuals on one clock) │     → guardrails → timeline events
 └─ API client (VITE_API_BASE)            ├─ RAG: FAISS + BM25 over a PDF corpus
                                          ├─ TTS: tiny-voca (ONNX, CPU)
                                          └─ Persistence: Supabase (Postgres, RLS)
```

- **Frontend:** React 18, TypeScript, Vite, Zustand, React Router. Deployed on Vercel with an SPA rewrite.
- **Backend:** FastAPI on Python 3.12, deployed as a Vercel Python function. Local development runs in Docker Compose.
- **Data:** Supabase Postgres for users, personas (learned traits only) and refresh tokens. Conversations are never stored.

## 2. Key Design Decisions

### 2.1 Streaming protocol (Server-Sent Events)
`POST /api/v1/talk` streams typed events: `route`, `segment`, `text`, `audio`, `image`, `form`, `entity`, `sim`, `done`, `error`. Each event carries a relative timestamp (`at_ms`) and duration, so the client can schedule everything on one clock.

### 2.2 Timeline-driven playback
The frontend `TimelinePlayer` reveals text word-chunk by word-chunk over `[at_ms, at_ms + duration_ms]`, plays audio clips at their offsets, and switches visual states on the same clock. The clock is anchored on the first timed event, so network and server latency stay out of the schedule. Text is timed from the speech duration, so subtitles and voice stay in sync even when TTS is unavailable (the duration is estimated).

### 2.3 Harness: routing, guardrails and grounding
- **Router:** chooses a fast path for small talk and a planned path for multi-step questions.
- **Stream parser:** consumes the LLM's NDJSON output incrementally. Only whitelisted tags are allowed; stray prose and stage directions never reach TTS or subtitles.
- **Guardrails:** input guards refuse unsafe requests before the model is called; output guards check the streamed text against a canary token and refuse if it leaks. A refusal is still streamed as a normal reply.
- **Grounding (RAG):** answers draw on a local PDF corpus (NASA, ESA, Chandra). A hybrid retriever (FAISS dense search + BM25, fused by an ensemble) feeds the top chunks to the model. If the best similarity score is below a threshold, the model is told there is no evidence instead of guessing.
- **Persona learning:** after a reply starts streaming, a background task extracts a few whitelisted traits (for example preferred name or interests) from the user's message. Extracted data is sanitized and size-bounded before it is saved.

### 2.4 Provider-agnostic LLM layer
One OpenAI-compatible client covers OpenRouter, OpenAI, DeepSeek, Qwen, Gemini and others. Switching model or provider is configuration only. An Anthropic-native provider is available behind the same interface.

### 2.5 Authentication
- Passwords hashed with Argon2.
- Short-lived JWT access tokens (15 minutes).
- Refresh tokens are random, stored only as SHA-256 hashes, and rotated on every use. Replaying an old refresh token is rejected.
- Per-IP rate limits on auth and talk endpoints.

### 2.6 Persistence behind a `Store` boundary
Repositories talk to a `Store` protocol. `SupabaseStore` uses the Supabase client with the server-side secret key; an in-memory store runs the test suite without a network. The schema (`supabase/schema.sql`) enables Row Level Security on every table with no policies, so the publishable key can read nothing and only the server can write.

### 2.7 Local voice (TTS) and embeddings
- **TTS:** tiny-voca (ONNX, CPU) with the `dizione` phonemizer, bundled in the repo (about 26 MB). Synthesis for a sentence takes roughly 0.3 s on a laptop CPU. If the model or phonemizer fails to load, the app keeps streaming text without voice.
- **Embeddings:** fastembed with `all-MiniLM-L6-v2`, chosen for English-only content and CPU inference.

## 3. Quality

- **Backend tests:** 79 passing (auth isolation, rate limiting, token rotation, stream parser, guardrails, timeline timing, RAG grounding, follow-up handling).
- **Frontend tests:** 27 passing (SSE parsing, timeline player, transition graph, orb motion, sign-in flow).
- **RAG evaluation:** offline and harness-level eval scripts with a golden question set; RAGAS faithfulness scoring.
- **Static checks:** `tsc -b` type-checks the frontend before each build.

## 4. Production Problems Solved

| Problem | Root cause | Fix |
|---|---|---|
| Vercel function bundle over 500 MB | `pymupdf` pulled `pymupdf4llm`, `pymupdf-layout` and extra ONNX dependencies | Moved PDF tooling to an optional `ingest` extra used only for offline index builds. Installed runtime size dropped to about 378 MB. |
| Requests failing with 500 after deploy | `.gitignore` rule `models/` also matched `backend/app/models`, so the ORM models were never committed | Anchored the ignore rule to the repo root; verified with `git archive`. |
| Model download failing at runtime | Serverless filesystem is read-only except `/tmp`; Hugging Face cache defaulted to `~` | Redirect `HF_HOME` and `FASTEMBED_CACHE_PATH` to `/tmp` when running on Vercel. |
| Voice never playing | Git-only dependency (`dizione`) not installed in the Vercel build, so TTS silently stayed off | Vendored the 230 KB package into the repo; TTS init failure now degrades to text-only instead of failing the request. |
| Text not appearing although the stream was correct | Frontend removed the empty reply line as soon as the stream ended, before the timeline had revealed the text. Vercel delivers the stream in one burst, which exposed the race. | Keep the reply line until the timeline finishes; reproduced with the exact production frames in a unit test. |
| Deep links returning 404 | Single-page app without rewrites on Vercel | Added a `vercel.json` rewrite to `index.html`. |
| Database access on Vercel | SQLAlchemy with a direct Postgres connection needed pooler-safe settings (prepared statements rejected by the transaction pooler) and per-cold-start migrations | Moved persistence to Supabase behind a `Store` protocol, enabled RLS, and kept an in-memory store for tests. |

## 5. Stack Summary

- **Backend:** Python 3.12, FastAPI, Pydantic, Supabase client, Argon2, PyJWT, httpx, FAISS, rank-bm25, fastembed, ONNX Runtime, PyMuPDF (ingest only).
- **Frontend:** React 18, TypeScript, Vite, Zustand, React Router, Vitest, jsdom.
- **Infrastructure:** Vercel (two projects), Supabase (Postgres, RLS), Docker Compose (local), GitHub.
- **AI:** any OpenAI-compatible chat model; tiny-voca TTS; all-MiniLM-L6-v2 embeddings.
