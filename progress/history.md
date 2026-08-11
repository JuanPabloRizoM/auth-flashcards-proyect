# Historial — append-only

No reescribas entradas anteriores. Cada cierre añade una entrada.

## 2026-08-09 — TASK-001 implementación completada (pendiente de review + QA)

- Entorno base instalado: Expo SDK 57.0.11, React Native 0.86.2, React 19.2.3, TypeScript 6.0.3, Expo Router 57.0.11.
- Herramientas: ESLint 9 (`eslint-config-expo`), Jest 29 + `jest-expo` (proyectos `unit` e `integration`), Playwright 1.62 (E2E web).
- Scripts reproducibles: `typecheck`, `lint`, `test`, `test:integration`, `test:e2e`, `e2e:install`, `smoke:web`.
- Gates: `./init.sh` exit 0 (typecheck, lint, unit, integration, e2e todos [OK]); `expo-doctor` 20/20; reinstalación limpia con `npm ci` verificada.
- Decisión: Supabase/PostgreSQL NO instalados en esta tarea (fuera de scope; requiere decisiones del usuario).
- Riesgo detectado: iCloud Drive duplicó directorios dentro de `node_modules` (`* 2`), rompiendo ESLint; resuelto con `npm ci`. Recomendado mover el proyecto fuera de `~/Documents`.
- Evidencia: `progress/evidence/TASK-001-implementation.md`.

## 2026-08-11 — TASK-001 cerrada: DONE

Ciclo completo del harness ejecutado hasta el cierre.

- **Contexto previo**: el usuario inicializó Git, publicó el remoto `https://github.com/JuanPabloRizoM/auth-flashcards-proyect.git` y movió el proyecto de `~/Documents` (iCloud) a `~/Proyects`. Con ello `check_scope.py` dejó de omitirse y pasó a devolver `SCOPE: OK (TASK-001)`, sustituyendo el `[WARN] Git aún no inicializado` del gate 3 de `init.sh`.
- **Review #1: CHANGES_REQUIRED** con cuatro hallazgos, ninguno crítico ni alto: F1 evidencia desactualizada sobre Git/iCloud, F2 preguntas abiertas ya resueltas en `current.md`, F3 `.claude/settings.local.json` versionado, F4 `react-test-renderer` con caret frente a `react` exacto.
- **Corrección de proceso**: un primer veredicto se formuló como "APPROVED con cambios menores". Ese veredicto no existe. `.harness/agents/reviewer.md` admite únicamente `APPROVED` o `CHANGES_REQUIRED`; habiendo hallazgos que exigen modificación, el veredicto correcto es `CHANGES_REQUIRED` aunque el código y los gates estén verdes. Queda registrado como precedente para futuras revisiones.
- **Corrección F1-F4** (`REVIEW_FAILED -> IMPLEMENTING`), sin tocar funcionalidad ni ampliar scope: evidencia con tabla "Estado del repositorio" antes/después conservando el registro histórico; `current.md` sin preguntas abiertas obsoletas; `.claude/settings.local.json` fuera del tracking (`git rm --cached`, sigue en disco) y en `.gitignore`, manteniendo `.claude/settings.json` versionado; `react-test-renderer` fijado a `19.2.3` exacto con lockfile actualizado.
- **Review #2: APPROVED**. El reviewer comparó el lockfile entrada por entrada en lugar de fiarse del resumen: 1117 entradas antes y después, cero añadidas o eliminadas, y cero cambios en `version`, `resolved` e `integrity`; los 93 cambios restantes son reclasificaciones de metadatos `dev` -> `devOptional`. Rehízo además la reproducibilidad sobre el árbol ya corregido, porque F4 tocó el lockfile.
- **QA: APPROVED**, 18/18 acceptance re-verificadas ejecutando los comandos de forma independiente. Comprobación propia del arranque web más allá del test del implementer: `expo start --web` + descarga de la página, HTTP 200 con `Flashcards` y `Entorno base preparado.` ya renderizados en el HTML, cero errores de consola.
- **Reproducibilidad desde el remoto**: clon limpio de GitHub + `npm ci` + `./init.sh` -> exit 0. Demuestra que lo versionado basta para reconstruir el entorno, y no que funcione por estado residual de la máquina de desarrollo. Es la evidencia más fuerte de la tarea y queda registrada de forma permanente en la evidencia de implementación.
- **Gates finales**: `./init.sh` exit 0 con los diez gates en `[OK]`. `CHECKPOINTS.md` C1-C6 verificado.
- **Pendiente para el usuario, fuera del harness**: las correcciones F1-F4 y la evidencia de review/QA estaban sin commitear al cerrar la tarea; el commit `e9983e8` publicado en GitHub todavía no las contiene. Requiere commit + push.
- **Observación para el planner** (no corregida a propósito, cambiarla durante la implementación habría violado "acceptance congelado"): el `allowed_paths` del contrato omite `.claude/**`, que el task sí incluye y es el que aplica `check_scope.py`.
- Evidencia: `progress/evidence/TASK-001-implementation.md`, `progress/evidence/TASK-001-review.md` (revisiones #1 y #2), `progress/evidence/TASK-001-qa.md`.

