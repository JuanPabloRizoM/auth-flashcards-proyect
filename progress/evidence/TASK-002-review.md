# TASK-002 — Review independiente

- **Task:** TASK-002 — Crear la base visual responsive y la estructura principal de navegación
- **Estado revisado:** `REVIEWING`
- **Agente:** reviewer (independiente, READ ONLY)
- **Fecha:** 2026-08-17
- **Base de Git:** `4b2d30f chore(TASK-001): cerrar entorno base tras review y QA`

## Veredicto

**CHANGES_REQUIRED**

Motivo resumido: el test que la evidencia declara como *test de regresión* del bug de navegación
**no falla cuando se revierte la corrección** (verificado empíricamente), y `progress/current.md`
no representa la sesión activa. Ambos puntos exigen modificación. El resto de la implementación es
sólida y los 27 acceptance están cubiertos por artefactos reales.

## Documentos leídos

1. `AGENTS.md`
2. `.harness/agents/reviewer.md`
3. `.harness/tasks/TASK-002.json`
4. `.harness/contracts/TASK-002.json` (27 acceptance + `verification_matrix` de 27 entradas)
5. `docs/ARCHITECTURE.md`
6. `docs/CONVENTIONS.md`
7. `docs/DESIGN.md`
8. `docs/VERIFICATION.md`
9. `docs/TESTING.md`
10. `CHECKPOINTS.md`
11. `docs/PRODUCT.md`
12. `progress/current.md`
13. `progress/evidence/TASK-002-implementation.md`
14. `.harness/policies/files.json`, `init.sh`, `scripts/verify.py`, `scripts/check_scope.py`,
    `scripts/check_evidence.py`

## Diff revisado

`git status --porcelain` (24 entradas) y `git diff HEAD`. Como gran parte del trabajo son archivos
**nuevos sin trackear**, se leyeron íntegros con Read, no solo por diff:

Modificados (trackeados): `app/_layout.tsx`, `app/index.tsx`, `package.json`,
`playwright.config.ts`, `progress/current.md`, `tests/e2e/web-boot.spec.ts`,
`tests/integration/expo-router-navigation.test.tsx`, `tests/unit/index-screen.test.tsx`.

Nuevos (untracked, leídos completos): `src/theme/tokens.ts`, `src/theme/index.ts`,
`src/lib/layout.ts`, `src/components/ui/{Button,Input,Card,Loading,EmptyState,Message,index}`,
`src/components/layout/{AppShell,NavigationItemButton,navigation,index}`, `app/componentes.tsx`,
`tests/unit/{theme,button,input,card,feedback,responsive}`,
`tests/integration/navigation.test.tsx`, `tests/e2e/responsive-navigation.spec.ts`,
`.harness/contracts/TASK-002.json`, `.harness/tasks/TASK-002.json`,
`progress/evidence/TASK-002-implementation.md`.

Total revisado: 28 archivos TS/TSX, 1705 líneas.

---

## 1. Scope

- `python3 scripts/check_scope.py` → `SCOPE: OK (TASK-002)`. Todos los archivos tocados caen en
  `allowed_paths` o en `always_allowed_meta_paths`.
- No se observan cambios oportunistas: no se tocaron `tsconfig.json`, `eslint.config.js`,
  `jest.config.js`, `app.json`, `scripts/**` ni `assets/**`.
- **Dependencias: ninguna añadida.** Verificado de forma independiente:
  - `git diff HEAD --stat -- package-lock.json` → salida vacía; el lockfile no cambió.
  - El único cambio de `package.json` es el script `e2e:install`
    (`playwright install --with-deps chromium` → `... chromium webkit`), coherente con la decisión
    técnica de pasar a 3 proyectos de Playwright. No es una dependencia nueva.
  - `dependencies` y `devDependencies` son idénticas a las de TASK-001.
- Acceptance no modificada durante la implementación: `task.acceptance == contract.acceptance`
  (27 == 27, comparación literal `True`), `allowed_paths` idénticos, y la `verification_matrix`
  cubre exactamente las 27 acceptance en el mismo orden.

## 2. Correctitud contra las 27 acceptance

Revisión independiente contra los artefactos reales, no contra el relato:

