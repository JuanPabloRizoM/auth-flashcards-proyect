# TASK-002 — QA independiente

- **Task:** TASK-002 — Crear la base visual responsive y la estructura principal de navegación
- **Estado revisado:** `QA`
- **Agente:** qa (independiente, READ ONLY sobre código y configuración)
- **Fecha:** 2026-08-17
- **Commit del candidato:** `146cca4 feat(TASK-002): base visual responsive y navegación principal`
- **Remoto:** `origin/main` = `146cca4b21c313cf0d564de99714e105f270f7db` (mismo hash que `HEAD`)
- **Revisiones previas:** review #1 `CHANGES_REQUIRED` (R1, R2, R3) → corregidos → review #2 `APPROVED`

## Veredicto

**APPROVED**

Las 27 acceptance del contrato se cumplen sobre el comportamiento observable, verificado por mí
ejecutando la aplicación real en el navegador en 8 tamaños de pantalla y 2 motores (Chromium y
WebKit), no releyendo los tests del implementer. Ningún hallazgo exige modificación. Los cuatro
gates (`npm test`, `npm run test:integration`, `npm run test:e2e`, `./init.sh`) terminan en verde y
los conteos coinciden exactamente con los que afirma la evidencia (36 / 8 / 19 passed + 2 skipped).

---

## Documentos leídos

