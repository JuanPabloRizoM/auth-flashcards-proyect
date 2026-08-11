# AGENTS.md — Punto de entrada obligatorio

Este archivo es un MAPA. No leas todo el repositorio.

## A. Siempre al iniciar una sesión

Haz exactamente esto, en orden:

1. Ejecuta `./init.sh`.
   - Si falla: no implementes.
2. Lee `progress/current.md`.
   - Recupera estado, tarea y próximo paso.
3. Ejecuta `bash scripts/agent_context.sh`.
   - Este resumen indica la tarea y qué documentos adicionales necesitas.
4. Si existe una tarea activa:
   - lee `.harness/tasks/<TASK>.json`;
   - lee `.harness/contracts/<TASK>.json` si ya existe.
5. Lee `docs/PRODUCT.md`.
   - Solo para conocer decisiones de producto confirmadas.
   - No conviertas posibilidades en requisitos.

Después de estos pasos, NO sigas leyendo archivos al azar.

## B. Antes de PLANIFICAR

Lee:
- `.harness/agents/planner.md`;
- la petición actual del usuario;
- `docs/PRODUCT.md`.

El Planner debe separar:
- requisitos explícitos;
- decisiones confirmadas;
- preguntas abiertas;
- cosas fuera de scope.

Si falta una decisión de producto importante, NO la inventes.

## C. Antes de IMPLEMENTAR

Lee obligatoriamente:
- task;
- contract;
- `docs/ARCHITECTURE.md`;
- `docs/CONVENTIONS.md`.

Luego lee SOLO los documentos que el context packet marque como relevantes:
- UI -> `docs/DESIGN.md`;
- datos -> `docs/DATABASE.md`;
- seguridad -> `docs/SECURITY.md`;
- pruebas -> `docs/TESTING.md`.

No releas documentos irrelevantes.

## D. Antes de VERIFYING / REVIEW / DONE

Lee obligatoriamente:
- `docs/VERIFICATION.md`;
- `CHECKPOINTS.md`;
- contract;
- evidencia de la tarea.

Reviewer además lee:
- `docs/ARCHITECTURE.md`;
- `docs/CONVENTIONS.md`.

## E. Historia

`progress/history.md` NO se lee por defecto.

Léelo solo si:
- `progress/current.md` indica que necesitas contexto anterior;
- existe una decisión histórica relevante;
- necesitas entender por qué se tomó una decisión.

## Reglas duras

- Una tarea a la vez.
- El usuario dirige el roadmap.
- No crear tareas futuras que el usuario no pidió.
- No asumir auth, pagos, IA, offline, algoritmo u otras decisiones.
- Baseline verde antes de editar.
- No modificar fuera de `allowed_paths`.
- Acceptance no cambia durante implementación.
- Cada acceptance necesita evidencia.
- No debilitar tests.
- Reviewer/QA son read-only.
- DONE requiere verification + review + QA + `./init.sh` final verde.
- Si no sabes algo de producto, no busques una respuesta en código: regístralo como decisión pendiente.
