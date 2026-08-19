# TASK-004 — Review independiente

- Task: TASK-004 — Persistencia local, unicidad de mazos y estabilización de navegación
- Agente: reviewer (READ ONLY sobre código y configuración)
- Fecha: 2026-08-18
- Base de Git: `06622c2 chore(TASK-003): cerrar mazos, flashcards y estudio tras review y QA`
- Contrato: `.harness/contracts/TASK-004.json` (51 acceptance, 51 filas de matriz, 6 decisiones técnicas)

## VEREDICTO

**CHANGES_REQUIRED**

El motivo bloqueante es un único defecto, el hallazgo **F1**: la persistencia introducida por esta
tarea reintroduce identificadores de mazo ya usados después de rehidratar, de modo que dos mazos
distintos pueden quedar guardados con el mismo `id` y las cartas de uno acaban en el otro. Está
demostrado ejecutando la aplicación real, no por lectura. Incumple las acceptance 7 y 8.

El resto del trabajo es de buena calidad: el scope es coherente, las decisiones de producto son
exactamente las siete confirmadas, la dependencia está justificada y bien aislada, los dos tests
que el usuario exigió miden lo que dicen medir (lo he comprobado rompiendo el código a propósito),
y ningún test se ha debilitado.

## Documentos leídos

`AGENTS.md`, `.harness/agents/reviewer.md`, `.harness/tasks/TASK-004.json`,
`.harness/contracts/TASK-004.json`, `docs/PRODUCT.md`, `docs/ARCHITECTURE.md`,
`docs/CONVENTIONS.md`, `docs/VERIFICATION.md`, `docs/TESTING.md`, `docs/DATABASE.md`,
`CHECKPOINTS.md`, `progress/current.md`, `progress/evidence/TASK-004-implementation.md`.

## Diff revisado

Tracked (`git diff HEAD`): `app/index.tsx`, `app/mazo/[id]/index.tsx`, `app/mazo/[id]/estudiar.tsx`,
`docs/PRODUCT.md`, `eslint.config.js`, `jest.config.js`, `package.json`, `package-lock.json`,
`progress/current.md`, `src/components/layout/AppShell.tsx`, `src/features/decks/library.ts`,
`src/lib/LibraryProvider.tsx`, `src/lib/navigation.ts`, `tests/integration/navigation.test.tsx`,
`tests/unit/library.test.ts`.

Untracked, leídos con Read porque `git diff` no los muestra: `.harness/tasks/TASK-004.json`,
`.harness/contracts/TASK-004.json`, `progress/evidence/TASK-004-implementation.md`,
`src/lib/storage/{types,serialization,asyncStorageRepository,memoryRepository,index}.ts`,
`tests/setup/{async-storage,reset-storage}.js`, `tests/unit/deck-name-uniqueness.test.ts`,
`tests/unit/storage-serialization.test.ts`, `tests/integration/persistence.test.tsx`,
`tests/e2e/persistence-navigation.spec.ts`.

## 1. Scope y coherencia

Comprobado programáticamente sobre los dos JSON:

```text
allowed_paths idénticos: True | n = 13
required_docs idénticos: True
acceptance idénticos:    True | n = 51
out_of_scope idénticos:  True
verification_matrix:     51 filas, cubre cada acceptance en orden: True
```

No se repite la divergencia de TASK-001. Todos los archivos tocados caen dentro de `allowed_paths`,
y `check_scope.py` lo confirma en las dos ejecuciones de `./init.sh` (`SCOPE: OK (TASK-004)`).

Cambios oportunistas: prácticamente ninguno. El único es la edición de la lista "Decisiones todavía
NO tomadas" de `docs/PRODUCT.md` (ver observación O1). No introduce decisiones nuevas.

## 2. Correctitud contra las 51 acceptance

Cumplidas y verificadas de forma independiente todas menos las siguientes:

| # | Acceptance | Estado |
|---|---|---|
| 7 | "Las cartas siguen perteneciendo al mazo correcto después de restaurar los datos." | **NO CUMPLE** — F1 |
| 8 | "Crear varios mazos conserva correctamente sus datos independientes." | **NO CUMPLE** — F1 |
| 1 | "Existe una implementación persistente del repositorio…" | Cumple, pero la evidencia esperada por el contrato no se alcanza — F2 |
| 22 | "Un error de lectura o escritura… no borra los datos válidos" | Parcial — F3 |

Las acceptance de navegación (23-26), unicidad (9-14), hidratación (18-21), regresión (46-47) y
plataformas (34-38) las he verificado ejecutando la suite y con las mutaciones descritas abajo.

## 3. La dependencia elegida

`@react-native-async-storage/async-storage@2.2.0`, instalada con `npx expo install`.

- **Justificada**: sí, en el contrato (`technical_decisions[0]`) y en la evidencia, con alternativas
  descartadas y motivo.
- **Proporcionada**: sí. Una única dependencia, API de clave/valor, sin configuración nativa
  adicional. `expo-sqlite` habría sido desproporcionado para un documento JSON pequeño.
- **Compatible con web, iOS y Android**: sí, es la opción que Expo soporta para las tres.
- **Aislada**: sí, comprobado por mí:

```text
$ grep -rn "async-storage" app src tests --include=*.ts --include=*.tsx --include=*.js \
    | grep -v "^src/lib/storage/"
tests/setup/reset-storage.js:1  (infraestructura de Jest)
tests/setup/async-storage.js:4  (mock oficial bajo Jest)

$ grep -rn "lib/storage" app/ src/components/
(ninguna)
```

Ninguna pantalla ni componente importa la capa de almacenamiento: solo hablan con `useLibrary()`.
El único consumidor de `createAsyncStorageRepository` es `src/lib/LibraryProvider.tsx:59`.

## 4. Calidad de los dos tests exigidos

Los dos exigidos por el usuario los he comprobado **empíricamente**, rompiendo el código y
observando fallos reales.

### 4a. Regresión de navegación: mide acumulación, no qué pantalla se ve

No se limita a comprobar la pantalla visible. Mide dos magnitudes distintas de acumulación:

- Integración (`tests/integration/navigation.test.tsx:82`): 15 ciclos, comprobando
  `router.canGoBack() === false` y `router.canDismiss() === false` **en cada vuelta**, es decir la
  profundidad real del apilado.
- E2E (`tests/e2e/persistence-navigation.spec.ts:114`): los mismos 15 ciclos contando **todas** las
  instancias del DOM con `.count()`, visibles e invisibles — la métrica exacta que usó QA. Más
  `persistence-navigation.spec.ts:153`, que comprueba que un borrador escrito en una pantalla
  anterior no sobrevive en una instancia invisible.

Verificado revirtiendo `goToTopLevel(router, () => router.replace(href))` a `router.replace(href)`
en `src/components/layout/AppShell.tsx:35`:

```text
$ npm run test:integration
FAIL integration tests/integration/navigation.test.tsx
  ● Navegación base › repetir 15 ciclos detalle -> destino de primer nivel no acumula stack
    expect(received).toBe(expected)  Expected: false  Received: true
      > 107 |       expect(router.canGoBack()).toBe(false);
Tests: 1 failed, 48 passed, 49 total

$ npx playwright test tests/e2e/persistence-navigation.spec.ts --project=desktop-chrome
  2 failed
    › 15 ciclos detalle -> destino de primer nivel no acumulan instancias
    › ninguna pantalla invisible conserva datos escritos antes
      strict mode violation: getByTestId('decks-list') resolved to 2 elements
  8 passed
```

El fallo de integración reproduce exactamente el que registró el implementer. Y el e2e demuestra la
acumulación material: dos nodos `decks-list` en el DOM. **El test no es vacuo.**

### 4b. Persistencia: destruye y recrea el proveedor

