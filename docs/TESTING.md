# TESTING — Evidencia ejecutable

Regla: el agente no dice “funciona”; lo demuestra.

## Fase 0 — Baseline

Antes de editar:

```bash
./init.sh
```

Debe estar verde.

## Fase 1 — Static

Cuando existan scripts:
- typecheck
- lint
- format/check
- build

## Fase 2 — Unit

Para lógica pura.

Debe cubrir:
- happy path;
- error/edge case relevante;
- resultado concreto.

## Fase 3 — Integration

Prueba fronteras reales:
- módulos;
- persistencia;
- Supabase test;
- RLS;
- serialización.

Evitar mocks cuando el riesgo real está en la integración.

## Fase 4 — E2E / Smoke

Para flujos críticos:
- login;
- crear mazo;
- crear card;
- estudiar;
- persistencia tras recarga.

Web: Playwright.

## Fase 5 — Regression

Ejecutar toda la suite relevante después de implementar.

## Fase 6 — Reviewer

Revisa:
- task;
- contract;
- diff;
- acceptance -> evidence;
- arquitectura;
- scope.

## Fase 7 — QA

Prueba experiencia observable.

## Regla de bugs

Todo bug corregido debe añadir un test de regresión cuando sea razonable.

## Mal test

“no lanzó excepción”.

## Buen test

“crear un deck persiste exactamente los datos esperados y otro usuario no puede leerlo”.
