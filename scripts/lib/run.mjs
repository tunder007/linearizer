// Core pipeline: collect → order → pack. Pure (no file writes, no console, no Date/random),
// so it is reusable by the CLI (linearize.mjs) and the self-test. Deterministic: the same repo
// state + options always yields a byte-identical bundle.
import { fileURLToPath } from "node:url";
import { fs, path, posix, cmp, readText, estTokens } from "./util.mjs";
import { collect } from "./walk.mjs";
import { DEFAULT_CONFIG } from "../config.default.mjs";

// The skill's own install directory (parent of scripts/), excluded so a repo that contains the
// linearizer does not bundle the linearizer.
export const SELF_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export const ORDER_MODES = ["reading", "graph", "path"];

// ---------------------------------------------------------------------------
// ORDERING
// ---------------------------------------------------------------------------

// reading: entry-contract reading order + MANIFEST.json sequence first, then remaining by path.
function orderReading(files, ctx) {
  const byPath = new Map(files.map((f) => [f.path, f]));
  const seq = []; const seen = new Set();
  const take = (rel) => { const f = byPath.get(rel); if (f && !seen.has(rel)) { seen.add(rel); seq.push(f); } };

  // 1) The entry contract itself comes first (CLAUDE.md / AGENTS.md), in config order.
  for (const e of ctx.config.entryFiles) take(e);

  // 2) Paths referenced (in document order) by the entry contract — its reading order.
  for (const e of ctx.config.entryFiles) {
    const body = readText(path.join(ctx.root, e));
    if (body) for (const ref of refsInOrder(body)) if (byPath.has(ref)) take(ref);
  }

  // 3) MANIFEST.json sequence: any string values / `path` fields that name a collected file.
  for (const name of ctx.config.indexNames) {
    const mf = findManifest(files, name);
    if (!mf) continue;
    let json; try { json = JSON.parse(byPath.get(mf).text); } catch { json = null; }
    if (json) for (const ref of manifestPaths(json, posix(path.dirname(mf)))) if (byPath.has(ref)) take(ref);
  }

  // 4) Everything else, lexical by path (files is already sorted).
  for (const f of files) if (!seen.has(f.path)) seq.push(f);
  return seq;
}

