# CHECKPOINTS — Definition of Done

Se evalúa el estado final, no el relato del agente.

## C1 — Harness sano

- [ ] `./init.sh` termina con exit code 0.
- [ ] Existe como máximo una tarea activa.
- [ ] La tarea activa tiene contrato antes de IMPLEMENTING.
- [ ] `progress/current.md` representa exactamente la sesión activa.

## C2 — Scope controlado

- [ ] Los cambios están dentro de `allowed_paths`.
- [ ] No se modificaron acceptance criteria durante implementación.
- [ ] No hay cambios oportunistas fuera de la tarea.
- [ ] Dependencias nuevas están justificadas.

## C3 — Implementación correcta

- [ ] Cada acceptance criterion está implementado.
- [ ] Cada acceptance criterion tiene evidencia.
- [ ] Happy path cubierto.
- [ ] Edge/error cases relevantes cubiertos.
- [ ] No quedan logs de debug, archivos temporales o TODOs sin contexto.
- [ ] Arquitectura respetada.

## C4 — Verificación por capas

- [ ] Baseline/preflight estaba verde antes de editar.
- [ ] Static gate pasa.
- [ ] Unit tests requeridos pasan.
- [ ] Integration tests requeridos pasan.
- [ ] E2E/smoke requerido pasa.
- [ ] Suite de regresión completa pasa.

## C5 — Revisión independiente

- [ ] Reviewer revisó task + contract + diff + evidencia.
- [ ] Reviewer no editó código.
- [ ] QA comprobó comportamiento observable.
- [ ] No quedan findings críticos/altos abiertos.

## C6 — Cierre limpio

- [ ] `./init.sh` final verde.
- [ ] Evidencia guardada en `progress/evidence/`.
- [ ] Historial actualizado append-only.
- [ ] `progress/current.md` limpio o exacto.
- [ ] No hay secretos/temporales sospechosos.
