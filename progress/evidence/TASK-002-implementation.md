# TASK-002 — Implementation Evidence

## Resumen

- Task: TASK-002 — Crear la base visual responsive y la estructura principal de navegación
- Agente: implementer
- Contrato: `.harness/contracts/TASK-002.json` (27 acceptance, `open_questions: []`)
- Base de Git: `4b2d30f chore(TASK-001): cerrar entorno base tras review y QA`
- Fecha: 2026-08-17

## Baseline

`./init.sh` ejecutado **antes** de modificar ningún archivo: **exit 0**.

```text
[OK] Harness válido
SCOPE: sin tarea de ejecución activa   [OK] Scope válido
[OK] Sin temporales/secretos obvios
[OK] typecheck   [OK] lint   [OK] test   [OK] test:integration   [OK] test:e2e
EVIDENCE: OK     [OK] Evidencia coherente
[OK] Estado verificable
```

Working tree limpio salvo `.harness/tasks/TASK-002.json`, creada por el usuario.

## Documentos leídos antes de implementar

`AGENTS.md`, `progress/current.md`, `bash scripts/agent_context.sh`, `.harness/tasks/TASK-002.json`,
`docs/PRODUCT.md`, `docs/ARCHITECTURE.md`, `docs/CONVENTIONS.md`, `docs/DESIGN.md`,
`docs/TESTING.md`, `docs/VERIFICATION.md`, más los archivos existentes necesarios para no inventar
patrones: `app/_layout.tsx`, `app/index.tsx`, `jest.config.js`, `playwright.config.ts`,
`tsconfig.json`, `eslint.config.js` y los tres tests heredados de TASK-001.

## Archivos creados y modificados

| Archivo | Estado | Motivo |
|---|---|---|
| `src/theme/tokens.ts` | nuevo | Tokens de color, tipografía, espaciado, radios, tamaños y breakpoint |
| `src/theme/index.ts` | nuevo | Punto de entrada del sistema de diseño |
| `src/lib/layout.ts` | nuevo | `resolveLayoutMode` (pura) y `useLayoutMode` (hook) |
| `src/components/ui/Button.tsx` | nuevo | Botón reutilizable con variantes y estados |
| `src/components/ui/Input.tsx` | nuevo | Campo de texto reutilizable con error y ayuda |
| `src/components/ui/Card.tsx` | nuevo | Contenedor de contenido reutilizable |
| `src/components/ui/Loading.tsx` | nuevo | Estado de carga |
| `src/components/ui/EmptyState.tsx` | nuevo | Estado vacío |
| `src/components/ui/Message.tsx` | nuevo | Mensajes y errores consistentes |
| `src/components/ui/index.ts` | nuevo | Barrel de componentes compartidos |
| `src/components/layout/AppShell.tsx` | nuevo | Layout principal responsive (sidebar / barra compacta) |
| `src/components/layout/NavigationItemButton.tsx` | nuevo | Control de navegación único para ambas disposiciones |
| `src/components/layout/navigation.ts` | nuevo | Declaración de las rutas de la navegación base |
| `src/components/layout/index.ts` | nuevo | Barrel del layout |
| `app/_layout.tsx` | modificado | Aplica `AppShell` una sola vez alrededor del `Stack` |
| `app/index.tsx` | modificado | Pantalla temporal que demuestra el sistema visual |
| `app/componentes.tsx` | nuevo | Catálogo de componentes, segunda ruta de la navegación |
| `playwright.config.ts` | modificado | De 1 a 3 proyectos: desktop-chrome, mobile-chrome, mobile-safari |
| `package.json` | modificado | `e2e:install` instala también webkit |
| `tests/unit/theme.test.ts` | nuevo | Tokens del sistema de diseño |
| `tests/unit/button.test.tsx` | nuevo | Comportamiento de Button |
| `tests/unit/input.test.tsx` | nuevo | Comportamiento de Input |
| `tests/unit/card.test.tsx` | nuevo | Comportamiento de Card |
| `tests/unit/feedback.test.tsx` | nuevo | Loading, EmptyState y Message |
| `tests/unit/responsive.test.tsx` | nuevo | Comportamiento responsive |
| `tests/unit/index-screen.test.tsx` | modificado | Adaptado a la nueva pantalla inicial |
| `tests/integration/navigation.test.tsx` | nuevo | Navegación base + regresión de duplicados |
| `tests/integration/expo-router-navigation.test.tsx` | modificado | Añadida la ruta `/componentes` |
| `tests/e2e/responsive-navigation.spec.ts` | nuevo | Navegación, responsive, overflow y táctil por dispositivo |
| `tests/e2e/web-boot.spec.ts` | modificado | Adaptado al nuevo contenido de la pantalla raíz |
| `.harness/contracts/TASK-002.json` | nuevo | Contrato con verification_matrix |
| `.harness/tasks/TASK-002.json` | modificado | Transiciones de estado |
| `progress/current.md`, este archivo | modificado/nuevo | Estado y evidencia |

