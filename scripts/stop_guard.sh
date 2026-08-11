#!/usr/bin/env bash
set -u
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! ./init.sh >/tmp/flashcards_stop_init.log 2>&1; then
  echo "No cierres: init.sh está rojo." >&2
  tail -40 /tmp/flashcards_stop_init.log >&2
  exit 2
fi

if ! python3 scripts/check_evidence.py >/tmp/flashcards_stop_evidence.log 2>&1; then
  echo "No cierres: evidencia incompleta." >&2
  cat /tmp/flashcards_stop_evidence.log >&2
  exit 2
fi

exit 0