| # | Acceptance | Verificado por el reviewer | OK |
|---|---|---|---|
| 1 | Sistema de diseño centralizado | `src/theme/tokens.ts` expone `colors`, `typography` (size/weight/lineHeight), `spacing`, `radius`, `sizes`, `breakpoints`, todo `as const` y tipado. `tests/unit/theme.test.ts` (6 tests) verifica escalas crecientes, formato de color y `touchTarget >= 44` | Sí |
| 2 | Layout principal reutilizable | `AppShell` aplicado **una sola vez** en `app/_layout.tsx`; ni `app/index.tsx` ni `app/componentes.tsx` reimplementan cabecera o navegación | Sí |
| 3 | Navegación base con Expo Router | `app/index.tsx` + `app/componentes.tsx`; `tests/integration/navigation.test.tsx` monta el router real con `renderRouter` | Sí |
| 4 | Navegación sin errores en web | E2E `responsive-navigation.spec.ts:20` captura `console` type=error y afirma `consoleErrors == []`; verde en los 3 proyectos | Sí |
| 5 | Compatible con Android e iOS | `npx expo config --type public` → `platforms: ['ios','android','web']`; grep propio: cero usos de `document.`/`window.` en `src/` y `app/`; solo primitivas de react-native | Sí |
| 6 | Vista desktop | E2E `desktop-chrome` 1280x800: `app-sidebar` visible, `app-tabbar` count 0. Verde | Sí |
| 7 | Vista móvil | E2E `mobile-chrome` (Pixel 5) y `mobile-safari` (iPhone 13): `app-tabbar` + `app-header` visibles, `app-sidebar` count 0. Verde | Sí |
| 8 | Sin overflow horizontal | E2E compara `scrollWidth - clientWidth <= 0` en `/` y `/componentes` × 3 proyectos = 6 comprobaciones. Verde | Sí |
| 9 | Objetivos táctiles | E2E mide `boundingBox` de todo control visible (`[role=button]`, `[role=link]`, `input`, `textarea`) en los 2 proyectos móviles, con `expect(total).toBeGreaterThan(0)` previo; más `sizes.touchTarget >= 44` y asserts de estilo en Button/Input | Sí |
| 10 | Button | `src/components/ui/Button.tsx`; `tests/unit/button.test.tsx` (5 tests con resultados concretos) | Sí |
| 11 | Input | `src/components/ui/Input.tsx`; `tests/unit/input.test.tsx` (5 tests) | Sí |
| 12 | Card | `src/components/ui/Card.tsx`; `tests/unit/card.test.tsx` (3 tests, incluye tokens de radio/padding) | Sí |
| 13 | Estados de carga | `Loading` con `accessibilityRole="progressbar"`; `feedback.test.tsx` | Sí |
| 14 | Estados vacíos | `EmptyState` con acción opcional; `feedback.test.tsx` verifica que la acción solo aparece cuando se pasa y que es pulsable | Sí |
| 15 | Errores/mensajes consistentes | `Message` (info/success/error), `accessibilityRole="alert"` solo en error; `Input` lo reutiliza en vez de tener su propio estilo de error | Sí |
| 16 | Sin lógica de feature futura | Grep propio sobre `src/`: cero coincidencias de mazo/deck/login/auth/supabase/estadística/scheduler/repetición/estudio. Todos los componentes reciben props visuales genéricas | Sí |
| 17 | Pantalla temporal que demuestra el sistema | `app/index.tsx` monta Card, Input, Button×2, Loading, EmptyState y Message sin recrearlos; `index-screen.test.tsx` comprueba los 6 testID | Sí |
| 18 | La pantalla temporal no simula producto | Lectura del contenido textual de `app/index.tsx` y `app/componentes.tsx`: hablan del propio sistema visual. Test explícito que afirma la ausencia de "Iniciar sesión", "Mis mazos", "Estudiar" y "Estadísticas" | Sí |
| 19 | Estilos no duplicados | Grep propio `#[0-9A-Fa-f]{3,8}` y `rgba?\(`/`hsla?\(` sobre `app/`, `src/components/`, `src/lib/`, `tests/`: **cero coincidencias**. Un único `NavigationItemButton` para sidebar y barra compacta | Sí |
| 20 | Respeta ARCHITECTURE y CONVENTIONS | Estructura `src/components/`, `src/theme/`, `src/lib/` conforme; typecheck y lint exit 0; cero `any`, cero TODO/FIXME, cero `console.*`, cero `eslint-disable`/`@ts-ignore` | Parcial — ver hallazgo 3 |
| 21 | Tests de los componentes reutilizables | 36 tests unitarios; revisados uno a uno: verifican resultados concretos (label exacto, texto propagado exacto, rol de accesibilidad, valores de token), no la mera ausencia de excepción | Sí |
| 22 | Prueba responsive | `tests/unit/responsive.test.tsx`: `resolveLayoutMode` en 6 anchos alrededor del breakpoint + AppShell mostrando tabbar o sidebar sobre el mismo componente. Más los 3 proyectos de Playwright | Sí |
| 23 | Prueba de integración de la navegación | `tests/integration/navigation.test.tsx` (5 tests, `renderRouter` real, cambio de contenido y estado `selected`) | Sí como prueba de navegación, **No** como prueba de regresión — ver hallazgo 1 |
| 24 | Sigue arrancando por smoke/E2E | `npm run smoke:web` → `SMOKE WEB: OK (http://localhost:8082 -> 200)`, exit 0; `web-boot.spec.ts` verde en 3 proyectos | Sí |
| 25 | Sin regresiones | `./init.sh` completo verde; los 3 tests heredados se actualizaron de forma legítima (ver punto 3) | Sí |
| 26 | `./init.sh` exit 0 | Ejecutado por el reviewer: **exit 0** | Sí |
| 27 | Evidencia registrada | `progress/evidence/TASK-002-implementation.md` completo (baseline, archivos, decisiones, comandos, matriz, riesgos, no verificado) | Sí, con una afirmación incorrecta — ver hallazgo 1 |

## 3. Calidad de los tests

**Tests nuevos.** Verifican resultados concretos, no ausencia de excepción:
`onPress` llamado exactamente 1 vez y **no** llamado en `disabled`/`loading`; `onChangeText`
recibido con el texto exacto; `accessibilityRole` esperado por variante; `minHeight`/`minWidth`
comparados contra `sizes.touchTarget`; `borderRadius`/`padding` comparados contra los tokens;
mensaje por defecto de `Loading`; `helperText` oculto cuando hay error. Cumplen docs/TESTING.md.

**Tests heredados actualizados: legítimo, no debilitamiento.** Los 3 cambios son consecuencia
directa de que la acceptance 17 obliga a sustituir el contenido observable de la pantalla raíz,
supuesto que la propia `verification_matrix` (acceptance 25) autoriza expresamente:

| Test | Antes | Ahora | Juicio |
|---|---|---|---|
| `tests/unit/index-screen.test.tsx` | 1 test: header "Flashcards" + texto "Entorno base preparado." | 4 tests: header, uso de los 6 componentes compartidos, el campo refleja lo escrito, ausencia de funcionalidades falsas | **Endurecido** |
| `tests/integration/expo-router-navigation.test.tsx` | 2 tests con `getByText` | 3 tests con testID + resolución de `/componentes` | **Equivalente o mejor.** El cambio de `getByText('Flashcards')` a testID es además necesario: `AppShell` introduce la marca "Flashcards" en el sidebar/header, así que el texto ya no es único |
| `tests/e2e/web-boot.spec.ts` | `getByText('Flashcards')` + `getByText('Entorno base preparado.')` | `getByRole('heading', { name: 'Flashcards' })` + `getByTestId('demo-card')`, y ahora en 3 dispositivos | **Endurecido**: pasa de texto plano a rol accesible y triplica la cobertura de dispositivos |

Ningún assert fue eliminado sin sustituto, no se añadió ningún `skip`/`only` salvo el
`test.skip` condicional y documentado de los tests táctiles en desktop, no hay
`eslint-disable`, `@ts-ignore` ni `@ts-expect-error` en todo el árbol.

**Excepción:** el test declarado como regresión del bug de navegación es vacuo. Ver hallazgo 1.

## 4. Regresiones

`./init.sh` completo ejecutado por el reviewer: **exit 0**, los diez gates en `[OK]`.
Conteos comprobados de forma independiente y coincidentes con la evidencia:
36 unit / 8 integration / 19 passed + 2 skipped en e2e.

## 5. Arquitectura y convenciones

