# TASK-003 — QA independiente

- **Task:** TASK-003 — Mazos, flashcards y estudio simple sobre la nueva dirección visual
- **Estado revisado:** `QA`
- **Agente:** qa (independiente, READ ONLY sobre código y configuración)
- **Fecha:** 2026-08-18
- **Commit del candidato:** `3dc2c75 feat(TASK-003): mazos, flashcards y estudio simple`
- **Remoto:** `origin/main` = `3dc2c758d93307295409f1d1369222668d73b34e` (mismo hash que `HEAD`)
- **Contrato:** `.harness/contracts/TASK-003.json` (32 acceptance + `verification_matrix` de 32 entradas)
- **Revisiones previas:** review #1 `CHANGES_REQUIRED` (R1-R5) → review #2 `CHANGES_REQUIRED` (N1-N4) → review #3 `APPROVED`

## Veredicto

**APPROVED**

Las 32 acceptance del contrato se cumplen sobre el **comportamiento observable**, verificado por mí
levantando la aplicación real y recorriéndola en el navegador en tres viewports y con scripts
propios, no releyendo los tests del implementer. Los cuatro gates terminan en verde y los conteos
coinciden **exactamente** con los que afirma la evidencia: **62 unit, 33 integration, 33 passed + 3
skipped E2E, `./init.sh` exit code 0**.

Los dos defectos que motivaron las rondas anteriores están **corregidos de verdad, comprobado por mí
en el navegador**: el error de validación de carta se ancla al campo que falla (borde rojo y mensaje
bajo *Frente*, con el *Reverso* limpio), y volver del estudio no deja una segunda instancia del
detalle apilada.

**Ningún hallazgo exige modificación.** Sí registro una observación no bloqueante de peso —el
apilado de pantallas crece sin límite al pulsar un destino de primer nivel desde una pantalla
apilada— que **no incumple ninguna acceptance** (el usuario siempre ve exactamente una pantalla, la
correcta, y todos los controles funcionan) pero que conviene que el usuario conozca porque es de la
misma familia que los dos bugs ya corregidos en esta tarea.

---

## Documentos leídos