// Markdown link targets in document order: ](target) and bare `path/with/slash` in backticks.
function refsInOrder(body) {
  const out = []; let m;
  const link = /\]\(([^)\s]+)\)/g;
  while ((m = link.exec(body))) out.push(normRef(m[1]));
  const tick = /`([A-Za-z0-9._\-/]+\/[A-Za-z0-9._\-/]+)`/g;
  while ((m = tick.exec(body))) out.push(normRef(m[1]));
  return out;
}
const normRef = (r) => posix(r.replace(/^\.\//, "").replace(/[#?].*$/, "").replace(/\/+$/, ""));

function findManifest(files, name) {
  const hit = files.find((f) => f.path === name || f.path.endsWith("/" + name));
  return hit ? hit.path : null;
}
// Collect candidate file paths from a manifest, resolved relative to the manifest's dir.
function manifestPaths(json, baseDir) {
  const out = [];
  const visit = (v, key) => {
    if (typeof v === "string") {
      const s = normRef(v);
      if (/[\/.]/.test(s) && /\.[a-z0-9]+$/i.test(s)) {
        out.push(s);
        if (baseDir && baseDir !== ".") out.push(posix(path.join(baseDir, s)));
      }
    } else if (Array.isArray(v)) v.forEach((x) => visit(x, key));
    else if (v && typeof v === "object") for (const k of Object.keys(v)) visit(v[k], k);
  };
  visit(json, null);
  return out;
}

// graph: topologically order markdown by cross-reference links — a doc comes AFTER the docs it
// links to where possible. Cycles broken deterministically (by lexical path). Non-markdown keeps
// lexical order, appended after the markdown layer.
function orderGraph(files) {
  const md = files.filter((f) => f.ext === "md" || f.ext === "mdc");
  const other = files.filter((f) => !(f.ext === "md" || f.ext === "mdc"));
  const set = new Set(md.map((f) => f.path));

  // edges: a -> b means "a links to b" (so b must come before a).
  const deps = new Map(md.map((f) => [f.path, new Set()]));
  for (const f of md) {
    for (const ref of refsInOrder(f.text)) {
      const target = resolveRef(f.path, ref, set);
      if (target && target !== f.path) deps.get(f.path).add(target);
    }
  }

  // Deterministic DFS post-order (Tarjan-style cycle tolerance): visit deps (sorted) first.
  const order = []; const state = new Map(); // 0=unvisited,1=on-stack,2=done
  const visit = (node) => {
    state.set(node, 1);
    for (const dep of [...deps.get(node)].sort(cmp)) {
      const st = state.get(dep) || 0;
      if (st === 0) visit(dep);
      // st === 1 → back-edge (cycle): skip to break it deterministically.
    }
    state.set(node, 2);
    order.push(node);
  };
  for (const p of md.map((f) => f.path).sort(cmp)) if ((state.get(p) || 0) === 0) visit(p);

  const byPath = new Map(files.map((f) => [f.path, f]));
  return [...order.map((p) => byPath.get(p)), ...other];
}

// Resolve a link/ref to a collected markdown path: try as-is, then relative to the source dir.
function resolveRef(fromPath, ref, set) {
  if (set.has(ref)) return ref;
  const rel = posix(path.normalize(path.join(path.dirname(fromPath), ref)));
  if (set.has(rel)) return rel;
  return null;
}

// path: plain lexical order (files already sorted in collect()).
function orderPath(files) { return files.slice(); }

export function order(files, mode, ctx) {
  if (mode === "reading") return orderReading(files, ctx);
  if (mode === "graph") return orderGraph(files);
  return orderPath(files);
}

// ---------------------------------------------------------------------------
// PACKING
// ---------------------------------------------------------------------------

const fence = (delim, label) => `${delim} ${label} ${delim}`;

// pack(orderedFiles, opts) → { bundle, toc, included, omitted, tokens }.
// Greedy budget: include files in order until maxTokens would be exceeded, then STOP and record
// every remaining file under omissions (no silent truncation). maxTokens=0/undefined = no budget.
export function pack(ordered, opts, ctx) {
  const delim = ctx.config.delim;
  const max = opts.maxTokens || 0;
  const HEADER_BUDGET = 200; // reserve a little for the header/TOC framing when budgeting

  const included = []; const omitted = [];
  let used = 0;
  for (const f of ordered) {
    const cost = f.tokens;
    if (max && used + cost > Math.max(0, max - HEADER_BUDGET) && included.length > 0) {
      omitted.push(f);
    } else if (max && cost > Math.max(0, max - HEADER_BUDGET) && included.length === 0) {
      // First file alone exceeds budget: include it (can't make progress otherwise) and stop.
      included.push(f); used += cost;
    } else if (omitted.length === 0) {
      included.push(f); used += cost;
    } else {
      omitted.push(f); // once we start omitting, keep order stable (no backfilling smaller files)
    }
  }

  const totalTokens = ordered.reduce((s, f) => s + f.tokens, 0);
  const incTokens = included.reduce((s, f) => s + f.tokens, 0);

  // --- Header ---
  const L = [];
  L.push(`# LINEARIZED — ${ctx.target}`);
  L.push("");
  L.push(`> Single-bundle linearization of \`${ctx.target}\` for one-prompt ingestion or top-to-bottom reading.`);
  L.push(`> Order mode: **${opts.mode}** · Token estimate = ceil(chars / 4) · \`.md\` source flattened; \`.html\`/binaries excluded.`);
  if (max) L.push(`> Token budget: **${max}** (reserved ~${HEADER_BUDGET} for framing).`);
  L.push("");
  L.push(`Files included: **${included.length}** · omitted (budget): **${omitted.length}** · included tokens (est): **${incTokens}** / total **${totalTokens}**.`);
  L.push("");

  // --- Table of contents ---
  L.push("## Table of contents");
  L.push("");
  L.push("| # | File | Tokens (est) | Status |");
  L.push("|---:|---|---:|---|");
  let n = 0;
  for (const f of included) L.push(`| ${++n} | \`${f.path}\` | ${f.tokens} | included |`);
  for (const f of omitted) L.push(`| ${++n} | \`${f.path}\` | ${f.tokens} | omitted |`);
  L.push("");

  // --- Omissions list (explicit; never silent) ---
  if (omitted.length) {
    L.push(`## Omissions (${omitted.length}) — over token budget, NOT silently dropped`);
    L.push("");
    for (const f of omitted) L.push(`- \`${f.path}\` (~${f.tokens} tokens)`);
    L.push("");
    L.push(`_Raise \`--max-tokens\` or narrow \`--include\` to bring these in._`);
    L.push("");
  }

  // --- File sections ---
  L.push("## Files");
  L.push("");
  for (const f of included) {
    L.push(fence(delim, f.path));
    L.push("");
    L.push(f.text.replace(/\n*$/, "")); // trim trailing blank lines for stable spacing
    L.push("");
    L.push(fence(delim, `end ${f.path}`));
    L.push("");
  }

  const bundle = L.join("\n").replace(/\n+$/, "\n");
  const toc = included.concat(omitted).map((f, i) => ({ n: i + 1, path: f.path, tokens: f.tokens, status: omitted.includes(f) ? "omitted" : "included" }));
  return { bundle, toc, included, omitted, tokens: { included: incTokens, total: totalTokens, budget: max || null } };
}

// ---------------------------------------------------------------------------
// TOP-LEVEL
// ---------------------------------------------------------------------------

// linearize(root, opts) → { target, files, ordered, bundle, toc, included, omitted, tokens, mode }.
// opts: { mode, maxTokens, include[], exclude[] }. Deterministic.
export function linearize(root, opts = {}) {
  const config = { ...DEFAULT_CONFIG };
  const mode = ORDER_MODES.includes(opts.mode) ? opts.mode : "reading";

  // Exclude the skill's own directory if the target contains it (don't bundle the bundler).
  const selfRel = posix(path.relative(root, SELF_DIR));
  const extraExclude = [];
  if (selfRel && !selfRel.startsWith("..") && !path.isAbsolute(selfRel)) extraExclude.push(selfRel + "/**");

  const collectOpts = {
    include: opts.include || [],
    exclude: [...(opts.exclude || []), ...extraExclude],
  };
  const files = collect(root, config, collectOpts);

  const target = path.basename(root);
  const ctx = { root, config, target };
  const ordered = order(files, mode, ctx);
  const packOpts = { mode, maxTokens: opts.maxTokens || 0 };
  const packed = pack(ordered, packOpts, ctx);

  return { target, files, ordered, mode, ...packed };
}
