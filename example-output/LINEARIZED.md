# LINEARIZED — lz-ex

> Single-bundle linearization of `lz-ex` for one-prompt ingestion or top-to-bottom reading.
> Order mode: **reading** · Token estimate = ceil(chars / 4) · `.md` source flattened; `.html`/binaries excluded.

Files included: **5** · omitted (budget): **0** · included tokens (est): **121** / total **121**.

## Table of contents

| # | File | Tokens (est) | Status |
|---:|---|---:|---|
| 1 | `CLAUDE.md` | 53 | included |
| 2 | `docs/a.md` | 26 | included |
| 3 | `docs/b.md` | 22 | included |
| 4 | `code/x.ts` | 5 | included |
| 5 | `MANIFEST.json` | 15 | included |

## Files

===== CLAUDE.md =====

# Example project — entry contract

Reading order: start with [docs/a.md](docs/a.md), then [docs/b.md](docs/b.md),
and finally the code in `code/x.ts`. The `.md` files are AI-source; `.html` is the human view.

===== end CLAUDE.md =====

===== docs/a.md =====

# Doc A — overview

This document depends on [Doc B](b.md). Read B first for the shared definitions.

===== end docs/a.md =====

===== docs/b.md =====

# Doc B — definitions

Leaf document. Defines the vocabulary used across the project.

===== end docs/b.md =====

===== code/x.ts =====

export const x = 1;

===== end code/x.ts =====

===== MANIFEST.json =====

{
  "sequence": ["docs/a.md", "docs/b.md", "code/x.ts"]
}

===== end MANIFEST.json =====
