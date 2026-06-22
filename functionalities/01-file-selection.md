# Functionality 01 — File selection

**Stage:** `collect(root, config, opts)` · **Type:** read-only · **Order:** first

## Purpose
Decide which files become part of the single bundle. Include a repository's **AI-source / text**
(markdown, plain text, structured data, code) and exclude everything that would waste an AI's
context window or break the bundle — chiefly the **`.html` human views** (per the md/html
convention) and **binaries** (images, fonts, archives, media).

## Inputs
- Target repo root.
- Default include/exclude extension sets (`config.includeExt` / `config.excludeExt`).
- Optional `--include <glob>` / `--exclude <glob>` (repeatable, additive).

## Expected project structure
- Works on any tree. No required layout.
- Rewards a repo where `.md` is the AI source and `.html` is the generated human view: the
  linearizer flattens the `.md` layer and drops the `.html` twin automatically.

## How it works (deterministic)
1. Walk the tree depth-first, entries sorted lexically; skip `config.ignoreDirs`
   (`.git`, `node_modules`, `.next`, `dist`, `build`, …) and `config.ignoreFiles` (lockfiles, `.DS_Store`).
2. Drop any file whose extension is in `excludeExt` (`.html`, images, fonts, media, archives, lockfiles).
3. Drop any path matching an `--exclude` glob.
4. Keep a file if it matches an `--include` glob **or** its extension is in `includeExt`
   (`.md/.mdc/.txt/.json/.yaml/.toml` + common code: `.ts/.tsx/.js/.mjs/.py/.go/.rs/…`).
5. Binary safety net: read each candidate as UTF-8; if the read fails or the content contains a
   NUL byte, drop it (it is binary regardless of extension).
6. Return files sorted lexically by path, each annotated with `{ path, ext, size, text, tokens }`.

## Output
The file census consumed by ordering (02) and packing (04/05). No files written.

## Safety
- Read-only. The skill's own install directory is excluded so a repo that vendors the linearizer
  never bundles the linearizer.

## Failure modes it prevents
- An AI ingesting both `feature.md` and its rendered `feature.html` (double content, drift risk).
- A binary blob (PNG/PDF/font) corrupting the bundle or burning the token budget on noise.
- `node_modules` / build output flooding the bundle.
