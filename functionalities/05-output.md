# Functionality 05 — Output

**Stage:** `pack(...)` → CLI write · **Type:** writes ONE file · **Order:** last

## Purpose
Assemble the header, table of contents (04), omissions list (03), and ordered file sections into
**one** bundle and write it to a single destination. This is the deliverable: a whole project (or
a layer of it) in one file you can paste into an AI prompt or read top-to-bottom.

## Inputs
- The packed result (header + TOC + omissions + fenced sections).
- `--out <file>` (default: `LINEARIZED.md` at the repo root).

## Expected project structure
- None. The output is a fresh file; nothing in the source tree is modified.

## How it works (deterministic)
1. Header: title, the order mode, the documented token heuristic, the budget (if any), and a
   one-line summary (`included / omitted / token totals`).
2. Then the TOC, then the Omissions section (only if any), then `## Files` with each fenced section.
3. The whole bundle is joined and its trailing newlines normalized to exactly one, so two runs on
   an unchanged repo produce a **byte-identical** file.
4. The CLI writes the bundle to `--out` (creating parent dirs) and prints a one-line summary.
   The pure core (`lib/run.mjs`) never writes — only the CLI does — so the pipeline stays testable.

## Output
- A single Markdown bundle (default `LINEARIZED.md`). No JSON/HTML siblings: the bundle *is* the
  AI-source artifact; a human can read the same `.md`.

## Safety
- Writes exactly one file at the requested path; read-only otherwise. Prefer `--out /tmp/<name>.md`
  to avoid overwriting an existing bundle in place.

## Failure modes it prevents
- Scattered multi-file output that defeats the point (one-prompt ingestion).
- Non-deterministic bundles (timestamps/random in the body) that churn diffs — the body contains
  no clock or random state.