- Organización conforme a `docs/ARCHITECTURE.md`: `app/`, `src/components/`, `src/lib/`,
  `src/theme/`, `tests/`. No se creó nada dentro de `src/features/`, correcto: no hay features.
- Regla 4 (componentes reutilizables en `src/components/`) y regla 5 (evitar duplicación):
  cumplidas. `NavigationItemButton` único para las dos disposiciones; `Input` reutiliza `Message`
  para el error; cero literales de color fuera de `src/theme/`.
- Regla de dirección UI → feature → datos: no aplica todavía; no hay acceso a datos.
- CONVENTIONS: sin `any`, sin logs de debug, sin TODOs, nombres descriptivos, tipos explícitos en
  las fronteras (`ButtonProps`, `InputProps`, `NavigationItem`, `LayoutMode`, `Theme`).
- `docs/DESIGN.md`: sidebar en desktop y navegación compacta en móvil, implementado tal cual.

## 6. Complejidad innecesaria

Mayoritariamente bien contenida: solo los 6 componentes que exige la acceptance, sin Modal, Tabs,
Badge, ProgressBar ni Toast; `resolveLayoutMode` separada del hook con una necesidad concreta
(testear el responsive sin montar UI). Una excepción: ver hallazgo 3 (`Input.multiline`).

## 7. Decisiones de producto no autorizadas

**No se detectan.** Revisado específicamente `/componentes` y la ruta de navegación:

- Ambas rutas (`/` Inicio, `/componentes` Componentes) describen el **andamiaje visual**, no
  secciones de producto. Los textos son "Catálogo de los componentes compartidos y sus variantes",
  "Base visual lista", "Campo de demostración: no guarda nada".
- No hay mazos, login, estudio, estadísticas, sincronización ni lógica de negocio, ni simulados.
- La segunda ruta **no es invención**: la `verification_matrix` de la acceptance 3 exige demostrar
  que "navegar entre ellas cambia el contenido renderizado", lo que requiere como mínimo dos
  destinos. Además está declarada en `technical_decisions[0]` del contrato, congelado antes de
  implementar.
- `src/components/layout/navigation.ts` documenta explícitamente que la lista es el punto de
  extensión para cuando el usuario decida secciones reales.

## 8. Cambios fuera del contrato

Ninguno. Todos los cambios están cubiertos por `allowed_paths` y por `technical_decisions`.
El cambio de `e2e:install` a `chromium webkit` es consecuencia necesaria de
`technical_decisions[4]` (proyecto `mobile-safari` sobre WebKit).

---

## Verificaciones ejecutadas por el reviewer

Todas ejecutadas por mí, sin fiarme de la evidencia. Las salidas largas se redirigieron a
`/tmp/review-init-1.log`, **fuera del árbol del repositorio**, para no ensuciar `check_scope.py`.

### V1 — `./init.sh`

```text
── 1. Harness ──   VERIFY: OK                       [OK] Harness válido
── 2. Scope ────   SCOPE: OK (TASK-002)             [OK] Scope válido
── 3. Hygiene ──                                    [OK] Sin temporales/secretos obvios
── 4. App gates ─  [OK] typecheck  [OK] lint  [OK] test
                   [OK] test:integration  [OK] test:e2e
── 5. Evidence ─   EVIDENCE: OK                     [OK] Evidencia coherente
── 6. Summary ──                                    [OK] Estado verificable
EXIT=0
```

### V2 — Conteos de las suites

```text
$ npm test
Test Suites: 7 passed, 7 total
Tests:       36 passed, 36 total

$ npm run test:integration
Test Suites: 2 passed, 2 total
Tests:       8 passed, 8 total

$ npm run test:e2e
Running 21 tests using 5 workers
  2 skipped
  19 passed (6.6s)
```

Los tres conteos coinciden exactamente con lo afirmado en la evidencia (36 / 8 / 19+2).

### V3 — Los tres proyectos de Playwright se ejecutan de verdad

Confirmado en la salida real de `npm run test:e2e`; aparecen tests etiquetados con los tres
nombres de proyecto:

```text
✓  2 [desktop-chrome] › responsive-navigation.spec.ts:20 › navega entre las rutas base sin errores de consola
✓  7 [desktop-chrome] › web-boot.spec.ts:3 › la app arranca en web y renderiza la pantalla raíz
✓  9 [mobile-chrome]  › responsive-navigation.spec.ts:20 › navega entre las rutas base sin errores de consola
✓ 12 [mobile-chrome]  › Accesibilidad táctil › los controles interactivos son alcanzables con el dedo en /
✓ 15 [mobile-safari]  › responsive-navigation.spec.ts:20 › navega entre las rutas base sin errores de consola
✓ 20 [mobile-safari]  › Accesibilidad táctil › ... en /componentes
-   4 [desktop-chrome] › Accesibilidad táctil › ... en /        (skipped)
-   6 [desktop-chrome] › Accesibilidad táctil › ... en /componentes (skipped)
```

7 tests por proyecto × 3 = 21; los 2 saltados son los táctiles en desktop, con motivo declarado.
`mobile-safari` usa `devices['iPhone 13']`, que es WebKit: el motor de iOS, ejecutado realmente.

### V4 — Ninguna dependencia nueva

```text
$ git diff HEAD --stat -- package-lock.json
(salida vacía: el lockfile no cambió)

$ git diff HEAD -- package.json
-    "e2e:install": "playwright install --with-deps chromium",
+    "e2e:install": "playwright install --with-deps chromium webkit",
```

`dependencies` y `devDependencies` idénticas a las de TASK-001. Afirmación **confirmada**.

### V5 — Compatibilidad iOS/Android

```text
$ npx expo config --type public
  platforms: [ 'ios', 'android', 'web' ]
```

### V6 — Smoke web

```text
$ npm run smoke:web
SMOKE WEB: OK (http://localhost:8082 -> 200)
EXIT=0
```

### V7 — ¿El test de regresión falla si se revierte la corrección?

Experimento: se sustituyó temporalmente `router.replace(href)` por `router.navigate(href)` en
`src/components/layout/AppShell.tsx:35` (copia de seguridad previa en `/tmp/AppShell.tsx.bak`).

**El test de integración declarado como regresión NO falla:**

```text
$ npx jest --selectProjects integration tests/integration/navigation.test.tsx
PASS integration tests/integration/navigation.test.tsx
PASS integration tests/integration/expo-router-navigation.test.tsx
Test Suites: 2 passed, 2 total
Tests:       8 passed, 8 total
```

