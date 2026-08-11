# TASK-001 — Implementation Evidence

## Resumen

- Task: TASK-001 — Preparar e instalar el entorno base del proyecto
- Agente: implementer
- Contrato: `.harness/contracts/TASK-001.json`
- Commit/base: repositorio sin Git inicializado (`.git/**` es `protected_path` en `.harness/policies/files.json`)
- Baseline: `./init.sh` exit 0 antes de editar (2026-08-09)
- Fecha: 2026-08-09

## Documentos leídos antes de decidir qué instalar

Leídos en este orden, antes del primer cambio de archivos:

1. `AGENTS.md`
2. `progress/current.md`
3. `.harness/tasks/TASK-001.json`
4. `docs/PRODUCT.md`
5. `docs/ARCHITECTURE.md`
6. `docs/CONVENTIONS.md`
7. `docs/TESTING.md`
8. `docs/VERIFICATION.md`
9. `docs/SECURITY.md`
10. `CHECKPOINTS.md`, `.harness/config.json`, `.harness/policies/*.json`, `.harness/agents/implementer.md`, `scripts/verify.py`, `scripts/check_scope.py`, `scripts/check_evidence.py`, `init.sh` (para conocer los gates que debe satisfacer el entorno)

No se leyó `progress/history.md` (no procedía según AGENTS.md sección E).

## Versiones del entorno

```text
node: v22.22.2      (package.json engines: ">=20.19.4", mínimo de Expo SDK 57)
npm : 10.9.7        (package.json engines: ">=10")
Expo SDK: 57.0.11
React: 19.2.3   React Native: 0.86.2
TypeScript: 6.0.3
Gestor de paquetes: npm; lockfile package-lock.json (lockfileVersion 3, 1117 entradas)
```

## Archivos creados/modificados

| Archivo | Motivo |
|---|---|
| `package.json` | Manifiesto, engines y scripts reproducibles |
| `package-lock.json` | Lockfile del gestor de paquetes |
| `app.json` | Config Expo: name/slug/scheme, plugin expo-router, ios/android/web |
| `tsconfig.json` | TypeScript strict sobre `expo/tsconfig.base` |
| `eslint.config.js` | Config base de lint (flat config de `eslint-config-expo`) |
| `jest.config.js` | Proyectos `unit` e `integration` con preset `jest-expo` |
| `playwright.config.ts` | E2E web con webServer de Expo |
| `.gitignore` | Ignora node_modules, artefactos de build/test y `.env*` |
| `app/_layout.tsx` | Layout raíz de Expo Router (Stack + SafeAreaProvider + StatusBar) |
| `app/index.tsx` | Pantalla placeholder del entorno (sin lógica de producto) |
| `tests/unit/index-screen.test.tsx` | Unit test (fase 2 de docs/TESTING.md) |
| `tests/integration/expo-router-navigation.test.tsx` | Integration test del enrutado real (fase 3) |
| `tests/e2e/web-boot.spec.ts` | E2E/smoke web con Playwright (fase 4) |
| `scripts/smoke_web.mjs` | Smoke reproducible de arranque web |
| `.harness/contracts/TASK-001.json` | Contrato con verification_matrix |
| `.harness/tasks/TASK-001.json` | Transición de estado |
| `progress/current.md`, `progress/history.md`, este archivo | Estado y evidencia |

Todos dentro de `allowed_paths`. Se descartó crear `assets/` (iconos de la plantilla Expo) por estar fuera de `allowed_paths`; Expo usa sus iconos por defecto y `expo-doctor` pasa igualmente.

## Dependencias y justificación

Producción (`dependencies`):

| Dependencia | Versión | Justificación |
|---|---|---|
| expo | ~57.0.11 | Base multiplataforma (docs/ARCHITECTURE.md) |
| react | 19.2.3 | Runtime requerido por Expo/RN |
| react-native | 0.86.2 | Base multiplataforma (docs/ARCHITECTURE.md) |
| expo-router | ~57.0.11 | Navegación confirmada (task + docs/ARCHITECTURE.md) |
| expo-constants | ~57.0.9 | Requerida por expo-router (manifest) |
| expo-linking | ~57.0.5 | Requerida por expo-router (deep linking) |
| expo-status-bar | ~57.0.1 | Barra de estado en el layout raíz |
| react-native-safe-area-context | ~5.7.0 | Peer nativa de expo-router (iOS/Android) |
| react-native-screens | ~4.26.0 | Peer nativa de expo-router (iOS/Android) |
| react-dom | 19.2.3 | Plataforma web |
| react-native-web | ^0.21.2 | Plataforma web |
| @expo/metro-runtime | ~57.0.8 | Runtime web de Metro (Fast Refresh / web) |

Desarrollo (`devDependencies`):