Todos dentro de `allowed_paths`. `check_scope.py` lo confirma: `SCOPE: OK (TASK-002)`.

**Ninguna dependencia nueva.** `git diff HEAD --stat -- package-lock.json` está vacío: el lockfile
no cambió. El único cambio de `package.json` es el script `e2e:install`.

## Decisiones técnicas

1. **Dos rutas de andamiaje**: `/` (Inicio) y `/componentes` (catálogo). La acceptance exige una
   navegación base demostrable, pero `out_of_scope` prohíbe inventar secciones de producto. Ambas
   rutas describen el propio sistema visual. No se crearon secciones de mazos, estudio ni
   estadísticas.
2. **Responsive con `useWindowDimensions`, no con media queries CSS**. Las media queries no existen
   en Android ni iOS; el requisito es una misma base para las tres plataformas.
3. **Sidebar en desktop y barra inferior compacta en móvil**, fijado por `docs/DESIGN.md`.
4. **Un único `NavigationItemButton`** reutilizado por el sidebar y por la barra compacta, para no
   duplicar estilos ni comportamiento entre disposiciones.
5. **Solo los componentes que exige la acceptance** (Button, Input, Card, Loading, EmptyState,
   Message). `docs/DESIGN.md` lista más, pero `docs/CONVENTIONS.md` exige el cambio más pequeño que
   cumpla la tarea. El resto se creará cuando una tarea lo pida.
6. **`Input` reutiliza `Message`** para mostrar su error, en lugar de tener su propio estilo de
   error. Una sola forma de mostrar errores en toda la aplicación.
7. **`resolveLayoutMode` es una función pura** separada del hook, para poder probar el
   comportamiento responsive de forma determinista sin montar la UI.

## Bug encontrado y corregido durante la implementación

El E2E multi-dispositivo detectó un defecto real de navegación que los tests de integración
iniciales no capturaban:

```text
[desktop-chrome] Navegación base › navega entre las rutas base sin errores de consola
  Error: strict mode violation: getByTestId('demo-card') resolved to 2 elements
```

Al volver de `/componentes` a `/`, `router.navigate()` apilaba una **segunda instancia** de la
pantalla de inicio en el `Stack` en vez de sustituir la actual. Los tres proyectos fallaban igual.

- **Causa**: los destinos de la navegación base son de primer nivel; `navigate` mantiene el
  historial y apila.
- **Corrección**: `src/components/layout/AppShell.tsx` usa `router.replace()`.
- **Test de regresión**: `tests/integration/navigation.test.tsx`, caso *"no acumula historial al
  navegar entre destinos de primer nivel"*, que afirma `router.canGoBack() === false` en cada paso
  del viaje de ida y vuelta. Ver la corrección R1 más abajo: la primera versión de este test era
  vacua y el reviewer lo demostró.

No se debilitó ningún test para conseguir verde: el test se endureció.

## Comandos ejecutados y resultados

```text
$ ./init.sh                    # baseline, antes de editar        -> exit 0
$ npm run typecheck                                               -> exit 0, 0 errores
$ npm run lint                                                    -> exit 0, 0 errores / 0 warnings
$ npm test                                                        -> exit 0, 7 suites / 36 tests PASS
$ npm run test:integration                                        -> exit 0, 2 suites / 8 tests PASS
$ npm run test:e2e                                                -> exit 0, 19 passed, 2 skipped
$ npm run smoke:web            -> exit 0, SMOKE WEB: OK (http://localhost:8082 -> 200)
$ npx expo config --type public                                   -> platforms: 'ios', 'android', 'web'
$ npx playwright install webkit                                   -> exit 0
$ ./init.sh                    # final                            -> exit 0
```