1. `AGENTS.md` (sección D)
2. `.harness/agents/qa.md`
3. `.harness/tasks/TASK-003.json`
4. `.harness/contracts/TASK-003.json` (32 acceptance + `verification_matrix`)
5. `docs/VERIFICATION.md`
6. `docs/TESTING.md`
7. `docs/DESIGN.md`
8. `docs/PRODUCT.md`
9. `CHECKPOINTS.md`
10. `progress/current.md`
11. `progress/evidence/TASK-003-implementation.md`
12. `progress/evidence/TASK-003-review.md` (revisiones #1, #2 y #3, completas)
13. Código leído para saber **qué observar**, no para darlo por bueno: `src/theme/tokens.ts`,
    `src/components/ui/{Button,Input,FlashcardFace}.tsx` (incluido `FlashcardSurface`),
    `src/components/layout/AppShell.tsx`, `app/index.tsx`, `app/mazo/[id]/index.tsx`,
    `app/mazo/[id]/estudiar.tsx`, `app/componentes.tsx`, `package.json`, `playwright.config.ts`.

---

## Gates ejecutados por mí

Todas las salidas se redirigieron a `/tmp`, **fuera del repositorio**, para no ensuciar
`check_scope.py` con un untracked propio.

### `npm test` (unit)

```text
Test Suites: 9 passed, 9 total
Tests:       62 passed, 62 total
Time:        1.054 s
```

### `npm run test:integration`

```text
Test Suites: 5 passed, 5 total
Tests:       33 passed, 33 total
Time:        1.458 s
```

### `npm run test:e2e`

```text
Running 36 tests using 5 workers
  3 skipped
  33 passed (9.7s)
```

Los 3 saltados son las comprobaciones táctiles en `desktop-chrome`
(`test.skip(..., 'Solo aplica a pantallas táctiles.')`), como declara la evidencia.

### `./init.sh` — **EXIT_CODE=0**

```text
── 1. Harness ──   VERIFY: OK                        [OK] Harness válido
── 2. Scope ────   SCOPE: OK (TASK-003)              [OK] Scope válido
── 3. Hygiene ──                                     [OK] Sin temporales/secretos obvios
── 4. App gates ─                                    [OK] typecheck
                                                     [OK] lint
                   Test Suites: 9 passed, 9 total
                   Tests:       62 passed, 62 total  [OK] test
                   Test Suites: 5 passed, 5 total
                   Tests:       33 passed, 33 total  [OK] test:integration
                   3 skipped
                   33 passed (9.1s)                  [OK] test:e2e
── 5. Evidence ─   EVIDENCE: OK                      [OK] Evidencia coherente
── 6. Summary ──                                     [OK] Estado verificable
```

**Los conteos que afirma `TASK-003-implementation.md` (62 / 33 / 33+3) son exactamente los que
obtuve.** Coinciden también con los medidos por el reviewer en las tres rondas.

---

## Recorrido real en el navegador

Servidor levantado por mí: `npx expo start --web --port 8091` (HTTP 200). Recorrido a mano con
scripts Playwright propios escritos **en `/tmp`**, fuera del árbol del repositorio, y borrados al
terminar. Tres contextos: **desktop 1280x800**, **móvil 390x844** y **móvil estrecho 320x568**
(los dos móviles con `hasTouch`/`isMobile`).

### 1. Estado inicial vacío en Mis mazos

```text
EmptyState visible; no existe decks-list; cabecera "0 mazos"
texto: "Todavía no tienes mazos · Crea tu primer mazo arriba y empieza a añadirle cartas."
sidebar presente en desktop · barra compacta AUSENTE en desktop
```

### 2. Validación de mazo: error legible y **anclado al campo del nombre**

```text
mensaje: "Escribe un nombre para el mazo."
el error vive DENTRO del contenedor del campo "Nombre del mazo"
  (contenedor medido: "Nombre del mazoEscribe un nombre para el mazo.")
se pinta DEBAJO del campo: dy = 4px
borde del campo en color error: rgb(168, 74, 74)  = #A84A4A
no se creó ningún mazo (sigue el EmptyState)
```

### 3. Crear un mazo: aparece sin recargar, el campo se limpia, el recuento sube

```text
el mazo aparece en la lista sin recarga
el campo queda en ""  · el error desaparece al escribir
cabecera "0 mazos" -> "1 mazo" -> "2 mazos"
la fila muestra nombre y "0 cartas"
```

### 4. Detalle del mazo y **Estudiar inhabilitado sin cartas**

```text
URL: http://localhost:8091/mazo/mazo-2   (cambia de verdad)
título = nombre del mazo · EmptyState de cartas visible
  "Este mazo todavía no tiene cartas · Las cartas que crees aparecerán aquí, dentro de este mazo."
study-button aria-disabled=true
pulsándolo a la fuerza NO navega: la URL no cambia
la razón se comunica: "Añade al menos una carta para poder estudiar este mazo."
```

### 5. Validación de carta — **el defecto R1, verificado corregido en el navegador**

Falta el **Frente** (con el Reverso relleno):

```text
mensaje: "Escribe el frente de la carta."
card-front-input-error   VISIBLE
card-back-input-error    NO EXISTE en el DOM
el error vive en el contenedor de Frente, y NO en el de Reverso
se sitúa geométricamente ENTRE el campo Frente y el campo Reverso
borde rojo SOLO en Frente:  frente=rgb(168, 74, 74)  reverso=rgb(221, 218, 211)
```

Caso simétrico, falta el **Reverso**:

```text
card-back-input-error    VISIBLE
card-front-input-error   NO EXISTE en el DOM
```

**El defecto real que el review #1 señaló está corregido y lo he comprobado yo mismo en el
navegador, en las dos direcciones.**

### 6. Crear cartas

```text
la carta aparece en el mazo (frente y reverso listados)
ambos campos quedan en "" · desaparece el EmptyState de cartas
study-button pasa a aria-disabled=null (se habilita)
el recuento del mazo sube a "2 cartas"
```

### 7. Las cartas NO se cruzan entre mazos

```text
mazo "Inglés"  : Book/Libro, House/Casa
mazo "Anatomía": Fémur/Hueso del muslo
"Book" y "House" NO aparecen en Anatomía
"Fémur" NO aparece en Inglés
Inglés conserva sus dos cartas · la lista raíz muestra "2 cartas" y "1 carta"
```

### 8. Sesión de estudio: ciclo completo

```text
inicio      : study-front visible · study-back NO ESTÁ EN EL DOM
              progreso "Carta 1 de 2" · botón "Mostrar respuesta" · sin "Siguiente carta"
revelado    : FRENTE y REVERSO visibles A LA VEZ ("Book" / "Libro")
              desaparece "Mostrar respuesta", aparece "Siguiente carta"
avance      : frente cambia "Book" -> "House"; study-back vuelve a NO estar en el DOM
              progreso "Carta 2 de 2" · reaparece "Mostrar respuesta"
final       : "Sesión terminada · Has repasado las 2 cartas de este mazo. · Volver al mazo"
salida      : "Volver al mazo" devuelve a /mazo/mazo-2
              instancias de cards-list tras volver = 1   (sin detalle duplicado)
```

El botón de vuelta de la cabecera del estudio (`‹ Inglés`) también navega de verdad y tampoco
duplica el detalle (`cards-list = 1`). **La regresión de apilado del review anterior sigue
corregida, comprobada por comportamiento y no por lectura de test.**

### 9. Sin ningún control de calificación

Inventario de los controles **realmente visibles** (descartando pantallas apiladas ocultas por
`display:none`/`aria-hidden`) en la pantalla de estudio:

```text
/mazo/[id]/estudiar (frente)    : nav-mazos · nav-componentes · back-to-deck · reveal-button
/mazo/[id]/estudiar (revelado)  : nav-mazos · nav-componentes · back-to-deck · next-card-button
/mazo/[id]/estudiar (final)     : nav-mazos · nav-componentes · back-to-deck · finish-back-button
```

Barrido con `otra vez|difícil|bien|fácil|calificar|repetir|again|hard|easy|good|acierto|fallo`:
**cero coincidencias** en las tres pantallas y en los tres viewports. Tampoco aparece texto que
aparente repetición espaciada (`repetición espaciada|nuevas|aprendiendo|repasar hoy|intervalo`):
cero coincidencias. La zona de calificación del boceto está **eliminada**, no simulada.

### 10. Todos los botones visibles hacen algo real

Pulsé uno por uno y comprobé su efecto observable: `create-deck-button`, la fila del mazo
(`deck-mazo-N`), `back-to-decks`, `study-button` (inhabilitado y habilitado), `add-card-button`,
`reveal-button`, `next-card-button`, `finish-back-button`, `back-to-deck`, `nav-mazos`,
`nav-componentes`. **Ninguno es decorativo.** El único inhabilitado es *Estudiar* sin cartas, con la
razón declarada en pantalla. Ningún control visible carece de `testID` ni de acción.

Ruta de detalle inexistente (`/mazo/no-existe`): se explica el estado
("Mazo no encontrado · Ese mazo ya no existe · Vuelve a Mis mazos y elige uno de la lista") y
`back-to-decks` funciona.

### 11. Navegación real

```text
/ -> /componentes -> /            URL y contenido cambian de verdad
los mazos siguen en la lista tras navegar (el estado vive mientras dura el documento)
errores de consola en los tres viewports: 0
```

---

## Dirección visual medida con `getComputedStyle`

Valores **realmente aplicados** en el navegador, no leídos de los tokens:

| Token confirmado | Valor esperado | Medido en el navegador | Dónde |
|---|---|---|---|
| Fondo principal | `#F7F5F0` | `rgb(247, 245, 240)` | raíz de la app |
| Superficie | `#FFFFFF` | `rgb(255, 255, 255)` | sidebar y carta de estudio |
| Texto principal | `#20242A` | `rgb(32, 36, 42)` | título de pantalla |
| Texto secundario | `#6B7280` | `rgb(107, 114, 128)` | ayuda del campo, etiquetas |
| Primario | `#315B7D` | `rgb(49, 91, 125)` | botón primario y destino activo |
| Primario suave | `#E7EEF4` | `rgb(231, 238, 244)` | fondo del destino activo |
| Borde | `#DDDAD3` | `rgb(221, 218, 211)` | sidebar, campos, carta de estudio |
| Error | `#A84A4A` | `rgb(168, 74, 74)` | borde y mensaje de validación |
| Éxito / acento | `#52705A` | `rgb(82, 112, 90)` | catálogo de componentes |
| Advertencia | `#A86F32` | no observado en pantalla | ver observación no bloqueante |

Los diez valores del token coinciden **uno a uno** con la tabla de `docs/DESIGN.md`, y
`tests/unit/theme.test.ts` los fija por valor exacto (incluido `warning` en la línea 68).

### Tipografía: la serif sólo en el contenido de las flashcards

```text
fuente de la interfaz (body): sans-serif del sistema
  "-apple-system, system-ui, Segoe UI, Roboto, Helvetica, Arial, sans-serif"

nodos con serif en /mazo/[id] (2 cartas): 4, todos dentro de una cara de flashcard
  "Serendipity"                               -> Iowan Old Style, Palatino, Georgia, serif
  "Serendipia: hallazgo afortunado e inesperado" -> idem
  "Ephemeral" / "Efímero"                     -> idem

nodos con serif en /mazo/[id]/estudiar (frente)  : 1  (el frente)
nodos con serif en /mazo/[id]/estudiar (revelado): 2  (frente y reverso)

la etiqueta "FRENTE" es SANS y el contenido "Serendipity" es SERIF (medido en el mismo bloque)
```

**Cero títulos, botones o etiquetas con serif.** La distinción semántica de `docs/DESIGN.md` se
respeta en pantalla.

### Sin estética de IA: ni gradientes, ni glow, ni sombras de color

Barrido de `backgroundImage`, `boxShadow`, `textShadow` y `filter` sobre **todos** los elementos de
cada ruta:

```text
/                      gradientes 0 · sombras 0 · filtros/blur 0
/mazo/[id]             gradientes 0 · sombras 0 · filtros/blur 0
/mazo/[id]/estudiar    gradientes 0 · sombras 0 · filtros/blur 0
/componentes           gradientes 0 · sombras 0 · filtros/blur 0
```

Confirmado además a ojo sobre capturas de las cinco pantallas: crema cálido, superficies blancas,
azul tinta, filete de 1 px. Limpio, académico y tranquilo, sin nada futurista.

---

## Responsive, overflow y objetivos táctiles

### Disposición: nunca coexisten sidebar y barra compacta

```text
desktop 1280x800 : app-sidebar SÍ · app-tabbar NO
móvil 390x844    : app-tabbar SÍ · app-sidebar NO   (en las 5 pantallas medidas)
móvil 320x568    : app-tabbar SÍ · app-sidebar NO   (en las 5 pantallas medidas)
```

Comprobado en `/`, `/mazo/[id]` vacío y con cartas, y en los tres estados de
`/mazo/[id]/estudiar` (frente, revelado y final), **no sólo al final del recorrido**.

### Sin overflow horizontal en ninguna ruta

`scrollWidth` frente a `clientWidth`, en `html` y en `body`:

```text
desktop 1280 : /  1280/1280 · /mazo/[id]  1280/1280 · /componentes 1280/1280
móvil 390    : /  390/390 · /mazo/[id] 390/390 · estudiar (frente/revelado/final) 390/390
móvil 320    : /  320/320 · /mazo/[id] 320/320 · estudiar (frente/revelado/final) 320/320
```

Probado además con **texto largo a propósito** ("Caída del Imperio Romano de Occidente" /
"476 d. C., deposición de Rómulo Augústulo por Odoacro"): sigue sin desbordar a 320 px.

### Objetivos táctiles: todos >= 44x44 en móvil

Medidas reales de `boundingBox` de cada control visible (móvil 390 / móvil 320):

```text
/                        deck-name-input 292x48 / 222x48 · create-deck-button 292x44 / 222x44
                         deck-mazo-N 342x106 / 272x106
                         nav-mazos 185x47 / 150x47 · nav-componentes 185x47 / 150x47
/mazo/[id]               back-to-decks 93x44 · study-button 97x44
                         card-front-input 292x48 / 222x48 · card-back-input 292x48 / 222x48
                         add-card-button 292x44 / 222x44
/mazo/[id]/estudiar      back-to-deck 75x44 · reveal-button 342x44 / 272x44
                         next-card-button 342x44 / 272x44 · finish-back-button 144x44
/mazo/no-existe          back-to-decks 93x44
```

**Ningún control por debajo de 44x44 en ninguna pantalla, incluidas las nuevas.** La barra compacta
(`nav-mazos`, `nav-componentes`), que el recorrido E2E del implementer no llegaba a medir en las
rutas nuevas, la he medido yo: 47 px de alto en ambos móviles.

---

## Nada fuera de scope

Greps propios sobre `app/` y `src/`:

```text
$ grep -rniE "supabase|autenticaci|\blogin\b|password|google|apple|modo oscuro|dark ?mode|
   estadístic|statistic|anki|importaci|sincroniz|\bsync\b|subcategor|openai|inteligencia artificial"
(sin coincidencias)

$ grep -rniE "calific|repetici|scheduler|\bsrs\b|otra vez|difícil|fácil|rating|grade|intervalo"
app/mazo/[id]/estudiar.tsx:24   comentario: declara que NO se implementa
src/features/study/session.ts:4 comentario: declara que NO se implementa

$ grep -rnE '#[0-9A-Fa-f]{3,8}|rgba?\(|hsla?\(' --include='*.ts' --include='*.tsx' app src | grep -v '^src/theme/'
(sin coincidencias)

$ grep -rniE "gradient|glow|neon|shadowColor|textShadow|shadowOpacity|shadowRadius|elevation" app/ src/
src/theme/tokens.ts:9   (comentario que las declara prohibidas)

$ grep -rn "serif" app/ src/
src/components/ui/FlashcardFace.tsx:57   fontFamily: typography.family.serif   ← único uso
(el resto: el comentario de ese archivo y la definición del token)

$ grep -rnE '\bany\b|TODO|FIXME|console\.(log|warn|error|debug)' app/ src/ tests/
(sin coincidencias)

$ git diff 9f530f0..HEAD -- package.json package-lock.json
(vacío: sin dependencias nuevas)
```

Confirmado también por observación: no hay pantalla de acceso, ni ajustes de tema, ni estadísticas,
ni contadores nuevas/aprendiendo/repasar, ni importación, ni subcategorías.

---

## Acceptance orientadas al usuario -> resultado

| # | Acceptance | Cómo lo comprobé | Resultado |
|---|---|---|---|
| 1 | Paleta aplicada, sin colores propios | `getComputedStyle` de 9 tokens en pantalla + grep sin literales fuera de `src/theme/` | **PASS** |
| 2 | Sans en interfaz, serif sólo en las flashcards | Barrido de `fontFamily` por nodo hoja en 4 rutas: 100 % de los nodos serif dentro de una cara de flashcard | **PASS** |
| 3 | Sin IA/neón/glow/futurismo | Barrido de gradientes, sombras y filtros en 4 rutas: 0/0/0 + revisión visual de capturas | **PASS** |
| 4 | La navegación funciona de verdad en web | `/` ↔ `/componentes` ↔ `/mazo/[id]` ↔ `/estudiar`: URL y contenido cambian; 0 errores de consola | **PASS** |
| 5 | Sección Mis mazos que lista los mazos | Lista con nombre y número real de cartas ("2 cartas", "1 carta") | **PASS** |
| 6 | Estado vacío en Mis mazos | EmptyState con texto que explica qué hacer | **PASS** |
| 7 | Crear mazo y verlo sin recargar | Aparece sin recarga, campo limpio, recuento 0→1→2 | **PASS** |
| 8 | Validación de mazo con error legible | "Escribe un nombre para el mazo.", anclado al campo, dy=4px, borde `#A84A4A` | **PASS** |
| 9 | Entrar al detalle desde la lista | Pulsando la fila: URL `/mazo/mazo-2` y detalle renderizado | **PASS** |
| 10 | El detalle muestra nombre y cartas | Título = nombre del mazo; cada carta con su frente y su reverso | **PASS** |
| 11 | Estado vacío de cartas | EmptyState explicando que hay que crear la primera carta | **PASS** |
| 12 | Crear flashcard con Frente y Reverso | Aparece en la lista, ambos campos limpios, EmptyState desaparece | **PASS** |
| 13 | Validación de flashcard con error legible | **Anclado al campo que falla en ambas direcciones**, borde rojo sólo en el campo culpable | **PASS** |
| 14 | Las cartas sólo dentro de su mazo | Dos mazos con contenido propio; ninguna carta se cruza | **PASS** |
| 15 | Todos los botones visibles ejecutan una acción real | 11 controles pulsados uno a uno con efecto observable; el único inhabilitado es Estudiar sin cartas, con razón declarada | **PASS** |
| 16 | El estudio muestra primero sólo el frente | `study-back` **no está en el DOM** en el estado inicial | **PASS** |
| 17 | Mostrar respuesta enseña frente y reverso a la vez | Ambos visibles simultáneamente tras la acción | **PASS** |
| 18 | Siguiente carta avanza y vuelve a ocultar | Frente "Book"→"House"; `study-back` vuelve a desaparecer del DOM | **PASS** |
| 19 | Progreso y final de sesión | "Carta 1 de 2" → "Carta 2 de 2" → "Sesión terminada" con salida al mazo que funciona | **PASS** |
| 20 | Sin controles de calificación ni apariencia de repetición espaciada | Inventario de controles visibles en las 3 pantallas de estudio y 3 viewports: cero coincidencias | **PASS** |
| 21 | Nada de auth, Supabase, importación, oscuro, estadísticas, anidadas, IA ni sync | Greps sin coincidencias + observación de pantallas + cero dependencias nuevas | **PASS** |
| 22 | Se adapta a desktop y a móvil | Sidebar en desktop y barra compacta en móvil, **nunca ambas**, en las 5 pantallas y 3 viewports | **PASS** |
| 23 | Sin overflow horizontal | `scrollWidth <= clientWidth` en todas las rutas a 1280, 390 y 320 px, también con texto largo | **PASS** |
| 24 | Objetivos táctiles utilizables | Todos los controles visibles >= 44x44 en 390 y 320 px, incluida la barra compacta | **PASS** |
| 25 | Lógica testeable sin interfaz | `src/features/**` sólo importa tipos; sus tests no montan nada | **PASS** |
| 26 | Tests unitarios de mazos y cartas con errores | `npm test` verde: `library.test.ts` con sus casos de error | **PASS** |
| 27 | Tests unitarios de la sesión | `npm test` verde: `study-session.test.ts`, ciclo completo | **PASS** |
| 28 | Integración de los tres flujos | `npm run test:integration`: 33 passed sobre `decks-flow`, `cards-flow`, `study-flow` | **PASS** |
| 29 | E2E de los flujos en desktop y móvil | `npm run test:e2e`: 33 passed + 3 skipped en los 3 proyectos | **PASS** |
| 30 | Sin regresiones | Suite completa verde en `./init.sh` | **PASS** |
| 31 | `./init.sh` exit 0 | Exit code 0 con todos los gates en `[OK]` | **PASS** |
| 32 | Evidencia registrada | `progress/evidence/TASK-003-implementation.md` leído y contrastado; sus conteos coinciden con los míos | **PASS** |

**32 de 32 PASS.**

---

## Hallazgos

**Ninguno.** No he encontrado nada que exija modificación para cumplir una acceptance del contrato.

---

## Observaciones no bloqueantes

Ninguna condiciona la aprobación. Las dos primeras son información que el usuario debería tener
antes de decidir los próximos pasos.

### 1. El apilado de pantallas crece sin límite al pulsar un destino de primer nivel desde una pantalla apilada

Reproducido por mí en los tres viewports. Estando en el detalle de un mazo (o en el estudio), pulsar
**Mis mazos** o **Componentes** en el sidebar/barra compacta **añade** una instancia nueva del
destino en lugar de volver a la que ya existe:

```text
detalle -> nav "Mis mazos", repetido 15 veces:
  instancias de "Mis mazos" montadas = 16
  instancias VISIBLES                = 1     (las 15 obsoletas quedan display:none + aria-hidden=true)
  filas de mazo visibles             = 1     (lo esperado)
  nodos DOM                          = 405 · sin overflow · 0 errores de consola
  el recorrido completo posterior (crear carta -> estudiar) sigue funcionando correctamente
```

**Por qué NO es un hallazgo:** ninguna acceptance habla de la profundidad del apilado ni de la
semántica del historial. La acceptance 4 se cumple en sus propios términos (la URL y el contenido
cambian de verdad, sin errores de consola), la 15 también (todos los controles visibles funcionan),
y el usuario **siempre ve exactamente una pantalla, la correcta**: las instancias obsoletas no son
visibles ni quedan expuestas a tecnología asistiva (`aria-hidden="true"`). Además, el comportamiento
es la consecuencia directa de la `technical_decision` 3 del contrato ("los destinos de primer nivel
siguen usando `replace`"), que el reviewer examinó y aprobó explícitamente: `replace` sustituye la
pantalla superior pero no saca del apilado las que hay debajo.

**Por qué conviene registrarlo:** es exactamente la misma familia que los dos bugs ya corregidos en
esta tarea (el apilado del estudio en la implementación y el `navigate` de TASK-002). El botón de
vuelta de pantalla (`‹ Mis mazos`) **no** presenta el problema: 4 ciclos con él dejan siempre 1 sola
instancia. Si el usuario quiere resolverlo, es una decisión suya y material para otra tarea, no un
incumplimiento de TASK-003.

### 2. El botón *atrás* del navegador vacía la biblioteca, y no por el apilado

Medido de forma aislada. Comparé cuatro caminos con un marcador en `window` para distinguir recarga
de documento de navegación en el mismo documento:

```text
A) raíz -> Componentes (sidebar) -> atrás   : recarga de documento (comportamiento heredado TASK-002)
B) raíz -> detalle (push)        -> atrás   : MISMO documento, url=/, biblioteca VACÍA ("0 mazos")
C) raíz -> detalle -> nav sidebar-> atrás   : MISMO documento, url=/, biblioteca VACÍA ("0 mazos")
D) raíz -> detalle -> "‹ Mis mazos" -> atrás: recarga de documento
```

El caso **B** es decisivo: ocurre en el camino más simple posible (entrar en un mazo y pulsar atrás),
**sin intervención alguna del apilado**. Es decir, la pérdida de datos al retroceder **no la causa la
observación 1**: es la consecuencia genérica de que la biblioteca viva en memoria ligada al árbol de
React. El contrato pone `Persistir datos entre recargas` en `out_of_scope` y la
`technical_decision` 1 declara la pérdida al recargar. Hacer que sobreviviera a un salto de historial
exigiría precisamente la decisión de almacenamiento que **no** está tomada, así que no puede ser un
defecto de TASK-003. Lo dejo medido porque es información útil para cuando el usuario decida la
persistencia.

### 3. Detalles menores

- **`warning` `#A86F32` no se observa en ninguna pantalla.** El token existe con el valor confirmado
  y `tests/unit/theme.test.ts:68` lo fija, pero `app/componentes.tsx` sólo renderiza las variantes
  `info`, `success` y `error` de `Message`. Ninguna acceptance exige mostrarlo; es una laguna del
  catálogo heredado de TASK-002.
- **El contador de identificadores se consume también en los intentos fallidos.** Lo verifiqué sin
  querer: tras un intento de crear un mazo con el nombre vacío, el primer mazo real es `mazo-2` y no
  `mazo-1`. Inocuo (los ids no se muestran) y ya señalado por el reviewer.
- **El estado vacío de estudio (`study-empty`) no es alcanzable por interfaz.** *Estudiar* está
  inhabilitado con 0 cartas y una URL directa recarga la página, lo que vacía la biblioteca en
  memoria y lleva a "Mazo no encontrado". Es código defensivo, coherente con la rama
  `field === 'form'` que el reviewer ya aceptó.
- **Confirmaciones que el reviewer dejó expresamente para QA:** la paleta a ojo contra la dirección
  visual confirmada queda **confirmada** (ver tabla de colores medidos y capturas), y la pérdida de
  datos al recargar es **visible y reproducible**, tal como está declarada.

### 4. Lo que NO he contado como defecto, por estar declarado o fuera de scope

Que los datos se pierdan al recargar; que no haya modo oscuro; que no se puedan editar ni borrar
mazos y cartas; que se permitan dos mazos con el mismo nombre (pregunta abierta NO bloqueante,
correctamente registrada en task, contrato y `progress/current.md`); y que falten componentes de
`docs/DESIGN.md` que la acceptance no exige.

---

## Estado de CHECKPOINTS

- **C1 Harness sano**: `./init.sh` exit 0; una sola tarea activa; contrato existente. **OK**
- **C2 Scope controlado**: `SCOPE: OK (TASK-003)`; acceptance intacta (32 en task y contrato); sin
  dependencias nuevas. **OK**
- **C3 Implementación correcta**: las 32 acceptance verificadas sobre comportamiento observable;
  happy path y casos de error cubiertos; sin logs, temporales ni TODOs. **OK**
- **C4 Verificación por capas**: static, unit, integration, e2e y regresión completa en verde,
  reejecutados por mí. **OK**
- **C5 Revisión independiente**: review #3 `APPROVED`; **QA ha comprobado el comportamiento
  observable**; no quedan findings críticos ni altos abiertos. **OK**
- **C6 Cierre limpio**: pendiente del paso de cierre (historial, `progress/current.md` y `./init.sh`
  final), que no corresponde a QA.

---

## Confirmación de rol read-only

- No he editado, creado ni borrado **ningún** archivo de código, test, documentación o configuración.
- El único archivo que he escrito es **este**: `progress/evidence/TASK-003-qa.md`.
- **No he tocado** `.harness/tasks/TASK-003.json`, ni `.harness/contracts/TASK-003.json`, ni
  `progress/current.md`, ni `progress/history.md`, ni `progress/evidence/TASK-003-review.md`, ni
  `progress/evidence/TASK-003-implementation.md`.
- A diferencia del reviewer, **no he modificado código ni siquiera de forma temporal**: no he
  reintroducido ningún bug. Toda mi verificación fue por observación del comportamiento de la
  aplicación en ejecución.
- Todos mis artefactos (scripts Playwright, capturas y logs) se escribieron en `/tmp`, **fuera del
  árbol del repositorio**, para no alterar `check_scope.py`, y fueron **borrados al terminar**.
- El servidor `npx expo start --web --port 8091` que levanté para el recorrido quedó **detenido**.
- Ningún defecto ha sido corregido por mí. No había ninguno que corregir.
- `git status --porcelain` al terminar devuelve únicamente el cambio de estado de la task que ya
  existía al empezar mi turno, más este archivo de evidencia.