| Dependencia | Versión | Justificación |
|---|---|---|
| typescript | ~6.0.3 | TypeScript confirmado |
| @types/react | ~19.2.4 | Tipos de React |
| eslint | ^9.39.5 | Gate de lint (docs/TESTING.md fase 1, init.sh) |
| eslint-config-expo | ~57.0.1 | Reglas base para proyectos Expo |
| jest | ^29.7.0 | Runner de unit/integration (fases 2-3) |
| jest-expo | ~57.0.3 | Preset Jest para Expo/RN |
| @testing-library/react-native | ^13.3.3 | Asserts sobre comportamiento renderizado |
| react-test-renderer | 19.2.3 | Peer de @testing-library/react-native, fijada a la versión de React del SDK |
| @types/jest | ^29.5.14 | Tipos de Jest para el typecheck |
| @playwright/test | ^1.62.1 | E2E web (docs/ARCHITECTURE.md, docs/TESTING.md fase 4) |

No se instaló ninguna dependencia de producto. En concreto, **Supabase / PostgreSQL no se instalaron** en esta tarea: aparecen en `docs/ARCHITECTURE.md`, pero configurarlos exige credenciales y esquema no confirmados por el usuario y entra en `out_of_scope` de TASK-001.

Comprobación de que no hay dependencias sueltas ni extraneous:

```text
$ npm ls --depth=0
flashcards@0.1.0
+-- @expo/metro-runtime@57.0.8      +-- react-dom@19.2.3
+-- @playwright/test@1.62.1         +-- react-native-safe-area-context@5.7.0
+-- @testing-library/react-native@13.3.3  +-- react-native-screens@4.26.2
+-- @types/jest@29.5.14             +-- react-native-web@0.21.2
+-- @types/react@19.2.18            +-- react-native@0.86.2
+-- eslint-config-expo@57.0.1       +-- react-test-renderer@19.2.3
+-- eslint@9.39.5                   +-- react@19.2.3
+-- expo-constants@57.0.9           `-- typescript@6.0.3
+-- expo-linking@57.0.5
+-- expo-router@57.0.11
+-- expo-status-bar@57.0.1
+-- expo@57.0.11
+-- jest-expo@57.0.3
+-- jest@29.7.0
(sin UNMET/extraneous)
```

## Comandos ejecutados y resultados

```text
$ ./init.sh                       # baseline, antes de editar     -> exit 0
$ node -v                         -> v22.22.2
$ npm -v                          -> 10.9.7
$ npm install expo@~57.0.11       -> exit 0
$ npx expo install react react-native react-dom react-native-web @expo/metro-runtime \
        expo-router expo-constants expo-linking expo-status-bar \
        react-native-safe-area-context react-native-screens
                                  -> exit 0 (11 módulos alineados con SDK 57.0.0)
$ npm install --save-dev typescript @types/react jest-expo eslint-config-expo jest \
        @types/jest @testing-library/react-native react-test-renderer @playwright/test
                                  -> exit 0
$ npx playwright install chromium -> exit 0 (binario en la caché local del usuario, no en el repo)