`./init.sh` final:

```text
[OK] Harness válido
SCOPE: OK (TASK-002)   [OK] Scope válido
[OK] Sin temporales/secretos obvios
[OK] typecheck   [OK] lint   [OK] test   [OK] test:integration   [OK] test:e2e
EVIDENCE: OK     [OK] Evidencia coherente
[OK] Estado verificable
```

### Cobertura por dispositivo

`npm run test:e2e` ejecuta la suite en tres proyectos, uno por cada tipo de dispositivo que
declaran los archivos del proyecto (`app.json`: ios, android, web; `docs/DESIGN.md`: desktop y
móvil):

| Proyecto | Dispositivo | Motor | Viewport |
|---|---|---|---|
| `desktop-chrome` | Desktop Chrome | Chromium | 1280x800 |
| `mobile-chrome` | Pixel 5 | Chromium (Android) | 393x851 |
| `mobile-safari` | iPhone 13 | WebKit (motor de iOS) | 390x664 |

Resultado: **19 passed, 2 skipped**. Los 2 saltados son las comprobaciones de tamaño táctil en
`desktop-chrome`, que declaran explícitamente `test.skip(..., 'Solo aplica a pantallas táctiles.')`.

### Greps de verificación

```text
$ grep -rniE '(mazo|deck|login|auth|supabase|estadístic|scheduler|repetición|estudi)' src/
  sin coincidencias
$ grep -rniE '(iniciar sesión|mis mazos|crear mazo|estudiar ahora|racha|aciertos)' app/
  sin coincidencias
$ grep -rnE "#[0-9A-Fa-f]{6}" app/ src/components/ src/lib/
  sin coincidencias      (todos los colores viven en src/theme/tokens.ts)
$ grep -rnE '\bany\b|TODO|FIXME|console\.log' app/ src/ tests/
  sin coincidencias
$ grep -rnE '\b(document|window)\.' src/ app/
  sin coincidencias      (sin APIs exclusivas de web en el código compartido)
```

## Acceptance -> evidencia

