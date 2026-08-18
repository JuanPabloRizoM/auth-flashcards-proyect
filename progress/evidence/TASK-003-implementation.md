# TASK-003 — Implementation Evidence

## Resumen

- Task: TASK-003 — Mazos, flashcards y estudio simple sobre la nueva dirección visual
- Agente: implementer
- Contrato: `.harness/contracts/TASK-003.json` (32 acceptance; una `open_question` NO bloqueante surgida en el review #1)
- Base de Git: `9f530f0 chore(TASK-002): cerrar base visual tras review y QA`
- Fecha: 2026-08-18

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

Working tree limpio.

## Documentos leídos antes de implementar

`AGENTS.md`, `progress/current.md`, `bash scripts/agent_context.sh`, `.harness/tasks/TASK-003.json`,
`.harness/contracts/TASK-003.json`, `docs/PRODUCT.md`, `docs/ARCHITECTURE.md`,
`docs/CONVENTIONS.md`, `docs/DESIGN.md`, `docs/TESTING.md`, `docs/VERIFICATION.md`, más el código
existente que había que reutilizar: tokens, componentes compartidos, `AppShell`, `navigation.ts`,
configuración de jest y playwright y los tests heredados.

## Documentación actualizada antes de la task

Por indicación explícita del usuario, y solo con decisiones confirmadas:

- `docs/PRODUCT.md`: catorce decisiones confirmadas con fecha 2026-08-18, y la lista de decisiones
  NO tomadas ampliada (persistencia, sincronización, subcategorías anidadas, modo oscuro,
  estadísticas, calificación).
- `docs/DESIGN.md`: dirección visual confirmada, tabla de la paleta, regla tipográfica
  sans/serif, componentes implementados frente a pendientes, y la regla derivada del boceto sobre
  no aparentar funcionalidad no disponible.

## Archivos creados y modificados

| Archivo | Estado | Motivo |
|---|---|---|
| `src/theme/tokens.ts` | modificado | Paleta confirmada + familia serif por plataforma |
| `src/types/domain.ts` | nuevo | Tipos Deck, Card y Library |
| `src/features/decks/library.ts` | nuevo | Lógica pura de mazos y cartas, con errores tipados |
| `src/features/study/session.ts` | nuevo | Lógica pura de la sesión de estudio |
| `src/lib/LibraryProvider.tsx` | nuevo | Acceso a datos centralizado, en memoria |
| `src/lib/navigation.ts` | nuevo | Vuelta atrás por historial para pantallas de detalle |
| `src/components/ui/FlashcardFace.tsx` | nuevo | Contenido de la carta: único lugar con serif |
| `src/components/ui/Card.tsx` | modificado | Acepta `onPress` en lugar de crear un componente de fila |
| `src/components/ui/index.ts` | modificado | Exporta el componente nuevo |
| `src/components/layout/ScreenHeader.tsx` | nuevo | Encabezado de pantalla con vuelta y acción |
| `src/components/layout/navigation.ts` | modificado | El destino raíz pasa a ser "Mis mazos" |
| `src/components/layout/index.ts` | modificado | Exporta `ScreenHeader` |
| `app/_layout.tsx` | modificado | Envuelve la app en `LibraryProvider` |
| `app/index.tsx` | modificado | Pantalla Mis mazos: lista, alta y estado vacío |
| `app/mazo/[id]/index.tsx` | nuevo | Detalle del mazo: cartas, alta y estado vacío |
| `app/mazo/[id]/estudiar.tsx` | nuevo | Estudio simple sin calificación |
| `app/componentes.tsx` | modificado | Añade `FlashcardFace` al catálogo |
| `tests/unit/library.test.ts` | nuevo | Lógica de mazos y cartas |
| `tests/unit/study-session.test.ts` | nuevo | Lógica de la sesión |
| `tests/unit/flashcard-face.test.tsx` | nuevo | Serif solo en el contenido |
| `tests/unit/theme.test.ts` | modificado | Verifica los diez valores exactos de la paleta |
| `tests/unit/responsive.test.tsx` | modificado | testID del destino raíz |
| `tests/unit/index-screen.test.tsx` | **eliminado** | Probaba la pantalla placeholder, que ya no existe (ver más abajo) |
| `tests/integration/routes.tsx` | nuevo | Mapa de rutas reales compartido |
| `tests/integration/decks-flow.test.tsx` | nuevo | Flujo crear mazo y entrar al detalle |
| `tests/integration/cards-flow.test.tsx` | nuevo | Flujo crear carta y pertenencia al mazo |
| `tests/integration/study-flow.test.tsx` | nuevo | Ciclo de estudio + regresión de apilado |
| `tests/integration/navigation.test.tsx` | modificado | Adaptado a la nueva pantalla raíz |
| `tests/integration/expo-router-navigation.test.tsx` | modificado | Añade las rutas de mazo y estudio |
| `tests/e2e/flashcards-flow.spec.ts` | nuevo | Recorrido completo por dispositivo |
| `tests/e2e/web-boot.spec.ts` | modificado | Adaptado a la nueva pantalla raíz |
| `tests/e2e/responsive-navigation.spec.ts` | modificado | testID del destino raíz |
| `docs/PRODUCT.md`, `docs/DESIGN.md` | modificados | Decisiones confirmadas |
| `.harness/tasks/TASK-003.json`, `.harness/contracts/TASK-003.json` | nuevos | Task y contrato |
| `progress/current.md`, este archivo | modificado/nuevo | Estado y evidencia |

Todos dentro de `allowed_paths`: `SCOPE: OK (TASK-003)`.

**Sin dependencias nuevas.** `git diff --stat HEAD -- package.json package-lock.json` está vacío.

## Decisiones técnicas

1. **Los datos viven en memoria**, en `LibraryProvider`. Supabase y la base de datos están fuera de
   scope y la persistencia local no ha sido decidida. Es la solución mínima que satisface todas las
   acceptance sin añadir dependencias. **Consecuencia declarada: al recargar la página se pierden
   los datos.** Cuando exista una decisión de almacenamiento solo cambia ese archivo.
2. **Lógica pura separada de la interfaz**: `features/decks/library.ts` y `features/study/session.ts`
   no importan react-native ni componentes; sus tests no montan nada.
3. **Los destinos de primer nivel siguen usando `replace`; el detalle y el estudio se apilan** y
   vuelven con `back`. Ver el bug corregido más abajo.
4. **Se permiten nombres de mazo repetidos.** La versión inicial los rechazaba; el review #1
   señaló que era una decisión de producto no confirmada y se retiró. La validación se limita al
   nombre vacío. Ver la corrección R2 más abajo.
5. **La zona de calificación del boceto se elimina por completo**, en lugar de conservarse como
   espacio estructural. El usuario admitía ambas opciones; eliminarla es lo más seguro frente a la
   exigencia de no aparentar funcionalidad disponible.
6. **La pantalla de acceso del boceto no se implementa**: autenticación está fuera de scope. El
   boceto es referencia visual, no una lista de pantallas a construir.
7. **Los contadores nuevas/aprendiendo/repasar del boceto no se implementan**: presuponen el
   algoritmo de repetición espaciada. En su lugar el mazo muestra su número real de cartas.
8. **`Card` se extiende con `onPress`** en lugar de crear un componente de fila nuevo
   (`docs/DESIGN.md`: antes de crear un componente, comprobar si uno existente puede extenderse).

## Bug encontrado y corregido durante la implementación

El E2E multi-dispositivo detectó un apilamiento de pantallas que los tests de integración iniciales
no capturaban:

```text
[desktop-chrome] Recorrido completo › crear un mazo, añadirle cartas y estudiarlas
  Error: strict mode violation: getByTestId('cards-list') resolved to 2 elements
```

Volver del estudio al detalle del mazo con `router.replace` dejaba montada la instancia anterior del
detalle: el apilado quedaba `/`, detalle, detalle'. Los tres proyectos fallaban igual.

- **Causa**: `replace` sustituye la pantalla actual pero no saca del apilado la que había debajo.
  Es el mismo patrón que el bug de TASK-002, ahora en rutas de detalle en lugar de en destinos de
  primer nivel.
- **Corrección**: `src/lib/navigation.ts` expone `goBackOr`, que sale del apilado con `back()` y
  solo recurre a `replace` cuando no hay historial, por ejemplo al abrir un enlace directo a la
  pantalla de estudio.
- **Test de regresión**: `tests/integration/study-flow.test.tsx`, caso *"volver del estudio no añade
  un nivel extra al apilado"*. Comprueba la **profundidad del apilado**, no cuántos nodos hay
  montados: tras volver del estudio, un único paso atrás más debe llevar a Mis mazos y dejar
  `router.canGoBack()` en `false`.

**Demostración de que el test detecta el bug** (la lección de TASK-002: un test no cuenta como
regresión hasta que se prueba que falla sin la corrección):

```text
=== A) Con la corrección (goBackOr) ===
Tests:       33 passed, 33 total

=== B) Reintroduciendo el bug (replace) ===
  ● Flujo: estudiar › volver del estudio no añade un nivel extra al apilado
Tests:       1 failed, 32 passed, 33 total

=== C) Restaurando ===
  const goToDeck = () => goBackOr(router, () => router.replace(`/mazo/${deckId}`));
Tests:       33 passed, 33 total
```

## Comandos ejecutados y resultados

```text
$ ./init.sh                # baseline, antes de editar     -> exit 0
$ npm run typecheck                                        -> exit 0, 0 errores
$ npm run lint                                             -> exit 0, 0 errores / 0 warnings
$ npm test                                                 -> exit 0, 9 suites / 62 tests PASS
$ npm run test:integration                                 -> exit 0, 5 suites / 33 tests PASS
$ npm run test:e2e                                         -> exit 0, 33 passed / 3 skipped
$ npm run smoke:web        -> exit 0, SMOKE WEB: OK (http://localhost:8082 -> 200)
$ ./init.sh                # final                         -> exit 0
```

`./init.sh` final:

```text
[OK] Harness válido
SCOPE: OK (TASK-003)   [OK] Scope válido
[OK] Sin temporales/secretos obvios
[OK] typecheck   [OK] lint   [OK] test   [OK] test:integration   [OK] test:e2e
EVIDENCE: OK     [OK] Evidencia coherente
[OK] Estado verificable
```

Los 3 saltados del E2E son las comprobaciones táctiles en `desktop-chrome`, con
`test.skip(..., 'Solo aplica a pantallas táctiles.')`.

### Greps de verificación

```text
$ grep -rnE "#[0-9A-Fa-f]{3,8}\b|rgba?\(" app/ src/components/ src/lib/ src/features/
  sin coincidencias                      (todos los colores viven en src/theme/tokens.ts)

$ grep -rniE "gradient|glow|blur|shadowColor|textShadow|neon" app/ src/
  solo el comentario de tokens.ts que declara que no se usan

$ grep -rn "family.serif" app/ src/ | grep -v "^src/theme/"
  src/components/ui/FlashcardFace.tsx:57   (único punto de uso)

$ grep -rniE "supabase|autenticaci|login|password|google|apple|modo oscuro|estadístic|anki|sincroniz" app/ src/
  sin coincidencias

$ grep -rniE "calific|repetici|scheduler|srs|otra vez|difícil|fácil" app/ src/
  solo dos comentarios que declaran que NO se implementan

$ grep -rnE '\bany\b|TODO|FIXME|console\.log' app/ src/ tests/
  sin coincidencias

$ git diff --stat HEAD -- package.json package-lock.json
  (vacío)
```

## Acceptance -> evidencia

| # | Acceptance | Método | Evidencia | Resultado |
|---|---|---|---|---|
| 1 | Paleta aplicada, sin colores propios | unit + review | `tests/unit/theme.test.ts` comprueba los diez hex exactos; grep sin literales fuera de `src/theme/` | PASS |
| 2 | Sans en interfaz, serif solo en flashcards | unit + review | `tests/unit/flashcard-face.test.tsx` (contenido con serif, etiqueta y Button sin ella); grep con un único punto de uso | PASS |
| 3 | Sin estética de IA, neón, glow ni futurismo | review | grep sin gradientes, sin sombras de color y sin brillos | PASS |
| 4 | La navegación funciona de verdad en web | e2e | `responsive-navigation.spec.ts` y `flashcards-flow.spec.ts`: cambian URL y contenido, consola sin errores, en 3 dispositivos | PASS |
| 5 | Sección Mis mazos que lista los mazos | integration + e2e | `decks-flow.test.tsx`; la lista muestra nombre y número de cartas | PASS |
| 6 | Estado vacío en Mis mazos | integration | `decks-flow.test.tsx` "parte de un estado vacío que explica qué hacer" | PASS |
| 7 | Crear mazo y verlo sin recargar | integration + e2e | `decks-flow.test.tsx` + paso 2 del recorrido E2E | PASS |
| 8 | Validación de mazo con error legible | unit + integration + e2e | 2 tests unitarios de error (vacío y solo espacios) + integración del mensaje y del campo al que se ancla + E2E | PASS |
| 9 | Entrar al detalle de un mazo | integration + e2e | `decks-flow.test.tsx` "abre el mazo pulsándolo"; E2E comprueba la URL `/mazo/mazo-1` | PASS |
| 10 | El detalle muestra nombre y cartas | integration | `cards-flow.test.tsx`: título del mazo y frente/reverso de cada carta | PASS |
| 11 | Estado vacío de cartas | integration | `cards-flow.test.tsx` "un mazo nuevo muestra el estado vacío" | PASS |
| 12 | Crear flashcard con frente y reverso | integration + e2e | `cards-flow.test.tsx` + paso 4 del recorrido E2E | PASS |
| 13 | Validación de flashcard con error legible | unit + integration + e2e | Frente vacío, reverso vacío y mazo inexistente en unitarios; ambos en integración; E2E de reverso ausente | PASS |
| 14 | Las cartas pertenecen a su mazo | unit + integration | `library.test.ts` "devuelve solo las cartas del mazo pedido" + `cards-flow.test.tsx` con dos mazos | PASS |
| 15 | Todos los botones tienen comportamiento real | e2e | El recorrido E2E pulsa cada control y afirma su efecto observable; el único inhabilitado es Estudiar sin cartas, y se comprueba que se habilita al añadir una | PASS |
| 16 | El estudio muestra primero solo el frente | unit + integration + e2e | `study-session.test.ts` + `study-flow.test.tsx` + E2E: `study-back` con count 0 | PASS |
| 17 | Mostrar respuesta enseña frente y reverso | unit + integration + e2e | Los tres niveles comprueban ambos visibles a la vez | PASS |
| 18 | Siguiente carta avanza y vuelve a ocultar | unit + integration + e2e | Los tres niveles; el frente cambia y el reverso desaparece | PASS |
| 19 | Progreso y final de sesión | unit + integration + e2e | "Carta 1 de 2" -> "Carta 2 de 2" -> "Sesión terminada" con vuelta al mazo | PASS |
| 20 | Sin controles de calificación | review + integration + e2e | grep; test de integración y E2E que afirman la ausencia de "Otra vez", "Difícil", "Bien", "Fácil" y "Calificar" | PASS |
| 21 | Nada de auth, Supabase, importación, oscuro, estadísticas, anidadas, IA, sync | review | grep sin coincidencias; sin dependencias nuevas | PASS |
| 22 | Se adapta a desktop y a móvil | e2e | 3 proyectos; sidebar o barra compacta, nunca ambas, también tras el recorrido completo | PASS |
| 23 | Sin overflow horizontal | e2e | Comprobado en `/`, `/componentes` y, dentro del recorrido, en detalle y estudio | PASS |
| 24 | Objetivos táctiles utilizables | e2e | Medición de `boundingBox` en los 2 proyectos móviles, incluidas las pantallas nuevas; ninguno por debajo de 44x44 | PASS |
| 25 | Lógica testeable sin interfaz | unit | `library.ts` y `session.ts` no importan react-native; sus tests no montan nada | PASS |
| 26 | Tests unitarios de mazos y cartas con errores | unit | `library.test.ts`, 14 tests | PASS |
| 27 | Tests unitarios de la sesión | unit | `study-session.test.ts`, 9 tests, incluido el ciclo completo y la sesión vacía | PASS |
| 28 | Integración de los tres flujos | integration | `decks-flow`, `cards-flow` y `study-flow` con el router real | PASS |
| 29 | E2E de los flujos en desktop y móvil | e2e | `flashcards-flow.spec.ts` en los 3 proyectos | PASS |
| 30 | Sin regresiones | integration | `./init.sh` con la suite completa en verde | PASS |
| 31 | `./init.sh` exit 0 | static | Exit code 0 con los diez gates en `[OK]` | PASS |
| 32 | Evidencia registrada | inspection | Este archivo | PASS |

### Tests heredados que cambiaron

La acceptance de TASK-003 sustituye la pantalla raíz, así que los tests que afirmaban su contenido
tenían que cambiar. No se debilitó ninguno: todos ganaron casos.

| Test | Antes | Ahora |
|---|---|---|
| `tests/unit/index-screen.test.tsx` | 4 tests sobre la pantalla placeholder de TASK-002 | **Eliminado.** La pantalla que probaba ya no existe. Su cobertura queda superada por `decks-flow.test.tsx` (9 tests sobre la pantalla real, con provider y router) |
| `tests/integration/expo-router-navigation.test.tsx` | 3 tests | 5 tests, añadidas las rutas de mazo y de estudio |
| `tests/integration/navigation.test.tsx` | 5 tests | 5 tests, adaptados a la nueva pantalla raíz; la regresión de historial de TASK-002 se conserva intacta |
| `tests/unit/responsive.test.tsx` | testID `nav-inicio` | testID `nav-mazos`; mismos casos |
| `tests/e2e/web-boot.spec.ts` | Comprobaba la tarjeta de demostración | Comprueba el encabezado Mis mazos y el estado vacío |
| `tests/e2e/responsive-navigation.spec.ts` | testID `nav-inicio` | testID `nav-mazos`; mismos casos |

Totales: unit 36 -> **62**, integration 8 -> **33**, e2e 19 -> **33**.

## Resultados por capa

- **Baseline**: `./init.sh` exit 0 antes de editar.
- **Scope**: `SCOPE: OK (TASK-003)`.
- **Static**: typecheck exit 0; lint exit 0, 0 errores y 0 warnings.
- **Unit**: 9 suites / 62 tests PASS.
- **Integration**: 5 suites / 33 tests PASS.
- **Responsive**: `tests/unit/responsive.test.tsx` y los 3 proyectos de Playwright.
- **E2E**: 33 passed / 3 skipped sobre desktop-chrome, Pixel 5 e iPhone 13 (WebKit).
- **Regression**: `./init.sh` final exit 0 con todos los gates en `[OK]`.

## Corrección de los hallazgos del review #1

El review #1 (`progress/evidence/TASK-003-review.md`) emitió **CHANGES_REQUIRED** con cinco
hallazgos, ninguno crítico ni alto. La task volvió a `IMPLEMENTING` solo para cerrarlos.

### R1 (MEDIA) — El error de la carta se anclaba al campo equivocado

Un único estado `error` se pasaba siempre al `Input` de Reverso, así que al faltar el **Frente** el
borde rojo y el mensaje aparecían bajo el campo correctamente rellenado. Defecto real de
usabilidad, no cosmético.

Corrección: el error pasa a llevar el campo al que pertenece
(`{ field: 'front' | 'back' | 'form'; message }`) y cada `Input` solo recibe el suyo. Los errores no
asociados a un campo concreto (mazo inexistente) se muestran como `Message` del formulario.
Además `Input` etiqueta su mensaje de error con `testID` derivado (`card-front-input-error`), para
que el anclaje sea comprobable.

### R2 (MEDIA) — Decisión de producto no confirmada: rechazo de nombres duplicados

El reviewer tenía razón: ninguna acceptance exige rechazar nombres repetidos, el caso vacío ya
satisface "valida su entrada", y que la decisión estuviera en `technical_decisions` no la confirma
porque ese contrato lo escribió el mismo agente.

Corrección: se retira la validación de duplicados. Se elimina el código de error
`nombre-duplicado`, su mensaje, su comprobación y la función `normalize` que solo servía para eso.
La entrada del contrato queda marcada como **RETIRADA** con el motivo. **Pregunta abierta para el
usuario**, no resuelta por el agente: ¿deben permitirse dos mazos con el mismo nombre?

### R3 (BAJA) — El test no comprobaba a qué campo se anclaba el error

Por eso R1 pasó los tres niveles. Los tests de `cards-flow.test.tsx` ahora afirman que el mensaje
está bajo el campo que falla **y ausente bajo el otro**.

**Demostración de que el test nuevo detecta el defecto:**

```text
=== A) Con la corrección (error por campo) ===
Tests:       33 passed, 33 total

=== B) Reintroduciendo el defecto (error siempre en Reverso) ===
  ● Flujo: crear flashcards › muestra un error legible si falta el frente, anclado a ese campo
Tests:       1 failed, 32 passed, 33 total

=== C) Restaurando ===
Tests:       33 passed, 33 total
```

### R4 (BAJA) — Literal de dimensión fuera de los tokens

`minHeight: 220` en `FlashcardFace` pasa a `sizes.studyCardMinHeight`.

### R5 (BAJA) — `docs/DESIGN.md` había perdido `Toast`

Restaurado en la lista de componentes pendientes, y añadido `FlashcardFace` a los implementados.

Gates tras la corrección: `./init.sh` exit 0; 62 unit, 33 integration, 33 e2e (+3 skipped).
Los conteos no cambian: los tests retirados del duplicado se sustituyen por los del anclaje.

## Corrección de los hallazgos del review #2

El review #2 emitió **CHANGES_REQUIRED** con cuatro hallazgos de severidad baja, **todos
introducidos por mi propia ronda de correcciones del review #1**. Ninguno afecta al comportamiento.

- **N1** — La `verification_matrix` del contrato seguía exigiendo cobertura del caso duplicado que
  la ronda anterior había retirado: la acceptance 26 pedía una evidencia que ya no podía existir.
  Corregidas las dos entradas afectadas.
- **N2** — La pregunta abierta sobre los nombres repetidos estaba declarada en prosa en tres
  sitios, pero `open_questions` seguía vacío en task y contrato y `current.md` decía "Ninguna": tal
  como estaba, la pregunta no llegaba al usuario. Ahora consta en `open_questions` de la task y del
  contrato, marcada como NO bloqueante, y en `progress/current.md`.
- **N3** — Dos filas de la tabla acceptance -> evidencia habían quedado desactualizadas: la fila 8
  citaba "4 tests unitarios" y un test de integración del duplicado que ya no existe, y la fila 26
  decía 17 tests donde hay 14. Corregidas contra el conteo real.
- **N4** — `letterSpacing: 0.6` seguía sin token pese a haberse señalado en R4. Pasa a
  `typography.letterSpacing.label`, con el motivo documentado.

Observación no bloqueante aceptada del review #2: la rama `field === 'form'` del error de carta es
inalcanzable hoy, porque la pantalla retorna antes si el mazo no existe. Se conserva porque el tipo
de error `mazo-inexistente` sí existe en la lógica y la rama evita que un error futuro quede mudo.

## Riesgos

- **Los datos no se persisten.** Al recargar la página se pierde todo. Es una consecuencia directa
  de que la decisión de almacenamiento no esté tomada, no un descuido. Es el riesgo más visible
  para quien pruebe la aplicación.
- **Los identificadores son un contador en memoria** (`mazo-1`, `carta-1`). Sirven mientras no haya
  base de datos; cuando la haya, los generará ella.
- **Se permiten mazos con el mismo nombre.** Rechazarlos habría sido inventar una decisión de
  producto. Queda como pregunta abierta para el usuario.
- **Sin editar ni borrar mazos y cartas.** El usuario no lo pidió. Un mazo con un nombre equivocado
  solo se puede corregir recargando, que además borra todo.
- **`assets/` sigue sin iconos propios**, heredado de TASK-001.
- **Sin modo oscuro**: la paleta confirmada es solo de tema claro.

## No verificado

- **Ejecución real en simulador o dispositivo físico iOS/Android**: requiere `expo prebuild` y
  toolchain nativa. La compatibilidad se verificó por configuración resuelta
  (`platforms: ios, android, web`), por la ausencia de APIs exclusivas de web en el código
  compartido y por el uso exclusivo de primitivas de react-native. `mobile-safari` ejercita el
  motor WebKit de iOS, pero en web.
- **La familia serif en nativo**: en web se verifica el valor aplicado; en iOS y Android se declara
  `Georgia` y `serif` respectivamente, sin comprobación en dispositivo.
- **Lectores de pantalla reales** (VoiceOver / TalkBack): se verifican los roles y estados
  expuestos, no la experiencia real.
- **Volumen**: no se ha probado con cientos de mazos o cartas; no hay virtualización de listas.
- **Playwright en CI**: la configuración lo contempla, pero no se ha ejecutado en un CI real.
