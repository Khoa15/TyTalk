<!-- CODEGRAPH_START -->
## CodeGraph

In repositories indexed by CodeGraph (a `.codegraph/` directory exists at the repo root), reach for it BEFORE grep/find or reading files when you need to understand or locate code:

- **MCP tool** (when available): `codegraph_explore` answers most code questions in one call — the relevant symbols' verbatim source plus the call paths between them, including dynamic-dispatch hops grep can't follow. Name a file or symbol in the query to read its current line-numbered source. If it's listed but deferred, load it by name via tool search.
- **Shell** (always works): `codegraph explore "<symbol names or question>"` prints the same output.

If there is no `.codegraph/` directory, skip CodeGraph entirely — indexing is the user's decision.
<!-- CODEGRAPH_END -->

## Language

This project focuses on **English only**: the UI copy, the Orb replies, the RAG corpus and the models.
- Use the English embedding model `sentence-transformers/all-MiniLM-L6-v2` for RAG (`RAG_EMBED_MODEL`). Do not switch to a multilingual model unless the user asks.
- Write new documentation, prompts and eval questions in English.