**El E2E sí falla**, reproduciendo exactamente el defecto descrito:

```text
$ npx playwright test tests/e2e/responsive-navigation.spec.ts --project=desktop-chrome
  ✘  1 [desktop-chrome] › Navegación base › navega entre las rutas base sin errores de consola
    Error: strict mode violation: getByTestId('demo-card') resolved to 2 elements
      > 37 |     await expect(page.getByTestId('demo-card')).toBeVisible();
  1 failed, 2 skipped, 3 passed
```

Conclusiones: (a) el bug descrito es **real y reproducible**, y la corrección con `router.replace`
es efectiva; (b) el guardián real es el E2E, **no** el test de integración que la evidencia
presenta como test de regresión.

**Restauración confirmada.** El archivo se restauró byte a byte:

```text
$ shasum -a 256 src/components/layout/AppShell.tsx
57362c3a2c36a56632c2baf361209d7363c1a5968787755a64073e56370070bd   (idéntico al hash previo)
$ grep -n "router\." src/components/layout/AppShell.tsx
35:    router.replace(href);
$ git status --porcelain
(idéntico al estado inicial: 8 modificados, 16 untracked; sin residuos)
```

`test-results/` generado por Playwright está en `.gitignore`, así que no contamina el gate de
scope.

### V8 — Greps propios (no los de la evidencia)

```text
$ grep -rnE "#[0-9A-Fa-f]{3,8}\b" app/ src/components/ src/lib/ tests/      → (ninguno)
$ grep -rnE "rgba?\(|hsla?\(" app/ src/ tests/                             → (ninguno)
$ grep -rnE "\bany\b" app/ src/ tests/                                     → (ninguno)
$ grep -rnE "TODO|FIXME|XXX|HACK" app/ src/ tests/                         → (ninguno)
$ grep -rnE "console\.(log|debug|warn|info)" app/ src/ tests/              → (ninguno)
$ grep -rnE "\b(document|window)\b" app/ src/                              → (ninguno)
$ grep -rnE "eslint-disable|@ts-(ignore|expect-error|nocheck)" app/ src/ tests/ → (ninguno)
$ grep -rniE "(mazo|deck|login|auth|supabase|estadístic|scheduler|repetici|estudi)" src/ app/
    app/index.tsx:11: * No implementa mazos, login, estudio ni estadísticas: ...   (comentario negativo)
```

La única aparición de `document.` en todo el repositorio está dentro de `page.evaluate()` en
`tests/e2e/responsive-navigation.spec.ts:14`, que se ejecuta en el contexto del navegador: correcto,
no es código compartido.

---

## Hallazgos

### Hallazgo 1 — ALTA — El test de regresión del bug de navegación no detecta el bug

- **Archivos:** `tests/integration/navigation.test.tsx:53-70`;
  `progress/evidence/TASK-002-implementation.md`, sección "Bug encontrado y corregido" y fila 23 de
  la matriz.
- **Qué afirma la evidencia:** *"Test de regresión: `tests/integration/navigation.test.tsx`, caso
  'no apila instancias duplicadas al ir y volver entre destinos', que afirma
  `getAllByTestId('demo-card')` con longitud exactamente 1 tras el viaje de ida y vuelta."*
- **Qué ocurre en realidad:** con `router.navigate(href)` restaurado (es decir, con el bug
  presente), ese test **pasa igualmente**: 8/8 tests de integración en verde. La aserción
  `toHaveLength(1)` es vacua en el entorno de `renderRouter`, donde la pantalla anterior no
  permanece montada. El defecto solo lo detecta `tests/e2e/responsive-navigation.spec.ts`, que sí
  falla con `strict mode violation: getByTestId('demo-card') resolved to 2 elements`.
