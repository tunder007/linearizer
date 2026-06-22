#!/usr/bin/env node
// Self-test for the Linearizer. OFFLINE + deterministic. Builds a throwaway FIXTURE repo in a
// unique temp dir, runs the pure pipeline against it, asserts every guarantee, and cleans up.
// Exits non-zero on any failure.
import { fs, path } from "./lib/util.mjs";
import { linearize } from "./lib/run.mjs";

let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? "  ✓" : "  ✗"} ${msg}`); if (!cond) failures++; };

// --- build a unique fixture repo ---
const fixture = "/tmp/skill-linearizer-selftest";
fs.rmSync(fixture, { recursive: true, force: true });
const write = (rel, content) => {
  const abs = path.join(fixture, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
};

// Entry contract with an explicit reading order: docs first, then code.
write("CLAUDE.md", [
  "# Fixture entry contract",
  "",
  "Reading order: start with [docs/a.md](docs/a.md), then [docs/b.md](docs/b.md),",
  "and finally the code in `code/x.ts`.",
  "",
].join("\n"));
// a links to b → in graph order, b must come BEFORE a.
write("docs/a.md", "# Doc A\n\nSee [Doc B](b.md) for details.\n");
write("docs/b.md", "# Doc B\n\nLeaf document, links to nothing.\n");
write("MANIFEST.json", JSON.stringify({ sequence: ["docs/a.md", "docs/b.md", "code/x.ts"] }, null, 2) + "\n");
write("code/x.ts", "export const x = 1;\n");
write("page.html", "<!doctype html><title>should be excluded</title>\n");
// fake binary: a .png whose bytes include a NUL.
fs.writeFileSync(path.join(fixture, "img.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01, 0x02]));

console.log(`\nLinearizer — self-test`);
console.log(`fixture: ${fixture}\n`);

// --- 1) Selection: .html and .png excluded; AI-source included ---
const reading = linearize(fixture, { mode: "reading" });
const paths = reading.files.map((f) => f.path);
console.log("Selection");
ok(!paths.includes("page.html"), ".html is excluded");
ok(!paths.includes("img.png"), "binary .png is excluded");
ok(paths.includes("CLAUDE.md") && paths.includes("docs/a.md") && paths.includes("code/x.ts"), "AI-source (.md/.ts/.json) included");

// --- 2) Bundle shape: TOC + delimiters + token estimate present ---
console.log("Bundle shape");
ok(/## Table of contents/.test(reading.bundle), "bundle contains a table of contents");
ok(reading.bundle.includes("===== docs/a.md ====="), "bundle uses ===== delimiters for file sections");
ok(reading.bundle.includes("===== end docs/a.md ====="), "bundle closes each section with an end delimiter");
ok(/Tokens \(est\)/.test(reading.bundle) && /ceil\(chars \/ 4\)/.test(reading.bundle), "token estimate is present and documented");

// --- 3) Reading order: entry + docs before code ---
console.log("Reading order");
const ord = reading.ordered.map((f) => f.path);
ok(ord[0] === "CLAUDE.md", "entry contract (CLAUDE.md) comes first");
ok(ord.indexOf("docs/a.md") < ord.indexOf("code/x.ts"), "docs are ordered before code (per reading order)");
ok(ord.indexOf("docs/b.md") < ord.indexOf("code/x.ts"), "all referenced docs precede code");

// --- 4) Graph order: b before a (a links to b) ---
console.log("Graph order");
const g = linearize(fixture, { mode: "graph" });
const go = g.ordered.map((f) => f.path);
ok(go.indexOf("docs/b.md") < go.indexOf("docs/a.md"), "graph places b before a (a links to b)");

// --- 5) Token budget: some files omitted AND listed (not silently dropped) ---
console.log("Token budget & omissions");
const budgeted = linearize(fixture, { mode: "path", maxTokens: 60 });
ok(budgeted.omitted.length > 0, "a tiny --max-tokens omits at least one file");
const everyOmittedListed = budgeted.omitted.every((f) => budgeted.bundle.includes(`\`${f.path}\``) && new RegExp(`## Omissions`).test(budgeted.bundle));
ok(everyOmittedListed, "every omitted file is listed in the Omissions section (no silent drop)");
ok(budgeted.tokens.included <= 60 + 200, "included tokens respect the budget envelope");

// --- 6) Determinism: two runs → byte-identical bundle ---
console.log("Determinism");
const r1 = linearize(fixture, { mode: "reading" });
const r2 = linearize(fixture, { mode: "reading" });
ok(r1.bundle === r2.bundle, "two reading-mode runs produce a byte-identical bundle");
const p1 = linearize(fixture, { mode: "path", maxTokens: 60 });
const p2 = linearize(fixture, { mode: "path", maxTokens: 60 });
ok(p1.bundle === p2.bundle, "two budgeted runs produce a byte-identical bundle");

// --- cleanup ---
fs.rmSync(fixture, { recursive: true, force: true });

console.log(`\nResult: ${reading.files.length} candidates · reading/graph/path modes verified · ${budgeted.omitted.length} omitted under budget`);
console.log(failures ? `\nSELF-TEST FAILED (${failures} assertion${failures > 1 ? "s" : ""})\n` : `\nSELF-TEST PASSED\n`);
process.exit(failures ? 1 : 0);