`tests/integration/persistence.test.tsx` no se limita al estado en memoria. `montarApp()` crea un
`LibraryProvider` nuevo en cada llamada, y siete tests hacen `screen.unmount()` y vuelven a montar
con el mismo repositorio, de modo que no queda estado de React que pueda dar un falso verde. Además
afirma sobre el medio con `peek()` + `parseStoredLibrary`. En e2e se hace `page.reload()` real.

Verificado anulando `save` en el repositorio en memoria:

```text
$ npm run test:integration
  ● crear un mazo lo persiste y se recupera del almacenamiento
  ● crear una carta la persiste y sigue en su mazo tras reconstruir
  ● dos cartas seguidas se conservan las dos
  ● varios mazos conservan sus datos de forma independiente
  ● las cartas siguen aisladas por mazo después de restaurar
  ● rehidratar dos veces no duplica los datos
  ● los identificadores nuevos no chocan con los restaurados
  ● el duplicado se rechaza también tras restaurar desde el almacenamiento
Tests: 8 failed, 41 passed, 49 total
```

**El test tampoco es vacuo.** Con la salvedad de F2: lo que ejercita es el doble en memoria, no la
implementación persistente real.

## 5. Regresiones y tests debilitados

Ningún archivo de test eliminado ni renombrado (`git diff HEAD --name-status -- tests/` solo
devuelve dos `M`). Conteos al alza en las tres capas: unit 62 -> 89, integration 33 -> 49,
e2e 33 -> 63 (+3 skipped declarados: los táctiles en `desktop-chrome`, con motivo).

`tests/unit/library.test.ts`: el cambio es **legítimo**. El test anterior afirmaba
`'permite un nombre repetido, porque nadie ha decidido prohibirlo'`, que es literalmente lo
contrario de la decisión que el usuario tomó el 2026-08-18 y de las acceptance 11 y 12. Mantenerlo
habría sido incoherente. No hay debilitamiento: el archivo conserva sus 14 `it()`, el test sigue
afirmando un resultado concreto (`{ ok: false, error: 'nombre-duplicado' }`) y la cobertura de la
normalización se amplía en `tests/unit/deck-name-uniqueness.test.ts` (12 tests).
`tests/integration/navigation.test.tsx` pasa de 5 a 7 `it()`, solo añade.

## 6. Arquitectura y convenciones

Respetadas. `UI -> feature logic -> data access` se mantiene: pantallas -> `useLibrary()` ->
`LibraryRepository` -> AsyncStorage. Acceso a datos centralizado en un único proveedor
(ARCHITECTURE regla 2). La unicidad vive en `src/features/decks/library.ts`, lógica pura y testeable
sin UI (reglas 1 y 7). Sin `any`, sin `TODO`/`FIXME`, sin `console.log`, sin colores fuera de
`src/theme/`. Salvedades menores en F4 y F5.

## 7. Complejidad innecesaria

La solución es proporcionada: un documento JSON, dos funciones de serialización, un contrato de dos
métodos. No hay migraciones, ni caché, ni capas intermedias sobrantes. Solo el tipo muerto de F4.

## 8. Decisiones de producto no autorizadas

`docs/PRODUCT.md` añade **exactamente las siete decisiones confirmadas**, ni una más. Cotejadas una
a una. No se ha colado ninguna normalización extra: `deckNameKey` es `name.trim().toLocaleLowerCase()`
y nada más, y `tests/unit/deck-name-uniqueness.test.ts:24,28` afirma explícitamente que **no** se
colapsan espacios interiores ni se eliminan acentos. La versión de TASK-003 que colapsaba espacios
interiores no se ha reintroducido.

Nada del `out_of_scope`: sin Supabase, sin auth, sin sincronización, sin cuentas, sin encriptación,
sin migraciones, sin editar/eliminar. La única coincidencia textual de "migracion" en todo `app/` y
`src/` es un comentario que declara que **no** hay sistema de migraciones.

## 9. Manejo de datos

Leer nunca escribe: `load()` no llama a `setItem` en ningún camino, ni con JSON inválido, ni con
versión desconocida, ni con forma inválida, ni cuando el medio falla. Comprobado en el código y en
`tests/unit/storage-serialization.test.ts:114` y `tests/integration/persistence.test.tsx:290`, que
afirman que el contenido roto sigue byte a byte en el medio después de arrancar. Correcto.

La salvedad es F3: lo guardado sí puede perderse en la **siguiente** acción de la persona usuaria
tras un error de lectura transitorio.

## Verificaciones ejecutadas

| # | Comando | Resultado |
|---|---|---|
| V1 | `./init.sh` (inicial) | **exit 0**. 10 gates en `[OK]`, `SCOPE: OK (TASK-004)`, `EVIDENCE: OK` |
| V2 | `npm test` | 11 suites / **89 passed**, 89 total |
| V3 | `npm run test:integration` | 6 suites / **49 passed**, 49 total |
| V4 | `npm run test:e2e` | **63 passed, 3 skipped** (66 en desktop-chrome, mobile-chrome, mobile-safari) |
| V5 | Mutación A: `router.replace(href)` en `AppShell.tsx:35` | integración **1 failed / 48 passed**; e2e **2 failed / 8 passed** |
| V6 | Mutación B: `save` anulado en `asyncStorageRepository.ts` | unit **89/89 PASS**, integración **49/49 PASS**, e2e **5 failed / 5 passed** |
| V7 | Mutación C: `save` anulado en `memoryRepository.ts` | integración **8 failed / 41 passed** |
| V8 | Sonda F1 (Jest fuera del repo, sin tocar el repo) | ids de mazo repetidos tras rehidratar |
| V9 | `./init.sh` (final, tras restaurar) | **exit 0**, mismos conteos |

Los conteos que afirma la evidencia del implementer (89 unit, 49 integration, 63 + 3 skipped e2e)
son **exactos**. La demostración de que el test de regresión falla al reintroducir el bug también se
reproduce literalmente (`1 failed, 48 passed, 49 total`).

Restauración: los tres archivos mutados se restauraron desde copia y su SHA-256 coincide con el
previo.

```text
2139de4d…16f0  src/components/layout/AppShell.tsx
7dca5ad4…8cfc  src/lib/storage/asyncStorageRepository.ts
2a53ba12…c572  src/lib/storage/memoryRepository.ts
-> diff hashes antes/después: idénticos; git status idéntico al de partida.
```

### Greps propios

```text
importaciones de async-storage fuera de src/lib/storage/ : solo tests/setup/ (infra de Jest)
importaciones de lib/storage en app/ y src/components/   : ninguna
any / TODO / FIXME / console.log en app/ y src/          : ninguno
colores fuera de src/theme/                              : ninguno
términos fuera de scope en app/, src/, tests/            : ninguno
git diff HEAD -- src/theme/ src/components/ui/ docs/DESIGN.md : vacío
```

### Apariencia visual de TASK-003

**Conservada.** El diff sobre `src/theme/`, `src/components/ui/` y `docs/DESIGN.md` está vacío: los
tokens no se han tocado. Los componentes nuevos que usan las pantallas (`Loading`, `Message`) ya
existían en `src/components/ui/index.ts` desde TASK-002; no se ha creado ninguna variante visual
nueva. Los e2e de overflow horizontal y objetivos táctiles siguen pasando en los tres proyectos.

## Hallazgos

### F1 — ALTO (bloqueante). Ids de mazo repetidos tras rehidratar: las cartas acaban en otro mazo

**Dónde**: `src/lib/LibraryProvider.tsx:75` junto con `:88-91`, `:102` y `:116`.

Al hidratar, el contador de identificadores se reinicia con el número de entidades restauradas:

```ts
nextId.current = result.library.decks.length + result.library.cards.length;
```

Pero `generateId` se invoca **como argumento**, es decir siempre, incluso cuando la operación se
rechaza:

