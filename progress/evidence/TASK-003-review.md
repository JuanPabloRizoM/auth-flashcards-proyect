# TASK-003 — Independent Review

- Task: TASK-003 — Mazos, flashcards y estudio simple sobre la nueva dirección visual
- Agente: reviewer (independiente, read-only)
- Fecha: 2026-08-18
- Base de Git: `9f530f0 chore(TASK-002): cerrar base visual tras review y QA`
- Contrato: `.harness/contracts/TASK-003.json` (32 acceptance, `open_questions: []`)

## Veredicto

**CHANGES_REQUIRED**

El trabajo es sólido: los gates están verdes de verdad, los tests son de calidad y verifican
resultados concretos, no hay dependencias nuevas ni literales de color fuera de `src/theme/`, y el
test de regresión del apilado **sí** detecta el bug (comprobado reintroduciéndolo). Pero quedan dos
hallazgos que exigen modificación: un error de validación anclado al campo equivocado en el detalle
del mazo, y una regla de producto no confirmada por el usuario (rechazo de nombres de mazo
duplicados). No existe "APPROVED con cambios menores".

## Documentos leídos

`AGENTS.md`, `.harness/agents/reviewer.md`, `.harness/tasks/TASK-003.json`,
`.harness/contracts/TASK-003.json`, `docs/PRODUCT.md`, `docs/DESIGN.md`, `docs/ARCHITECTURE.md`,
`docs/CONVENTIONS.md`, `docs/VERIFICATION.md`, `docs/TESTING.md`, `CHECKPOINTS.md`,
`progress/evidence/TASK-003-implementation.md`, `progress/current.md`, `init.sh`, `jest.config.js`.

## Diff revisado

`git status --porcelain`: 18 archivos trackeados modificados/borrados + 19 entradas sin trackear.

- Trackeados (`git diff HEAD`): `app/_layout.tsx`, `app/componentes.tsx`, `app/index.tsx`,
  `docs/DESIGN.md`, `docs/PRODUCT.md`, `progress/current.md`, `src/components/layout/index.ts`,
  `src/components/layout/navigation.ts`, `src/components/ui/Card.tsx`,
  `src/components/ui/index.ts`, `src/theme/tokens.ts`, `tests/e2e/responsive-navigation.spec.ts`,
  `tests/e2e/web-boot.spec.ts`, `tests/integration/expo-router-navigation.test.tsx`,
  `tests/integration/navigation.test.tsx`, `tests/unit/responsive.test.tsx`,
  `tests/unit/theme.test.ts`, y el borrado de `tests/unit/index-screen.test.tsx`.
- Nuevos, leídos uno a uno con Read (no aparecen en `git diff HEAD`): `src/types/domain.ts`,
  `src/features/decks/library.ts`, `src/features/study/session.ts`, `src/lib/LibraryProvider.tsx`,
  `src/lib/navigation.ts`, `src/components/ui/FlashcardFace.tsx`,
  `src/components/layout/ScreenHeader.tsx`, `app/mazo/[id]/index.tsx`,
  `app/mazo/[id]/estudiar.tsx`, `tests/integration/routes.tsx`,
  `tests/integration/decks-flow.test.tsx`, `tests/integration/cards-flow.test.tsx`,
  `tests/integration/study-flow.test.tsx`, `tests/unit/library.test.ts`,
  `tests/unit/study-session.test.ts`, `tests/unit/flashcard-face.test.tsx`,
  `tests/e2e/flashcards-flow.spec.ts`, `.harness/tasks/TASK-003.json`,
  `.harness/contracts/TASK-003.json`, `progress/evidence/TASK-003-implementation.md`.

## 1. Scope

- Todos los cambios caen dentro de `allowed_paths` (`app/**`, `src/**`, `tests/**`, `docs/**`,
  `progress/**`, `.harness/**`). `check_scope.py` en `./init.sh`: `SCOPE: OK (TASK-003)`.
- **Sin dependencias nuevas**: `git diff HEAD -- package.json package-lock.json` devuelve 0 bytes.
  Verificado por mí.
- Cambios oportunistas: ninguno relevante. `app/componentes.tsx` solo añade `FlashcardFace` al
  catálogo, que es consistente con el componente nuevo que la acceptance sí exige. El único cambio
  documental no exigido por ninguna acceptance es la desaparición de `Toast` de `docs/DESIGN.md`
  (hallazgo 5).
- No se modificaron acceptance criteria durante la implementación: task y contrato coinciden
  literalmente en los 32 criterios.

## 2. Correctitud contra las 32 acceptance

Revisadas una a una contra el código y contra los tests que las respaldan. Resultado: **31 de 32
correctas**; la 13 (validación de flashcard con error legible) queda parcialmente incumplida por el
hallazgo 1 — el mensaje es legible pero señala el campo equivocado.

Puntos comprobados directamente en código:

- **A1 paleta**: los diez tokens confirmados están en `src/theme/tokens.ts` y `tests/unit/theme.test.ts`
  los fija por valor exacto. Cero literales de color fuera de `src/theme/` (grep propio, abajo).
- **A2 tipografía**: `typography.family.serif` solo se consume en
  `src/components/ui/FlashcardFace.tsx:57`. Ningún título, botón o etiqueta la usa;
  `tests/unit/flashcard-face.test.tsx` lo prueba por ambos lados (contenido con serif, etiqueta y
  `Button` sin `fontFamily`).
- **A3 sin estética de IA**: cero coincidencias de `gradient|glow|blur|shadowColor|textShadow|neon|elevation`
  salvo el comentario de `tokens.ts` que las declara prohibidas.
- **A15 botones reales**: todos los `Button`/`Card` pulsables de las tres pantallas nuevas llevan
  `onPress`. El único inhabilitado es `study-button` con el mazo vacío, y la razón se comunica con
  un `Message` ("Añade al menos una carta para poder estudiar este mazo").
- **A16-A19 estudio**: `src/features/study/session.ts` implementa exactamente el ciclo confirmado;
  `estudiar.tsx` solo renderiza `study-back` cuando `session.revealed`, alterna
  `reveal-button`/`next-card-button`, muestra "Carta N de T" y cierra con "Sesión terminada".
- **A20 sin calificación**: no existe ningún control de calificación; la zona del boceto se eliminó
  entera. Grep de `calific|repetici|scheduler|srs|otra vez|difícil|fácil|rating|grade` solo devuelve
  dos comentarios que declaran que NO se implementan.
- **A21 nada fuera de scope**: grep de `supabase|autenticaci|auth|login|password|google|apple|dark|
  oscuro|estadístic|anki|sincroniz|sync` en `app/` y `src/`: **cero coincidencias**.
- **A25 lógica sin interfaz**: `src/features/**` solo importa `../../types/domain` (type-only).
  Verificado con grep de imports; no hay react-native ni componentes.

## 3. Calidad de los tests

Buena en general. Los tests afirman resultados concretos, no ausencia de excepciones: comparan
objetos completos (`library.test.ts` usa `toEqual` sobre la biblioteca resultante), comprueban
identidad referencial para la idempotencia (`expect(revealAnswer(unaVez)).toBe(unaVez)`), recorren
el ciclo completo acumulando la secuencia observada, y los de integración montan las pantallas
reales con el router real (`tests/integration/routes.tsx`), sin mocks.

**Sobre el borrado de `tests/unit/index-screen.test.tsx`: es legítimo, no es debilitar la suite.**

Revisé el contenido borrado con `git show HEAD:tests/unit/index-screen.test.tsx`. Sus cuatro casos
dependían de la pantalla placeholder de TASK-002: `demo-card`, `demo-input`, `demo-primary`,
`demo-secondary`, `demo-loading`, `demo-empty` y el encabezado "Flashcards". Ninguno de esos testIDs
existe ya (grep: cero coincidencias en todo el repo). Además, su cuarto caso afirmaba que la
pantalla **no** debía mostrar "Mis mazos" ni "Estudiar" — exactamente lo contrario de lo que ahora
exige la acceptance. No era adaptable: era un test de un artefacto retirado.

La cobertura sustituta es estrictamente mayor: `tests/integration/decks-flow.test.tsx` aporta 9
casos sobre la pantalla real (estado vacío, alta, lista sin recargar, campo vaciado, recuento de
cabecera, error de nombre vacío, error de duplicado, limpieza del error, entrada al detalle y vuelta),
y `expo-router-navigation.test.tsx` conserva la resolución de `/` con asserts equivalentes. Totales
verificados por mí: unit 62 (antes 36), integration 33 (antes 8), e2e 33 + 3 skipped (antes 19 + 2).
Ningún test heredado perdió casos: `navigation.test.tsx` mantiene sus 5, incluida la regresión de
historial de TASK-002, y `theme.test.ts` gana 2.

Donde sí falla la calidad es en el caso que debería haber cazado el hallazgo 1 — ver hallazgo 3.

## 4. Regresiones

- Suite completa verde ejecutada por mí (ver "Verificaciones ejecutadas").
- **Test de regresión del apilado: verificado empíricamente, la afirmación del implementer es
  cierta.** Reintroduje el bug y el test falló; restauré y volvió a pasar (salidas abajo).
- La regresión de TASK-002 ("no acumula historial al navegar entre destinos de primer nivel") sigue
  presente e intacta en `tests/integration/navigation.test.tsx`.