| # | Acceptance | Método | Evidencia | Resultado |
|---|---|---|---|---|
| 1 | Sistema de diseño centralizado | unit | `src/theme/tokens.ts` + `tests/unit/theme.test.ts` (6 tests: escalas crecientes, formato de color, táctil >= 44, breakpoint) | PASS |
| 2 | Layout principal reutilizable | integration | `src/components/layout/AppShell.tsx` aplicado una sola vez en `app/_layout.tsx`; ninguna pantalla reimplementa cabecera ni navegación | PASS |
| 3 | Navegación base con Expo Router | integration | `tests/integration/navigation.test.tsx` (5 tests con `renderRouter` real) | PASS |
| 4 | La navegación funciona sin errores en web | e2e | `responsive-navigation.spec.ts` "navega entre las rutas base sin errores de consola": cambia de ruta, cambia la URL y `consoleErrors` queda vacío, en los 3 proyectos | PASS |
| 5 | Compatible con Android e iOS | inspection | `npx expo config --type public` -> `platforms: 'ios', 'android', 'web'`; grep sin `document.`/`window.`; solo primitivas de react-native | PASS |
| 6 | Se adapta a desktop | e2e | `desktop-chrome` (1280x800): `app-sidebar` visible, `app-tabbar` con count 0 | PASS |
| 7 | Se adapta a móvil | e2e | `mobile-chrome` (Pixel 5) y `mobile-safari` (iPhone 13): `app-tabbar` y `app-header` visibles, `app-sidebar` con count 0 | PASS |
| 8 | Sin overflow horizontal | e2e | `scrollWidth - clientWidth <= 0` en `/` y `/componentes`, en los 3 proyectos (6 comprobaciones) | PASS |
| 9 | Objetivos táctiles utilizables | e2e + unit | En los 2 proyectos móviles se mide el `boundingBox` de cada control visible de `#root`; ninguno baja de 44x44. Más `tests/unit/theme.test.ts` sobre `sizes.touchTarget` y los tests de estilo de Button e Input | PASS |
| 10 | Componente Button | unit | `tests/unit/button.test.tsx` (5 tests: label, onPress, disabled, loading, tamaño táctil, rol) | PASS |
| 11 | Componente Input | unit | `tests/unit/input.test.tsx` (5 tests: label/valor, texto exacto, error con rol alert, ayuda oculta con error, altura) | PASS |
| 12 | Componente Card | unit | `tests/unit/card.test.tsx` (3 tests: secciones, opcionales omitidas, tokens de radio y padding) | PASS |
| 13 | Estructura para estados de carga | unit | `tests/unit/feedback.test.tsx` describe Loading (rol progressbar, label, mensaje por defecto) | PASS |
| 14 | Estructura para estados vacíos | unit | `tests/unit/feedback.test.tsx` describe EmptyState (título, descripción, acción opcional pulsable) | PASS |
| 15 | Forma consistente de mostrar errores/mensajes | unit | `Message` con variantes info/success/error; solo error usa `accessibilityRole="alert"`; `Input` lo reutiliza en lugar de tener su propio error | PASS |
| 16 | Componentes sin lógica de feature futura | review | grep de términos de producto sobre `src/` sin coincidencias; todos los componentes reciben props visuales genéricas | PASS |
| 17 | Pantalla temporal que demuestra el sistema | integration | `app/index.tsx` monta Card, Input, Button, Loading, EmptyState y Message; `tests/unit/index-screen.test.tsx` comprueba los 6 testID | PASS |
| 18 | La pantalla temporal no simula producto | review | grep sin coincidencias; test explícito que afirma que no existen "Iniciar sesión", "Mis mazos", "Estudiar" ni "Estadísticas" | PASS |
| 19 | Estilos no duplicados | review | Cero literales hexadecimales fuera de `src/theme/`; un único `NavigationItemButton` para sidebar y barra compacta | PASS |
| 20 | Respeta ARCHITECTURE y CONVENTIONS | review | Estructura `src/components/`, `src/theme/`, `src/lib/` conforme a `docs/ARCHITECTURE.md`; typecheck y lint en exit 0; sin `any`, sin TODOs, sin logs de debug | PASS |
| 21 | Tests de los componentes reutilizables | unit | 36 tests unitarios; cada componente compartido verifica resultados concretos, no ausencia de excepción | PASS |
| 22 | Prueba del comportamiento responsive | unit + e2e | `tests/unit/responsive.test.tsx`: `resolveLayoutMode` en 6 anchos + AppShell con el mismo componente mostrando barra compacta o sidebar según el modo. Más los 3 proyectos de Playwright | PASS |
| 23 | Prueba de integración de la navegación | integration | `tests/integration/navigation.test.tsx` (5 tests, incluida la regresión de duplicados) | PASS |
| 24 | Sigue arrancando por smoke/E2E | smoke | `npm run smoke:web` -> HTTP 200, `SMOKE WEB: OK`; `web-boot.spec.ts` pasa en los 3 proyectos | PASS |
| 25 | Sin regresiones en la suite anterior | integration | `./init.sh` ejecuta la suite completa: 36 unit + 8 integration + 19 e2e, todo en verde | PASS |
| 26 | `./init.sh` exit 0 | static | Exit code 0 con los diez gates en `[OK]` | PASS |
| 27 | Evidencia registrada | inspection | Este archivo | PASS |

### Tests heredados de TASK-001 que se actualizaron

Tres tests afirmaban textos de la pantalla placeholder que la propia acceptance de TASK-002 obliga a
sustituir. Se actualizaron sus asserts, no se debilitaron:

| Test | Antes | Ahora |
|---|---|---|
| `tests/unit/index-screen.test.tsx` | 1 test sobre "Entorno base preparado." | 4 tests: título, uso de los 6 componentes compartidos, campo que refleja lo escrito, ausencia de funcionalidades falsas |
| `tests/integration/expo-router-navigation.test.tsx` | 2 tests | 3 tests, añadida la resolución de `/componentes` |
| `tests/e2e/web-boot.spec.ts` | Texto plano | Rol `heading` + `demo-card`, y ahora corre en 3 dispositivos |

## Resultados por capa