```ts
const result = createDeckIn(library, name, generateId('mazo'));   // :102
const result = addCardTo(library, deckId, front, back, generateId('carta'));  // :116
```

Cualquier intento rechazado (nombre vacío, nombre solo con espacios, **nombre duplicado**, frente o
reverso vacío) consume un número que nunca llega a ser una entidad. Después de recargar, el contador
vuelve a un valor por debajo del mayor ya emitido y **reemite un id que ya está en uso**.

**Reproducción, ejecutando la aplicación real** (sonda de Jest ejecutada fuera del repositorio,
montando `app/index.tsx`, `app/mazo/[id]/index.tsx`, `AppShell` y `LibraryProvider` con el
repositorio en memoria):

1. Pulsar "Crear un mazo" con el campo vacío -> rechazado, pero consume `mazo-1`.
2. Crear "Alemán" -> `mazo-2`. Guardado.
3. Recargar (desmontar y volver a montar) -> el contador vuelve a 2.
4. Crear "Francés" -> `mazo-2` **otra vez**. Guardado.

Salida real de la sonda:

```text
MAZOS PERSISTIDOS: [{"id":"mazo-2","name":"Alemán"},{"id":"mazo-2","name":"Francés"}]
filas con testID deck-mazo-2: 2
ENCABEZADO DE LA PANTALLA ABIERTA: ["Alemán"]      <- se pulsó la fila de "Francés"
CARTAS PERSISTIDAS: [{"id":"carta-3","deckId":"mazo-2","front":"le chien","back":"el perro"}]
```

**Consecuencias observables**: pulsar la fila de "Francés" abre una pantalla encabezada "Alemán"
(`findDeck` devuelve la primera coincidencia); la carta que la persona usuaria cree estar añadiendo
a "Francés" queda persistida apuntando a un `deckId` que ahora pertenece a dos mazos, así que
aparece en los dos; y la lista renderiza dos elementos con el mismo `testID`.

**Acceptance incumplidas**: 7 ("Las cartas siguen perteneciendo al mazo correcto después de
restaurar los datos"), 8 ("Crear varios mazos conserva correctamente sus datos independientes"), y
en la práctica 17 ("La restauración de datos no crea copias duplicadas").

**Es una regresión introducida por esta tarea**: antes de TASK-004 el contador solo crecía dentro de
la sesión y la colisión era imposible; la reintroduce el reinicio derivado del almacenamiento.

**Por qué la suite no lo detecta**: `tests/integration/persistence.test.tsx:216`
("los identificadores nuevos no chocan con los restaurados") cubre únicamente el camino sin intentos
rechazados, que es justo el caso que nunca falla. Da una falsa sensación de cobertura. Nótese que un
intento rechazado es una acción cotidiana, y que el propio recorrido e2e de TASK-003 la ejercita
("la validación impide crear un mazo sin nombre").

No propongo la corrección concreta: es decisión del implementer. Sí debe quedar cubierta por un test
que incluya al menos un intento rechazado antes de la rehidratación.

### F2 — MEDIO. La implementación persistente real no está cubierta por unit ni integración

**Dónde**: `src/lib/storage/asyncStorageRepository.ts`, `tests/unit/storage-serialization.test.ts`,
`tests/integration/persistence.test.tsx`.

Los tests de contrato corren contra `createMemoryRepository` y `createFailingRepository`, nunca
contra `createAsyncStorageRepository`, que es la única implementación que usa la aplicación en
producción. Demostrado anulando su `save`:

```text
$ npm test                  -> 89 passed, 89 total   (verde)
$ npm run test:integration  -> 49 passed, 49 total   (verde)
$ npx playwright test tests/e2e/persistence-navigation.spec.ts --project=desktop-chrome
  5 failed (todos los de "Persistencia local" + el de duplicado tras recarga)
```

Es decir: se puede romper por completo la persistencia real del producto y las dos primeras capas de
la suite siguen verdes. Solo el e2e lo detecta.

Esto contradice el `evidence_expected` que el propio contrato fija para la acceptance 1: *"los tests
de contrato corren contra ambas implementaciones"*. También choca con `docs/TESTING.md` fase 3
("evitar mocks cuando el riesgo real está en la integración"). Además, la rama `catch` de `load()`
(`reason: 'ilegible'`) no se ejercita nunca sobre la implementación real.

Atenuante: el e2e sí cubre el camino real en web, con recarga de navegador, y el mock oficial de
AsyncStorage ya está registrado en Jest, así que cerrar el hueco es barato.

### F3 — MEDIO. Un fallo de lectura transitorio puede acabar borrando datos válidos

**Dónde**: `src/lib/LibraryProvider.tsx:76-79` y `:94-98`.

Cuando `load()` devuelve `{ status: 'error', reason: 'ilegible' }` —un fallo del medio, con datos
guardados que pueden ser perfectamente válidos— el proveedor deja la biblioteca vacía en memoria y
muestra el aviso. En cuanto la persona usuaria crea un mazo, `persist()` escribe la biblioteca
(vacía salvo ese mazo) **encima de los datos válidos que solo eran ilegibles en ese momento**.

No es silencioso: el mensaje avisa ("No se han podido leer tus datos guardados. Lo que crees ahora
sí se guardará."), y para `contenido-invalido` la evidencia lo documenta como comportamiento
deliberado. Pero para `ilegible` el efecto neto es la pérdida de datos válidos a raíz de un error de
almacenamiento, que es precisamente el escenario que el usuario señaló. La acceptance 22 pide que el
manejo "no borre los datos válidos existentes".

No es un fallo de implementación evidente sino un comportamiento que conviene decidir de forma
explícita (por ejemplo, no sobrescribir mientras el estado sea de error de lectura). Lo reporto para
que se resuelva conscientemente, no para que se arregle a ojo. Ningún test cubre este camino: el
repositorio de prueba que falla al leer también falla al escribir, así que la sobrescritura nunca se
observa.

### F4 — BAJO. Tipo exportado y no usado

`src/lib/navigation.ts:15` declara y exporta `StackRouter`, que no se usa en ningún sitio:
`goToTopLevel` declara su parámetro con un tipo estructural inline. Código muerto añadido por esta
tarea. CONVENTIONS 10 ("un cambio debe ser tan pequeño como permita cumplir la tarea").

```text
$ grep -rn "StackRouter" src app tests
src/lib/navigation.ts:15:export type StackRouter = {
```

### F5 — BAJO. Los dobles de prueba viajan en el bundle de la aplicación

`createMemoryRepository` y `createFailingRepository` viven en `src/lib/storage/memoryRepository.ts`
y se reexportan desde `src/lib/storage/index.ts:2`, que es el módulo que importa el código de
producción (`src/lib/LibraryProvider.tsx:20`). Los dobles acaban formando parte de la aplicación.
Sin efecto funcional; conviene que los dobles vivan con los tests o al menos no se reexporten desde
el barrel que consume producción.

### F6 — BAJO. `createAsyncStorageRepository()` se evalúa en cada render

`src/lib/LibraryProvider.tsx:59`: el argumento de `useRef` se evalúa en todos los renders, así que se
construye un repositorio desechable cada vez (solo se conserva el primero). Sin efecto observable.
En la misma línea, la prop `repository` solo se lee en el primer render; está documentado como
inyección para pruebas, así que es aceptable, pero conviene que el tipo o el comentario lo digan.

## Observaciones no bloqueantes

- **O1** — `docs/PRODUCT.md`: además de las siete decisiones (correctas y exactas), se editó la
  lista de "Decisiones todavía NO tomadas": se reformuló "base de datos y persistencia (Supabase
  incluida)" como "base de datos remota y persistencia en la nube (Supabase incluida)", cambio
  necesario y coherente, y se añadieron dos entradas nuevas ("cuentas de usuario y colaboración",
  "editar o eliminar mazos y flashcards"). No son decisiones de producto —son reflejo del
  `out_of_scope` del contrato— pero son ediciones que nadie pidió.
- **O2** — `progress/current.md` eliminó la sección "Pendientes registrados". Está justificado
  porque el archivo debe representar exactamente la sesión activa (CHECKPOINTS C1), pero con ella se
  fueron apuntes vivos ajenos a TASK-004 que conviene no perder: la divergencia `allowed_paths`
  task/contract de **TASK-001** destinada a un planner futuro, "Playwright en máquina nueva
  (`npm run e2e:install`)" y "sin iconos propios".
- **O3** — La escritura es fire-and-forget (`persist` no encadena las llamadas). Dos acciones muy
  seguidas podrían resolverse fuera de orden. Con los tamaños actuales el riesgo es teórico y la
  evidencia lo declara en Riesgos.
- **O4** — La evidencia del implementer es de calidad alta: los conteos, las salidas y la
  demostración del fallo al reintroducir el bug se reproducen literalmente. La sección "No
  verificado" es honesta (nativo iOS/Android sin comprobar, cuota de almacenamiento, concurrencia
  entre pestañas).
