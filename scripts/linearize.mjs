#!/usr/bin/env node
// Linearizer — CLI entry. Wraps the pure pipeline in lib/run.mjs and writes ONE bundle.
// Usage:
//   node linearize.mjs <repo> [--out <file>] [--max-tokens N]
//                       [--include <glob>] [--exclude <glob>] [--order reading|graph|path]
// --include / --exclude may be repeated. Read-only except for the single output bundle.
import { fs, path, posix } from "./lib/util.mjs";
import { DEFAULT_CONFIG } from "./config.default.mjs";
import { linearize, ORDER_MODES } from "./lib/run.mjs";

function parseArgs(argv) {
  const a = { path: ".", out: null, maxTokens: 0, include: [], exclude: [], order: "reading" };
  const rest = argv.slice(2);
  for (let i = 0; i < rest.length; i++) {
    const t = rest[i];
    if (t === "--out") a.out = rest[++i];
    else if (t === "--max-tokens") a.maxTokens = parseInt(rest[++i], 10) || 0;
    else if (t === "--include") a.include.push(rest[++i]);
    else if (t === "--exclude") a.exclude.push(rest[++i]);
    else if (t === "--order") a.order = rest[++i];
    else if (!t.startsWith("--")) a.path = t;
  }
  return a;
}

function main() {
  const args = parseArgs(process.argv);
  const root = path.resolve(args.path);
  if (!fs.existsSync(root)) { console.error(`Target not found: ${root}`); process.exit(2); }
  if (!ORDER_MODES.includes(args.order)) {
    console.error(`Bad --order '${args.order}'. Choose: ${ORDER_MODES.join(" | ")}`); process.exit(2);
  }

  const res = linearize(root, {
    mode: args.order, maxTokens: args.maxTokens, include: args.include, exclude: args.exclude,
  });

  const outFile = args.out ? path.resolve(args.out) : path.join(root, DEFAULT_CONFIG.outName);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, res.bundle);

  console.log(`\nLinearizer — ${res.target}  (order: ${res.mode}${args.maxTokens ? `, budget ${args.maxTokens}` : ""})`);
  console.log(`included: ${res.included.length} files (~${res.tokens.included} tokens)` +
    (res.omitted.length ? ` · omitted (budget): ${res.omitted.length} files` : "") +
    ` · total candidates: ${res.files.length}`);
  console.log(`written to: ${posix(path.relative(process.cwd(), outFile)) || outFile}\n`);
}

main();