## 5. Arquitectura y convenciones

- `docs/ARCHITECTURE.md` regla 1 y 3: la lógica vive en `src/features/`, es pura y se testea sin
  montar nada. Correcto.
- Regla 2 (acceso a datos centralizado): `src/lib/LibraryProvider.tsx` es el único punto de estado.
- Regla 4: `ScreenHeader` y `FlashcardFace` viven en `src/components/`.
- `docs/DESIGN.md` "antes de crear un componente, comprobar si uno existente puede extenderse":
  `Card` se extiende con `onPress` en vez de crear una fila nueva. Correcto.
- `docs/CONVENTIONS.md`: cero `any`, cero `TODO`/`FIXME`, cero `console.log` en `app/`, `src/` y
  `tests/` (grep propio). Errores explícitos y tipados (`LibraryErrorCode`), no silenciados.
- Desviación menor: literales de dimensión fuera de tokens (hallazgo 4).

## 6. Complejidad innecesaria

No la encuentro. El estado es un `useState` con funciones puras; no hay reducers, ni capa de
repositorio, ni abstracciones especulativas. `goBackOr` son 7 líneas con una razón concreta
(el bug real). El `LibraryResult` discriminado es la forma más simple de devolver errores tipados.

## 7. Decisiones de producto

Los cuatro puntos que se me pidió examinar explícitamente:

1. **Datos solo en memoria — CORRECTO, no es una decisión de producto que requiriese consulta.**
   `docs/PRODUCT.md` lista "base de datos y persistencia (Supabase incluida)" como NO decidida, y el
   contrato la pone en `out_of_scope`. Cualquier alternativa (localStorage, AsyncStorage, un fichero)
   **sí** habría sido inventar una decisión de almacenamiento. La memoria es la lectura mínima que
   satisface las acceptance sin decidir nada (`ARCHITECTURE.md` regla 8). Además está declarada como
   consecuencia visible en la evidencia y en `progress/current.md`, y aislada en un único archivo.
   Lo apruebo sin reservas.
2. **Rechazo de nombres de mazo duplicados — NO CORRECTO. Es una regla de producto no confirmada.**
   Ver hallazgo 2.
3. **Eliminación de la zona de calificación — CORRECTA.** El usuario admitió explícitamente ambas
   opciones (eliminarla o dejarla como espacio estructural no interactivo). Eliminarla es la opción
   que no puede aparentar funcionalidad disponible, y la más simple. Bien elegida y bien razonada.
4. **Solo dos rutas de primer nivel — CORRECTO.** "Mis mazos" y "Componentes". No se inventaron
   secciones (nada de Ajustes, Estadísticas o Perfil). El detalle del mazo y el estudio se apilan en
   lugar de convertirse en destinos, que es lo coherente con `docs/DESIGN.md`. Observación no
   bloqueante sobre "Componentes" más abajo.

Otras decisiones del contrato que reviso y considero correctas: no implementar la pantalla de acceso
del boceto (auth fuera de scope) y no implementar los contadores nuevas/aprendiendo/repasar (presuponen
repetición espaciada, que es justo lo que no debe aparentarse).

## 8. Cambios fuera del contrato: `docs/PRODUCT.md` y `docs/DESIGN.md`

Comparé el diff línea a línea contra lo que el usuario confirmó.

`docs/PRODUCT.md`: las catorce decisiones fechadas 2026-08-18 se corresponden **una a una** con lo
que el usuario confirmó (dirección visual, rechazo de estética IA/neón/glow/futurismo, regla
tipográfica, boceto como referencia adaptable, navegación real, Mis mazos, crear mazos, entrar al
detalle, crear flashcards Frente/Reverso, cartas dentro de su mazo, botones con comportamiento real,
ciclo de estudio sin calificación, y la zona de calificación eliminable o no interactiva). No hay
ninguna decisión añadida de más. La lista de "NO tomadas" solo se amplía con temas que el usuario
puso fuera de scope; la única retirada es "estructura exacta de tarjetas", justificada porque
Frente/Reverso ya está confirmado. **Correcto.**

`docs/DESIGN.md`: la dirección visual, la regla sans/serif, la regla de "no aparentar funcionalidad
no disponible" y la regla de apilado se corresponden con lo confirmado. Dos matices:

- La tabla de paleta con diez hex exactos: el task y el contrato la declaran confirmada ("la paleta
  es la del boceto aprobado"). **No puedo verificar los hex contra el boceto**, que no está en el
  repositorio; los doy por buenos según el task, y lo dejo señalado para QA/usuario.
- `Toast` desapareció de la lista de componentes sin justificación. Hallazgo 5.

## Verificaciones ejecutadas por mí

Salida redirigida a `/tmp` (fuera del repositorio) para no ensuciar `check_scope.py`.

### `./init.sh` — exit code 0

```text
── 1. Harness ──   [OK] Harness válido
── 2. Scope ────   SCOPE: OK (TASK-003)        [OK] Scope válido
── 3. Hygiene ──   [OK] Sin temporales/secretos obvios
── 4. App gates ─  [OK] typecheck
                   [OK] lint
                   Test Suites: 9 passed, 9 total
                   Tests:       62 passed, 62 total          [OK] test
                   Test Suites: 5 passed, 5 total
                   Tests:       33 passed, 33 total          [OK] test:integration
                   3 skipped
                   33 passed (10.0s)                         [OK] test:e2e
── 5. Evidence ─   EVIDENCE: OK                [OK] Evidencia coherente
── 6. Summary ──   [OK] Estado verificable
EXIT_CODE=0
```

Los conteos de la evidencia (62 unit, 33 integration, 33 passed + 3 skipped e2e) **coinciden
exactamente** con lo que obtuve. Los 3 saltados son las comprobaciones táctiles en `desktop-chrome`.

### Dependencias

```text
$ git diff HEAD -- package.json package-lock.json | wc -c
0
```

Ninguna dependencia nueva. Confirmado.

### Test de regresión del apilado — comprobado reintroduciendo el bug

Procedimiento: `shasum -a 256` del archivo, copia de seguridad en `/tmp`, revertir
`goBackOr(router, () => router.replace(...))` a `router.replace(...)` en
`app/mazo/[id]/estudiar.tsx:36`, ejecutar, restaurar desde la copia y volver a comprobar el hash.

Con el bug reintroducido:

```text
● Flujo: estudiar › volver del estudio no añade un nivel extra al apilado

  125 |     await pulsar('back-to-decks');
> 127 |     expect(await screen.findByTestId('create-deck-button')).toBeTruthy();

Test Suites: 1 failed, 4 passed, 5 total
Tests:       1 failed, 32 passed, 33 total
```

Falla **exactamente ese caso y ningún otro**. A diferencia de lo ocurrido en TASK-002, la afirmación
del implementer es cierta: el test es una regresión real, no decorativa.

Restauración confirmada por hash idéntico:

```text
antes:    d2499be9e25e4c72851250f0c4a07c2bbd0faadec45d1a7af0d6a70620a68224  app/mazo/[id]/estudiar.tsx
después:  d2499be9e25e4c72851250f0c4a07c2bbd0faadec45d1a7af0d6a70620a68224  app/mazo/[id]/estudiar.tsx
```

Y la suite vuelve a verde tras restaurar: `Tests: 33 passed, 33 total` (integration),
`Tests: 62 passed, 62 total` (unit). `git status --porcelain` devuelve las mismas 37 entradas que
antes de mi intervención.

### Greps propios

```text
$ grep -rnE "#[0-9A-Fa-f]{3,8}|rgba?\(" app/ src/ --include=*.ts --include=*.tsx | grep -v "^src/theme/"
(sin coincidencias)

$ grep -rniE "gradient|glow|blur|shadowColor|textShadow|neon|elevation" app/ src/
src/theme/tokens.ts:9:  * profesional. Sin gradientes, sin sombras de color y sin brillos.

$ grep -rn "serif" app/ src/
src/components/ui/FlashcardFace.tsx:17  (comentario)
src/components/ui/FlashcardFace.tsx:57  fontFamily: typography.family.serif   ← único uso
src/theme/tokens.ts:40,44,45,47,48      (definición del token)

$ grep -rniE "supabase|autenticaci|auth|login|password|google|apple|oscuro|dark|estadístic|anki|sincroniz|sync" app/ src/
(sin coincidencias)

$ grep -rniE "calific|repetici|scheduler|srs|otra vez|difícil|fácil|rating|grade" app/ src/
app/mazo/[id]/estudiar.tsx:24     (comentario: declara que NO se implementa)
src/features/study/session.ts:4   (comentario: declara que NO se implementa)

$ grep -rnE "\bany\b|TODO|FIXME|console\.log" app/ src/ tests/
(sin coincidencias)

$ grep -rn "^import" src/features/
src/features/study/session.ts:1: import type { Card } from '../../types/domain';
src/features/decks/library.ts:1: import type { Card, Deck, Library } from '../../types/domain';
```

La lógica de `src/features/` es efectivamente pura: solo importa tipos, ni react-native ni
componentes ni el proveedor.

## Hallazgos

### 1. [MEDIA] El error de "frente requerido" se ancla al campo Reverso

`app/mazo/[id]/index.tsx:93`. El detalle del mazo mantiene **un único** estado `error`, y lo pasa
solo al `Input` de Reverso:

```tsx
<Input label="Frente"  ... testID="card-front-input" />          // sin error
<Input error={error} label="Reverso" ... testID="card-back-input" />
```

`src/components/ui/Input.tsx:36,40` hace que el `error` pinte el borde del campo en
`colors.danger` **y** renderice el `Message` debajo de ese campo. Consecuencia: si la persona deja
el Frente vacío y rellena el Reverso, el mensaje "Escribe el frente de la carta." y el borde rojo
aparecen sobre el **Reverso**, que es el campo correctamente rellenado. Con ambos campos vacíos pasa
lo mismo, porque `addCard` devuelve `frente-requerido` primero.

Impacto: la acceptance 13 pide un error legible; el texto lo es, pero señala el campo equivocado, lo
que contradice `docs/CONVENTIONS.md` (UI: "estados claros") y desorienta al usuario. Arreglo
esperado: asociar el error al campo que lo provoca (por ejemplo, derivándolo del `LibraryErrorCode`)
o, si se prefiere lo mínimo, sacarlo de los `Input` y mostrarlo como `Message` del formulario.

**No lo he corregido: soy read-only.**

### 2. [MEDIA] Decisión de producto no confirmada: rechazar nombres de mazo duplicados

`src/features/decks/library.ts:45-48` y `.harness/contracts/TASK-003.json`, technical_decision 4.

La acceptance dice "La creación de mazo valida su entrada y muestra un error legible cuando no es
válida". No define qué es válido. El caso vacío se deduce sin ambigüedad de "su entrada"; el
duplicado, no: es una **regla de producto** que decide en nombre del usuario que dos mazos no pueden
llamarse igual (y encima con comparación insensible a mayúsculas y a espacios repetidos, que es otra
decisión más). Nadie lo pidió y ninguna acceptance lo necesita: el caso vacío ya la satisface por
completo.

Esto choca con `CLAUDE.md` regla 2 ("no inventes features ni decisiones de producto"), con
`docs/PRODUCT.md` ("los agentes NO convierten posibilidades en requisitos") y con
`.harness/agents/reviewer.md` ("si el implementer tomó una decisión de producto no confirmada,
rechaza"). Que esté declarada en `technical_decisions` no la convierte en confirmada: el contrato lo
escribió el mismo agente en la misma sesión, no el usuario.

Acción esperada: o bien retirar la regla (y sus tests) dejando solo la validación de vacío, o bien
registrarla como `open_question` y esperar a que el usuario la confirme. La razón declarada ("evita
dos mazos indistinguibles") es razonable como propuesta, pero es del usuario decidirla.

### 3. [BAJA] El test que debía cazar el hallazgo 1 no comprueba el campo

`tests/integration/cards-flow.test.tsx:73-80`, "muestra un error legible si falta el frente":

```tsx
expect(screen.getByText('Escribe el frente de la carta.')).toBeTruthy();
```

Solo comprueba que el texto existe **en algún sitio** del árbol, no a qué campo pertenece. Por eso
el defecto 1 pasó los tres niveles de verificación. `docs/CONVENTIONS.md` (Tests: "verificar
resultados concretos") pide más. El E2E `la validación impide crear una carta incompleta` tampoco lo
detecta porque solo ejercita el caso del reverso ausente, que es justo el que sí queda bien anclado.
Al corregir el hallazgo 1 debería añadirse la comprobación del campo.

### 4. [BAJA] Literales de dimensión fuera de los tokens

`src/components/ui/FlashcardFace.tsx:97` (`minHeight: 220`) y `:63` (`letterSpacing: 0.6`). La
cabecera de `src/theme/tokens.ts` declara que ningún componente debe declarar literales de color
**o de espaciado** por su cuenta. No afecta a ninguna acceptance (la acceptance 1 habla solo de
color, y ahí el cumplimiento es total), pero es la misma regla y conviene resolverlo con un token o
justificarlo en el comentario.

### 5. [BAJA] `docs/DESIGN.md` retira `Toast` sin justificación

El diff mueve `EmptyState` y `Loading` a "implementados", añade `Message`, y de paso **elimina**
`Toast` de la lista de componentes pendientes. Ninguna acceptance lo pedía. Si la intención es que
`Message` sustituye a `Toast`, debe decirlo; si no, hay que devolverlo a la lista. Es un cambio
documental fuera del contrato, pequeño pero real.

## Observaciones no bloqueantes

- **Acceptance 22, cobertura literal**: el `verification_matrix` pide comprobar sidebar vs. barra
  compacta "en todas las rutas nuevas". `flashcards-flow.spec.ts:109-115` solo lo afirma al final del
  recorrido, ya de vuelta en `/`. Como `AppShell` es un layout global la conclusión se sostiene, y el
  test táctil sí se ejecuta sobre la pantalla de estudio, pero la evidencia es más débil que la
  redacción del contrato. No lo considero bloqueante.
- **La paleta no es verificable desde el repositorio**: los diez hex se dan por confirmados según el
  task, pero el boceto aprobado no está versionado. Conviene que QA o el usuario confirmen a ojo el
  resultado. Guardar la referencia visual en el repositorio evitaría esta zona ciega en el futuro.
- **`Componentes` sigue siendo un destino de primer nivel** visible para el usuario final, aunque sea
  andamiaje de desarrollo. Viene de TASK-002 y no es una decisión nueva de TASK-003, así que no lo
  cuento como hallazgo; pero cuando el producto crezca habrá que decidir si esa sección se muestra.
- **Colisión de nombres `Card`**: el tipo de dominio `Card` (una flashcard) y el componente de UI
  `Card` (un contenedor visual) comparten nombre. `app/mazo/[id]/index.tsx` importa los dos conceptos
  y sobrevive porque uno viene por `cardsOfDeck`, pero es una fuente de confusión futura.
- **El contador de ids es compartido** entre mazos y cartas (`LibraryProvider.tsx:33`), así que la
  numeración salta (`mazo-1`, `carta-2`). Es inocuo mientras no haya base de datos y los tests lo
  fijan explícitamente.
- La evidencia del implementer es honesta y comprobable: todo lo que afirma se sostuvo al
  reejecutarlo, incluido lo que en TASK-002 no se sostuvo. La sección "No verificado" declara
  correctamente los límites (sin dispositivo físico, serif nativa sin comprobar, sin CI real).

## Confirmación de rol read-only

- No he editado, creado ni borrado ningún archivo de código, test, documentación o configuración.
- El único archivo que he escrito es este: `progress/evidence/TASK-003-review.md`.
- No he tocado `.harness/tasks/TASK-003.json`, ni `.harness/contracts/TASK-003.json`, ni
  `progress/current.md`.
- La única escritura sobre código fue la reintroducción **temporal y explícitamente encargada** del
  bug de apilado en `app/mazo/[id]/estudiar.tsx` para validar el test de regresión. El archivo quedó
  restaurado byte a byte (hash SHA-256 idéntico antes y después) y `git status --porcelain` es
  idéntico al del inicio de la revisión (37 entradas, las mismas).
- Ningún defecto ha sido corregido por mí: todos quedan reportados arriba.
- Las salidas de verificación se escribieron en `/tmp`, fuera del repositorio, para no alterar
  `check_scope.py`.

## Qué falta para APPROVED

1. Resolver el hallazgo 1 (error anclado al campo equivocado) y el 3 (test que lo compruebe).
2. Resolver el hallazgo 2: retirar el rechazo de duplicados o convertirlo en `open_question` y
   obtener la confirmación del usuario.
3. Los hallazgos 4 y 5 son de baja severidad; deben resolverse o justificarse explícitamente.
4. Reejecutar `./init.sh` y volver a pasar por review.

---

## Revisión #2 — 2026-08-18

- Task: TASK-003 — Mazos, flashcards y estudio simple sobre la nueva dirección visual
- Agente: reviewer (independiente, read-only). Segunda pasada tras la corrección de R1-R5.
- Base de Git: `9f530f0 chore(TASK-002): cerrar base visual tras review y QA`
- Contrato: `.harness/contracts/TASK-003.json` (32 acceptance, `open_questions: []`)

## Veredicto

**CHANGES_REQUIRED**

La corrección del código es **buena y está verificada empíricamente**. R1, R3 y R5 quedan cerrados sin
reservas; R2 está cerrado en el código, sin un solo resto. Los gates siguen verdes con los mismos
conteos, no se añadió ninguna dependencia, no apareció ningún archivo nuevo y la acceptance no se
tocó. **Ningún defecto de comportamiento sobrevive.**

Lo que impide aprobar no está en el código, sino en la coherencia de contrato y evidencia después de
la ronda: el contrato sigue exigiendo cobertura del caso duplicado que él mismo acaba de retirar, la
evidencia afirma tres cosas que ya no son ciertas, la "pregunta abierta para el usuario" que el
implementer declara tres veces no está registrada en ningún campo estructurado (y
`progress/current.md` sigue diciendo "Ninguna"), y R4 se cerró a medias: de los dos literales que
señalé, uno se tokenizó y el otro ni se resolvió ni se justificó. Los cuatro puntos son de severidad
**BAJA** y de arreglo mecánico, pero son verificables y concretos, y no existe "APPROVED con cambios
menores".

## Documentos leídos

`AGENTS.md`, `.harness/agents/reviewer.md`, `.harness/tasks/TASK-003.json`,
`.harness/contracts/TASK-003.json`, `docs/PRODUCT.md`, `docs/DESIGN.md`, `docs/ARCHITECTURE.md`,
`docs/CONVENTIONS.md`, `docs/VERIFICATION.md`, `docs/TESTING.md`, `CHECKPOINTS.md`,
`progress/evidence/TASK-003-implementation.md` (incluida la sección nueva "Corrección de los
hallazgos del review #1"), `progress/current.md`, la revisión #1 de este mismo archivo, y el código:
`app/index.tsx`, `app/mazo/[id]/index.tsx`, `app/mazo/[id]/estudiar.tsx`,
`src/features/decks/library.ts`, `src/features/study/session.ts`, `src/lib/LibraryProvider.tsx`,
`src/lib/navigation.ts`, `src/components/ui/Input.tsx`, `src/components/ui/FlashcardFace.tsx`,
`src/components/layout/ScreenHeader.tsx`, `src/theme/tokens.ts`, `tests/unit/library.test.ts`,
`tests/integration/cards-flow.test.tsx`, `tests/integration/decks-flow.test.tsx`,
`tests/integration/study-flow.test.tsx`, `tests/e2e/flashcards-flow.spec.ts`, `.gitignore`.

## Verificación de los cinco hallazgos

### R1 (MEDIA) — Error anclado al campo equivocado: **CERRADO**, comprobado ejecutando

En código: `app/mazo/[id]/index.tsx:21` sustituye el `string` por
`{ field: 'front' | 'back' | 'form'; message: string }`; `:48-54` deriva el campo del
`LibraryErrorCode`; `:92` y `:103` hacen que cada `Input` reciba **solo** su propio error
(`error?.field === 'front' ? error.message : undefined`). `src/components/ui/Input.tsx:41` añade
`testID={testID ? `${testID}-error` : undefined}`, que es lo que hace el anclaje comprobable. El
diff de `Input.tsx` es de 5 líneas y no cambia ningún comportamiento existente.

**No me basté con leerlo. Revertí el anclaje y comprobé que el test falla de verdad**, según se me
pidió: `Frente` pasa a recibir `undefined` y `Reverso` pasa a recibir `error?.message`.

```text
$ npm run test:integration    # con el anclaje revertido
FAIL integration tests/integration/cards-flow.test.tsx
  ● Flujo: crear flashcards › muestra un error legible si falta el frente, anclado a ese campo

    Unable to find an element with testID: card-front-input-error

Test Suites: 1 failed, 4 passed, 5 total
Tests:       1 failed, 32 passed, 33 total
EXIT=1
```

Falla **exactamente ese caso y ningún otro**. El test es una regresión real, no decorativa.

Restauración desde copia en `/tmp` (fuera del repositorio), confirmada por hash SHA-256 idéntico:

```text
antes:    11fbc9afe43d607cc032e9fff28b861369bf01ab2ad8c14ec8bbcfbb9f0be54d  app/mazo/[id]/index.tsx
después:  11fbc9afe43d607cc032e9fff28b861369bf01ab2ad8c14ec8bbcfbb9f0be54d  app/mazo/[id]/index.tsx

$ npm run test:integration   ->  Tests: 33 passed, 33 total
$ npm test                   ->  Tests: 62 passed, 62 total
$ git status --porcelain | wc -l  ->  39   (las mismas de antes de mi intervención)
```

### R2 (MEDIA) — Rechazo de nombres duplicados: **retirado del código sin restos**, pero la pregunta abierta no está registrada

Retirada completa en código. Grep propio sobre `app/`, `src/`, `tests/`, `docs/`, `.harness/` y
`progress/`:

```text
$ grep -rniE "duplicad|normalize|nombre-duplicado|repetid|mismo nombre" app/ src/ tests/ docs/ .harness/ progress/
src/features/decks/library.ts:39   comentario: "Los nombres repetidos se permiten..."
tests/unit/library.test.ts:49-50   "permite un nombre repetido, porque nadie ha decidido prohibirlo"
.harness/contracts/TASK-003.json:96,205    ← restos, ver hallazgo N1
.harness/contracts/TASK-003.json:258       "RETIRADA tras el review #1" (correcto)
(el resto son TASK-001/TASK-002 y este mismo archivo)
```

- El código de error `nombre-duplicado` no existe: `LibraryErrorCode` tiene exactamente cuatro
  miembros (`library.ts:8-12`) y `errorMessages` cuatro entradas.
- La función `normalize` no existe. `createDeck` solo hace `trim()` y valida vacío.
- El mensaje del duplicado no existe en ningún sitio.
- Los tests del duplicado se sustituyeron por su contrario, que es lo correcto:
  `library.test.ts:50` "permite un nombre repetido, porque nadie ha decidido prohibirlo", y
  `decks-flow.test.tsx:64` "ancla el error al campo del nombre" en el hueco del antiguo test de
  duplicado. La cobertura no bajó (conteos abajo).
- La entrada del contrato **sí** quedó marcada: `technical_decisions[3]` empieza por "RETIRADA tras
  el review #1" y explica el motivo correctamente.

Lo que **no** se hizo: registrarla como pregunta abierta en algún sitio donde el usuario la vea. Ver
hallazgo N2.

### R3 (BAJA) — El test ahora sí comprueba el campo, **y también la ausencia en el otro**: CERRADO

`tests/integration/cards-flow.test.tsx:73-94`. Los dos casos son simétricos y afirman las dos
direcciones:

```tsx
// falta el frente
expect(screen.getByTestId('card-front-input-error')).toBeTruthy();
expect(screen.queryByTestId('card-back-input-error')).toBeNull();
// falta el reverso
expect(screen.getByTestId('card-back-input-error')).toBeTruthy();
expect(screen.queryByTestId('card-front-input-error')).toBeNull();
```

Es exactamente lo que pedía el hallazgo. Además `decks-flow.test.tsx:64-71` añade el anclaje del
error de nombre. Que el test detecta el defecto está demostrado arriba, ejecutándolo.

### R4 (BAJA) — **CERRADO A MEDIAS**

`minHeight: 220` sí se resolvió: `src/theme/tokens.ts:104-105` define
`studyCardMinHeight: 220` con comentario, y `FlashcardFace.tsx:97` lo consume. Correcto.

Pero el hallazgo 4 nombraba **dos** literales, y `letterSpacing: 0.6` sigue en
`src/components/ui/FlashcardFace.tsx:63`, sin token y sin justificación: la sección R4 de la
evidencia solo menciona el `minHeight`. Mi cierre pedía literalmente "resolverse o justificarse
explícitamente"; esto no es ninguna de las dos. Barrido propio de literales de dimensión:

```text
$ grep -rnE "(minHeight|maxHeight|height|width|padding.*|margin.*|gap|borderRadius|fontSize|lineHeight|letterSpacing)\s*:\s*-?[0-9.]+,?$" --include=*.ts --include=*.tsx app src | grep -v "^src/theme/"
src/components/ui/FlashcardFace.tsx:63:    letterSpacing: 0.6,
src/components/layout/ScreenHeader.tsx:81:    minWidth: 0,
src/components/layout/AppShell.tsx:118:    minWidth: 0,
```

Los dos `minWidth: 0` **no** los cuento: no son una dimensión de diseño sino el idioma de flexbox
para permitir que un hijo se encoja, y el de `AppShell` viene de TASK-002. El único resto real es el
`letterSpacing`.

### R5 (BAJA) — `Toast` restaurado: CERRADO

`docs/DESIGN.md:70` vuelve a listar `Toast` entre los no implementados, y `FlashcardFace` aparece
entre los implementados, que es correcto porque esta tarea lo crea. El diff de `docs/DESIGN.md`
frente a `HEAD` ya no elimina ninguna línea de la lista de componentes.

## Re-verificación general

### `./init.sh` — exit code 0

Salida redirigida a `/tmp/rev2-init.txt`, **fuera del repositorio**, para no ensuciar
`check_scope.py` con un untracked propio.

```text
── 1. Harness ──   VERIFY: OK                     [OK] Harness válido
── 2. Scope ────   SCOPE: OK (TASK-003)           [OK] Scope válido
── 3. Hygiene ──                                  [OK] Sin temporales/secretos obvios
── 4. App gates ─                                 [OK] typecheck
                                                  [OK] lint
                   Test Suites: 9 passed, 9 total
                   Tests:       62 passed, 62 total          [OK] test
                   Test Suites: 5 passed, 5 total
                   Tests:       33 passed, 33 total          [OK] test:integration
                   3 skipped
                   33 passed (9.4s)                          [OK] test:e2e
── 5. Evidence ─   EVIDENCE: OK                   [OK] Evidencia coherente
── 6. Summary ──                                  [OK] Estado verificable
EXIT_CODE=0
```

Los conteos coinciden **exactamente** con los que afirma la evidencia y con los que yo mismo medí en
la revisión #1: 62 unit, 33 integration, 33 passed + 3 skipped e2e. Los 3 saltados siguen siendo las
comprobaciones táctiles en `desktop-chrome`.

### La cobertura no bajó

Contados por mí, fichero a fichero (`it(`/`test(`):

```text
unit         14 library  ·  9 study-session  ·  8 theme  ·  5 button  ·  3 card
              7 feedback ·  5 input  ·  5 flashcard-face  ·  6 responsive     = 62
integration   8 cards-flow · 9 decks-flow · 5 expo-router · 5 navigation
              6 study-flow                                                    = 33
e2e           36 declarados: 33 passed + 3 skipped
```

Los tests del duplicado se sustituyeron uno a uno por los del anclaje, así que los totales son
idénticos a los de la revisión #1 y ningún fichero perdió casos netos. La regresión de historial de
TASK-002 (`navigation.test.tsx`, 5 casos) y la del apilado (`study-flow.test.tsx:115`) siguen ahí
intactas.

### Sin dependencias nuevas

```text
$ git diff HEAD -- package.json package-lock.json | wc -c
0
$ git status --porcelain package.json package-lock.json | wc -l
0
```

### Sin ampliación de scope aprovechando la ronda

`git status --porcelain --untracked-files=all` devuelve **exactamente las mismas 39 entradas** que
había antes de esta ronda: 19 trackeados modificados/borrados y 20 sin trackear. **No apareció
ningún archivo nuevo.** El único archivo trackeado que la ronda añadió a la lista respecto de la
revisión #1 es `src/components/ui/Input.tsx`, y su diff son 5 líneas que solo añaden el `testID` del
mensaje de error. Los cambios de la ronda se limitan a: `app/mazo/[id]/index.tsx`,
`src/features/decks/library.ts`, `src/components/ui/Input.tsx`, `src/theme/tokens.ts` (una constante),
`src/components/ui/FlashcardFace.tsx` (una línea), `docs/DESIGN.md` (una línea), los tests
correspondientes y la documentación. Todo dentro de `allowed_paths`; `SCOPE: OK (TASK-003)`.

### La acceptance no se modificó

Comparación programática de los dos arrays:

```text
task acc 32 · contract acc 32 · IDENTICAL: True
matrix entries 32 · acc sin entrada en la matriz: ninguna · entradas de matriz sin acceptance: ninguna
```

Las 32 acceptance siguen cumpliéndose: las 31 que ya di por buenas en la revisión #1 no se han
tocado, y la 13 ("La creación de flashcard valida su entrada y muestra un error legible cuando no es
válida"), que era la única parcialmente incumplida, **queda cumplida**: el mensaje es legible y ahora
señala el campo que falla, comprobado en los tres niveles.

### Greps propios

```text
$ grep -rnE "#[0-9A-Fa-f]{3,8}|rgba?\(|hsla?\(" --include=*.ts --include=*.tsx app src | grep -v "^src/theme/"
(sin coincidencias)

$ grep -rniE "gradient|glow|blur|shadowColor|textShadow|neon|elevation|shadowOpacity|shadowRadius" app/ src/
src/theme/tokens.ts:9   (comentario que las declara prohibidas)

$ grep -rn "serif" app/ src/
src/components/ui/FlashcardFace.tsx:57   fontFamily: typography.family.serif   ← único uso
(el resto: el comentario de ese mismo archivo y la definición del token)

$ grep -rniE "supabase|autenticaci|login|password|google|apple|modo oscuro|dark mode|estadístic|anki|sincroniz" app/ src/
(sin coincidencias)

$ grep -rniE "calific|repetici|scheduler|srs|otra vez|difícil|fácil|rating|grade" app/ src/
app/mazo/[id]/estudiar.tsx:24 y src/features/study/session.ts:4   (comentarios que declaran que NO se implementan)

$ grep -rnE "\bany\b|TODO|FIXME|console\.(log|debug|warn)" app/ src/ tests/
(sin coincidencias)
```

Idénticos a los de la revisión #1. La corrección no introdujo colores propios, ni `any`, ni logs, ni
términos fuera de scope.

## Hallazgos nuevos

Todos de severidad **BAJA** y de arreglo mecánico. Ninguno afecta al comportamiento de la aplicación.

### N1. [BAJA] El contrato sigue exigiendo cobertura del caso duplicado que él mismo retiró

`.harness/contracts/TASK-003.json`, dos entradas del `verification_matrix` quedaron sin actualizar
cuando `technical_decisions[3]` se marcó como RETIRADA:

```text
:96   acceptance 8  → "npm test sobre la lógica pura (nombre vacío, solo espacios, duplicado)..."
:205  acceptance 26 → "Cobertura de creación válida, nombre vacío, nombre solo con espacios,
                       nombre duplicado, frente vacío y reverso vacío."
```

El contrato es ahora internamente contradictorio: una decisión declara retirada la regla y la matriz
de verificación sigue pidiendo su evidencia. Leído al pie de la letra, la acceptance 26 no puede
satisfacerse, porque la cobertura que exige ya no puede existir. Es un defecto **introducido por la
ronda de corrección**. Arreglo: sustituir "duplicado" por el caso que de verdad lo reemplaza (nombre
repetido permitido) en las dos entradas.

### N2. [BAJA] La "pregunta abierta para el usuario" no está registrada en ningún campo estructurado

El implementer la declara tres veces en prosa —`library.ts:39-40`, `technical_decisions[3]` del
contrato ("Queda como pregunta abierta para el usuario, no resuelta por el agente") y la sección R2
de la evidencia ("**Pregunta abierta para el usuario**: ¿deben permitirse dos mazos con el mismo
nombre?")— pero:

```text
.harness/tasks/TASK-003.json      "open_questions": []
.harness/contracts/TASK-003.json  "open_questions": []
progress/current.md:51-54         "## Preguntas abiertas — Ninguna. Todo lo necesario está resuelto..."
```

Retirar la regla era una de las dos salidas que ofrecí, y se hizo bien, así que R2 está cerrado en lo
material. Pero `AGENTS.md` ("si no sabes algo de producto, regístralo como decisión pendiente") y
`docs/PRODUCT.md` (regla: "anótala como `open_question` en la tarea") piden que quede anotada, y el
propio implementer dice que lo está cuando no lo está. Tal como queda, al cerrar la tarea el usuario
leerá "Preguntas abiertas: Ninguna" y la pregunta no le llegará nunca.

### N3. [BAJA] La evidencia afirma tres cosas que ya no son ciertas

`progress/evidence/TASK-003-implementation.md`. La sección nueva de correcciones es honesta y
comprobable, pero la tabla acceptance -> evidencia no se actualizó:

```text
fila 8   "4 tests unitarios de error + vacío y duplicado en integración + E2E"
         → los tests unitarios de error de createDeck son 2 (vacío y solo espacios), no 4,
           y el caso "duplicado en integración" ya no existe: lo comprobé, no hay tal test.
fila 26  "library.test.ts, 17 tests"
         → contados por mí: 14.
```

`docs/VERIFICATION.md` abre con "una afirmación del agente no es evidencia" y `CHECKPOINTS.md` C3
exige que cada acceptance **tenga** evidencia. Una fila que apunta a un test inexistente no es
evidencia de nada. Es lo mismo que se corrigió en R2 pero en la capa de arriba.

### N4. [BAJA] R4 quedó a medias (ver arriba)

`letterSpacing: 0.6` en `src/components/ui/FlashcardFace.tsx:63` no se tokenizó ni se justificó, y la
evidencia no lo menciona. La cabecera de `src/theme/tokens.ts` sigue declarando que ningún componente
debe declarar literales de color **o de espaciado** por su cuenta.

## Observaciones no bloqueantes

- **La rama `field === 'form'` es inalcanzable hoy.** `app/mazo/[id]/index.tsx:113-117` renderiza
  `card-form-error` para los errores sin campo, que solo puede ser `mazo-inexistente`; pero el
  componente hace `return` temprano en `:29` cuando `!deck`, así que cuando se pulsa "Añadir carta"
  el mazo siempre existe. Es código defensivo razonable, pero está sin test a ningún nivel y no puede
  ejercitarse. No lo cuento como hallazgo: es minúsculo y su alternativa (quitarlo) tampoco mejora
  nada. Conviene saberlo.
- **El contador de ids se consume también en los intentos fallidos.** `LibraryProvider.tsx:42,54`
  llama a `generateId` antes de validar, así que un intento con el nombre vacío quema un número y el
  siguiente mazo sería `mazo-2`. Hoy es inocuo (los ids no se muestran y los tests no encadenan un
  fallo con un alta), pero es una rareza que desaparecerá cuando los genere la base de datos.
- **La paleta sigue sin ser verificable desde el repositorio**: el boceto aprobado no está
  versionado. Los diez hex se dan por confirmados según el task. Sigue siendo trabajo de QA o del
  usuario confirmarlo a ojo.
- **La E2E de validación de carta sigue ejercitando solo el reverso ausente**
  (`flashcards-flow.spec.ts:127-138`). El anclaje del frente sí está cubierto en integración por los
  dos lados, así que la cobertura es suficiente; ampliar la E2E sería una mejora, no una carencia.
- La sección "Corrección de los hallazgos del review #1" de la evidencia es honesta: todo lo que
  afirma sobre R1, R3 y R5 se sostuvo al reejecutarlo, incluida la demostración de que el test nuevo
  falla sin la corrección, que reproduje de forma independiente y confirmé.

## Confirmación de rol read-only

- No he editado, creado ni borrado ningún archivo de código, test, documentación o configuración.
- El único archivo que he escrito es este, y **solo añadiendo** esta sección al final: la revisión #1
  queda intacta, byte a byte.
- No he tocado `.harness/tasks/TASK-003.json`, ni `.harness/contracts/TASK-003.json`, ni
  `progress/current.md`. Hashes SHA-256 idénticos al inicio y al final de mi revisión:

```text
f8f039526f0117e223fb7d51b431b39ea296ea9d0d6eb71a95df080bb12e4bba  .harness/tasks/TASK-003.json
642505ba7f2b6c7613efca26eb9995fc0760347bbcb502f595bf2d967377159c  .harness/contracts/TASK-003.json
9603ae30375526aa351d850acbe1d2e06456202af46ed674ce4c2e8f2c7d4383  progress/current.md
```

- La única escritura sobre código fue la reversión **temporal y explícitamente encargada** del
  anclaje del error en `app/mazo/[id]/index.tsx`, para comprobar que el test falla de verdad. El
  archivo quedó restaurado desde una copia en `/tmp` con hash SHA-256 idéntico
  (`11fbc9af...0be54d`), y `git status --porcelain` devuelve las mismas 39 entradas que antes de mi
  intervención.
- Ningún defecto ha sido corregido por mí: todos quedan reportados arriba.
- Las salidas de verificación se escribieron en `/tmp` (`rev2-init.txt`, `rev2-int-bug.txt`,
  `rev2-detalle-backup.tsx`), fuera del repositorio, para no alterar `check_scope.py`.

## Qué falta para APPROVED

1. N1: actualizar las dos entradas del `verification_matrix` del contrato (líneas 96 y 205) para que
   dejen de exigir cobertura del caso duplicado.
2. N2: registrar la pregunta abierta donde el usuario la vea —`open_questions` de la task y del
   contrato, y `progress/current.md`— o retirar la afirmación de que está registrada.
3. N3: corregir las filas 8 y 26 de la tabla acceptance -> evidencia para que describan los tests que
   existen de verdad.
4. N4: tokenizar `letterSpacing: 0.6` o justificarlo explícitamente, como se pidió en el review #1.
5. Reejecutar `./init.sh` y volver a pasar por review.

Nada de esto toca el comportamiento de la aplicación: son cuatro ediciones de documentación y una
línea de estilo. El código de TASK-003, tal como está, lo doy por correcto y verificado.

---

## Revisión #3 — 2026-08-18

- Task: TASK-003 — Mazos, flashcards y estudio simple sobre la nueva dirección visual
- Agente: reviewer (independiente, read-only). Tercera pasada tras la corrección de N1-N4.
- Base de Git: `9f530f0 chore(TASK-002): cerrar base visual tras review y QA`
- Contrato: `.harness/contracts/TASK-003.json` (32 acceptance, **una** `open_question` no bloqueante)

## Veredicto

**APPROVED**

Los cuatro hallazgos del review #2 están cerrados, verificados uno a uno contra el estado real del
repositorio y no contra el relato de la evidencia. La ronda de corrección **no ha introducido ninguna
incoherencia nueva**: es la primera ronda de esta tarea de la que puedo decirlo. El contrato ya no se
contradice a sí mismo, la pregunta abierta está registrada en los tres sitios con el mismo texto, las
dos filas de la tabla acceptance -> evidencia coinciden con el conteo que yo mismo hice fichero a
fichero, y el último literal fuera de tokens está tokenizado con su motivo.

Todo lo demás sigue como estaba: gates verdes con los mismos conteos, cero dependencias nuevas, cero
archivos nuevos, acceptance intacta, lógica de `src/features/` pura y las 32 acceptance cumplidas.
Además he vuelto a comprobar **ejecutando** que los dos tests que el implementer presenta como
regresiones fallan de verdad sin su corrección, y he restaurado los archivos byte a byte.

No queda nada que exija modificación. Lo que aparece más abajo como "no bloqueante" es exactamente
eso: no condiciona la aprobación y no debe convertirse en otra ronda.

## Documentos leídos

`AGENTS.md`, `.harness/agents/reviewer.md`, `.harness/tasks/TASK-003.json`,
`.harness/contracts/TASK-003.json`, `docs/PRODUCT.md`, `docs/DESIGN.md`, `docs/ARCHITECTURE.md`,
`docs/CONVENTIONS.md`, `docs/VERIFICATION.md`, `docs/TESTING.md`, `CHECKPOINTS.md`,
`progress/current.md`, `progress/evidence/TASK-003-implementation.md` (incluida la sección nueva
"Corrección de los hallazgos del review #2"), las revisiones #1 y #2 de este mismo archivo,
`.gitignore`, y el código: `app/index.tsx`, `app/mazo/[id]/index.tsx`, `app/mazo/[id]/estudiar.tsx`,
`src/theme/tokens.ts`, `src/features/decks/library.ts`, `src/features/study/session.ts`,
`src/lib/LibraryProvider.tsx`, `src/lib/navigation.ts`, `src/components/ui/Input.tsx`,
`src/components/ui/Card.tsx`, `src/components/ui/FlashcardFace.tsx`,
`src/components/layout/ScreenHeader.tsx`, `tests/unit/library.test.ts`, `tests/unit/theme.test.ts`,
`tests/integration/cards-flow.test.tsx`, `tests/integration/decks-flow.test.tsx`,
`tests/integration/study-flow.test.tsx`, `tests/e2e/flashcards-flow.spec.ts`.

## Verificación de los cuatro hallazgos del review #2

### N1 — Restos del caso "duplicado" en el contrato: **CERRADO, sin un solo resto**

Las dos entradas que señalé están corregidas y ahora describen lo que de verdad existe:

```text
fila 8  (acceptance 8)   command_or_procedure:
  "npm test sobre la lógica pura (nombre vacío, solo espacios) y npm run test:integration
   sobre el error mostrado y el campo al que se ancla."
fila 26 (acceptance 26)  evidence_expected:
  "Cobertura de creación válida, nombre vacío, nombre solo con espacios, nombre repetido
   permitido, frente vacío, reverso vacío y mazo inexistente."
```

La acceptance 26 vuelve a ser satisfacible, y lo compruebo caso por caso contra
`tests/unit/library.test.ts`: creación válida (`:20`), nombre vacío (`:35`), solo espacios (`:42`),
**nombre repetido permitido** (`:50`), frente vacío (`:85`), reverso vacío (`:94`) y mazo inexistente
(`:103`). Los siete casos que exige el contrato existen: la matriz ya no pide una evidencia
imposible, y tampoco pide una que no esté cubierta.

Barrido propio de restos sobre todo el repositorio:

```text
$ grep -rniE "duplicad|nombre-duplicado|normalize" app/ src/ tests/ docs/ .harness/ progress/
.harness/tasks/TASK-002.json, .harness/contracts/TASK-002.json, progress/evidence/TASK-00[12]-*.md
  → todos de tareas anteriores, sobre "estilos duplicados". Nada que ver.
progress/evidence/TASK-003-review.md y -implementation.md
  → prosa histórica de los reviews #1 y #2 y de sus correcciones. Correcto que siga ahí.
```

**Cero coincidencias en `app/`, `src/`, `tests/`, `docs/` y en los ficheros TASK-003 de `.harness/`.**
El código de error `nombre-duplicado` no existe (`LibraryErrorCode` tiene cuatro miembros,
`library.ts:8-12`, y `errorMessages` cuatro entradas), `normalize` no existe, y `createDeck` solo
recorta y valida vacío (`library.ts:32-43`).

### N2 — La pregunta abierta, registrada y coherente en los tres sitios: **CERRADO**

Comparación programática, no lectura a ojo:

```text
open_questions task     : ["NO BLOQUEANTE, para el usuario: ¿deben permitirse dos mazos con el
                           mismo nombre? Hoy se permiten, porque prohibirlos sería una decisión de
                           producto que el agente no puede tomar. Surgió durante el review #1 y no
                           impide cerrar TASK-003."]
open_questions contract : (idéntico)
OQ IDENTICAL: True
```

Y `progress/current.md:53-57` tiene la sección "Preguntas abiertas" con el mismo contenido, marcada
igualmente como **NO BLOQUEANTE**, y ya no dice "Ninguna". Las tres redacciones dicen lo mismo: que
hoy se permiten, que prohibirlos sería una decisión de producto del usuario, que surgió en el review
#1 y que no impide cerrar la tarea. Coherente también con `library.ts:39-40` y con
`technical_decisions[3]` del contrato ("RETIRADA tras el review #1"). Además `current.md:6` y la
cabecera de la evidencia describen ahora el contrato como "32 acceptance; una `open_question` NO
bloqueante", que es exactamente lo que hay.

Esto cumple lo que pedían `AGENTS.md` ("si no sabes algo de producto, regístralo como decisión
pendiente") y `docs/PRODUCT.md` (regla 1: "anótala como `open_question` en la tarea"). La pregunta
llegará al usuario al cerrar.

### N3 — Filas 8 y 26 de la tabla acceptance -> evidencia: **CERRADO, contadas por mí**

Conté los tests fichero a fichero (`^\s*(it|test)\(`), sin fiarme de ningún total afirmado:

```text
unit          library 14 · study-session 9 · theme 8 · feedback 7 · responsive 6
              button 5 · flashcard-face 5 · input 5 · card 3            = 62
integration   decks-flow 9 · cards-flow 8 · study-flow 6
              expo-router-navigation 5 · navigation 5                   = 33
e2e           flashcards-flow 6 · responsive-navigation 5 · web-boot 1
              = 12 declarados x 3 proyectos = 36  →  33 passed + 3 skipped
```

- **Fila 8** dice ahora "2 tests unitarios de error (vacío y solo espacios) + integración del mensaje
  y del campo al que se ancla + E2E". Comprobado: los tests unitarios de error de `createDeck` son
  exactamente **2** (`library.test.ts:35` y `:42`); la integración existe y es doble
  (`decks-flow.test.tsx:53` el mensaje, `:64` el anclaje vía `deck-name-input-error`); y el E2E
  existe de verdad (`flashcards-flow.spec.ts:118`, "la validación impide crear un mazo sin nombre y
  lo explica"). Ya no se cita ningún test inexistente.
- **Fila 26** dice "`library.test.ts`, 14 tests". Mi conteo: **14**. Coincide.

Aprovecho para verificar las filas vecinas que dependen de los mismos conteos, por si la corrección
hubiera desplazado el error a otro sitio: fila 13 ("frente vacío, reverso vacío y mazo inexistente en
unitarios") → los tres existen (`library.test.ts:85`, `:94`, `:103`); fila 27
("`study-session.test.ts`, 9 tests") → 9. **No hay ninguna otra cifra desactualizada en la tabla.**

### N4 — `letterSpacing: 0.6` tokenizado: **CERRADO**

`src/theme/tokens.ts:73-76` añade

```ts
letterSpacing: {
  /** Etiquetas en mayúsculas: sin abrir un poco el interletraje se leen apretadas. */
  label: 0.6,
},
```

y `src/components/ui/FlashcardFace.tsx:63` lo consume (`letterSpacing: typography.letterSpacing.label`).
El token está dentro de `typography`, que es donde corresponde, y lleva el motivo documentado, que es
justo lo que pedía el hallazgo. Barrido propio de literales de dimensión y tipografía:

```text
$ grep -rnE "(minHeight|maxHeight|height|width|minWidth|maxWidth|padding[A-Za-z]*|margin[A-Za-z]*|
   gap|borderRadius|fontSize|lineHeight|letterSpacing|borderWidth|flexBasis)\s*:\s*-?[0-9.]+"
   --include="*.ts" --include="*.tsx" app src | grep -v "^src/theme/"
src/components/ui/{Card,Button,Input,EmptyState}.tsx  borderWidth: 1
src/components/ui/FlashcardFace.tsx:94                borderWidth: 1
src/components/layout/{ScreenHeader,AppShell}.tsx     minWidth: 0
```

**Cero `letterSpacing`, cero `fontSize`, cero `minHeight`, cero espaciado literal.** Los `minWidth: 0`
son el idioma de flexbox, no una dimensión de diseño, y ya los descarté en el review #2. Los
`borderWidth: 1` son el filete de 1 px que usan por igual los cinco componentes —cuatro de ellos
heredados de TASK-002, ya revisados y aprobados—: `FlashcardFace` sigue el patrón existente en lugar
de inventar uno, que es lo que pide `docs/CONVENTIONS.md` ("busca cómo se resuelve algo equivalente
dentro del proyecto"). No es un hallazgo; lo dejo abajo como observación.

## Búsqueda de incoherencias nuevas introducidas por esta ronda

Es lo que falló en la ronda anterior, así que lo revisé como eje principal. La ronda tocó seis
archivos: contrato (dos filas de la matriz + `open_questions`), task (`open_questions`),
`progress/current.md`, la evidencia, `src/theme/tokens.ts` (un token) y
`src/components/ui/FlashcardFace.tsx` (una línea). Contrasté cada frontera:

### Task vs. contrato

```text
task acc 32 · contract acc 32 · IDENTICAL: True
verification_matrix 32 entradas · mismo orden que acceptance: True
acceptance sin entrada en la matriz: ninguna
entradas de matriz sin acceptance: ninguna
open_questions  IDENTICAL: True
allowed_paths   IDENTICAL: True
required_docs   IDENTICAL: True
task.status = REVIEWING
```

**El array `acceptance` no se modificó**: sigue siendo el mismo de las revisiones #1 y #2, los mismos
32 criterios en el mismo orden, idénticos en task y contrato. La ronda no aprovechó para retocarlo.

### Contrato vs. implementación

Repasé las 32 acceptance contra el código y los tests que las respaldan. Las 31 que ya di por buenas
en el review #1 no se han tocado, y la 13, que el review #2 dio por cumplida tras el anclaje del
error, sigue cumplida. Ninguna acceptance depende de nada que la ronda haya cambiado, salvo la 1
(paleta y tokens) y la 26 (cobertura unitaria), que verifico arriba. Añadir `typography.letterSpacing`
no rompe `tests/unit/theme.test.ts`, que sigue fijando los diez hex exactos y la familia serif, y los
62 unitarios pasan.

Comprobaciones puntuales que rehíce en código:

- **A1** los diez hex confirmados están en `tokens.ts` y `theme.test.ts` los fija por valor.
- **A2** `typography.family.serif` se consume en **un único sitio**, `FlashcardFace.tsx:57`.
- **A15** todos los controles visibles llevan `onPress`; el único inhabilitado es `study-button` con
  el mazo vacío, y la razón se comunica con un `Message` (`app/mazo/[id]/index.tsx:73-87`).
- **A16-A19** `session.ts` implementa el ciclo confirmado y `estudiar.tsx` solo monta `study-back`
  cuando `session.revealed`, alterna `reveal-button`/`next-card-button`, muestra "Carta N de T" y
  cierra con "Sesión terminada".
- **A20** no hay ningún control de calificación; la zona del boceto sigue eliminada entera.
- **A25** la lógica de `src/features/` es pura: `library.ts:1` y `session.ts:1` solo importan tipos
  (`import type`) de `../../types/domain`. Ni react-native, ni componentes, ni el proveedor.

### Evidencia vs. realidad medida

Ya cubierto en N3. Añado que las cifras de la sección "Comandos ejecutados" (62 / 33 / 33+3) y de
"Corrección de los hallazgos del review #2" ("Gates tras la corrección: `./init.sh` exit 0; 62 unit,
33 integration, 33 e2e (+3 skipped)") coinciden **exactamente** con lo que yo mismo obtuve. No
encontré ninguna afirmación de la evidencia que no se sostenga al reejecutarla.

### `progress/current.md` vs. estado real

`Estado: REVIEWING (review #1 y #2 = CHANGES_REQUIRED; hallazgos corregidos; pendiente review #3)`
coincide con `task.status = REVIEWING`; el contrato se describe con sus 32 acceptance y su única
pregunta abierta; el plan corto marca los pasos 12 y 13 como hechos y pendiente respectivamente; la
sección de preguntas abiertas ya no dice "Ninguna". Coherente con lo que hay en disco.

## Re-verificación general (ejecutada por mí)

Salida redirigida a `/tmp/rev3-init.txt`, **fuera del repositorio**, para no ensuciar
`check_scope.py` con un untracked propio.

### `./init.sh` — exit code 0

```text
── 1. Harness ──   VERIFY: OK                      [OK] Harness válido
── 2. Scope ────   SCOPE: OK (TASK-003)            [OK] Scope válido
── 3. Hygiene ──                                   [OK] Sin temporales/secretos obvios
── 4. App gates ─                                  [OK] typecheck
                                                   [OK] lint
                   Test Suites: 9 passed, 9 total
                   Tests:       62 passed, 62 total           [OK] test
                   Test Suites: 5 passed, 5 total
                   Tests:       33 passed, 33 total           [OK] test:integration
                   3 skipped
                   33 passed (9.4s)                           [OK] test:e2e
── 5. Evidence ─   EVIDENCE: OK                    [OK] Evidencia coherente
── 6. Summary ──                                   [OK] Estado verificable
EXIT_CODE=0
```

Los conteos que afirma la evidencia (62 unit, 33 integration, 33 passed + 3 skipped e2e) son los
que obtuve, y coinciden con los de las revisiones #1 y #2. Los 3 saltados siguen siendo las
comprobaciones táctiles en `desktop-chrome` (`test.skip(..., 'Solo aplica a pantallas táctiles.')`).

### Sin dependencias nuevas

```text
$ git diff HEAD -- package.json package-lock.json | wc -c        →  0
$ git status --porcelain package.json package-lock.json | wc -l  →  0
```

### Sin ampliación de scope

`git status --porcelain --untracked-files=all` devuelve 40 entradas: 19 trackeadas
(modificadas/borradas) y 21 sin trackear. **No apareció ningún archivo nuevo respecto de la ronda
anterior**: los archivos que la ronda tocó ya estaban todos en esa lista. Todos dentro de
`allowed_paths`; `SCOPE: OK (TASK-003)`.

Nota de fe de erratas sobre mi propia revisión #2: allí escribí "39 entradas (19 trackeados y 20 sin
trackear)". El desglose correcto es 19 + 21 = 40. Fue un error aritmético mío al describir la lista,
no un archivo aparecido: el conjunto de ficheros es el mismo.

### Los dos tests de regresión fallan de verdad sin su corrección

Los comprobé **ejecutándolos**, no leyéndolos, uno después de otro y restaurando entre medias.

**a) Apilado (`study-flow.test.tsx:115`).** Revertí `app/mazo/[id]/estudiar.tsx:36` de
`goBackOr(router, () => router.replace(...))` a `router.replace(...)`:

```text
● Flujo: estudiar › volver del estudio no añade un nivel extra al apilado
  > 127 |     expect(await screen.findByTestId('create-deck-button')).toBeTruthy();
Test Suites: 1 failed, 4 passed, 5 total
Tests:       1 failed, 32 passed, 33 total
```

**b) Anclaje del error (`cards-flow.test.tsx:73`).** Revertí `app/mazo/[id]/index.tsx` para que
`Frente` no recibiera error y `Reverso` recibiera siempre `error?.message`:

```text
● Flujo: crear flashcards › muestra un error legible si falta el frente, anclado a ese campo
  > 80 |     expect(screen.getByTestId('card-front-input-error')).toBeTruthy();
Test Suites: 1 failed, 4 passed, 5 total
Tests:       1 failed, 32 passed, 33 total
```

En los dos casos falla **exactamente ese caso y ningún otro**: son regresiones reales, no decorativas.

**Restauración confirmada por hash SHA-256 idéntico al de antes de mi intervención:**

```text
11fbc9afe43d607cc032e9fff28b861369bf01ab2ad8c14ec8bbcfbb9f0be54d  app/mazo/[id]/index.tsx
d2499be9e25e4c72851250f0c4a07c2bbd0faadec45d1a7af0d6a70620a68224  app/mazo/[id]/estudiar.tsx

$ npx jest --selectProjects integration  →  Tests: 33 passed, 33 total
$ npx jest --selectProjects unit         →  Tests: 62 passed, 62 total
$ git status --porcelain --untracked-files=all | wc -l  →  40   (las mismas de antes)
```

### Greps propios

```text
$ grep -rnE "#[0-9A-Fa-f]{3,8}|rgba?\(|hsla?\(" --include="*.ts" --include="*.tsx" app src | grep -v "^src/theme/"
(sin coincidencias)

$ grep -rniE "gradient|glow|blur|shadowColor|textShadow|neon|elevation|shadowOpacity|shadowRadius|shadowOffset" app/ src/
src/theme/tokens.ts:9   (comentario que las declara prohibidas)

$ grep -rn "serif" app/ src/
src/components/ui/FlashcardFace.tsx:57   fontFamily: typography.family.serif   ← único uso
(el resto: el comentario de ese archivo y la definición del token en tokens.ts)

$ grep -rniE "supabase|autenticaci|login|password|google|apple|modo oscuro|dark mode|estadístic|anki|sincroniz|\bsync\b|subcategor" app/ src/
(sin coincidencias)

$ grep -rniE "calific|repetici|scheduler|srs|otra vez|difícil|fácil|rating|grade" app/ src/
app/mazo/[id]/estudiar.tsx:24 y src/features/study/session.ts:4   (comentarios que declaran que NO se implementan)

$ grep -rnE "\bany\b|TODO|FIXME|console\.(log|debug|warn|error)" app/ src/ tests/
(sin coincidencias)
```

Idénticos a los de las revisiones #1 y #2. La ronda no introdujo colores propios, ni `any`, ni logs,
ni términos fuera de scope.

## Hallazgos

**Ninguno.** N1, N2, N3 y N4 están cerrados; R1-R5 siguen cerrados; no encontré ningún defecto nuevo
introducido por esta ronda ni ninguna incoherencia entre task, contrato, código, evidencia y
`current.md`.

## Observaciones no bloqueantes

Ninguna exige modificación. No condicionan la aprobación y no deben abrir otra ronda.

- **`borderWidth: 1` sin token** en `Card`, `Button`, `Input`, `EmptyState` (heredados de TASK-002,
  ya aprobados) y en `FlashcardFace` (nuevo, siguiendo el mismo patrón). Es el filete de 1 px del
  sistema, no una dimensión de diseño variable, y `FlashcardFace` hace lo correcto al reutilizar el
  idioma existente en vez de inventar otro. Si algún día se añade un `borders` a los tokens, conviene
  hacerlo de una vez para los cinco, no solo para el archivo nuevo.
- **`progress/current.md` quedará ligeramente desfasado en cuanto se añada esta sección**: dice
  "`progress/evidence/TASK-003-review.md` (revisiones #1 y #2)" y sigue marcando el review #3 como
  pendiente. Es consecuencia inevitable de mi propia escritura, no un defecto del implementer; el
  paso de cierre (commit, QA y actualización de estado) lo resolverá.
- **La paleta sigue sin ser verificable desde el repositorio**: el boceto aprobado no está versionado,
  así que los diez hex se dan por confirmados según el task. Es trabajo de QA o del usuario
  confirmarlos a ojo. Versionar la referencia visual eliminaría esta zona ciega en tareas futuras.
- **La rama `field === 'form'`** (`app/mazo/[id]/index.tsx:113-117`) sigue siendo inalcanzable hoy,
  porque la pantalla retorna antes si el mazo no existe. El implementer la conserva de forma
  explícita y razonada en la evidencia; me parece bien.
- **El contador de ids se consume también en los intentos fallidos** (`LibraryProvider.tsx:42,54`).
  Inocuo mientras los ids no se muestren y no exista base de datos.
- **La E2E de validación de carta solo ejercita el reverso ausente**
  (`flashcards-flow.spec.ts:127-138`). El anclaje del frente está cubierto en integración por los dos
  lados, así que la cobertura es suficiente.
- **`Componentes` sigue siendo un destino de primer nivel** visible para el usuario final. Viene de
  TASK-002; habrá que decidir su visibilidad cuando el producto crezca.
- **La evidencia es honesta y comprobable.** Todo lo que afirma se sostuvo al reejecutarlo, incluidas
  las dos demostraciones de que los tests de regresión fallan sin su corrección, que reproduje de
  forma independiente. La sección "No verificado" declara correctamente sus límites (sin dispositivo
  físico, serif nativa sin comprobar, sin CI real).

## Confirmación de rol read-only

- No he editado, creado ni borrado ningún archivo de código, test, documentación o configuración.
- El único archivo que he escrito es este, y **solo añadiendo** esta sección al final: las revisiones
  #1 y #2 quedan intactas, byte a byte.
- No he tocado `.harness/tasks/TASK-003.json`, ni `.harness/contracts/TASK-003.json`, ni
  `progress/current.md`. Hashes SHA-256 idénticos al inicio y al final de mi revisión:

```text
c6e911fdbeb765a06b46c97c2763b93554be408593188d2ddd58c19954100027  .harness/tasks/TASK-003.json
8ea5426bddf9333a41f81dca68e7c6c43d872d316ea7953d5be2383c6340a57d  .harness/contracts/TASK-003.json
260e542cbc17986490201833eed35337b260012867a18959c7eec5e3eaad2684  progress/current.md
```

- Las únicas escrituras sobre código fueron las dos reversiones **temporales y explícitamente
  encargadas** de `app/mazo/[id]/estudiar.tsx` y `app/mazo/[id]/index.tsx`, para comprobar que los
  tests de regresión fallan de verdad. Ambos archivos quedaron restaurados desde copias en `/tmp`
  con hash SHA-256 idéntico, y `git status --porcelain --untracked-files=all` devuelve las mismas 40
  entradas que antes de mi intervención.
- Ningún defecto ha sido corregido por mí. No había ninguno que corregir.
- Las salidas de verificación se escribieron en `/tmp` (`rev3-init.txt`, `rev3-hashes-before.txt`,
  `rev3-estudiar.bak`, `rev3-detalle.bak`), fuera del repositorio, para no alterar `check_scope.py`.

## Estado de CHECKPOINTS

- **C1 Harness sano**: `./init.sh` exit 0; una sola tarea activa; contrato existente; `current.md`
  representa la sesión. **OK**
- **C2 Scope controlado**: cambios dentro de `allowed_paths`; acceptance sin modificar; sin cambios
  oportunistas; sin dependencias nuevas. **OK**
- **C3 Implementación correcta**: las 32 acceptance implementadas y con evidencia real; happy path y
  casos de error cubiertos; sin logs, temporales ni TODOs; arquitectura respetada. **OK**
- **C4 Verificación por capas**: baseline verde antes de editar; static, unit, integration, e2e y
  regresión completa en verde, reejecutados por mí. **OK**
- **C5 Revisión independiente**: reviewer revisó task, contract, diff y evidencia sin editar código;
  no quedan findings abiertos. Falta **QA**, que es el paso siguiente. **Pendiente solo QA**
- **C6 Cierre limpio**: pendiente del commit del candidato, la actualización del historial y el
  `./init.sh` final, que corresponden al paso de cierre.

## Qué queda por hacer (no es trabajo de corrección)

1. Commit del candidato.
2. QA sobre el comportamiento observable, con dos puntos que le señalo expresamente: **confirmar la
   paleta a ojo** contra el boceto aprobado (no es verificable desde el repositorio) y **comprobar
   que la pérdida de datos al recargar** —consecuencia declarada de que la persistencia no esté
   decidida— resulta aceptable para esta entrega.
3. `./init.sh` final y cierre, trasladando al usuario la pregunta abierta no bloqueante sobre los
   nombres de mazo repetidos.