- **O5** — El e2e `alternar entre destinos de primer nivel tampoco acumula` sigue pasando con el bug
  de navegación reintroducido: alternar entre dos rutas de primer nivel a profundidad 1 no acumula
  ni con `replace` a secas. No es un problema —los otros dos tests sí discriminan— pero por sí solo
  no protege de nada.

## Confirmación de rol

Reviewer **read-only**. No he editado, creado ni borrado ningún archivo de código, test,
documentación o configuración. El único archivo escrito es este,
`progress/evidence/TASK-004-review.md`. No he tocado `.harness/tasks/TASK-004.json` ni
`progress/current.md`.

Para las verificaciones empíricas que exigía el encargo mutilé temporalmente tres archivos
(`src/components/layout/AppShell.tsx`, `src/lib/storage/asyncStorageRepository.ts`,
`src/lib/storage/memoryRepository.ts`) y los restauré desde copia previa: su SHA-256 coincide con el
de partida y `git status` es idéntico al inicial. La sonda de F1 se escribió y ejecutó **fuera del
repositorio**, en el directorio temporal de la sesión, sin añadir ningún archivo al proyecto. Los
registros de las ejecuciones se dejaron en `/tmp`, fuera del repositorio, para no alterar
`check_scope.py`.

`./init.sh` final tras restaurar: **exit code 0**, con 89 unit, 49 integration y 63 passed + 3
skipped en e2e.

## Qué hace falta para APPROVED

1. Corregir **F1** y cubrirlo con un test que incluya al menos un intento rechazado antes de
   rehidratar (bloqueante).
2. Resolver **F2**: ejercitar `createAsyncStorageRepository` desde la suite de contrato, incluida su
   rama de error de lectura.
3. Decidir explícitamente **F3** y dejarlo cubierto por un test.
4. F4, F5 y F6 son de limpieza; que se traten con F1 o se registren.

---

## Revisión #2 — 2026-08-18

- Task: TASK-004 — Persistencia local, unicidad de mazos y estabilización de navegación
- Agente: reviewer (READ ONLY sobre código y configuración)
- Objeto: verificar el cierre de F1-F6 y buscar defectos introducidos por la ronda de correcciones
- Base de Git: `06622c2` (sin commits nuevos; el candidato sigue en el working tree)

### VEREDICTO

**CHANGES_REQUIRED**

Los seis hallazgos del review #1 están cerrados. F1, el bloqueante, lo he verificado ejecutando la
mutación exacta y comprobando que los tests nuevos fallan de verdad y que mi escenario original ya
no se reproduce. F2 también: romper `save()` de la implementación persistente ya no deja verde
`npm test`.

Lo que impide aprobar es que la ronda de correcciones **ha dejado sin cobertura las dos ramas de
error de almacenamiento**, y una de ellas por un efecto colateral de la propia corrección de F3:

- **G1 (MEDIO, nuevo en esta ronda)**: el test de integración *"un fallo de escritura no rompe la
  aplicación"* ya no ejercita ningún fallo de escritura. La suspensión de escrituras que introduce
  F3 hace que `save()` no llegue a invocarse nunca en ese test. Demostrado: **0 invocaciones**.
- **G2 (BAJO, residual de F2)**: la rama `catch` de `load()` de `createAsyncStorageRepository` sigue
  sin cubrir. Era el punto 2 explícito de "Qué hace falta para APPROVED" del review #1.

Ninguno es un defecto de comportamiento: el código de producción es correcto en los dos casos. Son
huecos de verificación, exactamente la clase de problema que motivó F2, y ambos se cierran con un
test pequeño cada uno. Todo lo demás está aprobado.

### Estado de los seis hallazgos

| # | Hallazgo | Estado | Cómo lo he comprobado |
|---|---|---|---|
| F1 | Ids reemitidos tras rehidratar | **CERRADO** | Mutación M1 ejecutada: 3 tests fallan; mi escenario original se reproduce literalmente |
| F2 | La implementación persistente sin cubrir | **CERRADO** (con residual G2) | Mutación M2 ejecutada y verificada en disco: `npm test` 3 failed / 94 passed |
| F3 | Sobrescritura tras error de lectura | **CERRADO** (con efecto colateral G1) | Lectura del código, mensaje y test; coherente |
| F4 | Tipo `StackRouter` muerto | **CERRADO** | `grep -rn "StackRouter" src app tests` -> sin coincidencias |
| F5 | Dobles de prueba en el bundle | **CERRADO** | El barrel ya no los reexporta; ningún archivo de producción los alcanza |
| F6 | Repositorio construido en cada render | **CERRADO** | Lectura del código: se construye una sola vez, la prop se respeta, la identidad no cambia |

#### F1 — cerrado y verificado ejecutando

`nextCounterFrom` deduce el contador del **mayor sufijo ya emitido** en mazos y cartas
(`src/lib/LibraryProvider.tsx:63-73`), no del recuento. Es correcto: los huecos que dejan los
intentos rechazados son inofensivos, y un id restaurado nunca se reemite. El regex `/-(\d+)$/` sobre
un id sin sufijo numérico devuelve 0, que tampoco puede colisionar con los generados.

Mutación **M1**, revirtiendo la línea 101 a `result.library.decks.length + result.library.cards.length`
(verificada en disco antes de ejecutar):

```text
$ npm run test:integration
  ● Identificadores tras intentos fallidos y rehidratación › no reemite identificadores aunque haya habido intentos rechazados
  ● Identificadores tras intentos fallidos y rehidratación › abrir un mazo tras rehidratar muestra ese mazo y no otro
  ● Identificadores tras intentos fallidos y rehidratación › las cartas nuevas no reusan el id de una carta restaurada
Tests:       3 failed, 50 passed, 53 total
```

**Los tests no son vacuos.** Y el segundo reproduce mi escenario original palabra por palabra:

```text
console.error
  Encountered two children with the same key, `mazo-2`.
● abrir un mazo tras rehidratar muestra ese mazo y no otro
  Found multiple elements with testID: deck-mazo-2
```

Es el mismo `mazo-2` duplicado que produje con la sonda del review #1. Con la corrección restaurada
el escenario ya no se reproduce: los tres pasan y `npm run test:integration` da 53/53.

#### F2 — cerrado; el arnés ya detecta la rotura de la implementación real

`tests/unit/storage-serialization.test.ts:144-199` añade una suite de contrato con `describe.each`
que corre cuatro casos contra memoria y contra AsyncStorage.

Rompí `save()` de `src/lib/storage/asyncStorageRepository.ts` **verificando el contenido del archivo
después de editarlo** (leí las líneas 20-38 y comprobé el SHA-256 del archivo mutado,
`947a0031…6059`, distinto del original). El cambio se aplicó:

```text
$ npm test
  ● contrato de LibraryRepository: AsyncStorage › lo guardado se recupera exactamente igual
  ● contrato de LibraryRepository: AsyncStorage › guardar dos veces conserva lo último, sin mezclar
  ● contrato de LibraryRepository: AsyncStorage › conserva la pertenencia de cada carta a su mazo
Tests:       3 failed, 94 passed, 97 total

$ npm run test:integration
Tests:       53 passed, 53 total
```

Coincide exactamente con lo que declara la evidencia del implementer. Que integración siga verde es
correcto y esperado: usa el doble en memoria por diseño, y el contrato exige la cobertura en la capa
unitaria, que es donde ahora está. No puedo confirmar qué ocurrió en mi primer intento del review #1;
lo que importa es el estado actual, y el estado actual detecta la rotura.

Queda el residual **G2**, más abajo.

#### F3 — cerrado y coherente

La corrección es consistente en las tres piezas:

- `src/lib/LibraryProvider.tsx:89, 103-105, 124-126`: `writesSuspended` se activa **solo** con
  `ilegible` y `persist()` sale antes de escribir. Es un `ref`, así que dura toda la sesión.
- El mensaje lo dice explícitamente (`src/lib/storage/types.ts:28`): *"No se han podido leer tus
  datos guardados. Para no sobrescribirlos, en esta sesión no se guardará nada nuevo."* La persona
  usuaria sabe que lo que cree no se guardará; no es un guardado silenciosamente perdido.
- Hay test: `tests/integration/persistence.test.tsx:379-394` monta un repositorio que falla al leer
  pero comparte el `save` de uno con contenido, crea un mazo y comprueba con `peek()` que el
  contenido previo sigue **intacto**.

El trato distinto de `contenido-invalido` **está justificado**: ahí el medio sí se leyó, y lo leído
es inservible (JSON roto, versión desconocida o forma inválida). Sigue sin borrarse al arrancar
(`tests/integration/persistence.test.tsx:396-405`), solo se sustituye cuando la persona usuaria
guarda algo. Coincide con `technical_decisions[3]` del contrato y está declarado en Riesgos.

Observación **O6**, sin exigir cambio: el caso "versión desconocida" cae en `contenido-invalido`, así
que un documento escrito por una versión futura sí acabaría sobrescrito. Es la consecuencia aceptada
de `version: 1` sin migraciones, ya declarada en Riesgos y fuera de scope.

#### F4, F5, F6 — cerrados

```text
$ grep -rn "StackRouter" src app tests
(sin coincidencias)

$ grep -rn "createMemoryRepository|createFailingRepository" src app tests
src/lib/storage/memoryRepository.ts  (definición)
tests/unit/storage-serialization.test.ts, tests/integration/persistence.test.tsx  (solo tests,
importando de '../../src/lib/storage/memoryRepository' directamente)
```

`src/lib/storage/index.ts` exporta ahora solo `createAsyncStorageRepository`, `STORAGE_KEY`, la
serialización y los tipos. Ningún archivo de producción alcanza los dobles.

F6 está bien resuelto y **no introduce los problemas que pedí comprobar**:

```ts
const repositoryRef = useRef<LibraryRepository | null>(repository ?? null);
if (repositoryRef.current === null) {
  repositoryRef.current = createAsyncStorageRepository();
}
```

- El repositorio inyectado por props **no se ignora**: inicializa el `ref` en el primer render, y en
  ese caso `createAsyncStorageRepository()` no llega a llamarse nunca.
- La identidad **no cambia entre renders**: la asignación solo ocurre mientras el `ref` es `null`.
- Se construye una sola vez, no uno desechable por render.

### Hallazgos nuevos

#### G1 — MEDIO (nuevo en esta ronda). La corrección de F3 ha dejado inerte el test de fallo de escritura

**Dónde**: `tests/integration/persistence.test.tsx:367-375` y `src/lib/LibraryProvider.tsx:127-129`.

`createFailingRepository()` falla al leer con `reason: 'ilegible'`. Desde F3, eso suspende las
escrituras de la sesión, así que en el test *"un fallo de escritura no rompe la aplicación"*
`persist()` retorna antes de llamar a `save()`: **el fallo de escritura no llega a producirse**.

Comprobado instrumentando temporalmente `createFailingRepository.save` para que registre cada
invocación (mutación M4):

```text
invocaciones de save del repositorio que falla, en npm run test:integration : 0
invocaciones en npm test                                                    : 1
```

Esa única invocación es la del propio doble en
`tests/unit/storage-serialization.test.ts:134` (`rejects.toThrow()`), que prueba el doble, no cómo
reacciona la aplicación.

Consecuencias concretas:

1. El test es hoy un **duplicado exacto** del anterior (`:358-365`): los dos montan el mismo
   repositorio, ven el mismo error de lectura y comprueban lo mismo. Su nombre afirma algo que no
   verifica. Es la definición de test vacuo que esta revisión lleva dos rondas persiguiendo.
2. La rama de manejo de error de escritura del proveedor
   —`save(next).catch(() => setStorageError('No se han podido guardar los últimos cambios en este
   dispositivo.'))`— **no la ejercita ningún test de ninguna capa**. El mensaje no aparece en ningún
   archivo de test:

```text
$ grep -rn "No se han podido guardar" .   (excluyendo node_modules y .git)
src/lib/LibraryProvider.tsx:128     <- única aparición en todo el repositorio
```

   El E2E tampoco puede cubrirlo: usa `localStorage` real y no simula un fallo de escritura.

Esta rama sí es alcanzable en producción: un repositorio que lee bien y falla al escribir (cuota de
`localStorage` llena, por ejemplo) es justo el caso que la acceptance 22 nombra. La fila de la
`verification_matrix` para esa acceptance pide expresamente *"npm test con un repositorio que lanza
al leer **y al escribir**; npm run test:integration"*, y la evidencia esperada es *"La aplicación no
falla, muestra un mensaje de error controlado"*. Ese mensaje de error controlado no lo observa nadie.

La evidencia del implementer (fila 22 de la tabla acceptance -> evidencia) sigue afirmando *"Tres
tests con repositorio que falla…"*: uno de esos tres ya no prueba lo que su nombre dice.

**Lo que hace falta**: un repositorio de prueba que **cargue bien y falle al guardar**, y un test que
compruebe que la aplicación no se rompe y que el aviso de escritura fallida es visible. No propongo
la forma concreta. Conviene también revisar el nombre del test actual para que no afirme lo que no
hace.

#### G2 — BAJO (residual de F2). La rama de error de lectura de la implementación real sigue sin cubrir

**Dónde**: `src/lib/storage/asyncStorageRepository.ts:25-28`.

Mutación M3: sustituí el `catch` que devuelve `{ status: 'error', reason: 'ilegible' }` por un
`{ status: 'ok', library: { decks: [], cards: [] } }`.

```text
$ npm test
Tests:       97 passed, 97 total     <- verde con la rama de error destruida
```

La suite de contrato solo llama a `createAsyncStorageRepository()` sin argumentos, así que
`getItem` nunca lanza. Cerrarlo es barato: la función ya acepta el medio por parámetro
(`storage: Pick<typeof AsyncStorage, 'getItem' | 'setItem'> = AsyncStorage`), así que basta pasarle
uno que lance. Era el punto 2 de "Qué hace falta para APPROVED" del review #1, textualmente
*"incluida su rama de error de lectura"*, y no se ha hecho.

### Lo que NO se ha roto en esta ronda

Revisado con cuidado por el precedente de TASK-003. Salvo G1, no encuentro nada más:

- **Scope sin ampliar**: los archivos tocados son **exactamente los mismos** que en el review #1
  (15 tracked modificados, y como untracked la capa `src/lib/storage/`, `tests/setup/`, dos tests
  unitarios, uno de integración y uno e2e). Ni un archivo nuevo, ni uno fuera de `allowed_paths`.
  `check_scope.py` confirma `SCOPE: OK (TASK-004)`.
- **Acceptance intactas**: comprobado programáticamente sobre los dos JSON.

```text
acceptance task n = 51 | contract n = 51 | idénticos: True
allowed_paths idénticos: True | n = 13
required_docs idénticos: True | out_of_scope idénticos: True
verification_matrix: 51 filas, cubre cada acceptance en orden: True
status = REVIEWING | open_questions = []
```

- **Ningún test debilitado ni eliminado**: los conteos solo suben —unit 89 -> **97**, integration
  49 -> **53**, e2e **63 + 3 skipped** sin cambios—, `git diff HEAD --name-status -- tests/` sigue
  devolviendo solo dos `M`, y los archivos que ya existían conservan sus casos
  (`library.test.ts` 14 `it()`, `deck-name-uniqueness.test.ts` 12, `navigation.test.tsx` 7). Los +4
  de integración son los tres de F1 más el de F3; los +8 de unit, la suite de contrato de F2.
  La salvedad es G1: ningún test se ha *editado* para debilitarlo, pero uno ha quedado inerte.
- **Apariencia de TASK-003 conservada**: `git diff HEAD --stat -- src/theme/ src/components/ui/
  docs/DESIGN.md` sigue **vacío**. Los e2e de overflow horizontal y de objetivos táctiles pasan en
  los tres proyectos.
- **Sin decisiones de producto nuevas**: el diff de `docs/PRODUCT.md` es idéntico al del review #1,
  las mismas siete decisiones confirmadas. Nada del `out_of_scope`.
- **Sin higiene rota**: `grep -rnE '\bany\b|TODO|FIXME|console\.log' app/ src/` sin coincidencias.
  Las mutaciones de esta revisión están todas restauradas.
- **Correcciones de F1 y F6 sin efectos secundarios**: el contador compartido entre mazos y cartas es
  coherente con el `generateId` único; la prop `repository` se sigue respetando.

### Verificaciones ejecutadas

| # | Comando / mutación | Resultado |
|---|---|---|
| W1 | `./init.sh` (salida a `/tmp`, fuera del repo) | **exit 0**, todos los gates en `[OK]`, `SCOPE: OK (TASK-004)`, `EVIDENCE: OK` |
| W2 | `npm test` | 11 suites, **97 passed / 97** |
| W3 | `npm run test:integration` | 6 suites, **53 passed / 53** |
| W4 | `npm run test:e2e` | **63 passed, 3 skipped** |
| W5 | Comparación programática task vs contrato | acceptance 51 idénticas, `allowed_paths` idénticos (13), matriz 51 filas en orden |
| W6 | **M1**: `nextCounterFrom` -> `decks.length + cards.length` | integración **3 failed / 50 passed / 53**; reproduce `deck-mazo-2` duplicado |
| W7 | **M2**: `save()` de `asyncStorageRepository` anulado (aplicación verificada en disco) | `npm test` **3 failed / 94 passed / 97**; integración 53/53 |
| W8 | **M3**: rama `catch` de `load()` de `asyncStorageRepository` alterada | `npm test` **97/97 verde** -> rama sin cubrir (G2) |
| W9 | **M4**: sonda en `createFailingRepository.save` | **0 invocaciones** en integración, 1 en unit (G1) |
| W10 | Restauración y verificación de SHA-256 | los tres archivos coinciden con el original |

Conteos de la evidencia del implementer (97 unit, 53 integration, 63 + 3 skipped e2e): **exactos**.
Las tres demostraciones que declara (F1 con 3 failed / 50 passed, F2 con 3 failed / 94 passed,
restauración a verde) se reproducen literalmente.

```text
b073879e…96f8  src/lib/LibraryProvider.tsx
7dca5ad4…8cfc  src/lib/storage/asyncStorageRepository.ts
2a53ba12…c572  src/lib/storage/memoryRepository.ts
-> hashes idénticos a los previos; `git status --porcelain` byte a byte igual al de partida.
```

### Confirmación de rol

Reviewer **read-only**. No he editado, creado ni borrado ningún archivo de código, test,
documentación o configuración. El único archivo escrito es este, y solo **añadiendo** esta sección al
final: no he modificado nada del contenido previo. No he tocado `.harness/tasks/TASK-004.json`,
`.harness/contracts/TASK-004.json` ni `progress/current.md`.

Para las cuatro mutaciones (M1-M4) modifiqué temporalmente
`src/lib/LibraryProvider.tsx`, `src/lib/storage/asyncStorageRepository.ts` y
`src/lib/storage/memoryRepository.ts`, y los restauré desde copia previa guardada fuera del
repositorio: sus SHA-256 coinciden con los de partida y `git status` es idéntico al inicial. La
salida de `./init.sh` se escribió en `/tmp`, fuera del repositorio, para no alterar `check_scope.py`.

### Qué hace falta para APPROVED

1. **G1**: un repositorio de prueba que cargue bien y falle al guardar, y un test que compruebe el
   manejo del error de escritura desde la aplicación. Revisar de paso el nombre del test que ha
   quedado inerte.
2. **G2**: ejercitar la rama de error de lectura de `createAsyncStorageRepository` pasándole un medio
   que lance.
3. Ajustar la fila 22 de la tabla acceptance -> evidencia de
   `progress/evidence/TASK-004-implementation.md`, que hoy cuenta como cobertura un test que no
   ejercita lo que su nombre afirma.

Nada más. F1 a F6 quedan cerrados y no hace falta volver sobre ellos.

---

## Revisión #3 — 2026-08-18

- Task: TASK-004 — Persistencia local, unicidad de mazos y estabilización de navegación
- Agente: reviewer (READ ONLY sobre código y configuración)
- Objeto: verificar el cierre de **G1** y **G2** y buscar defectos introducidos por esta tercera ronda
- Base de Git: `06622c2` (sin commits nuevos; el candidato sigue en el working tree)

### VEREDICTO

**APPROVED**

G1 y G2 están cerrados, y lo he comprobado **ejecutando las mutaciones exactas que pedía el encargo**,
no leyendo el código:

- **G1**: existe `createWriteFailingRepository`, que lee bien y falla solo al guardar. Anulando el
  `setStorageError` de la rama `save().catch(...)` en `src/lib/LibraryProvider.tsx`, **dos tests de
  integración fallan de verdad**. La rama está cubierta y el aviso al usuario se afirma.
- **G2**: alterando la rama `catch` de `load()` de `createAsyncStorageRepository`, **falla un test
  unitario**. La rama ya no es invisible para la suite.

Ningún test queda inerte ni duplicado en `Errores de almacenamiento`: los cinco verifican cosas
distintas y alcanzables. Los seis hallazgos del review #1 siguen cerrados —he vuelto a ejecutar las
mutaciones de F1 y de la navegación para confirmarlo— y esta ronda no ha ampliado el scope, no ha
tocado las acceptance, no ha debilitado ningún test y no ha introducido decisiones de producto.

Las tres observaciones que quedan (O7, O8, O9) **no exigen modificar código ni tests** y se listan
aparte para no prolongar el ciclo.

### G1 — CERRADO. La rama de error de escritura está cubierta y el aviso se afirma

El doble nuevo es `createWriteFailingRepository` (`src/lib/storage/memoryRepository.ts:52-61`):
`load()` devuelve `{ status: 'empty' }` y `save()` rechaza. Es la única forma de llegar a la rama,
porque un doble que además falle al leer suspende las escrituras desde la corrección de F3. El propio
archivo lo documenta, y el test lo repite en un comentario
(`tests/integration/persistence.test.tsx:368-370`).

