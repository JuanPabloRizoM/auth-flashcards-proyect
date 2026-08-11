#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

python3 scripts/verify.py
python3 scripts/check_scope.py

if [ -f package.json ] && command -v npm >/dev/null 2>&1; then
  if node -e "const p=require('./package.json'); process.exit(p.scripts&&p.scripts.typecheck?0:1)" 2>/dev/null; then
    npm run typecheck
  fi
fi
