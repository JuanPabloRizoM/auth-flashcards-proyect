# Sesión actual

- **Task activa:** ninguna
- **Última tarea cerrada:** TASK-001 — Preparar e instalar el entorno base del proyecto (`DONE`, 2026-08-11)
- **Estado del harness:** `./init.sh` exit 0
- **Repositorio:** rama `main`, remoto `https://github.com/JuanPabloRizoM/auth-flashcards-proyect.git`

No hay tarea en curso. El usuario decide cuál es la siguiente; el harness no propone roadmap.

## Estado del entorno tras TASK-001

- Expo SDK 57.0.11, React Native 0.86.2, React 19.2.3, TypeScript 6.0.3, Expo Router 57.0.11.
- Plataformas declaradas: iOS, Android y web. Arranque web verificado.
- Gates disponibles: `typecheck`, `lint`, `test`, `test:integration`, `test:e2e`, más `smoke:web` y `e2e:install`.
- `src/features/` vacío: no hay funcionalidad de producto implementada.

## Pendientes que quedaron fuera de TASK-001

Ninguno bloquea el harness. Se registran para que el usuario decida qué hacer con ellos.

- **Commit y push**: las correcciones F1-F4 y la evidencia de review/QA no estaban commiteadas al cerrar la tarea. El commit `e9983e8` publicado en GitHub todavía contiene `.claude/settings.local.json` versionado y `react-test-renderer` con caret.
- **Contrato vs task**: el `allowed_paths` del contrato de TASK-001 omite `.claude/**`, que el task sí incluye y es el que aplica `check_scope.py`. Corresponde al planner en una tarea futura; no se tocó para no alterar un contrato durante su implementación.
- **Playwright en máquina nueva**: `npm run test:e2e` requiere ejecutar antes `npm run e2e:install` una vez, porque los binarios del navegador no se versionan.
- **Sin iconos propios**: se usan los de Expo por defecto; `assets/**` quedó fuera de `allowed_paths`.
- **Decisiones de producto no tomadas**: Supabase/PostgreSQL, autenticación, mazos, cards, estudio y repetición espaciada siguen sin instalar ni implementar, a la espera de decisiones del usuario.

## Evidencia de la última tarea

- `progress/evidence/TASK-001-implementation.md`
- `progress/evidence/TASK-001-review.md` (revisiones #1 y #2)
- `progress/evidence/TASK-001-qa.md`