Lo usan dos tests, y el primero afirma el aviso literal:

```ts
expect(await screen.findByTestId('storage-error')).toBeTruthy();
expect(
  screen.getByText('No se han podido guardar los últimos cambios en este dispositivo.'),
).toBeTruthy();
```

**Mutación N1** — anulado el `setStorageError` de la rama `save().catch(...)` de
`src/lib/LibraryProvider.tsx:127-129`, dejando el `catch` vacío:

```text
$ npm run test:integration
  ● Errores de almacenamiento › un fallo de escritura no rompe la aplicación y se avisa
  ● Errores de almacenamiento › tras un fallo de escritura se puede seguir usando la aplicación
Tests:       2 failed, 52 passed, 54 total
```

Coincide exactamente con lo que declara la evidencia del implementer. **Los tests no son vacuos.**

**Mutación N4** — sonda de invocaciones instalada en el `save()` de los dos dobles que fallan:

```text
save de createWriteFailingRepository, en npm run test:integration : invocado (3 veces)
save de createFailingRepository,      en npm run test:integration : 0 invocaciones
save de createFailingRepository,      en npm test                 : 1 (su propio rejects.toThrow)
```

Es decir: la rama de escritura la ejercita ahora un doble que sí llega a `save()`. Que
`createFailingRepository` siga sin llegar a `save()` en integración es **correcto y esperado**: con
lectura fallida las escrituras están suspendidas por diseño (F3), y ese doble ya no es el que cubre la
escritura.

Restaurado y verificado: `npm run test:integration` vuelve a 54/54.

### G2 — CERRADO. La rama `catch` de `load()` real ya la detecta la suite

`tests/unit/storage-serialization.test.ts:206-252` añade `asyncStorageRepository: fallos del medio`,
tres tests que **inyectan el medio por parámetro** en `createAsyncStorageRepository`, que es justo lo
que el review #2 señaló que faltaba.

**Mutación N2** — la rama `catch` de `src/lib/storage/asyncStorageRepository.ts:25-28` sustituida por
`return { status: 'ok', library: { decks: [], cards: [] } }`:

```text
$ npm test
  ● asyncStorageRepository: fallos del medio › informa de un medio ilegible en lugar de lanzar
Tests:       1 failed, 99 passed, 100 total
```

