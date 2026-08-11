#!/usr/bin/env bash
# Preflight + final verification. Ejecutar antes de editar y antes de cerrar.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

FAIL=0
ok(){ printf '[OK]   %s\n' "$1"; }
warn(){ printf '[WARN] %s\n' "$1"; }
bad(){ printf '[FAIL] %s\n' "$1"; FAIL=1; }

echo "── 1. Harness ─────────────────────────────"
python3 scripts/verify.py && ok "Harness válido" || bad "Harness inválido"

echo
echo "── 2. Scope ───────────────────────────────"
python3 scripts/check_scope.py && ok "Scope válido" || bad "Scope inválido"

echo
echo "── 3. Hygiene ─────────────────────────────"
if command -v git >/dev/null 2>&1 && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  suspicious="$(git status --porcelain | grep -E '(\.env($|\.)|\.tmp$|__pycache__|node_modules/)' || true)"
  if [ -n "$suspicious" ]; then
    bad "Archivos sospechosos:"
    printf '%s\n' "$suspicious"
  else
    ok "Sin temporales/secretos obvios"
  fi
else
  warn "Git aún no inicializado"
fi

echo
echo "── 4. App gates ───────────────────────────"
if [ -f package.json ] && command -v npm >/dev/null 2>&1; then
  run_if(){
    local s="$1"
    if node -e "const p=require('./package.json'); process.exit(p.scripts&&p.scripts['$s']?0:1)" 2>/dev/null; then
      echo "→ npm run $s"
      npm run "$s" && ok "$s" || bad "$s"
    else
      warn "script '$s' aún no existe"
    fi
  }
  run_if typecheck
  run_if lint
  run_if test
  run_if test:integration
  run_if test:e2e
else
  warn "App Expo aún no bootstrappeada"
fi

echo
echo "── 5. Evidence ────────────────────────────"
python3 scripts/check_evidence.py && ok "Evidencia coherente" || bad "Evidencia incompleta"

echo
echo "── 6. Summary ─────────────────────────────"
if [ "$FAIL" -eq 0 ]; then
  ok "Estado verificable"
  exit 0
fi
bad "No avanzar/cerrar hasta resolver"
exit 1
