# VERIFICATION — Cómo demostrar que una tarea está terminada

Este documento se lee al entrar en VERIFYING y antes de declarar DONE.

## Regla de oro

Una afirmación del agente no es evidencia.

Toda tarea debe demostrar sus acceptance criteria mediante pruebas o verificaciones reproducibles.

## Secuencia

### V0 — Baseline
Antes de editar:

```bash
./init.sh
```

Debe estar verde.

### V1 — Scope
Comprobar que los archivos cambiados respetan `allowed_paths`.

### V2 — Static
Cuando existan:
- typecheck;
- lint;
- format check;
- build.

### V3 — Unit
Para lógica pura y edge cases.

### V4 — Integration
Para fronteras reales:
- persistencia;
- Supabase;
- RLS;
- serialización;
- módulos conectados.

### V5 — E2E / Smoke
Para comportamiento visible al usuario.

### V6 — Regression
Ejecutar toda la suite relevante, no solo tests nuevos.

### V7 — Review independiente
Reviewer lee:
- task;
- contract;
- diff;
- evidencia;
- arquitectura;
- convenciones;
- checkpoints.

### V8 — QA
Valida el comportamiento observable.

### V9 — Final
Ejecutar otra vez:

```bash
./init.sh
```

y comprobar `CHECKPOINTS.md`.

## Acceptance -> Evidence

Cada acceptance criterion del contrato debe tener:
- método;
- comando/test;
- resultado;
- evidencia persistente.

Si no puede demostrarse, no está DONE.
