# Flashcards Harness — User Directed

Este repositorio contiene el Harness, no el roadmap del producto.

El usuario decide qué construir y en qué orden.

## Qué NO hace el Harness

No decide automáticamente:
- autenticación;
- Google/email/Apple;
- mazos;
- estadísticas;
- algoritmo;
- IA;
- offline;
- monetización;
- ninguna feature futura.

## Flujo

Cuando el usuario pide una feature concreta:

1. Planner lee la petición + PRODUCT.
2. Crea UNA task desde `TASK-TEMPLATE.json`.
3. Separa requisitos confirmados de preguntas abiertas.
4. Si falta una decisión material, no la inventa.
5. Cuando está definida, crea contract desde `CONTRACT-TEMPLATE.json`.
6. Implementer trabaja.
7. Verification.
8. Reviewer.
9. QA.
10. Final `./init.sh` + CHECKPOINTS.

## Orden de lectura

La fuente principal es `AGENTS.md`.

No se debe leer todo el repositorio.

### Siempre
- `AGENTS.md`
- `progress/current.md`
- context packet
- task/contract activos
- `docs/PRODUCT.md`

### Antes de implementar
- `docs/ARCHITECTURE.md`
- `docs/CONVENTIONS.md`
- docs específicos listados por la task

### Antes de cerrar
- `docs/VERIFICATION.md`
- `CHECKPOINTS.md`

## Crear una tarea vacía

```bash
python3 scripts/harness.py create TASK-001
```

Eso SOLO copia la plantilla. No rellena requisitos ni inventa roadmap.

## Verificar Harness

```bash
./init.sh
```

## Contexto corto

```bash
bash scripts/agent_context.sh
```
