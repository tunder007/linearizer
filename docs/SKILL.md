# Linearizer — skill specification (AI-optimized)

> **Source of truth for this skill.** This `.md` is written for AI agents (dense, machine-parseable).
> The human view is [`README.html`](./README.html), generated from this file. Per project
> convention: **`.md` = AI optimization, `.html` = human view.**

The Linearizer flattens **any repository's AI-source** into a SINGLE ordered, token-budgeted
bundle with a table of contents — so a whole project (or one layer) can be fed to an AI in one
prompt, or read top-to-bottom by a human. "Linearization" = serializing a tree/graph into one
ordered document.

- **Status:** built (self-test passing)
- **Targets:** Claude Code · Codex · Cursor (one source of truth, three shells)
- **Dependencies:** none (zero-dependency Node.js ≥18)

---

## 1. What it does (functionalities)

A pipeline of **5 functionalities**, each documented under [`functionalities/`](./functionalities/)
on a uniform schema (Purpose · Inputs · Expected project structure · How it works · Output ·
Safety · Failure modes it prevents).

| # | Functionality | Stage |
|---|---|---|
| 01 | [File selection](./functionalities/01-file-selection.md) | `collect()` |
| 02 | [Ordering (reading/graph/path)](./functionalities/02-ordering.md) | `order()` |
| 03 | [Token budget & omissions](./functionalities/03-token-budget-and-omissions.md) | `pack()` |
| 04 | [TOC & delimiters](./functionalities/04-toc-and-delimiters.md) | `pack()` |
| 05 | [Output](./functionalities/05-output.md) | `pack()` → write |

The pure core is `collect(root,opts) → files` → `order(files,mode,ctx)` → `pack(files,opts) →
{bundle, toc, included, omitted, tokens}`, all in [`scripts/lib/run.mjs`](./scripts/lib/run.mjs).

---

## 2. Expected input

| Input | Required | Default | Notes |
|---|---|---|---|
| Target repo path | no | current working directory | The root to flatten. |
| `--out <file>` | no | `LINEARIZED.md` at repo root | The single output bundle. |
| `--max-tokens N` | no | none (include all) | Budget; over-budget files are omitted + listed. |
| `--include <glob>` | no | — | Add paths beyond the default AI-source set (repeatable). |
| `--exclude <glob>` | no | — | Remove paths (repeatable). |
| `--order reading\|graph\|path` | no | `reading` | Ordering mode (see §4). |

**Invocation per agent**
- **Claude Code:** `/linearizer [path] [flags]` (Skill tool).
- **Codex:** read the `AGENTS.md` reference → run `scripts/linearize.mjs [path] [flags]`.
- **Cursor:** rule `linearizer.mdc` → same script.

The skill is **read-only** apart from writing the one output bundle.

---

## 3. Selection policy

**Included by default** (`config.includeExt`): markdown/text/data (`.md .mdc .txt .rst .json
.jsonc .yaml .yml .toml`) and common code (`.ts .tsx .js .jsx .mjs .cjs .py .rb .go .rs .java .c
.h .cpp .hpp .cs .php .sh .sql .css .scss`).

**Always excluded** (`config.excludeExt`): `.html`/`.htm` (the human view, per the md/html
convention), images, fonts, media, archives, lockfiles, and other binaries. A NUL-byte check
drops any file that is binary regardless of its extension. `node_modules/`, `.git/`, `.next/`,
`dist/`, `build/`, … directories are never walked.

`--include` / `--exclude` globs are additive on top of this policy. The skill's own install
directory is auto-excluded (it won't bundle itself).

---

## 4. Ordering modes

- **`reading` (default).** If an entry contract (`CLAUDE.md`/`AGENTS.md`) and/or `MANIFEST.json`
  exist, order by the reading order / manifest sequence first (entry docs → referenced docs in
  document order → manifest-named files), then remaining files by path. This reproduces the
  curated reading order a human would intend.
- **`graph`.** Topologically order markdown by their cross-reference links: a doc comes **after**
  the docs it links to where possible. Cycles are broken deterministically (lexical). This is
  graph linearization — foundational/leaf docs first.
- **`path`.** Plain lexical path order.

All three are deterministic (every sort is stable; sets are iterated in sorted order).

---

## 5. Output (the bundle)

One Markdown file (default `LINEARIZED.md`), structured as:

1. **Header** — title, order mode, the token heuristic, budget (if any), and a one-line
   `included / omitted / tokens` summary.
2. **Table of contents** — numbered table `# · File · Tokens (est) · Status` covering every
   included *and* omitted file.
3. **Omissions** (only if a budget dropped files) — every omitted file named with its estimate.
   **No silent truncation.**
4. **Files** — each file body wrapped in `===== <path> =====` … `===== end <path> =====`.

**Token estimate** = `ceil(chars / 4)` — a documented, model-agnostic heuristic (no tokenizer
dependency, fully reproducible).

```text
# LINEARIZED — <repo>
> Order mode: reading · Token estimate = ceil(chars / 4) · .md flattened; .html/binaries excluded.
Files included: 5 · omitted (budget): 0 · included tokens (est): 121 / total 121.

## Table of contents
| # | File | Tokens (est) | Status |
...
## Files
===== docs/a.md =====
...
===== end docs/a.md =====
```

A sample is committed under [`example-output/LINEARIZED.md`](./example-output/LINEARIZED.md).

---

## 6. Determinism guarantees

- **Reproducible:** same repo state + same options → byte-identical bundle. No `Date`/random in
  the bundle body.
- **Stable ordering:** directory reads, link/manifest resolution, and graph traversal all sort
  before iterating.
- **Read-only:** writes exactly one bundle; never mutates the source tree.

---

## 7. Acceptance criteria

- [x] `.html` and binaries excluded; AI-source included; `--include`/`--exclude` honored.
- [x] Three order modes; `reading` honors entry contract + manifest; `graph` topo-orders by links.
- [x] `--max-tokens` stops at the budget and lists every omitted file (no silent drop).
- [x] Bundle has a TOC, per-file `=====` delimiters, and a documented token estimate.
- [x] Two runs on an unchanged repo produce an identical bundle.

---

## 8. Build status & how to run

- ✅ This spec + 5 functionality docs + human [`README.html`](./README.html).
- ✅ **Implementation:** [`scripts/`](./scripts/) — zero-dependency Node.js. Pure core
  `lib/run.mjs` (`collect`/`order`/`pack`), the file collector `lib/walk.mjs`, helpers
  `lib/util.mjs`, default policy `config.default.mjs`, and the `linearize.mjs` CLI.
- ✅ **Cross-tool shells:** `.claude/skills/linearizer/SKILL.md` and
  `.cursor/rules/linearizer.mdc` (Codex reads the same via `AGENTS.md`).
- ✅ **Self-test:** `node scripts/self-test.mjs` — offline, builds a fixture in
  `/tmp/skill-linearizer-selftest`, asserts selection, ordering (reading + graph), budget +
  omissions, TOC/delimiters, and byte-identical determinism, then cleans up. **SELF-TEST PASSED.**

```bash
node tasks/skill-linearizer/scripts/linearize.mjs <repo> [--out <file>] [--max-tokens N] \
     [--include <glob>] [--exclude <glob>] [--order reading|graph|path]
node tasks/skill-linearizer/scripts/self-test.mjs
```

## References
- [`example-output/LINEARIZED.md`](./example-output/LINEARIZED.md) — sample bundle.
- [`scripts/config.default.mjs`](./scripts/config.default.mjs) — include/exclude policy + defaults.
