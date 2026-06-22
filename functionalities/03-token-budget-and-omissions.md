# Functionality 03 — Token budget & omissions

**Stage:** `pack(...)` (budget pass) · **Type:** read-only · **Order:** during packing

## Purpose
Fit the bundle inside a model's context window on request — and when it can't fit everything,
**say so explicitly** rather than silently truncating. Every dropped file is named so a human or
agent can raise the budget or narrow the selection.

## Inputs
- The ordered file list (02), each carrying a token estimate.
- `--max-tokens N` (omit / `0` = no budget; include everything).

## Expected project structure
- None. Works on any selection.

## How it works (deterministic)
1. **Token estimate** = `ceil(chars / 4)` per file — a model-agnostic heuristic (English text
   averages ~4 chars/token). No network call, no tokenizer dependency, fully reproducible.
2. A small framing reserve (~200 tokens) is held back for the header + TOC.
3. Walk files in their established order, accumulating tokens. Include a file while the running
   total stays within `maxTokens − reserve`. Once a file would overflow, **stop including** and
   move it (and all subsequent files) to the omissions list — order is preserved, no backfilling
   of smaller later files (that would be order-dependent and surprising).
4. Edge case: if the very first file alone exceeds the budget, it is included anyway (so the
   bundle is never empty) and everything after it is omitted.

## Output
- `included[]`, `omitted[]`, and `tokens { included, total, budget }` — surfaced in the bundle as
  a summary line plus a dedicated **Omissions** section listing every dropped file with its
  estimate. The CLI prints the included/omitted counts.

## Safety
- Read-only. **No silent truncation** — omissions are always enumerated in the bundle.

## Failure modes it prevents
- A bundle that quietly drops the second half of a project, so an AI answers from a partial view
  without anyone realizing files were missing.
- Surprise context-window overflows when pasting a whole repo into one prompt.
