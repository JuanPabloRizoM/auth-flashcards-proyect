# TASK-001 — QA Evidence

- Task: TASK-001 — Preparar e instalar el entorno base del proyecto
- Fecha: 2026-08-11
- Rol: QA independiente (READ ONLY sobre código y configuración — `qa_read_only: true` en `.harness/policies/files.json`)
- Estado al entrar: `QA` (review #1 = CHANGES_REQUIRED con F1-F4; corregidos; review #2 = APPROVED)
- Base evaluada: commit `e9983e8` + working tree con las correcciones F1-F4 **sin commitear**
- Remoto: `https://github.com/JuanPabloRizoM/auth-flashcards-proyect.git`

## Veredicto

**APPROVED**

Ningún hallazgo requiere modificación de código, configuración o evidencia para cumplir una
acceptance. Las 18 acceptance del contrato se cumplen y fueron re-verificadas de forma
independiente ejecutando los comandos, no aceptando lo que afirma la evidencia previa.

## Documentos leídos

1. `AGENTS.md`
2. `.harness/agents/qa.md`
3. `.harness/tasks/TASK-001.json`
4. `.harness/contracts/TASK-001.json` (verification_matrix)
5. `docs/VERIFICATION.md`
6. `docs/TESTING.md`
7. `CHECKPOINTS.md`
8. `progress/current.md`
9. `progress/evidence/TASK-001-implementation.md`
10. `progress/evidence/TASK-001-review.md` (revisiones #1 y #2)
11. Código y config inspeccionados: `app/_layout.tsx`, `app/index.tsx`, `app.json`, `package.json`,
    `init.sh`, `.gitignore`, `scripts/smoke_web.mjs`, `scripts/check_evidence.py`,
    `.harness/policies/files.json`, los tres tests (`tests/unit`, `tests/integration`, `tests/e2e`)

## Método

Toda afirmación de la evidencia previa se volvió a comprobar ejecutando el comando. Los logs de
esta ronda se escribieron **fuera del árbol del repositorio** (`/tmp/qa_*.log`, `/tmp/qa_clone/`,
`/tmp/qa_wt/`) para no introducir untracked que `check_scope.py` marcaría como fuera de scope.
`git status --porcelain` es idéntico antes y después de la QA.

## Estado exacto del repositorio observado

```text
$ git log --oneline -3
e9983e8 chore: bootstrap flashcards project and harness       <- único commit del repositorio

$ git rev-parse HEAD
e9983e8909064b3bc8591dd76848257c8dc7f353
$ git ls-remote origin main
e9983e8909064b3bc8591dd76848257c8dc7f353        refs/heads/main   <- local == remoto, nada por empujar

$ git status --porcelain
D  .claude/settings.local.json          <- F3, en el índice, SIN commitear
 M .gitignore                           <- F3
 M .harness/tasks/TASK-001.json         <- transición REVIEWING -> QA
 M package-lock.json                    <- F4
 M package.json                         <- F4
 M progress/current.md                  <- F2
 M progress/evidence/TASK-001-implementation.md   <- F1
?? progress/evidence/TASK-001-review.md           <- evidencia de review, SIN commitear

$ git diff --stat
 .gitignore | 3 + ; .harness/tasks/TASK-001.json | 2 +- ; package-lock.json | 188 +-
 package.json | 2 +- ; progress/current.md | 38 +- ; ...implementation.md | 112 +-
 6 files changed, 231 insertions(+), 114 deletions(-)
$ git diff --cached --stat
 .claude/settings.local.json | 52 -----   (1 file changed, 52 deletions)

$ git show HEAD:.harness/tasks/TASK-001.json | grep status   ->  "status": "REVIEWING"
$ grep status .harness/tasks/TASK-001.json                   ->  "status": "QA"
```

**Confirmado de forma independiente: las correcciones F1-F4 NO están commiteadas ni publicadas.**
Verificado sobre un clon real del remoto:

```text
$ git clone https://github.com/JuanPabloRizoM/auth-flashcards-proyect.git /tmp/qa_clone
  -> CLONE OK, e9983e8
$ node -p "require('/tmp/qa_clone/package.json').devDependencies['react-test-renderer']"
  ^19.2.3                                  <- F4 NO está en el remoto
$ git -C /tmp/qa_clone ls-files .claude
  .claude/settings.json
  .claude/settings.local.json              <- F3 NO está en el remoto
$ grep -c 'settings.local' /tmp/qa_clone/.gitignore
  0                                        <- F3 NO está en el remoto
```

Es un asunto de cierre (commit + push por el usuario), no un defecto del entorno: **ambos estados
—el publicado y el corregido— instalan y pasan todos los gates** (ver "Reproducibilidad"). No
altera el veredicto.

## Comportamiento observable (happy path)

### Smoke web

```text
$ npm run smoke:web
> node scripts/smoke_web.mjs
SMOKE WEB: OK (http://localhost:8082 -> 200)
exit=0
```

### E2E real en navegador (Playwright / chromium)

```text
$ npm run test:e2e
[WebServer] Web Bundled 506ms node_modules/expo-router/entry.js (858 modules)
[WebServer] Web  LOG  Running application "main" with appParams: {"rootTag": "#root"}
  ✓  1 [chromium] › tests/e2e/web-boot.spec.ts:3:5 › la app arranca en web y renderiza la pantalla raíz (607ms)
  1 passed (2.6s)
exit=0
```

El test asserta resultado concreto, no ausencia de excepción: HTTP 200, `Flashcards` visible,
`Entorno base preparado.` visible y `consoleErrors` vacío.

### Comprobación propia del render (independiente del test del implementer)

QA levantó el servidor web en un puerto distinto y descargó la página directamente:

```text
$ npx expo start --web --port 8087   (en segundo plano)
$ curl -o page.html -w '%{http_code}' http://localhost:8087/
HTTP=200
$ grep -o 'Flashcards' page.html              -> Flashcards
$ grep -o 'Entorno base preparado.' page.html -> Entorno base preparado.
$ grep -o '<div id="root">' page.html         -> <div id="root">
38464 bytes
```

La pantalla raíz se sirve ya renderizada (`web.output: static`) con el texto observable. La app
arranca de verdad y renderiza; no es solo un 200 vacío.

## Gates de la verification_matrix

Ejecutados uno a uno por QA sobre el working tree corregido:

| Gate | Comando | Exit | Resultado observado |
|---|---|---|---|
| static | `npm run typecheck` | 0 | `tsc --noEmit`, 0 errores |
| static | `npm run lint` | 0 | `eslint .`, sin errores ni warnings |
| unit | `npm test` | 0 | 1 suite / 1 test PASS (`IndexScreen`) |
| integration | `npm run test:integration` | 0 | 1 suite / 2 tests PASS (router monta `/` y devuelve not-found en ruta inexistente) |
| smoke | `npm run smoke:web` | 0 | HTTP 200 + contenedor raíz |
| e2e | `npm run test:e2e` | 0 | 1 passed (chromium) |
| smoke | `npx expo config --type public` | 0 | ver abajo |

### `./init.sh` completo

```text
$ ./init.sh   (log en /tmp/qa_init.log, fuera del árbol del repositorio)
── 1. Harness ──   VERIFY: OK            [OK] Harness válido
── 2. Scope ────   SCOPE: OK (TASK-001)  [OK] Scope válido
── 3. Hygiene ──                         [OK] Sin temporales/secretos obvios
── 4. App gates ─                        [OK] typecheck
                                         [OK] lint
                                         [OK] test
                                         [OK] test:integration
                                         [OK] test:e2e
── 5. Evidence ─   EVIDENCE: OK          [OK] Evidencia coherente
── 6. Summary ──                         [OK] Estado verificable

init.sh exit=0
```

`git status --porcelain` tras la ejecución: idéntico al de antes (sin artefactos de QA dentro del repo).

## Compatibilidad declarada iOS / Android / web

```text
$ npx expo config --type public          -> exit 0
  name: 'Flashcards'   slug: 'flashcards'   scheme: 'flashcards'   sdkVersion: '57.0.0'
  plugins: [ 'expo-router', 'expo-status-bar' ]
  platforms: [ 'ios', 'android', 'web' ]
  ios:     { supportsTablet: true, bundleIdentifier: 'com.flashcards.app' }
  android: { package: 'com.flashcards.app', predictiveBackGestureEnabled: false }
  web:     { bundler: 'metro', output: 'static' }
```

`app.json` declara las tres plataformas. Peers nativas presentes y alineadas por `expo install`:
`react-native-safe-area-context@5.7.0`, `react-native-screens@4.26.2`. `app/_layout.tsx` y
`app/index.tsx` no contienen código específico de plataforma que rompa nativo (solo `react-native`,
`expo-router`, `expo-status-bar`, `react-native-safe-area-context`).

No verificado por QA (fuera del alcance ejecutable de esta máquina y ya declarado como "no
verificado" por el implementer): ejecución real en simulador iOS/Android, que exigiría
`expo prebuild` y toolchain nativa.

## Entorno y dependencias

```text
$ node -v   -> v22.22.2      (engines.node ">=20.19.4"  -> cumple)
$ npm -v    -> 10.9.7        (engines.npm  ">=10"       -> cumple)

$ npm ls --omit=dev --depth=0   -> exit 0, 12 dependencias, sin UNMET ni extraneous
  @expo/metro-runtime@57.0.8   expo-constants@57.0.9   expo-linking@57.0.5
  expo-router@57.0.11          expo-status-bar@57.0.1  expo@57.0.11
  react@19.2.3                 react-dom@19.2.3        react-native@0.86.2
  react-native-safe-area-context@5.7.0                 react-native-screens@4.26.2
  react-native-web@0.21.2
```

Ninguna dependencia de producto (Supabase, auth, ORM, estado global) instalada. Cada entrada de
`dependencies`/`devDependencies` está cubierta por `dependency_justification` del contrato.
`react-test-renderer` está declarado exacto `19.2.3`, alineado con `react` (F4 corregido).

## Reproducibilidad desde archivos versionados

Verificada de forma independiente en **dos escenarios**, porque el estado publicado y el corregido
difieren:

### A) Clon limpio del remoto real (estado publicado, `e9983e8`, SIN F1-F4)

```text
$ git clone https://github.com/JuanPabloRizoM/auth-flashcards-proyect.git /tmp/qa_clone  -> OK (e9983e8)
$ cd /tmp/qa_clone
$ npm ci                       -> exit 0
$ node -p "require('./node_modules/react-test-renderer/package.json').version"  -> 19.2.3
$ npm run typecheck            -> exit 0
$ npm run lint                 -> exit 0
$ npm test                     -> exit 0
$ npm run test:integration     -> exit 0
$ npm run test:e2e             -> exit 0 (1 passed, chromium)
```

### B) Copia limpia del working tree corregido (CON F1-F4)

```text
$ rsync -a --exclude node_modules --exclude .expo --exclude dist --exclude .git \
        --exclude playwright-report --exclude test-results <repo>/ /tmp/qa_wt/
$ node -p "require('/tmp/qa_wt/package.json').devDependencies['react-test-renderer']"  -> 19.2.3
$ cd /tmp/qa_wt
$ npm ci                       -> exit 0
$ node -p "require('./node_modules/react-test-renderer/package.json').version"  -> 19.2.3
$ npm run typecheck            -> exit 0
$ npm run lint                 -> exit 0
$ npm test                     -> exit 0
$ npm run test:integration     -> exit 0
$ npm run test:e2e             -> exit 0 (1 passed, chromium)
```

Ambos escenarios se instalan desde el lockfile y quedan en verde, incluido E2E. La acceptance se
cumple con independencia de si las correcciones llegan a estar commiteadas.

Salvedad confirmada (ya documentada por el implementer y el reviewer): en esta máquina el binario
de chromium está en la caché global de Playwright (`~/Library/Caches/ms-playwright`), así que
`test:e2e` pasó en los dos escenarios sin descargarlo. En una máquina nueva hay que ejecutar una
vez `npm run e2e:install`, script que sí está versionado en `package.json`.

## Ausencia de secretos

```text
$ find . -path ./node_modules -prune -o -name '.env*' -print
(sin resultados)

$ git ls-files | grep -iE '\.env|\.pem|\.key|\.p12|secret|credential'
(sin resultados)

$ grep -rInE "(SUPABASE_(URL|KEY)|api[_-]?key|secret|password|token)[[:space:]]*[:=][[:space:]]*['\"][^'\"]{8,}" \
    --include='*.ts' --include='*.tsx' --include='*.js' --include='*.json' --include='*.mjs' \
    --exclude-dir=node_modules --exclude-dir=.expo --exclude=package-lock.json .
(sin resultados, exit 1)

$ git ls-files | grep -i DS_Store
(sin resultados — los .DS_Store del disco están ignorados, no versionados)
```

`.gitignore` cubre `node_modules/`, `.expo/`, `dist/`, `web-build/`, `coverage/`,
`playwright-report/`, `test-results/`, `.env`, `.env.*` (con `!.env.example`), `*.key`, `*.p12`,
`*.pem`, `*.jks`, `*.p8`, `*.mobileprovision`, `.DS_Store` y `.claude/settings.local.json`.
El gate 3 de `init.sh` (Hygiene) devuelve `[OK] Sin temporales/secretos obvios`.

## Ausencia de funcionalidad de producto

```text
$ git ls-files app src tests
app/.gitkeep   app/_layout.tsx   app/index.tsx
src/.gitkeep   src/components/.gitkeep   src/features/.gitkeep
src/lib/.gitkeep   src/theme/.gitkeep   src/types/.gitkeep
tests/e2e/.gitkeep   tests/e2e/web-boot.spec.ts
tests/integration/.gitkeep   tests/integration/expo-router-navigation.test.tsx
tests/unit/.gitkeep   tests/unit/index-screen.test.tsx

$ grep -rInE 'supabase|auth|login|signin|deck|mazo|flashcard|card|spaced|repetic|estudi' \
    --include='*.ts' --include='*.tsx' app/ src/
app/index.tsx:7:        Flashcards        <- único hit: el texto del título, no lógica

$ grep -rInE 'TODO|FIXME|console\.log' --include='*.ts' --include='*.tsx' app/ src/ tests/
(sin resultados)
```

`src/features/` contiene solo `.gitkeep`. `app/` contiene solo el layout raíz (Stack +
SafeAreaProvider + StatusBar) y una pantalla placeholder sin lógica de negocio, estado, navegación
propia ni acceso a datos. No hay autenticación, mazos, flashcards, estudio ni repetición espaciada.
Todos los puntos de `out_of_scope` del task y del contrato se respetan.

La pantalla es un placeholder deliberado del entorno: QA no evalúa su diseño ni su riqueza de UX,
porque el task y el contrato no definen ningún requisito de UX de producto para TASK-001.

## Calidad de los tests (docs/TESTING.md, "mal test" vs "buen test")

Los tres niveles assertan resultados concretos, no "no lanzó excepción":

- unit: `getByRole('header').props.children === 'Flashcards'` y presencia del subtítulo.
- integration: monta el router real (`renderRouter` de `expo-router/testing-library`), resuelve `/`
  a la pantalla index y comprueba además el edge case de una URL inexistente (`/ruta-inexistente`),
  donde el contenido de index ya no está presente.
- e2e: navegador real, status 200, dos textos visibles y cero errores de consola.

## Acceptance orientados al usuario -> resultado

Los marcados con ● son comportamiento directamente observable por el usuario; el resto son
acceptance de entorno verificadas por comando.

| # | Acceptance | Verificación de QA | Resultado |
|---|---|---|---|
| ● 1 | El proyecto puede ejecutarse en web sin errores de arranque | `npm run smoke:web` (200), `npm run test:e2e` (chromium), curl propio a `:8087` con textos renderizados | PASS |
| ● 2 | Expo Router instalado y configurado correctamente | `main: expo-router/entry`, plugin `expo-router` en config resuelta, integration test monta `/` y not-found, arranque web real | PASS |
| ● 3 | La configuración base mantiene compatibilidad con Android e iOS | `npx expo config --type public` -> `platforms: ['ios','android','web']`; app.json declara ios/android/web; peers nativas alineadas | PASS (config; no probado en simulador) |
| ● 4 | El proyecto puede instalarse de nuevo desde cero solo con archivos versionados | `npm ci` + gates en clon del remoto y en copia limpia del árbol corregido | PASS (ambos escenarios) |
| ● 5 | No se han implementado funcionalidades del producto | `git ls-files app src tests` + grep de términos de producto | PASS |
| 6 | Documentos obligatorios leídos antes de instalar | Sección "Documentos leídos" de la evidencia de implementación | PASS (inspección) |
| 7 | Versión de Node.js y gestor de paquetes comprobada y documentada | `node -v` v22.22.2, `npm -v` 10.9.7, `engines` en package.json coherente | PASS |
| 8 | Proyecto Expo correctamente inicializado | `npx expo config --type public` exit 0 con name/slug/scheme/sdkVersion | PASS |
| 9 | TypeScript configurado y typecheck sin errores | `npm run typecheck` exit 0 | PASS |
| 10 | Dependencias registradas en package.json y lockfile | `npm ls --omit=dev --depth=0` exit 0 sin extraneous; `npm ci` OK | PASS |
| 11 | Sin dependencias injustificadas | Contraste `package.json` vs `dependency_justification` del contrato | PASS |
| 12 | Comando reproducible de typecheck | script `typecheck` en package.json, exit 0 | PASS |
| 13 | Configuración base de linting | `eslint.config.js` presente, `npm run lint` exit 0 | PASS |
| 14 | Configuración base de pruebas según docs/TESTING.md | unit / integration / e2e existen y pasan; assertions concretas | PASS |
| 15 | Los comandos de verificación requeridos terminan correctamente | `./init.sh` exit 0, 5 gates de app en `[OK]` | PASS |
| 16 | Sin secretos, credenciales ni archivos de entorno privados | `find`, `git ls-files`, grep de secretos, `.gitignore`, gate Hygiene | PASS |
| 17 | Evidencia registrada en progress/evidence/TASK-001-implementation.md | Lectura del archivo: versiones, comandos, salidas y tabla acceptance -> evidencia | PASS |
| 18 | `./init.sh` termina correctamente al finalizar la tarea | `./init.sh` exit 0 ejecutado por QA | PASS |

18/18 PASS.

## Hallazgos

Ninguno. No se encontró ningún defecto que requiera modificación de código, configuración o
evidencia para cumplir una acceptance del contrato.

## Observaciones no bloqueantes

No exigen modificación dentro de TASK-001; se registran por trazabilidad.

- **QA-O1 — Las correcciones F1-F4 siguen sin commitear ni publicar.** Confirmado por QA de forma
  independiente: `HEAD == origin/main == e9983e8`, y el clon del remoto todavía trae
  `react-test-renderer: "^19.2.3"` y `.claude/settings.local.json` versionado. Es el mismo estado
  en que está todo TASK-001 y no impide ninguna acceptance (ambos estados instalan y pasan los
  gates), pero el cierre de la task requiere commit + push por parte del usuario. Coincide con la
  observación O3 de la revisión #2.
- **QA-O2 — `progress/history.md` sigue sin la entrada de la ronda de corrección.** Su última
  entrada es la del 2026-08-09. `CHECKPOINTS.md` C6 la exige al declarar `DONE`, no en QA. Debe
  añadirse en el cierre. Coincide con O2 de la revisión #2.
- **QA-O3 — E2E depende de la caché global de Playwright.** `test:e2e` pasó en el clon y en la
  copia limpia porque chromium ya estaba en `~/Library/Caches/ms-playwright`. En una máquina nueva
  hay que ejecutar `npm run e2e:install` antes. Ya está documentado en la evidencia de
  implementación y el script está versionado.
- **QA-O4 — `allowed_paths` del contrato es más estrecho que el del task.** Ya registrado como O1
  en la revisión #2. `check_scope.py` usa el del task, y devuelve `SCOPE: OK (TASK-001)`. Es
  materia del planner en una tarea futura; no se corrige durante TASK-001.
- **QA-O5 — Aviso informativo de Expo.** Durante `test:e2e` el bundler informa
  `An update for expo is available: 57.0.11 → ~57.0.12` y `4 other packages may need updating`. Es
  un aviso, no un error; no afecta a ningún gate y actualizar versiones no está pedido por el task.
- **QA-O6 — Compatibilidad nativa verificada solo por configuración.** No se ejecutó la app en
  simulador iOS ni Android (requiere `expo prebuild` y toolchain nativa). La acceptance pide
  "mantiene compatibilidad", verificable por configuración resuelta y dependencias alineadas, y así
  se verificó. Se anota como límite del alcance de esta QA, ya declarado en "No verificado" de la
  evidencia de implementación.

## Confirmación de rol read-only

QA no editó, creó ni borró ningún archivo de código, test, configuración ni harness. **El único
archivo escrito en esta fase es este mismo archivo**, `progress/evidence/TASK-001-qa.md`.

No se modificaron `.harness/tasks/TASK-001.json`, `progress/current.md`, `progress/history.md`,
`progress/evidence/TASK-001-implementation.md` ni `progress/evidence/TASK-001-review.md`. No se
ejecutó ningún comando de escritura de Git (`commit`, `add`, `push`, `checkout`).

Todos los artefactos temporales de verificación se escribieron fuera del árbol del repositorio:
`/tmp/qa_typecheck.log`, `/tmp/qa_lint.log`, `/tmp/qa_unit.log`, `/tmp/qa_integration.log`,
`/tmp/qa_smoke.log`, `/tmp/qa_e2e.log`, `/tmp/qa_init.log`, `/tmp/qa_expoconfig.log`,
`/tmp/qa_page.html`, `/tmp/qa_clone/`, `/tmp/qa_wt/`. El servidor web levantado para la comprobación
manual (`:8087`) fue detenido al terminar. `git status --porcelain` es idéntico antes y después de
la QA, salvo la aparición de este archivo de evidencia.

Conforme a `.harness/agents/qa.md` y a `.harness/policies/files.json` (`qa_read_only: true`).

## Acción requerida

Ninguna sobre el código ni la configuración. TASK-001 puede avanzar al cierre. Antes de declarar
`DONE`, el orquestador/usuario debe atender los puntos de `CHECKPOINTS.md` C6 que siguen abiertos y
que están fuera del rol de QA: entrada append-only en `progress/history.md` (QA-O2), commit + push
de las correcciones F1-F4 y de la evidencia (QA-O1), `progress/current.md` limpio, transición de
estado de la task y `./init.sh` final.