1. `AGENTS.md` (sección D)
2. `.harness/agents/qa.md`
3. `.harness/tasks/TASK-002.json`
4. `.harness/contracts/TASK-002.json` (27 acceptance + `verification_matrix` de 27 entradas)
5. `docs/VERIFICATION.md`
6. `docs/TESTING.md`
7. `docs/DESIGN.md`
8. `CHECKPOINTS.md`
9. `progress/current.md`
10. `progress/evidence/TASK-002-implementation.md`
11. `progress/evidence/TASK-002-review.md` (revisiones #1 y #2)
12. Código de la tarea leído para saber qué observar, no para darlo por bueno:
    `src/theme/tokens.ts`, `src/lib/layout.ts`,
    `src/components/layout/{AppShell,NavigationItemButton,navigation}`,
    `src/components/ui/{Loading,Message,EmptyState}`, `app/{_layout,index,componentes}.tsx`,
    `tests/e2e/responsive-navigation.spec.ts`, `tests/integration/navigation.test.tsx`,
    `playwright.config.ts`, `package.json`, `scripts/check_evidence.py`.

---

## A. Gates ejecutados por mí

Todos ejecutados en esta sesión de QA. Los registros largos se escribieron en `/tmp`, **fuera del
árbol del repositorio**, para no ensuciar `check_scope.py`.

### A1 — Unit

```text
$ npm test                          EXIT=0
Test Suites: 7 passed, 7 total
Tests:       36 passed, 36 total
Time:        1.008 s
```

### A2 — Integration

```text
$ npm run test:integration          EXIT=0
PASS integration tests/integration/navigation.test.tsx
PASS integration tests/integration/expo-router-navigation.test.tsx
Test Suites: 2 passed, 2 total
Tests:       8 passed, 8 total
```

### A3 — E2E

```text
$ npm run test:e2e                  EXIT=0
Running 21 tests using 5 workers
  2 skipped
  19 passed (6.2s)

$ grep -oE "\[(desktop-chrome|mobile-chrome|mobile-safari)\]" /tmp/qa-e2e.log | sort | uniq -c
   7 [desktop-chrome]
   7 [mobile-chrome]
   7 [mobile-safari]
```

Los 3 conteos (36 / 8 / 19+2) **coinciden exactamente** con lo afirmado en
`TASK-002-implementation.md` y en el review #2. Los 2 saltados son los táctiles en
`desktop-chrome`, con motivo declarado en el propio código
(`test.skip(!isMobileProject(...), 'Solo aplica a pantallas táctiles.')`); es el único `skip` de
todo `tests/`, comprobado con `grep -rnE "\.(skip|only)\(" tests/`.

### A4 — `./init.sh`

```text
$ ./init.sh                         EXIT=0

── 1. Harness ──   VERIFY: OK                       [OK] Harness válido
── 2. Scope ────   SCOPE: OK (TASK-002)             [OK] Scope válido
── 3. Hygiene ──                                    [OK] Sin temporales/secretos obvios
── 4. App gates ─  [OK] typecheck  [OK] lint  [OK] test
                   [OK] test:integration  [OK] test:e2e
── 5. Evidence ─   EVIDENCE: OK                     [OK] Evidencia coherente
── 6. Summary ──                                    [OK] Estado verificable
```

### A5 — Smoke web y compatibilidad declarada

```text
$ npm run smoke:web
SMOKE WEB: OK (http://localhost:8082 -> 200)

$ npx expo config --type public
  platforms: [ 'ios', 'android', 'web' ]
  ios: { supportsTablet: true, ... }
```

### A6 — Estado del repositorio al terminar

```text
$ git status --porcelain
 M .harness/tasks/TASK-002.json        (transición REVIEWING → QA; único cambio, trackeado)

$ python3 scripts/check_scope.py
SCOPE: OK (TASK-002)                    EXIT=0
```

Ningún artefacto de QA quedó dentro del repositorio.

---

## B. Verificación observable en el navegador (lo principal)

Esta tarea es de interfaz, así que la validación central no son los gates sino la experiencia real.

### B0 — Levantar la app y cargar las rutas de verdad

Servidor propio, en un puerto distinto del que usa Playwright, para no interferir:

```text
$ npx expo start --web --port 8090        (en segundo plano)

$ curl -s -o /tmp/qa-root.html        -w "%{http_code}" http://localhost:8090/
200      (47.777 bytes)
$ curl -s -o /tmp/qa-componentes.html -w "%{http_code}" http://localhost:8090/componentes
200      (53.004 bytes)
```

El HTML servido ya contiene el contenido esperado renderizado en servidor, no un cascarón vacío:

```text
/            → "Flashcards", "Base visual lista", "Estado del proyecto",
               "Campo de ejemplo", "Acción principal", "Sin contenido"
/componentes → "Catálogo de los componentes", "Primario", "Deshabilitado",
               "Campo con error", "Mensaje de error", "Sin elementos"
```

### B1 — Responsive real: sidebar vs. barra inferior, y nunca ambos

Script Playwright propio escrito en `/tmp/qa-pw/qa.cjs` (fuera del repo), usando el Playwright ya
instalado del proyecto. 8 viewports × 2 rutas = 16 comprobaciones. `cnt` es el número de nodos con
ese `testID` en el DOM; `vis` es visibilidad efectiva.

```text
viewport            | route         | vw   | sidebar cnt/vis | tabbar cnt/vis | header | overflow
--------------------+---------------+------+-----------------+----------------+--------+---------
desktop-1440x900    | /             | 1440 | 1/true          | 0/false        | 0      | 0
desktop-1440x900    | /componentes  | 1440 | 1/true          | 0/false        | 0      | 0
desktop-1280x800    | /             | 1280 | 1/true          | 0/false        | 0      | 0
desktop-1280x800    | /componentes  | 1280 | 1/true          | 0/false        | 0      | 0
laptop-1024x768     | /             | 1024 | 1/true          | 0/false        | 0      | 0
laptop-1024x768     | /componentes  | 1024 | 1/true          | 0/false        | 0      | 0
tablet-768x1024     | /             |  768 | 1/true          | 0/false        | 0      | 0
tablet-768x1024     | /componentes  |  768 | 1/true          | 0/false        | 0      | 0
tablet-767x1024     | /             |  767 | 0/false         | 1/true         | 1      | 0
tablet-767x1024     | /componentes  |  767 | 0/false         | 1/true         | 1      | 0
pixel5-393x851      | /             |  393 | 0/false         | 1/true         | 1      | 0
pixel5-393x851      | /componentes  |  393 | 0/false         | 1/true         | 1      | 0
iphone13-390x664 *  | /             |  390 | 0/false         | 1/true         | 1      | 0
iphone13-390x664 *  | /componentes  |  390 | 0/false         | 1/true         | 1      | 0
iphoneSE-320x568    | /             |  320 | 0/false         | 1/true         | 1      | 0
iphoneSE-320x568    | /componentes  |  320 | 0/false         | 1/true         | 1      | 0
```

`*` = motor **WebKit** (el de iOS). El resto, Chromium.

Conclusiones medidas, no inferidas:

- **Nunca coexisten.** En los 16 casos, exactamente una de las dos navegaciones está presente en el
  DOM y la otra tiene `count = 0`: no está simplemente oculta con CSS, no se renderiza. No hay ni un
  solo tamaño en el que se vean las dos a la vez.
- **El corte es exactamente el breakpoint declarado** (`breakpoints.md = 768` en
  `src/theme/tokens.ts`): 768 px muestra sidebar, 767 px muestra barra inferior + cabecera. Coincide
  con el comportamiento documentado (`resolveLayoutMode`: "un ancho exactamente igual al breakpoint
  ya se considera expandido").
- Probé **dos tamaños de desktop y un portátil por encima del breakpoint**, y **cuatro tamaños por
  debajo** incluyendo uno más estrecho (320 px) que cualquiera de los que cubre la suite del
  implementer.

### B2 — Overflow horizontal

Medido en cada uno de los 16 casos de la tabla anterior:

```text
document.documentElement.scrollWidth - clientWidth  = 0   (en los 16)
document.body.scrollWidth            - clientWidth  = 0   (en los 16)
```

**Cero overflow horizontal en todos los tamaños y en ambas rutas**, incluido 320 px, que no forma
parte de la suite del implementer.

### B3 — Objetivos táctiles medidos por mí

Medí el `boundingBox` real de cada control interactivo visible dentro de `#root`
(`[role=button]`, `[role=link]`, `input`, `textarea`, `button`) en los tres viewports táctiles.
Mínimo exigido: 44 × 44.

**Pixel 5 (393 × 851), Chromium**

| Ruta | Control | Medido | ≥ 44×44 |
|---|---|---|---|
| `/` | Campo de ejemplo (input) | 295 × 48 | Sí |
| `/` | Acción principal | 155 × 44 | Sí |
| `/` | Acción secundaria | 173 × 44 | Sí |
| `/` | Inicio (tab) | 187 × 47 | Sí |
| `/` | Componentes (tab) | 187 × 47 | Sí |
| `/componentes` | Primario | 98 × 44 | Sí |
| `/componentes` | Secundario | 120 × 44 | Sí |
| `/componentes` | Ghost | 79 × 44 | Sí |
| `/componentes` | Deshabilitado | 138 × 44 | Sí |
| `/componentes` | Cargando | 136 × 46 | Sí |
| `/componentes` | Campo normal (input) | 295 × 48 | Sí |
| `/componentes` | Campo con error (input) | 295 × 48 | Sí |
| `/componentes` | Acción opcional | 154 × 44 | Sí |
| `/componentes` | Inicio / Componentes (tabs) | 187 × 47 | Sí |

**iPhone 13 (390 × 664), WebKit**: mismas medidas salvo el ancho de los inputs (292 en vez de 295)
y de las tabs (185 en vez de 187). Ninguna altura por debajo de 44.

**iPhone SE (320 × 568), Chromium táctil**: inputs 222 × 48, tabs 150 × 47, botones idénticos a los
anteriores. Ninguna dimensión por debajo de 44 ni siquiera en la pantalla más estrecha probada.

**Total: 5 controles en `/` y 10 en `/componentes`, en 3 dispositivos = 45 mediciones, cero por
debajo del mínimo.** El elemento más pequeño de todo el conjunto es el botón "Ghost" con 79 × 44:
cumple con margen en alto y de sobra en ancho.

### B4 — Navegación real: ruta, URL, contenido y consola

Ejecutado en los 8 viewports. Recorrido: cargar `/` → pulsar "Componentes" → pulsar "Inicio".

```text
URL:        http://localhost:8090/  →  http://localhost:8090/componentes  →  http://localhost:8090/
Encabezado: "Flashcards"            →  "Componentes"
consoleErrors: []      pageErrors: []      (en los 8 viewports, los 3 pasos)
```

- **La URL cambia de verdad** en la barra de direcciones, no solo el contenido.
- **El contenido cambia**: el encabezado pasa de "Flashcards" a "Componentes"; `demo-card` (tarjeta
  propia de la pantalla inicial) pasa de 1 a 0 nodos al ir al catálogo.
- **Cero errores de consola y cero errores de página** capturados con `page.on('console')` y
  `page.on('pageerror')` durante todo el recorrido, en los 8 viewports.
- **Carga directa / deep link**: `http://localhost:8090/componentes` cargado en frío y recargado con
  F5 resuelve la ruta correcta y muestra el catálogo. No depende de haber pasado antes por `/`.

### B5 — El bug corregido: ida y vuelta no deja dos pantallas de inicio montadas

Es el defecto que el E2E detectó durante la implementación (`router.navigate` apilaba una segunda
instancia de la pantalla de inicio). Lo comprobé sobre el DOM real tras el viaje de ida y vuelta,
en los 8 viewports:

```text
nodos [data-testid="demo-card"]                   antes: 1   en /componentes: 0   al volver: 1
nodos [data-testid="catalogo-button-primary"]     al volver a /: 0
apariciones del texto "Base visual lista"         al volver a /: 1
```

**Exactamente una instancia de la pantalla de inicio montada tras volver, en los 8 viewports.**
Ningún resto del catálogo queda montado. El defecto no se reproduce.

### B6 — Interacción real de los componentes

- **Input**: escribí "probando QA" en `demo-input` y `inputValue` devolvió exactamente
  `"probando QA"` en los 8 viewports. El campo refleja lo que se teclea.
- **Estado activo de la navegación**: el destino de la ruta actual se distingue visualmente. Fondo
  computado de `nav-inicio` estando en `/`: `rgb(232, 236, 251)` (= `colors.primarySurface`
  `#E8ECFB`); el inactivo `nav-componentes`: `rgba(0, 0, 0, 0)` (transparente).
- **Botón deshabilitado**: `catalogo-button-disabled` expone `aria-disabled="true"` en el DOM.
- **Estados de la interfaz visibles en pantalla**: en `/` se ven a la vez el mensaje informativo,
  el estado de carga ("Cargando contenido…") y el estado vacío ("Sin contenido" + descripción).
  En `/componentes` se ven las tres variantes de `Message` (info / correcto / error), los cinco
  estados de `Button` y el `Input` con error.
- **Roles de accesibilidad presentes en el DOM real** (no solo en los tests):
  - `/`: `link`, `link`, `heading`, `button`, `button`, `progressbar`
  - `/componentes`: además `alert` × 2, con el texto
    `"Este campo tiene un error de ejemplo."` y `"Error | Mensaje de error."`.
    El error del `Input` se anuncia con `role="alert"`, es decir, `Input` reutiliza de verdad el
    componente `Message` compartido.

### B7 — Nada de funcionalidades de producto

Volqué el **texto visible completo** de las dos pantallas renderizadas en el navegador:

```text
/            Flashcards · Inicio · Componentes · Flashcards ·
             "Base visual lista. Esta pantalla existe para comprobar el sistema de diseño y la
              navegación; todavía no hay funcionalidades del producto." ·
             Estado del proyecto · Componentes compartidos · Campo de ejemplo ·
             "Campo de demostración: no guarda nada." · Acción principal · Acción secundaria ·
             Estados de la interfaz · Cargando contenido… · Sin contenido

/componentes Flashcards · Inicio · Componentes · Componentes ·
             "Catálogo de los componentes compartidos y sus variantes." ·
             Button (Primario, Secundario, Ghost, Deshabilitado, Cargando) ·
             Input (Campo normal, Campo con error) ·
             Message (Información, Correcto, Error) · Loading y EmptyState
```

No hay mazos, ni login o registro, ni sesiones de estudio, ni estadísticas, ni rachas, ni
contadores, ni listas simuladas, ni datos falsos de ningún tipo. Todo el texto describe el propio
sistema visual. El único campo de texto avisa explícitamente de que no guarda nada.

Greps propios, ejecutados por mí sobre **ambos** árboles:

```text
$ grep -rniE "(mazo|deck|login|iniciar sesión|auth|supabase|estadístic|scheduler|repetici|
              sesión de estudio|estudiar)" src/ app/
  app/index.tsx:11   comentario NEGATIVO ("No implementa mazos, login, estudio ni estadísticas")
  (ninguna otra coincidencia)

$ grep -rnE "#[0-9A-Fa-f]{3,8}\b|rgba?\(|hsla?\(" app/ src/components/ src/lib/   → (ninguno)
$ grep -rnE "(: *any\b|<any>|as any)|TODO|FIXME|console\.(log|debug|warn|info)|
             \b(document|window)\." app/ src/                                     → (ninguno)
```

---

## C. Acceptance orientadas al usuario → resultado

| # | Acceptance | Cómo lo comprobé yo | Resultado |
|---|---|---|---|
| 1 | Sistema de diseño centralizado | `src/theme/tokens.ts` expone `colors`, `typography`, `spacing`, `radius`, `sizes`, `breakpoints`; los valores aparecen en el DOM real (`primarySurface` = `rgb(232,236,251)` en el destino activo); cero literales de color fuera de `src/theme/`; `npm test` 36/36 | PASS |
| 2 | Layout principal reutilizable | `AppShell` aplicado una sola vez en `app/_layout.tsx`; en el DOM real la marca "Flashcards" y la navegación aparecen una única vez por pantalla y las dos rutas comparten la misma envoltura | PASS |
| 3 | Navegación base con Expo Router | Las dos rutas se resuelven por URL directa (`curl` 200 en ambas) y por clic; `npm run test:integration` 8/8 | PASS |
| 4 | La navegación funciona sin errores en web | Recorrido `/` → `/componentes` → `/` en 8 viewports: URL cambia, contenido cambia, `consoleErrors = []` y `pageErrors = []` en todos | PASS |
| 5 | Compatible con Android e iOS | `npx expo config --type public` → `platforms: ['ios','android','web']`; grep propio sin `document.`/`window.` en `src/` ni `app/`; el motor WebKit (iOS) renderiza idéntico al de Chromium | PASS |
| 6 | Se adapta a vista desktop | Sidebar visible y barra inferior **ausente del DOM** en 1440, 1280, 1024 y 768 px, en ambas rutas | PASS |
| 7 | Se adapta a vista móvil | Barra inferior + cabecera visibles y sidebar **ausente del DOM** en 767, 393 (Pixel 5), 390 (iPhone 13 / WebKit) y 320 px, en ambas rutas. El contenido sigue legible y alcanzable | PASS |
| 8 | Sin overflow horizontal | `scrollWidth - clientWidth = 0` y `body.scrollWidth - clientWidth = 0` en las 16 combinaciones tamaño × ruta, incluido 320 px | PASS |
| 9 | Objetivos táctiles utilizables | 45 mediciones de `boundingBox` en 3 dispositivos táctiles: ninguna por debajo de 44 × 44. Mínimo observado: 79 × 44 | PASS |
| 10 | Componente Button | Las 5 variantes/estados se ven en `/componentes`; el deshabilitado expone `aria-disabled="true"`; el de carga muestra indicador de progreso; `npm test` cubre `onPress` y su ausencia en disabled/loading | PASS |
| 11 | Componente Input | Escribí en el campo y el valor leído fue exactamente el tecleado; el campo con error muestra el mensaje con `role="alert"` en el DOM real | PASS |
| 12 | Componente Card | Las tarjetas con título, descripción, contenido y pie se renderizan en ambas pantallas reutilizando el mismo componente | PASS |
| 13 | Estructura para estados de carga | `Loading` visible en las dos pantallas con `role="progressbar"` en el DOM y el mensaje "Cargando contenido…" / "Cargando…" | PASS |
| 14 | Estructura para estados vacíos | `EmptyState` visible con título, descripción y —en el catálogo— acción opcional pulsable de 154 × 44 | PASS |
| 15 | Forma consistente de errores/mensajes | `Message` en sus 3 variantes visibles en `/componentes`; solo la de error expone `role="alert"`; el error del `Input` aparece también como `alert`, o sea reutiliza el mismo componente | PASS |
| 16 | Componentes sin lógica de feature futura | Greps propios sobre `src/` y `app/`: única coincidencia, un comentario negativo. Todos reciben props visuales genéricas | PASS |
| 17 | Pantalla temporal que demuestra el sistema | `/` muestra en pantalla Card, Input, Button ×2, Loading, EmptyState y Message, dentro del layout compartido | PASS |
| 18 | La pantalla temporal no simula producto | Volcado del texto visible completo de ambas pantallas: cero mazos, login, estudio, estadísticas o datos simulados | PASS |
| 19 | Estilos no duplicados | Cero literales de color/`rgb()`/`hsl()` fuera de `src/theme/`; un único control de navegación sirve a sidebar y barra compacta (mismas dimensiones y estilo de activo en ambas disposiciones) | PASS |
| 20 | Respeta ARCHITECTURE y CONVENTIONS | `npm run typecheck` y `npm run lint` en exit 0 dentro de `./init.sh`; greps propios sin `any`, TODO, `console.*` ni `eslint-disable` | PASS |
| 21 | Tests de los componentes reutilizables | `npm test`: 7 suites / 36 tests, exit 0 | PASS |
| 22 | Prueba del comportamiento responsive | `tests/unit/responsive.test.tsx` en verde, más mi propia verificación en 8 viewports reales con el corte exacto en el breakpoint declarado | PASS |
| 23 | Prueba de integración de la navegación | `npm run test:integration` 8/8, incluida la regresión de historial (`router.canGoBack() === false`) que el review #2 demostró que falla al reintroducir el bug | PASS |
| 24 | Sigue arrancando por smoke/E2E | `npm run smoke:web` → `SMOKE WEB: OK (http://localhost:8082 -> 200)`; además levanté yo la app en el 8090 y ambas rutas devolvieron HTTP 200 con contenido real | PASS |
| 25 | Sin regresiones en la suite anterior | `./init.sh` completo en verde; conteos idénticos a los declarados (36 / 8 / 19+2) | PASS |
| 26 | `./init.sh` exit 0 | Ejecutado por mí: **EXIT=0**, los seis bloques en `[OK]` | PASS |
| 27 | Evidencia registrada | `progress/evidence/TASK-002-implementation.md` presente y coherente con lo que medí; `check_evidence.py` → `EVIDENCE: OK` | PASS |

**27 de 27 en PASS.**

---

## Hallazgos

**Ninguno.** No encontré ningún defecto que exija modificación para cumplir una acceptance.

Cosas que busqué específicamente y **descarté** midiendo, no razonando:

- Que sidebar y barra inferior pudieran coexistir en algún tamaño intermedio: no ocurre en ninguno
  de los 8 anchos probados, incluidos los dos que rodean el breakpoint (767 y 768).
- Overflow horizontal en pantallas estrechas: cero incluso a 320 px, más estrecho que cualquier
  viewport de la suite del implementer.
- Controles táctiles por debajo del mínimo: ninguno en 45 mediciones.
- Reaparición del bug de doble montaje al ir y volver: no se reproduce en ninguno de los 8 viewports.
- Errores silenciosos de consola durante la navegación: ninguno en los 8 viewports.
- Funcionalidades de producto coladas en la interfaz: ninguna en el texto visible de las dos
  pantallas.

---

## Observaciones no bloqueantes

No exigen modificación y ninguna afecta a una acceptance. Se registran para tareas futuras.

1. **`progress/current.md` está por detrás del estado real.** Declara `Estado: REVIEWING` con
   "Review #2 — pendiente" y "commit, QA, cierre — pendiente", cuando el review #2 ya emitió
   `APPROVED`, el candidato está commiteado (`146cca4`) y publicado, y `.harness/tasks/TASK-002.json`
   está en `QA`. Ninguna de las 27 acceptance cubre `current.md`, así que no altera el veredicto,
   pero **`CHECKPOINTS.md` C1 y C6 lo exigen antes de declarar DONE**: el agente que cierre la tarea
   debe actualizarlo. No lo toco: soy read-only sobre él.
2. **El botón Atrás del navegador no vuelve entre destinos de la navegación base.** Consecuencia
   directa y consciente de usar `router.replace` para corregir el bug de apilado: tras `/` →
   `/componentes`, `page.goBack()` deja la URL en `/componentes`. Lo verifiqué en el navegador.
   Ninguna acceptance cubre el historial del navegador y para una navegación tipo tabs es un patrón
   defendible; el review #1 ya lo anotó. Conviene reevaluarlo cuando la navegación crezca.
3. **El destino activo no se anuncia a lectores de pantalla en web.** `NavigationItemButton` pasa
   `accessibilityState={{ selected }}` —que el test de integración comprueba y que es correcto en
   nativo—, pero react-native-web no lo traduce a ningún atributo ARIA sobre un `role="link"`: en el
   DOM real no aparece ni `aria-selected` ni `aria-current`. El estado activo se transmite solo por
   color de fondo. Ninguna acceptance lo exige; sería una mejora de accesibilidad para una tarea
   futura.
4. **Anidamiento de `role="progressbar"`.** `Loading` declara `accessibilityRole="progressbar"` en su
   contenedor y envuelve un `ActivityIndicator`, que react-native-web también marca como
   `progressbar`; en el DOM aparecen dos nodos anidados con ese rol por cada `Loading`. La acceptance
   13 solo exige que exista rol de progreso y se cumple. Puramente cosmético a nivel de árbol de
   accesibilidad.
5. **Cobertura de tamaños de la suite automatizada.** Los tres proyectos de Playwright cubren 1280,
   393 y 390 px. Mi verificación añadió 1440, 1024, 768, 767 y 320, incluidos los dos anchos que
   rodean el breakpoint, y todo pasó. Si en el futuro se quiere blindar el corte del breakpoint en
   CI, añadir un proyecto en 767/768 sería la forma barata de hacerlo. No es un defecto actual.
6. **Vocabulario de producto en fixtures de test** (`"Nombre del mazo"`, `"Cargando mazos…"`): ya
   anotado por el review #1. Son cadenas de prueba, no llegan a la interfaz; lo confirmé volcando el
   texto visible de las dos pantallas, donde no aparecen.

---

## Confirmación de rol read-only

- `qa_read_only: true`, respetado.
- **El único archivo que he escrito es este:** `progress/evidence/TASK-002-qa.md`.
- No modifiqué, creé ni borré ningún archivo de código, test, configuración ni documentación. No
  toqué `.harness/tasks/TASK-002.json`, ni `.harness/contracts/TASK-002.json`, ni
  `progress/current.md`, ni `progress/history.md`.
- **No realicé ningún experimento sobre el código.** A diferencia del reviewer, no reintroduje el
  bug de navegación modificando `AppShell.tsx`: verifiqué el comportamiento corregido observándolo
  en el navegador (sección B5). La demostración de que el test de regresión falla con el bug
  presente queda acreditada por el review #2.
- Todos mis artefactos se escribieron **fuera del árbol del repositorio**: `/tmp/qa-unit.log`,
  `/tmp/qa-int.log`, `/tmp/qa-e2e.log`, `/tmp/qa-init.log`, `/tmp/qa-root.html`,
  `/tmp/qa-componentes.html`, `/tmp/qa-server-8090.log` y `/tmp/qa-pw/` (scripts `qa.cjs`,
  `touch.cjs`, `states.cjs` y su salida). Todos eliminados al terminar, y el servidor de pruebas del
  puerto 8090 detenido.
- Estado del repositorio al cerrar QA: `git status --porcelain` muestra únicamente
  `M .harness/tasks/TASK-002.json` (la transición a `QA`, hecha antes de que yo empezara), y
  `check_scope.py` sigue devolviendo `SCOPE: OK (TASK-002)`.
- Ningún defecto fue corregido por mí. No había ninguno que reportar.

**Veredicto final: APPROVED.** Siguiente paso del harness: cierre de la tarea con `./init.sh` final
verde, actualización de `progress/current.md` y `progress/history.md`, y transición a `DONE`.
