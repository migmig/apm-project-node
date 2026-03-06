#!/bin/sh

set -eu

BUN_BIN="${BUN_BIN:-$HOME/.bun/bin/bun}"

if [ ! -x "$BUN_BIN" ]; then
  echo "Bun binary not found at $BUN_BIN" >&2
  exit 1
fi

exec "$BUN_BIN" "$@" src/server.js
