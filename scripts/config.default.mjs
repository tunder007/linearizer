// Default configuration for the Linearizer.
// Overridable via --include / --exclude flags (additive) and the CLI options.
// Everything here is documented so the bundle is reproducible and tunable.

export const DEFAULT_CONFIG = {
  // Directories never walked.
  ignoreDirs: [".git", "node_modules", ".next", "dist", "build", "coverage", ".vercel", ".turbo", ".cache", "out"],

  // Files never included (lockfiles + OS noise).
  ignoreFiles: ["package-lock.json", "yarn.lock", "pnpm-lock.yaml", ".DS_Store"],

  // Extensions that are AI-source / text and INCLUDED by default (no leading dot).
  // Markdown/text/data + common code. Add more via --include.
  includeExt: [
    "md", "mdc", "txt", "rst", "json", "jsonc", "yaml", "yml", "toml",
    "ts", "tsx", "js", "jsx", "mjs", "cjs", "py", "rb", "go", "rs", "java",
    "c", "h", "cpp", "hpp", "cs", "php", "sh", "bash", "sql", "css", "scss"
  ],

  // Extensions ALWAYS excluded — rendered/human views and binaries (no leading dot).
  excludeExt: [
    "html", "htm",                          // human view per md/html convention
    "png", "jpg", "jpeg", "gif", "webp", "svg", "ico", "bmp", "avif",
    "pdf", "woff", "woff2", "ttf", "otf", "eot",
    "zip", "gz", "tar", "tgz", "rar", "7z",
    "mp4", "mov", "webm", "mp3", "wav", "ogg",
    "lock", "wasm", "bin", "exe", "dll", "so", "dylib"
  ],

  // Entry-contract files that define a reading order (functionality 02, reading mode).
  entryFiles: ["CLAUDE.md", "AGENTS.md"],

  // Machine-index candidates whose sequence drives reading-mode ordering.
  indexNames: ["MANIFEST.json"],

  // Default output bundle name (written to the repo root unless --out is given).
  outName: "LINEARIZED.md",

  // Fence delimiter style for each file section.
  delim: "=====",
};
