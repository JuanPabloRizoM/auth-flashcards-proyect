#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

python3 scripts/verify.py >/tmp/flashcards_verify.log 2>&1 || {
  echo "=== HARNESS ALERTA ==="
  tail -30 /tmp/flashcards_verify.log
  echo "No implementes hasta resolverlo."
  exit 0
}

python3 scripts/agent_context.py