- **Baseline**: `./init.sh` exit 0 antes de editar.
- **Scope**: `SCOPE: OK (TASK-002)`.
- **Static**: typecheck exit 0; lint exit 0, 0 errores y 0 warnings.
- **Unit**: 7 suites / 36 tests PASS.
- **Integration**: 2 suites / 8 tests PASS.
- **Responsive**: cubierto por `tests/unit/responsive.test.tsx` y por los 3 proyectos de Playwright.
- **E2E**: 19 passed / 2 skipped sobre desktop, Pixel 5 e iPhone 13.
- **Regression**: `./init.sh` final exit 0 con todos los gates en `[OK]`.

## Corrección de los hallazgos del review #1

El review #1 (`progress/evidence/TASK-002-review.md`) emitió **CHANGES_REQUIRED** con tres
hallazgos. La task volvió a `IMPLEMENTING` para cerrarlos, sin ampliar scope.

### R1 (ALTA) — El test de regresión no detectaba el bug

El reviewer revirtió `router.replace` a `router.navigate` y demostró que el test que la evidencia
presentaba como regresión **pasaba igualmente**: en `renderRouter` la pantalla anterior se
desmonta, así que `getAllByTestId('demo-card')).toHaveLength(1)` era cierto con y sin el bug. El
guardián real era el E2E, no ese test. La afirmación de la evidencia era falsa.

Corrección: el test ya no cuenta nodos montados, comprueba el **historial de navegación**, que es
lo que de verdad distingue `replace` de `navigate`:

```ts
expect(router.canGoBack()).toBe(false);   // en cada paso del viaje de ida y vuelta
```

Demostración de que ahora sí falla con el bug presente:

```text
=== A) Con la corrección (router.replace) ===
Tests:       8 passed, 8 total

=== B) Reintroduciendo el bug (router.navigate) ===
  ● Navegación base › no acumula historial al navegar entre destinos de primer nivel
Tests:       1 failed, 7 passed, 8 total

=== C) Restaurando ===
    router.replace(href);
```

El archivo quedó restaurado; `git status` no muestra residuos.

### R2 (MEDIA) — `progress/current.md` desactualizado

Decía `IMPLEMENTING` con los pasos 4-9 marcados como pendientes cuando ya estaban hechos.
Incumplía `CHECKPOINTS.md` C1 ("`progress/current.md` representa exactamente la sesión activa").
Actualizado al estado real, con el resultado del review #1 y los pasos que faltan.

### R3 (BAJA) — `Input.multiline` era una abstracción sin necesidad

Prop y rama de estilo sin ningún consumidor ni test, y prefabricaba el TextArea que el
`out_of_scope` del contrato excluye explícitamente. Incumplía `docs/CONVENTIONS.md` 2 y 10.
Eliminados la prop `multiline`, su uso en el `TextInput` y el estilo `fieldMultiline`.

Gates tras la corrección: ver "Comandos ejecutados" más abajo; `./init.sh` exit 0.

## Riesgos

- **Binarios de Playwright**: `mobile-safari` necesita WebKit. En una máquina nueva hay que ejecutar
  `npm run e2e:install` (ya actualizado para instalar chromium **y** webkit) antes de `npm run test:e2e`.
- **Tiempo de E2E**: al triplicar los proyectos, la suite tarda ~3x. Sigue por debajo de 15 s en local.
- **`assets/` sigue sin iconos propios**: heredado de TASK-001, fuera de `allowed_paths` entonces.
  No afecta a esta tarea.
- **Sin modo oscuro**: los tokens son de tema claro. No lo pide la acceptance y no hay decisión de
  producto; añadirlo habría sido inventar alcance. Los tokens están centralizados, así que
  introducirlo después no obliga a tocar los componentes uno a uno.

## No verificado

- **Ejecución real en simulador o dispositivo físico iOS/Android**: requiere `expo prebuild` y
  toolchain nativa. La compatibilidad se verificó por configuración resuelta
  (`platforms: ios, android, web`), por la ausencia de APIs exclusivas de web en el código
  compartido y por el uso exclusivo de primitivas de react-native. `mobile-safari` ejercita el
  motor WebKit de iOS, pero en web, no como app nativa.
- **Lectores de pantalla reales** (VoiceOver / TalkBack): se verifican los roles y estados de
  accesibilidad expuestos por los componentes, no la experiencia real de un lector de pantalla.
- **Playwright en CI**: la configuración contempla `process.env.CI`, pero no se ha ejecutado en un
  entorno CI real.
- **Rendimiento y animaciones**: fuera del alcance de la tarea.
