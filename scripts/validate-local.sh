#!/usr/bin/env bash
set -euo pipefail

CODEX_NODE_DIR="${CODEX_NODE_DIR:-$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin}"
CODEX_APP_NODE="/Applications/Codex.app/Contents/Resources/node"

find_node() {
  if [ -n "${CODEX_NODE:-}" ] && [ -x "$CODEX_NODE" ]; then
    printf '%s\n' "$CODEX_NODE"
    return 0
  fi

  if [ -x "$CODEX_NODE_DIR/node" ]; then
    printf '%s\n' "$CODEX_NODE_DIR/node"
    return 0
  fi

  if [ -x "$CODEX_APP_NODE" ]; then
    printf '%s\n' "$CODEX_APP_NODE"
    return 0
  fi

  if command -v node >/dev/null 2>&1; then
    command -v node
    return 0
  fi

  return 1
}

if command -v npm >/dev/null 2>&1; then
  npm run validate
elif NODE_BIN="$(find_node)"; then
  echo "npm was not found in PATH; validating with $("$NODE_BIN" -v) at $NODE_BIN."
  "$NODE_BIN" node_modules/eslint/bin/eslint.js .
  "$NODE_BIN" node_modules/typescript/bin/tsc --noEmit
  python3 -m unittest discover -s etl/tests
  "$NODE_BIN" --test tests/*.test.mjs
  "$NODE_BIN" node_modules/next/dist/bin/next build --webpack
else
  echo "npm was not found in PATH and no usable node binary was found."
  echo "Install Node.js 22.x with npm >= 10, or set CODEX_NODE_DIR to a Node runtime that includes node."
  exit 127
fi
git diff --check
