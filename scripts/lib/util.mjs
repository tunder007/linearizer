// Shared helpers. Everything here is deterministic (no Date/random).
import fs from "node:fs";
import path from "node:path";

// Stable byte-order comparator for deterministic sorting.
export const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// Normalize a path to forward slashes (stable across OSes).
export const posix = (p) => p.split(path.sep).join("/");

// Read a file as UTF-8, returning null on any error (binary/missing).
export function readText(abs) {
  try { return fs.readFileSync(abs, "utf8"); } catch { return null; }
}

// Token estimate heuristic: ceil(chars / 4). Documented, deterministic, model-agnostic.
// (English text averages ~4 chars/token; close enough for budgeting, never network/tokenizer.)
export const estTokens = (text) => Math.ceil((text ? text.length : 0) / 4);

// Minimal glob → RegExp (supports **, *, ?). Anchored against full repo-relative posix paths.
export function globToRe(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") { re += "[^]*"; i++; if (glob[i + 1] === "/") i++; }
      else re += "[^/]*";
    } else if (c === "?") re += "[^/]";
    else if ("\\^$.|+()[]{}".includes(c)) re += "\\" + c;
    else re += c;
  }
  return new RegExp("^" + re + "$");
}

// Does a repo-relative posix path match ANY of the given globs?
export function matchAny(rel, globs) {
  if (!globs || !globs.length) return false;
  return globs.some((g) => globToRe(g).test(rel));
}

export { fs, path };
