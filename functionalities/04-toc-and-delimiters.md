# Functionality 04 — Table of contents & delimiters

**Stage:** `pack(...)` (framing) · **Type:** read-only · **Order:** during packing

## Purpose
Make the flattened bundle navigable. A single concatenated document is useless if you can't tell
where one file ends and the next begins, or get an at-a-glance map of what's inside and how big.
This adds a **table of contents** and unambiguous **per-file delimiters**.

## Inputs
- The included + omitted file lists (02/03), each with path and token estimate.

## Expected project structure
- None.

## How it works (deterministic)
1. **Table of contents** — a numbered table: `# · File · Tokens (est) · Status`, listing every
   included file (in bundle order) then every omitted file, so the TOC is a complete inventory.
2. **Delimiters** — each file body is wrapped in a clear fence:
   `===== <repo-relative path> =====` to open and `===== end <path> =====` to close. The path is
   the exact repo-relative posix path, so an AI can cite or re-split the bundle precisely.
3. Trailing blank lines inside each file body are trimmed to one, for stable inter-section spacing
   (keeps the bundle byte-identical across runs).
4. The delimiter token (`=====`) is configurable (`config.delim`).

## Output
- The TOC table + the fenced file sections that make up the body of the bundle (05).

## Safety
- Read-only.

## Failure modes it prevents
- An AI conflating the end of one file with the start of the next (no boundary markers).
- A human scrolling a 50-file bundle with no index of what's in it or how large each part is.
- Ambiguous citations ("which file was that snippet from?") — every section is path-labelled.