Reproduce literalmente la salida que declara la evidencia. Antes, esta misma mutación dejaba la suite
en **97/97 verde** (W8 del review #2): el hueco está cerrado.

**Mutación N3**, por mi cuenta, para comprobar que los otros dos tests nuevos tampoco son vacuos —
`save()` de la implementación real envuelto en un `try/catch` que traga el error:

```text
$ npm test
  ● asyncStorageRepository: fallos del medio › propaga el fallo al guardar, para que el proveedor pueda avisar
Tests:       1 failed, 99 passed, 100 total
```

También discrimina. El tercero (*escribe bajo la clave versionada esperada*) verifica que hay
exactamente una escritura y que el contenido escrito se vuelve a parsear como la biblioteca original;
sobre él, ver la observación O9.

### ¿Queda algún test inerte o duplicado?

**No.** El bloque `Errores de almacenamiento` tiene ahora cinco tests y cada uno verifica algo
distinto y alcanzable. Lo he comprobado ejecutando, no leyendo:

| Test | Qué verifica que no verifica ningún otro | Comprobado |
|---|---|---|
| `un fallo de lectura no rompe la aplicación y se comunica` | Se avisa del error de lectura y la app sigue usable | Distinto del resto; único que usa `createFailingRepository` |
| `un fallo de escritura no rompe la aplicación y se avisa` | El aviso **de escritura** es visible | Falla con N1 |
| `tras un fallo de escritura se puede seguir usando la aplicación` | Se puede abrir el mazo y añadir cartas después del fallo | Falla con N1; su aserción propia (`to overlook`) es adicional |
| `si no se pudo leer, no se sobrescribe con la biblioteca vacía` | El medio conserva su contenido byte a byte (`peek()`) | Cubre F3, no la rama de escritura |
| `un contenido guardado inválido no se borra al arrancar` | Arrancar no destruye contenido inválido | Único con `contenido-invalido` |

El duplicado exacto que denunció G1 ha desaparecido: el test que antes repetía al anterior ahora monta
un repositorio distinto, con un resultado de carga distinto, y afirma un mensaje distinto.

### Los seis hallazgos del review #1 siguen cerrados

Reejecutadas las dos mutaciones que importan, más los greps:

```text
N6 — nextCounterFrom -> decks.length + cards.length   (revierte F1)
$ npm run test:integration
  ● Identificadores tras intentos fallidos y rehidratación › no reemite identificadores aunque haya habido intentos rechazados
  ● Identificadores tras intentos fallidos y rehidratación › abrir un mazo tras rehidratar muestra ese mazo y no otro
  ● Identificadores tras intentos fallidos y rehidratación › las cartas nuevas no reusan el id de una carta restaurada
Tests:       3 failed, 51 passed, 54 total

N5 — router.replace(href) a secas en AppShell.tsx:35  (revierte la corrección de navegación)
$ npm run test:integration
  ● Navegación base › repetir 15 ciclos detalle -> destino de primer nivel no acumula stack
Tests:       1 failed, 53 passed, 54 total
```

| # | Hallazgo | Estado | Comprobación de esta ronda |
|---|---|---|---|
| F1 | Ids reemitidos tras rehidratar | **CERRADO** | Mutación N6: 3 tests fallan |
| F2 | Implementación persistente sin cubrir | **CERRADO** | Suite de contrato `describe.each` intacta (26 runs); N2 y N3 la hacen fallar |
| F3 | Sobrescritura tras error de lectura | **CERRADO** | `writesSuspended` intacto; su test sigue afirmando `peek()` byte a byte |
| F4 | Tipo `StackRouter` muerto | **CERRADO** | `grep -rn "StackRouter" src app tests` -> sin coincidencias |
| F5 | Dobles de prueba en el bundle | **CERRADO** | El barrel exporta solo repositorio real, serialización y tipos; ningún archivo de `src/` ni `app/` alcanza los dobles (incluido el nuevo `createWriteFailingRepository`) |
| F6 | Repositorio construido en cada render | **CERRADO** | `useRef` + asignación condicional intactos; la prop `repository` se respeta |

Importante para F5: el doble **nuevo** de esta ronda tampoco se filtra. Comprobado:

```text
$ grep -rn "createMemoryRepository\|createFailingRepository\|createWriteFailingRepository" src/ app/
(solo la definición en src/lib/storage/memoryRepository.ts)
```

### Lo que NO se ha roto en esta ronda

- **Scope sin ampliar**: `git status --porcelain` es **byte a byte idéntico** al del review #2. Ni un
  archivo nuevo. `check_scope.py` confirma `SCOPE: OK (TASK-004)`. Los cambios de esta ronda caben en
  tres archivos ya tocados: `src/lib/storage/memoryRepository.ts` (doble nuevo),
  `tests/integration/persistence.test.tsx` y `tests/unit/storage-serialization.test.ts`.
- **Acceptance y allowed_paths intactos**, comprobado programáticamente sobre los dos JSON:

```text
acceptance task n = 51 | contract n = 51 | idénticos: True
allowed_paths idénticos: True | n = 13
required_docs idénticos: True | out_of_scope idénticos: True
verification_matrix: 51 filas, cubre cada acceptance en orden: True
status = REVIEWING | open_questions = [] | technical_decisions = 6
```

- **Ningún test debilitado ni eliminado**: los conteos vuelven a subir —unit 97 -> **100**,
  integration 53 -> **54**, e2e **63 + 3 skipped** sin cambios—, `git diff HEAD --name-status -- tests/`
  sigue devolviendo solo dos `M`, y los archivos heredados conservan sus casos
  (`library.test.ts` 14 `it()`, `deck-name-uniqueness.test.ts` 12, `navigation.test.tsx` 7). Los +3 de
  unit son los tres de G2; el +1 de integración es el segundo test de G1. El test que estaba inerte no
  se borró: se **reescribió para que verifique lo que su nombre dice**, conservando además su aserción
  original de que la app no se rompe.
- **Acceptance 22 y su fila de la matriz, ahora satisfechas de verdad**: la matriz pedía
  *"npm test con un repositorio que lanza al leer **y al escribir**"*. Los dos casos existen ya en la
  capa unitaria (`getItem` que lanza, `setItem` que lanza), y la integración observa el mensaje de
  error controlado. Era lo que faltaba.
- **Apariencia de TASK-003 conservada**: `git diff HEAD --stat -- src/theme/ src/components/ui/
  docs/DESIGN.md` sigue **vacío**. Los e2e de overflow horizontal y objetivos táctiles pasan en los
  tres proyectos.
- **Sin decisiones de producto nuevas**: el diff de `docs/PRODUCT.md` es **idéntico** al del review #1
  y #2: las mismas siete decisiones confirmadas. Nada del `out_of_scope`.
- **Configuración sin debilitar**: `jest.config.js` solo registra los dos setup de almacenamiento;
  `eslint.config.js` solo añade globals de Jest para `tests/setup/**`, sin desactivar reglas;
  `playwright.config.ts` sin cambios.
- **Higiene**: sin `any`, `TODO`, `FIXME` ni `console.log` en `app/` ni `src/`; sin colores fuera de
  `src/theme/`; sin términos fuera de scope; AsyncStorage solo en `src/lib/storage/` y en los dos
  archivos de infraestructura de Jest.

### Verificaciones ejecutadas

| # | Comando / mutación | Resultado |
|---|---|---|
| X1 | `./init.sh` inicial (salida a `/tmp`, fuera del repo) | **exit 0**; todos los gates en `[OK]`, `SCOPE: OK (TASK-004)`, `EVIDENCE: OK` |
| X2 | `npm test` | 11 suites, **100 passed / 100** |
| X3 | `npm run test:integration` | 6 suites, **54 passed / 54** |
| X4 | `npm run test:e2e` | **63 passed, 3 skipped** |
| X5 | **N1**: `setStorageError` de `save().catch(...)` anulado | integración **2 failed / 52 passed / 54** -> G1 cerrado |
| X6 | **N2**: rama `catch` de `load()` de `asyncStorageRepository` alterada | unit **1 failed / 99 passed / 100** -> G2 cerrado |
| X7 | **N3**: `save()` de `asyncStorageRepository` traga el error | unit **1 failed / 99 passed / 100** |
| X8 | **N4**: sonda de invocaciones en los dobles que fallan | write-failing invocado 3 veces en integración; failing 0 en integración, 1 en unit |
| X9 | **N5**: `router.replace(href)` a secas en `AppShell.tsx:35` | integración **1 failed / 53 passed / 54** |
| X10 | **N6**: `nextCounterFrom` -> recuento de entidades | integración **3 failed / 51 passed / 54** |
| X11 | Comparación programática task vs contrato | 51 acceptance idénticas, `allowed_paths` idénticos (13), matriz de 51 filas en orden |
| X12 | Restauración + SHA-256 + `git status --porcelain` | los cuatro archivos coinciden con el original; git status idéntico |
| X13 | `./init.sh` final | **exit 0**; 100 unit, 54 integration, 63 passed + 3 skipped |

Los conteos que afirma la evidencia del implementer (**100 unit, 54 integration, 63 + 3 skipped e2e**)
son **exactos**, y las dos demostraciones que declara para G1 (`2 failed, 52 passed, 54 total`) y G2
(`1 failed, 99 passed, 100 total`) se reproducen literalmente.

### Observaciones no bloqueantes

- **O7** — La fila 22 de la tabla *acceptance -> evidencia* de
  `progress/evidence/TASK-004-implementation.md` sigue diciendo *"Tres tests con repositorio que
  falla…"* cuando el bloque tiene ahora cinco, y la fila 42 sigue diciendo *"16 tests"* cuando
  `storage-serialization.test.ts` ejecuta 26. Era el punto 3 de "Qué hace falta para APPROVED" del
  review #2, pero su **motivo real ha desaparecido**: la fila ya no cuenta como cobertura un test que
  no ejercita lo que su nombre dice, y la corrección de G1 está documentada en detalle, con su salida,
  en la sección "Corrección de los hallazgos del review #2" del mismo archivo. Es un desajuste de
  recuento en una tabla resumen, no un hueco de evidencia: no lo convierto en bloqueante.
- **O8** — `progress/current.md` se ha quedado atrás: su plan corto sigue marcando
  *"13. Review #2 independiente — **pendiente**"* y no refleja las dos rondas de corrección
  posteriores. No exige tocar código, y es el archivo que el cierre actualiza de todos modos, pero
  **debe quedar exacto antes de declarar DONE** (CHECKPOINTS C1 y C6).
- **O9** — En `tests/unit/storage-serialization.test.ts:246`, la aserción
  `expect(escrituras[0]?.clave).toBe(STORAGE_KEY)` compara la constante consigo misma: el test y la
  implementación importan `STORAGE_KEY` del mismo módulo, así que esa aserción concreta no puede
  fallar cambie lo que cambie el valor de la clave. El resto del test **sí** verifica algo real (que
  hay exactamente una escritura y que lo escrito se vuelve a parsear como la biblioteca original), así
  que no es un test vacuo; solo una de sus tres aserciones es tautológica.
- **O6** (del review #2) sigue vigente y aceptada: "versión desconocida" cae en `contenido-invalido`,
  así que un documento escrito por una versión futura acabaría sobrescrito. Consecuencia declarada de
  `version: 1` sin migraciones, ya registrada en Riesgos y fuera de scope.
- **O10** — `createFailingRepository.save` ya no lo alcanza la aplicación en ninguna capa (medido: 0
  invocaciones en integración). Es la consecuencia correcta de F3 y ya no deja nada sin cubrir, porque
  la escritura tiene ahora su propio doble. Lo dejo anotado para que una tarea futura no lo interprete
  como cobertura de escritura.

### Confirmación de rol

Reviewer **read-only**. No he editado, creado ni borrado ningún archivo de código, test,
documentación o configuración. El único archivo escrito es este, y solo **añadiendo** esta sección al
final: no he modificado ni una línea del contenido previo. No he tocado
`.harness/tasks/TASK-004.json`, `.harness/contracts/TASK-004.json` ni `progress/current.md`.

Para las seis mutaciones (N1-N6) modifiqué temporalmente `src/lib/LibraryProvider.tsx`,
`src/lib/storage/asyncStorageRepository.ts`, `src/lib/storage/memoryRepository.ts` y
`src/components/layout/AppShell.tsx`, y los restauré desde copia previa guardada **fuera del
repositorio**. SHA-256 tras restaurar, idénticos a los de partida:

```text
b073879e…96f8  src/lib/LibraryProvider.tsx
7dca5ad4…8cfc  src/lib/storage/asyncStorageRepository.ts
8f6b6fdc…3036  src/lib/storage/memoryRepository.ts
2139de4d…16f0  src/components/layout/AppShell.tsx
-> `git status --porcelain` byte a byte idéntico al de partida.
```

Las salidas de `./init.sh` se escribieron en `/tmp`, fuera del repositorio, para no alterar
`check_scope.py`.

### Qué queda

Nada bloqueante. El candidato puede pasar a QA y cierre.

Al cerrar conviene, sin que ninguna de las tres sea condición de esta aprobación: poner al día
`progress/current.md` (O8), y de paso ajustar los dos recuentos de la tabla de evidencia (O7).