- **Reglas incumplidas:** `docs/TESTING.md` ("Mal test: no lanzó excepción" / "Regla de bugs: todo
  bug corregido debe añadir un test de regresión"); `docs/CONVENTIONS.md` sección Tests
  ("Verificar resultados concretos"); `docs/VERIFICATION.md` ("Una afirmación del agente no es
  evidencia").
- **Impacto:** si alguien vuelve a cambiar `replace` por `navigate`, la capa que la evidencia
  presenta como red de seguridad no avisa. Además la evidencia contiene una afirmación falsa.
- **Qué hace falta (no lo aplico, soy read-only):** o bien convertir ese caso en una regresión que
  falle de verdad sin la corrección (por ejemplo comprobando el estado/longitud del historial del
  router, o afirmando que `router.replace` es lo que se invoca), o bien corregir la evidencia para
  atribuir la regresión al E2E que efectivamente la captura y retitular el test de integración por
  lo que sí verifica.

### Hallazgo 2 — MEDIA — `progress/current.md` no representa la sesión activa

- **Archivo:** `progress/current.md`.
- **Problema:** declara `**Estado:** _IMPLEMENTING_` y `**Agente:** _implementer_` mientras
  `.harness/tasks/TASK-002.json` está en `REVIEWING`. Los pasos 4 a 9 del plan corto siguen
  marcados como "pendiente" pese a estar completados, y "Próximo paso" dice *"Implementar tokens,
  componentes, layout y pantallas; después la batería de tests y los gates"*, trabajo ya terminado.
- **Regla incumplida:** `CHECKPOINTS.md` C1: "`progress/current.md` representa exactamente la
  sesión activa"; también C6.
- **Impacto:** el estado vivo del harness, que es fuente de verdad según `CLAUDE.md`, contradice a
  la task. Un agente que retome la sesión leyendo solo `current.md` reimplementaría trabajo hecho.
- **Qué hace falta:** actualizar estado, agente, plan corto y próximo paso al punto real
  (REVIEWING / review independiente).

### Hallazgo 3 — BAJA — `Input.multiline`: abstracción sin necesidad concreta, en el borde del out_of_scope

- **Archivo:** `src/components/ui/Input.tsx:14,25,35,39` y `styles.fieldMultiline:69-72`.
- **Problema:** la prop `multiline` y su rama de estilo no se usan en ninguna parte
  (`grep -rn multiline app/ src/ tests/` solo devuelve las 4 líneas de la propia definición), no la
  exige ninguna acceptance y ningún test la cubre. Funcionalmente prefabrica el comportamiento de
  TextArea, componente que el contrato excluye explícitamente en `out_of_scope`: *"Crear los
  componentes de docs/DESIGN.md que la acceptance no exige (TextArea, Modal, Dialog, Tabs, Badge,
  ProgressBar, Toast, IconButton)"*.
- **Reglas incumplidas:** `docs/CONVENTIONS.md` principios 2 ("No introducir abstracciones sin una
  necesidad concreta de la tarea") y 10 ("Un cambio debe ser tan pequeño como permita cumplir la
  tarea"); `docs/ARCHITECTURE.md` regla 8. Afecta a la acceptance 20.
- **Impacto:** bajo, pero es código muerto no verificado que anticipa un componente vetado.
- **Qué hace falta:** eliminar `multiline` y `fieldMultiline` de `Input`, o —si se considera
  necesaria— cubrirla con un test y justificarla en el contrato. Coherencia: el propio implementer
  aplicó este criterio para dejar fuera Modal, Tabs, Badge y Toast.

---

## Observaciones no bloqueantes

No exigen modificación; se registran para tareas futuras.

1. **`router.replace` y el botón Atrás del navegador.** Con `replace`, moverse entre `/` y
   `/componentes` no deja entrada en el historial, así que el botón Atrás del navegador ya no
   vuelve a la ruta base anterior. Ninguna acceptance lo cubre y para una navegación tipo tabs es
   un patrón defendible, pero cuando la navegación crezca conviene evaluar el `Tabs` de Expo Router
   o `dismissTo`.
2. **`tests/unit/responsive.test.tsx` mockea `useLayoutMode`.** La unión real entre el ancho de
   ventana y `AppShell` no queda cubierta por unit tests; sí lo está por `resolveLayoutMode` (6
   anchos) y por los 3 proyectos de Playwright con viewports reales. Cobertura suficiente.
3. **Tokens sin consumidor todavía:** `colors.primaryHover`, `radius.sm`, `radius.pill`,
   `typography.weight.regular`, `typography.lineHeight.xl`. Forman parte de escalas coherentes y el
   test de tokens los valida, así que no los considero código muerto al mismo nivel que el
   hallazgo 3.
4. **Vocabulario de producto en fixtures de test:** `tests/unit/input.test.tsx:9` usa
   "Nombre del mazo" y `tests/unit/feedback.test.tsx:7` "Cargando mazos…". Son cadenas de prueba,
   no lógica ni UI de producto, así que no violan la acceptance 16; conviene igualmente un
   vocabulario neutro mientras el producto no esté decidido.
5. **Alcance de los greps de la evidencia:** el grep de términos de producto se ejecutó sobre `src/`
   y el de textos de UI sobre `app/`, no ambos sobre ambos. Repetidos por mí sobre los dos árboles,
   el resultado sigue siendo limpio, así que la conclusión se sostiene.
6. **Clasificación de suites:** `tests/unit/responsive.test.tsx` usa `renderRouter`, más propio de
   integración. `jest.config.js` separa los proyectos solo por carpeta, así que es una cuestión de
   nomenclatura, no de corrección.

---

## Confirmación de rol read-only

- `reviewer_read_only: true` en `.harness/policies/files.json`, respetado.
- **El único archivo escrito por el reviewer es este:**
  `progress/evidence/TASK-002-review.md`.
- No se modificó, creó ni borró ningún archivo de código, test, configuración, documentación,
  `progress/current.md`, `progress/history.md` ni `.harness/tasks/TASK-002.json`.
- La única escritura temporal fuera de este archivo fue el experimento controlado de la
  verificación V7 sobre `src/components/layout/AppShell.tsx`, restaurado byte a byte y confirmado
  por hash SHA-256 idéntico y por `git status --porcelain` sin cambios respecto al estado inicial.
- Los registros extensos se escribieron en `/tmp/review-init-1.log` y `/tmp/AppShell.tsx.bak`,
  fuera del árbol del repositorio, para no alterar el gate de scope.
- Ningún defecto fue corregido por el reviewer: los tres hallazgos quedan reportados, no aplicados.

**Veredicto final: CHANGES_REQUIRED** (hallazgos 1, 2 y 3 abiertos).

---

## Revisión #2 — 2026-08-17

- **Task:** TASK-002 — Crear la base visual responsive y la estructura principal de navegación
- **Estado revisado:** `REVIEWING`
- **Agente:** reviewer (independiente, READ ONLY)
- **Objeto de esta ronda:** verificar las correcciones de los hallazgos R1, R2 y R3 del review #1 y
  re-verificar de forma independiente que nada más se rompió, debilitó ni amplió.
- **Base de Git:** `4b2d30f chore(TASK-001): cerrar entorno base tras review y QA`

## Veredicto

**APPROVED**

Los tres hallazgos están cerrados y verificados empíricamente por mí, no por el relato del
implementer. El hallazgo ALTA (R1) es el decisivo: reintroduje el bug y **el test de integración
ahora sí falla**, señalando la línea exacta de la comprobación de historial. La corrección se hizo
sin ampliar scope: solo 3 archivos de trabajo cambiaron, y uno de ellos (`AppShell.tsx`) quedó
byte a byte idéntico. Las 27 acceptance siguen cumpliéndose y `./init.sh` termina en exit 0.

## Documentos leídos

1. `AGENTS.md`
2. `.harness/agents/reviewer.md`
3. `.harness/tasks/TASK-002.json`
4. `.harness/contracts/TASK-002.json` (27 acceptance + `verification_matrix` de 27 entradas)
5. `docs/ARCHITECTURE.md`
6. `docs/CONVENTIONS.md`
7. `docs/DESIGN.md`
8. `docs/VERIFICATION.md`
9. `docs/TESTING.md`
10. `CHECKPOINTS.md`
11. `progress/current.md`
12. `progress/evidence/TASK-002-implementation.md` (incluida la nueva sección "Corrección de los
    hallazgos del review #1")
13. `progress/evidence/TASK-002-review.md` (revisión #1, intacta)
14. `.harness/policies/files.json`, `.gitignore`, `jest.config.js`, `playwright.config.ts`,
    `eslint.config.js`
15. Todo el código de la tarea, leído de nuevo con Read por ser mayoritariamente untracked:
    `src/theme/{tokens,index}.ts`, `src/lib/layout.ts`,
    `src/components/ui/{Button,Input,Card,Loading,EmptyState,Message,index}`,
    `src/components/layout/{AppShell,NavigationItemButton,navigation,index}`,
    `app/{_layout,index,componentes}.tsx` y las 10 suites de `tests/`.

## Alcance real de la ronda de correcciones

Comprobado por marca de tiempo, no por lo que dice la evidencia. Archivos modificados **después**
de que se escribiera el review #1 (`TASK-002-review.md`, 13:18:17):

```text
$ find app src tests docs progress .harness scripts *.json *.js *.ts *.sh -newermt "2026-08-17 13:18:00" -type f
.harness/tasks/TASK-002.json                      13:22:08   (solo transición de estado)
progress/current.md                               13:21:11   (R2)
progress/evidence/TASK-002-implementation.md      13:21:33   (evidencia de la corrección)
progress/evidence/TASK-002-review.md              13:18:17   (este archivo, review #1)
src/components/layout/AppShell.tsx                13:20:38   (mtime; contenido IDÉNTICO, ver hash)
src/components/ui/Input.tsx                       13:20:53   (R3)
tests/integration/navigation.test.tsx             13:19:58   (R1)
```

`AppShell.tsx` cambió de mtime pero no de contenido: su SHA-256 sigue siendo el mismo que registró
el review #1, lo que confirma que el implementer repitió el experimento de revertir/restaurar sin
dejar residuo.

```text
$ shasum -a 256 src/components/layout/AppShell.tsx
57362c3a2c36a56632c2baf361209d7363c1a5968787755a64073e56370070bd   (idéntico al del review #1)
```

`.harness/contracts/TASK-002.json` conserva mtime **13:00:12**, anterior a todo el código
(13:01 en adelante): el contrato sigue congelado y no se tocó durante las correcciones.

Conclusión: **no hubo ampliación de scope** aprovechando la ronda. Ningún componente, token, ruta,
test ni configuración adicional.

---

## R1 (ALTA) — Test de regresión del bug de navegación — **CERRADO**

### Qué cambió

`tests/integration/navigation.test.tsx` ya no cuenta nodos montados. El caso se llama ahora
*"no acumula historial al navegar entre destinos de primer nivel"* y afirma
`router.canGoBack() === false` en los tres puntos del viaje de ida y vuelta (inicio, tras ir a
`/componentes`, tras volver a `/`), conservando además las comprobaciones de que no queda una
segunda instancia montada. El comentario del test documenta explícitamente por qué contar nodos
sería vacuo en `renderRouter`.

### Verificación empírica propia (no me fío de la demostración del implementer)

Experimento controlado: copia de seguridad en `/tmp/review2-AppShell.tsx.bak` (fuera del repo),
sustitución de `router.replace(href)` por `router.navigate(href)` en
`src/components/layout/AppShell.tsx:35`, ejecución de la suite de integración, restauración.

```text
$ grep -n "router\." src/components/layout/AppShell.tsx
35:    router.navigate(href);          # bug reintroducido

$ npm run test:integration
EXIT=1
FAIL integration tests/integration/navigation.test.tsx
  ● Navegación base › no acumula historial al navegar entre destinos de primer nivel

    expect(received).toBe(expected) // Object.is equality

    Expected: false
    Received: true

      67 |     });
      68 |     await screen.findByTestId('catalogo-button-primary');
    > 69 |     expect(router.canGoBack()).toBe(false);
         |                                ^

PASS integration tests/integration/expo-router-navigation.test.tsx
Test Suites: 1 failed, 1 passed, 2 total
Tests:       1 failed, 7 passed, 8 total
```

El test **sí detecta el bug ahora**, y falla solo él: los otros 7 siguen en verde, así que la
regresión está localizada y no es un fallo colateral. Con `router.replace` restaurado:

```text
$ npm run test:integration
Test Suites: 2 passed, 2 total
Tests:       8 passed, 8 total
```

### Restauración confirmada

```text
$ shasum -a 256 src/components/layout/AppShell.tsx
57362c3a2c36a56632c2baf361209d7363c1a5968787755a64073e56370070bd   (idéntico al hash previo)
$ grep -n "router\." src/components/layout/AppShell.tsx
35:    router.replace(href);
$ git status --porcelain
(26 entradas: 8 modificados + 18 untracked —las carpetas nuevas se colapsan—,
 idéntico al estado con el que empecé esta ronda; sin residuos)
```

La evidencia de implementación también quedó corregida: la sección "Bug encontrado y corregido"
ya no afirma la comprobación vacua de `toHaveLength(1)` y describe la comprobación de historial,
citando además que la primera versión era vacua y que el reviewer lo demostró. **Afirmación de la
evidencia = comportamiento real.** Cumple `docs/TESTING.md` (regla de bugs) y `docs/VERIFICATION.md`.

## R2 (MEDIA) — `progress/current.md` — **CERRADO**

`progress/current.md` refleja ahora el estado real y coincide con `.harness/tasks/TASK-002.json`:

| Comprobación | Estado |
|---|---|
| `Estado: REVIEWING` frente a `task.status` = `REVIEWING` | Coinciden |
| Pasos 1-9 del plan corto marcados "hecho" | Correcto: están hechos y verificados |
| Paso 10 "Review #1 independiente — hecho (**CHANGES_REQUIRED**: R1, R2, R3)" | Correcto y con el resultado |
| Paso 11 "Corrección de R1-R3 — hecho" | Correcto |
| Pasos 12-13 "Review #2" y "commit, QA, cierre" — pendientes | Correcto |
| "Próximo paso: Review #2 independiente (read-only)" | Correcto |
| "Evidencia disponible" lista implementación + review #1 | Correcto |

Cumple `CHECKPOINTS.md` C1 ("`progress/current.md` representa exactamente la sesión activa").
No detecto ninguna afirmación desactualizada ni contradictoria con la task.

## R3 (BAJA) — `Input.multiline` — **CERRADO**

`src/components/ui/Input.tsx` ya no declara la prop `multiline` en `InputProps`, no la desestructura,
no la pasa al `TextInput` y no existe el estilo `fieldMultiline`.

```text
$ grep -rn "multiline\|fieldMultiline" app/ src/ tests/ docs/ .harness/
(ninguna coincidencia en código, tests, docs ni contrato;
 solo menciones históricas en progress/current.md y en los dos archivos de evidencia)
```

Sin restos colaterales, comprobado uno a uno:

- **Imports:** `Input.tsx` importa `colors, radius, sizes, spacing, typography` y usa los cinco
  (`colors.surface/border/text/textMuted/danger`, `radius.md`, `sizes.controlHeight`, `spacing.*`,
  `typography.*`). Ningún import huérfano. `npm run lint` exit 0 lo respalda.
- **Tokens:** la eliminación no dejó ningún token sin consumidor nuevo. Los únicos tokens sin uso
  siguen siendo los ya listados como observación no bloqueante en el review #1
  (`colors.primaryHover`, `radius.sm`, `radius.pill`, `typography.weight.regular`,
  `typography.lineHeight.xl`), todos parte de escalas coherentes.
- **Tests:** ninguno cubría `multiline`, así que no se perdió cobertura. El conteo unitario sigue
  siendo 36, es decir, **no se eliminó ningún test** para acomodar el cambio. `input.test.tsx`
  conserva sus 5 casos (label/valor, texto exacto propagado, error con rol `alert`, ayuda oculta
  con error, altura táctil ≥ `sizes.touchTarget`).
- **Consumidores:** `app/index.tsx` y `app/componentes.tsx` usan `Input` sin esa prop; typecheck
  exit 0.

Queda alineado con `docs/CONVENTIONS.md` 2 y 10 y con el `out_of_scope` del contrato (TextArea).

---

## Re-verificación general independiente

Todas las salidas siguientes son de comandos que ejecuté yo en esta ronda. Los registros largos se
escribieron en `/tmp/review2-*.log`, **fuera del árbol del repositorio**, para no ensuciar
`check_scope.py`.

### G1 — `./init.sh` (dos ejecuciones: antes y después de mi experimento)

```text
$ ./init.sh   > /tmp/review2-init-1.log     EXIT=0
$ ./init.sh   > /tmp/review2-init-2.log     EXIT=0   (tras restaurar AppShell.tsx)

── 1. Harness ──   VERIFY: OK                       [OK] Harness válido
── 2. Scope ────   SCOPE: OK (TASK-002)             [OK] Scope válido
── 3. Hygiene ──                                    [OK] Sin temporales/secretos obvios
── 4. App gates ─  [OK] typecheck  [OK] lint  [OK] test
                   [OK] test:integration  [OK] test:e2e
── 5. Evidence ─   EVIDENCE: OK                     [OK] Evidencia coherente
── 6. Summary ──                                    [OK] Estado verificable
```

### G2 — Conteos de las suites

```text
$ npm test                  EXIT=0   Test Suites: 7 passed, 7 total   Tests: 36 passed, 36 total
$ npm run test:integration  EXIT=0   Test Suites: 2 passed, 2 total   Tests:  8 passed,  8 total
$ npm run test:e2e          EXIT=0   Running 21 tests using 5 workers
                                     2 skipped
                                     19 passed (6.2s)
```

Los tres conteos coinciden exactamente con lo que afirma la evidencia (36 / 8 / 19+2) y con los
del review #1: **la corrección no cambió ningún conteo**, es decir, no se añadieron ni eliminaron
tests para conseguir verde; se cambió el contenido de un caso por otro más fuerte.

Reparto por proyecto de Playwright, contado sobre la salida real:

```text
$ grep -oE "\[(desktop-chrome|mobile-chrome|mobile-safari)\]" /tmp/review2-e2e.log | sort | uniq -c
   7 [desktop-chrome]
   7 [mobile-chrome]
   7 [mobile-safari]
```

7 × 3 = 21; los 2 saltados son los táctiles en `desktop-chrome`, con motivo declarado
(`test.skip(..., 'Solo aplica a pantallas táctiles.')`). Es el **único** `skip` de todo `tests/`.

### G3 — Static y smoke

```text
$ npm run typecheck   EXIT=0   (tsc --noEmit, 0 errores)
$ npm run lint        EXIT=0   (eslint ., 0 errores / 0 warnings)
$ npm run smoke:web   EXIT=0   SMOKE WEB: OK (http://localhost:8082 -> 200)
$ npx expo config --type public   platforms: [ 'ios', 'android', 'web' ]
```

### G4 — Ninguna dependencia nueva

```text
$ git diff HEAD --stat -- package-lock.json
(salida vacía: el lockfile no cambió)

$ git diff HEAD -- package.json
-    "e2e:install": "playwright install --with-deps chromium",
+    "e2e:install": "playwright install --with-deps chromium webkit",
```

Ese sigue siendo el único cambio de `package.json`. `dependencies` y `devDependencies` intactas.
Confirmado también que la ronda de correcciones **no** tocó `package.json`, `package-lock.json`,
`jest.config.js`, `playwright.config.ts`, `tsconfig.json`, `eslint.config.js`, `app.json` ni
`scripts/**` (ver la lista de mtimes de arriba).

### G5 — La acceptance no fue modificada

```text
$ python3 - (comparación literal task vs contract)
task acceptance len            27
contract acceptance len        27
identical:                     True
allowed_paths identical:       True
verification_matrix len        27
matrix cubre las 27 en orden:  True
task status:                   REVIEWING
```

Además el contrato conserva mtime 13:00:12, anterior a la primera línea de código de la tarea, y no
se modificó durante la ronda de correcciones. La `acceptance` es por tanto la misma con la que se
congeló el contrato.

### G6 — Greps propios sobre el árbol ya corregido

```text
$ grep -rnE "#[0-9A-Fa-f]{3,8}\b" app/ src/components/ src/lib/ tests/   → (ninguno)
$ grep -rnE "rgba?\(|hsla?\(" app/ src/ tests/                          → (ninguno)
$ grep -rnE "(: *any\b|<any>|as any)" app/ src/ tests/                   → (ninguno)
$ grep -rnE "TODO|FIXME|XXX|HACK" app/ src/ tests/                       → (ninguno)
$ grep -rnE "console\.(log|debug|warn|info|error)" app/ src/             → (ninguno)
$ grep -rnE "\b(document|window)\." app/ src/                            → (ninguno)
$ grep -rnE "eslint-disable|@ts-(ignore|expect-error|nocheck)" app/ src/ tests/ → (ninguno)
$ grep -rnE "\.(skip|only)\(" tests/                                     → 1: el skip táctil documentado
$ grep -rniE "(mazo|deck|login|auth|supabase|estadístic|scheduler|repetici|estudi)" src/ app/
    app/index.tsx:11  comentario negativo ("No implementa mazos, login, estudio ni estadísticas")
```

### G7 — Las 27 acceptance siguen cumpliéndose

Repasadas de nuevo contra los artefactos, no contra la evidencia. Ninguna cambió de estado respecto
al review #1 salvo las que estaban afectadas por los hallazgos:

| # | Acceptance | Estado tras las correcciones |
|---|---|---|
| 1-2 | Sistema de diseño / layout reutilizable | Sin cambios. `src/theme/tokens.ts` intacto; `AppShell` sigue aplicándose una sola vez en `app/_layout.tsx` | 
| 3-5 | Navegación Expo Router / web sin errores / iOS-Android | Sin cambios. Integración 8/8, E2E sin errores de consola, `platforms: ios, android, web` |
| 6-9 | Desktop / móvil / sin overflow / táctil | Sin cambios. 19 passed en los 3 proyectos |
| 10-15 | Button, Input, Card, Loading, EmptyState, Message | **Input re-revisado tras R3**: sigue renderizando label, valor, error vía `Message` con rol `alert`, ayuda oculta con error y altura ≥ táctil. El resto intactos |
| 16-18 | Sin lógica de feature / pantalla temporal / sin producto simulado | Sin cambios. Greps limpios y test explícito de ausencia |
| 19 | Estilos no duplicados | **Mejorado** por R3: una rama de estilo muerta menos |
| 20 | Respeta ARCHITECTURE y CONVENTIONS | **Cerrado**. Era "Parcial" en el review #1 por el hallazgo 3; eliminada la abstracción sin necesidad, typecheck y lint en exit 0 |
| 21-22 | Tests de componentes / prueba responsive | Sin cambios: 36 unit, ninguno eliminado |
| 23 | Prueba de integración de la navegación | **Cerrado**. Era "No como prueba de regresión" en el review #1; ahora falla de verdad al reintroducir el bug (demostrado arriba) |
| 24-26 | Smoke/E2E / sin regresiones / `./init.sh` exit 0 | Verificados de nuevo por mí: exit 0 en las dos ejecuciones |
| 27 | Evidencia registrada | **Cerrado**. La evidencia ya no contiene la afirmación falsa y documenta las tres correcciones |

## Hallazgos nuevos

**Ninguno.** No he encontrado ningún defecto nuevo introducido por la ronda de correcciones ni
ninguna verificación previa que se haya debilitado. Concretamente descarté:

- Tests eliminados o relajados para conseguir verde: los conteos son idénticos (36/8/19+2) y
  `input.test.tsx` conserva sus 5 casos pese a que `Input` perdió una prop.
- Restos de la eliminación de `multiline`: sin imports huérfanos, sin tokens huérfanos nuevos, sin
  referencias en código, tests, docs ni contrato.
- Scope ampliado: solo 3 archivos de trabajo tocados, uno de ellos con contenido idéntico.
- Contrato o acceptance retocados para acomodar las correcciones: ambos congelados y verificados
  literalmente iguales.

## Observaciones no bloqueantes

Se mantienen las 6 observaciones del review #1 (botón Atrás con `replace`, mock de `useLayoutMode`
en el test responsive, tokens sin consumidor, vocabulario de producto en fixtures de test, alcance
de los greps de la evidencia, clasificación de suites). Ninguna exige modificación. Se añaden:

7. **Redacción residual en dos filas de la evidencia.** El inventario de archivos y la fila 23 de la
   matriz siguen llamando al caso "regresión de duplicados". Literalmente sigue siendo cierto —el
   test conserva las aserciones `toHaveLength(1)` / `toHaveLength(0)` junto a la de historial—, y la
   sección "Bug encontrado y corregido" y la sección R1 describen correctamente que el guardián real
   es `router.canGoBack()`. Es una etiqueta abreviada, no una afirmación falsa: no bloquea.
8. **Referencia interna de la evidencia.** La frase "Gates tras la corrección: ver 'Comandos
   ejecutados' más abajo" apunta a una sección que está más arriba en el documento. Cosmético.
9. **Nombres de test en la `verification_matrix`.** El contrato nombra
   `tests/unit/{loading,empty-state,message}.test.tsx` y la implementación los consolidó en
   `tests/unit/feedback.test.tsx`. Ya era así en el review #1 y no se consideró un hallazgo: el
   `evidence_expected` de esas tres filas se cumple íntegramente (rol `progressbar`, acción opcional
   de `EmptyState`, variantes y rol `alert` de `Message`). Conviene, en tareas futuras, nombrar en el
   contrato el comportamiento y no el archivo exacto.
10. **`.harness/tasks/TASK-002.json` cambió de mtime durante la ronda** (transición
    `REVIEWING → IMPLEMENTING → REVIEWING`). Su `acceptance` es literalmente idéntica a la del
    contrato congelado, así que la transición es legítima y no alteró el alcance.

## Confirmación de rol read-only

- `reviewer_read_only: true` en `.harness/policies/files.json`, respetado.
- **El único archivo escrito por el reviewer en esta ronda es este**,
  `progress/evidence/TASK-002-review.md`, y únicamente **añadiendo** la sección "Revisión #2". El
  contenido de la revisión #1 quedó intacto.
- No se modificó, creó ni borró ningún archivo de código, test, configuración o documentación, ni
  `progress/current.md`, ni `progress/history.md`, ni `.harness/tasks/TASK-002.json`, ni
  `.harness/contracts/TASK-002.json`.
- La única escritura temporal fuera de este archivo fue el experimento controlado de R1 sobre
  `src/components/layout/AppShell.tsx`, restaurado desde `/tmp/review2-AppShell.tsx.bak` y
  confirmado por SHA-256 idéntico (`57362c3a…70bd`), por `grep` de la línea 35 y por
  `git status --porcelain` sin cambios respecto al estado inicial.
- Registros largos en `/tmp/review2-init-1.log`, `/tmp/review2-init-2.log`, `/tmp/review2-unit.log`,
  `/tmp/review2-int.log`, `/tmp/review2-int-bug.log`, `/tmp/review2-e2e.log`, `/tmp/review2-tc.log`,
  `/tmp/review2-lint.log`, `/tmp/review2-smoke.log` y `/tmp/review2-AppShell.tsx.bak`, **todos fuera
  del árbol del repositorio**, para no alterar el gate de scope.
- Ningún defecto fue corregido por el reviewer.

**Veredicto final: APPROVED.** Hallazgos 1, 2 y 3 del review #1: cerrados y verificados. Sin
hallazgos nuevos. Siguiente paso del harness: commit del candidato, QA y cierre con `./init.sh`
final verde.