$ npm run typecheck               -> exit 0, 0 errores de tsc
$ npm run lint                    -> exit 0, 9 archivos analizados, 0 errores, 0 warnings
$ npm test                        -> exit 0, 1 suite / 1 test PASS (proyecto "unit")
$ npm run test:integration        -> exit 0, 1 suite / 2 tests PASS (proyecto "integration")
$ npm run smoke:web               -> exit 0, SMOKE WEB: OK (http://localhost:8082 -> 200)
$ npm run test:e2e                -> exit 0, 1 passed (chromium, arranque web real)
$ npx expo config --type public   -> exit 0, platforms: ['ios','android','web']
$ npx expo-doctor@latest          -> exit 0, 20/20 checks passed
$ ./init.sh                       # final                          -> exit 0
```

Reinstalación desde cero (solo archivos versionados + npm):

```text
$ rsync -a --exclude node_modules --exclude .expo --exclude dist <repo>/ <tmp>/
$ cd <tmp> && npm ci              -> exit 0
$ npm run typecheck               -> exit 0
$ npm run lint                    -> exit 0
$ npm test                        -> exit 0 (1 test PASS)
$ npm run test:integration        -> exit 0 (2 tests PASS)
```

Config Expo resuelta (`npx expo config --type public`):

```text
name: 'Flashcards', slug: 'flashcards', scheme: 'flashcards', sdkVersion: '57.0.0'
plugins: ['expo-router', 'expo-status-bar']
platforms: ['ios', 'android', 'web']
ios: { supportsTablet: true, bundleIdentifier: 'com.flashcards.app' }
android: { package: 'com.flashcards.app', predictiveBackGestureEnabled: false }
web: { bundler: 'metro', output: 'static' }
```

Comprobación de secretos:

```text
$ find . -path ./node_modules -prune -o -name '.env*' -print
(sin resultados)
$ grep -rInE "(SUPABASE_(URL|KEY)|api[_-]?key|secret|password|token)\s*[:=]\s*['\"][^'\"]{8,}" \
    --include='*.ts' --include='*.tsx' --include='*.js' --include='*.json' \
    --exclude-dir=node_modules --exclude=package-lock.json .
(sin resultados)
.gitignore ignora: node_modules/, .expo/, dist/, web-build/, coverage/,
playwright-report/, test-results/, .env, .env.* (excepto .env.example), *.key, *.p12, *.pem
```

## Acceptance -> evidencia

| Acceptance | Método | Comando / procedimiento | Resultado |
|---|---|---|---|
| Documentos obligatorios leídos antes de instalar | inspection | Sección "Documentos leídos" de este archivo | PASS |
| Versión de Node.js y gestor de paquetes comprobada y documentada | static | `node -v`, `npm -v`, `engines` en package.json | PASS (v22.22.2 / 10.9.7) |
| Proyecto Expo correctamente inicializado | smoke | `npx expo config --type public`, `npx expo-doctor` | PASS (20/20 checks) |
| TypeScript configurado y typecheck sin errores | static | `npm run typecheck` | PASS (exit 0) |
| Expo Router instalado y configurado | smoke + integration | `main: expo-router/entry`, plugin en app.json, `npm run test:integration` | PASS (2 tests) |
| Ejecuta en web sin errores de arranque | smoke | `npm run smoke:web`, `npm run test:e2e` | PASS (HTTP 200, sin errores de consola) |
| Compatibilidad con Android e iOS | inspection | `npx expo config --type public` (platforms ios/android/web), `expo-doctor` | PASS |
| Dependencias registradas en package.json y lockfile | static | `npm ls --depth=0`, `npm ci` en copia limpia | PASS |
| Sin dependencias injustificadas | review | Tabla "Dependencias y justificación" | PASS |
| Comando reproducible de typecheck | static | `npm run typecheck` | PASS |
| Configuración base de linting | static | `eslint.config.js` + `npm run lint` (9 archivos, 0 errores) | PASS |
| Configuración base de pruebas según docs/TESTING.md | unit + integration + e2e | `npm test`, `npm run test:integration`, `npm run test:e2e` | PASS |
| Comandos de verificación requeridos terminan correctamente | static | `./init.sh` | PASS (exit 0) |
| Instalable desde cero con archivos versionados | integration | `npm ci` + gates en copia limpia | PASS |
| Sin funcionalidades de producto implementadas | review | `src/features/` sigue vacío; `app/` solo layout + placeholder | PASS |
| Sin secretos ni ficheros de entorno privados | inspection | `find` de `.env*`, grep de secretos, `.gitignore` | PASS |
| Evidencia registrada en progress/evidence/TASK-001-implementation.md | inspection | Este archivo | PASS |
| `./init.sh` termina correctamente al finalizar | static | `./init.sh` final | PASS (exit 0) |

## Resultados por capa

- Baseline: `./init.sh` exit 0 antes de editar.
- Static: typecheck exit 0; lint exit 0 (9 archivos, 0 errores/0 warnings).
- Unit: 1 suite / 1 test PASS.
- Integration: 1 suite / 2 tests PASS (montaje real del router y ruta inexistente).
- E2E/Smoke: Playwright chromium 1 test PASS contra el servidor web real; `smoke:web` HTTP 200.
- Regression: `./init.sh` final ejecuta typecheck + lint + test + test:integration + test:e2e -> todos [OK], exit 0.

## Riesgos / decisiones

- **npm como gestor de paquetes**: es el que asume `init.sh` y el predeterminado de Expo. Lockfile `package-lock.json`.
- **`react-server-dom-webpack` no instalado**: es peer de `jest-expo` pero su versión publicada exige `react ^19.2.4`, incompatible con el `react 19.2.3` que fija Expo SDK 57. No se usan React Server Components, y todos los tests pasan sin él. Si en el futuro se usan RSC, habrá que revisarlo.
- **Binarios de Playwright**: no viven en el repositorio. Tras clonar hay que ejecutar `npm run e2e:install` una vez antes de `npm run test:e2e`.
- **`node_modules` duplicado por sincronización de iCloud**: durante la tarea aparecieron 7 directorios duplicados (`@typescript-eslint/scope-manager 2`, etc.) dentro de `node_modules`, lo que hizo fallar `eslint` con `Cannot find module`. Se resolvió con `rm -rf node_modules && npm ci` y quedó verificado a 0 duplicados. Causa probable: el proyecto vive en `~/Documents`, sincronizado por iCloud Drive. **Riesgo abierto para el usuario**: conviene excluir el proyecto de iCloud o moverlo fuera de `~/Documents`.
- **Sin iconos de aplicación**: `assets/**` queda fuera de `allowed_paths`; se usan los iconos por defecto de Expo. Pendiente para una tarea futura si el usuario lo pide.
- **Git no inicializado**: `.git/**` es `protected_path`, por lo que `check_scope.py` se omite y `init.sh` deja un `[WARN]`. Decisión del usuario.

## No verificado

- Ejecución real en simulador/dispositivo iOS y Android (requiere `expo prebuild` y toolchain nativa). La compatibilidad se verificó por configuración resuelta (`platforms: ios, android, web`), dependencias nativas alineadas por `expo install` y `expo-doctor` 20/20.
- Supabase / PostgreSQL / RLS: fuera de scope en esta tarea.
- Playwright en CI (`process.env.CI`): la configuración existe pero no se ha ejecutado en un entorno CI real.
