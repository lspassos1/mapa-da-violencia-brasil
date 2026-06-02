#!/usr/bin/env bash
set -euo pipefail

CODEX_NODE_DIR="${CODEX_NODE_DIR:-$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin}"
CODEX_NODE="$CODEX_NODE_DIR/node"

if command -v npm >/dev/null 2>&1; then
  npm run validate
elif [ -x "$CODEX_NODE" ]; then
  "$CODEX_NODE" node_modules/eslint/bin/eslint.js .
  "$CODEX_NODE" node_modules/typescript/bin/tsc --noEmit
  python3 -m unittest discover -s etl/tests
  "$CODEX_NODE" --test tests/*.test.mjs
  "$CODEX_NODE" node_modules/next/dist/bin/next build --webpack
else
  echo "npm was not found in PATH and the bundled Codex Node runtime was not found at $CODEX_NODE."
  echo "Install Node.js 22.x with npm >= 10, or set CODEX_NODE_DIR to a Node runtime that includes node."
  exit 127
fi
git diff --check
