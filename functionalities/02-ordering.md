# Functionality 02 — Ordering (reading / graph / path)

**Stage:** `order(files, mode, ctx)` · **Type:** read-only · **Order:** after 01

## Purpose
Serialize the selected file tree/graph into ONE linear sequence. The order an AI reads a project
in matters: this is the "linearization" — turning a tree (or a cross-reference graph) into a
single top-to-bottom document. Three modes cover the common intents.

## Inputs
- The file census from 01.
- `--order reading|graph|path` (default `reading`).
- Context: the entry-contract files (`CLAUDE.md` / `AGENTS.md`) and `MANIFEST.json` if present.

## Expected project structure
- `reading` mode rewards an entry contract that names a reading order and/or a `MANIFEST.json`
  with a sequence; degrades gracefully to lexical order when neither exists.
- `graph` mode rewards markdown that cross-links (a doc linking to the docs it builds on).

## How it works (deterministic)
**`reading` (default)** — front-load the curated order, then append the rest lexically:
1. The entry-contract files themselves (`CLAUDE.md`, `AGENTS.md`), in config order.
2. Paths referenced by the entry contract, **in document order** (markdown links `](target)` and
   backticked `dir/file` tokens).
3. Paths named by `MANIFEST.json` (any string value / `path` field), resolved relative to the
   manifest's directory.
4. Every remaining file, lexical by path. (Each file is emitted once; first mention wins.)

**`graph`** — topological order of markdown by cross-reference:
1. Build edges `a → b` for every link from doc `a` to a collected doc `b`.
2. Deterministic DFS post-order (dependencies visited first, sorted lexically) so a doc comes
   **after** the docs it links to. Back-edges (cycles) are skipped to break them deterministically.
3. Non-markdown files keep lexical order, appended after the markdown layer.

**`path`** — plain lexical path order (the census order from 01).

## Output
An ordered array of files, passed to packing.

## Safety
- Read-only. Unknown `--order` values are rejected by the CLI.

## Failure modes it prevents
- Feeding an AI a project in arbitrary filesystem order, so foundational docs arrive after the
  documents that assume them.
- Non-determinism from unordered directory reads or set iteration (everything is sorted).
