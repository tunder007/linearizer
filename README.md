# @softeneers/linearizer

> Flatten a repository's AI-source into one ordered, token-budgeted context bundle with a table of contents.

Zero runtime dependencies. Node ≥ 18. Part of the [Softeneers tools](https://github.com/tunder007/softeneers-tools) suite.

## Install

```bash
# one-off, no install
npx @softeneers/linearizer

# or install globally
npm i -g @softeneers/linearizer

# or as a dev dependency
npm i -D @softeneers/linearizer
```

## Usage

```bash
linearizer [path]
```

## What it does

See [`functionalities/`](./functionalities/) for the full per-feature documentation, and
[`example-output/`](./example-output/) for sample reports.

## Part of a suite

Install every Softeneers tool at once with the wrapper:

```bash
npm i -g softeneers-tools
softeneers-tools run linearizer -- [args]
```

## License

MIT © 2026 Softeneers
