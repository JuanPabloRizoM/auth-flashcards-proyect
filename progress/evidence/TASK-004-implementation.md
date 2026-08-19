# TASK-004 — Implementation Evidence

## Resumen

- Task: TASK-004 — Persistencia local, unicidad de mazos y estabilización de navegación
- Agente: implementer
- Contrato: `.harness/contracts/TASK-004.json` (51 acceptance, `open_questions: []`)
- Base de Git: `06622c2 chore(TASK-003): cerrar mazos, flashcards y estudio tras review y QA`
- Fecha: 2026-08-18

## Baseline

`./init.sh` ejecutado **antes** de modificar ningún archivo: **exit 0**. Working tree limpio.

```text
[OK] Harness válido
SCOPE: sin tarea de ejecución activa   [OK] Scope válido
[OK] Sin temporales/secretos obvios
[OK] typecheck   [OK] lint   [OK] test   [OK] test:integration   [OK] test:e2e
EVIDENCE: OK     [OK] Evidencia coherente
[OK] Estado verificable
```

## Documentos leídos

`AGENTS.md`, `progress/current.md`, `bash scripts/agent_context.sh`, `docs/PRODUCT.md`,
`.harness/tasks/TASK-004.json`, `.harness/contracts/TASK-004.json`, `docs/ARCHITECTURE.md`,
`docs/CONVENTIONS.md`, `docs/TESTING.md`, `docs/VERIFICATION.md`.

`docs/DATABASE.md` se leyó y **no aplica**: describe el esquema remoto de Supabase con RLS y
migraciones versionadas, que sigue fuera de scope. Esta tarea no crea tablas ni migraciones.

## Coherencia de scope desde el principio

`allowed_paths` y `required_docs` se generaron a la vez para task y contrato, desde una única
definición, para no repetir la divergencia detectada en TASK-001:

```text
task.allowed_paths == contract.allowed_paths  -> True
verification_matrix: 51 filas == 51 acceptance
```

## Solución de persistencia elegida

**`@react-native-async-storage/async-storage` 2.2.0**, instalada con `npx expo install` para que
la versión quede alineada con el SDK.

Por qué:

- **Cubre las tres plataformas declaradas con una sola implementación**: en web se apoya en
  `localStorage`, en iOS y Android en el almacenamiento nativo, exponiendo la misma API. No hacen
  falta adaptadores distintos por plataforma, así que un único repositorio cumple el contrato.
- **Es la opción que Expo instala y soporta**, no una librería de terceros ajena al stack.
- **API mínima** de clave/valor: `getItem` y `setItem`. Nada que no se use.
- **Proporcionada**: una dependencia, sin binarios propios ni configuración nativa adicional.

Alternativas descartadas:

- **`expo-sqlite`**: desproporcionado para un único documento pequeño; obligaría a esquema y
  consultas para algo que es un objeto JSON.
- **`localStorage` directo**: no existe en iOS ni Android, rompería la compatibilidad declarada.
- **Sistema de archivos (`expo-file-system`)**: no existe en web.

## Arquitectura de la solución

```text
pantallas (app/**)
   -> useLibrary()            src/lib/LibraryProvider.tsx
      -> LibraryRepository    src/lib/storage/types.ts        (contrato)
         -> AsyncStorage      src/lib/storage/asyncStorageRepository.ts
         -> memoria           src/lib/storage/memoryRepository.ts   (pruebas)
```

`src/lib/storage/asyncStorageRepository.ts` es **el único archivo del proyecto que importa la
librería**. Verificado:

```text
$ grep -rn "async-storage" app src --include="*.ts" --include="*.tsx" | grep -v "src/lib/storage/"
  sin coincidencias fuera de src/lib/storage
$ grep -rn "lib/storage" app/
  ninguna pantalla importa la capa de almacenamiento
```

Sustituir el almacenamiento (o ponerle un backend remoto, cuando esa decisión exista) solo obliga
a escribir otra implementación del contrato.

### Forma persistida

Un único documento JSON bajo la clave `flashcards:library:v1`:

```json
{ "version": 1,
  "decks": [{ "id": "mazo-1", "name": "Inglés" }],
  "cards": [{ "id": "carta-2", "deckId": "mazo-1", "front": "...", "back": "..." }] }
```

Un solo documento, y no una clave por entidad, para que no puedan quedar cartas huérfanas por una
escritura parcial. **No hay sistema de migraciones**: no existe ninguna versión anterior que
migrar. `version` es el punto por donde entrarían el día que haga falta.

### Comportamiento ante datos ausentes o inválidos

| Situación | Resultado | Qué pasa con lo guardado |
|---|---|---|
| No hay clave | `empty` -> biblioteca vacía | Nada que preservar |
| JSON inválido | `error: contenido-invalido` | **Se deja intacto**, no se sobrescribe al arrancar |
| Versión desconocida | `error: contenido-invalido` | Se deja intacto |
| Forma inválida (mazo o carta sin sus campos) | `error: contenido-invalido` | Se deja intacto |
| El medio falla al leer | `error: ilegible` | Se deja intacto |
| El medio falla al escribir | Se avisa en pantalla | La aplicación sigue usable |

Ningún caso borra datos en silencio: leer nunca escribe. Lo guardado solo se sustituye cuando la
persona usuaria realiza una acción que guarda.

## Unicidad de nombre de mazo

Normalización **exactamente la confirmada** y ninguna otra, en `deckNameKey`:

```ts
name.trim().toLocaleLowerCase()
```

Se declara explícitamente en el código y en los tests que **no** se colapsan los espacios
interiores ni se eliminan los acentos: serían normalizaciones no confirmadas. En TASK-003 llegó a
existir una versión que colapsaba espacios interiores; no se ha reintroducido.

La comprobación vive en `src/features/decks/library.ts`, es decir en la lógica de dominio. El test
`tests/unit/deck-name-uniqueness.test.ts` la ejercita **sin montar ninguna pantalla**, que es lo que
demuestra que no depende de la interfaz.

## Corrección del crecimiento del stack

Causa: `router.replace(href)` sustituye la pantalla de arriba pero deja intactas las de debajo. Al
volver a un destino de primer nivel desde una pantalla apilada, el apilado pasaba de `/`, detalle a
`/`, `/`. Repetido, crecía sin límite: QA midió 16 instancias montadas tras 15 ciclos.

Corrección en `src/lib/navigation.ts`:

```ts
export function goToTopLevel(router, replace) {
  if (router.canDismiss()) {
    router.dismissAll();   // vacía el apilado hasta su raíz
  }
  replace();               // y sustituye esa raíz
}
```

`AppShell` la usa para los destinos de primer nivel. La profundidad se mantiene en 1 por muchas
vueltas que se den. Las pantallas de detalle **siguen apilándose** y volviendo con `back`: el botón
atrás conserva su comportamiento, comprobado en el test *"el detalle sigue apilándose y volviendo de
forma coherente"*.

## Hidratación y estados

`LibraryProvider` arranca en `status: 'loading'` y pasa a `'ready'` cuando el repositorio responde.
Las tres pantallas muestran `Loading` mientras tanto y **no** presentan el estado vacío: un vacío
mostrado antes de saber qué hay guardado sería falso. El detalle del mazo tampoco declara un mazo
inexistente antes de hidratar.

Los identificadores nuevos continúan a partir de los restaurados, para no chocar con los que ya
existían.

## Archivos creados y modificados

| Archivo | Estado | Motivo |
|---|---|---|
| `src/lib/storage/types.ts` | nuevo | Contrato `LibraryRepository` y resultados de carga |
| `src/lib/storage/serialization.ts` | nuevo | Serializar, parsear, versionar y validar la forma |
| `src/lib/storage/asyncStorageRepository.ts` | nuevo | Implementación persistente; único punto que conoce la librería |
| `src/lib/storage/memoryRepository.ts` | nuevo | Implementación en memoria y una que falla, para pruebas |
| `src/lib/storage/index.ts` | nuevo | Barrel de la capa |
| `src/lib/LibraryProvider.tsx` | modificado | Hidratación asíncrona, persistencia y estados de carga/error |
| `src/lib/navigation.ts` | modificado | `goToTopLevel` para destinos de primer nivel |
| `src/components/layout/AppShell.tsx` | modificado | Usa `goToTopLevel` |
| `src/features/decks/library.ts` | modificado | `deckNameKey` y rechazo de duplicados |
| `app/index.tsx` | modificado | Estado de carga, aviso de error de almacenamiento |
| `app/mazo/[id]/index.tsx` | modificado | Estado de carga antes de decidir que el mazo no existe |
| `app/mazo/[id]/estudiar.tsx` | modificado | La sesión se construye cuando los datos ya están |
| `jest.config.js` | modificado | Registra los setup de almacenamiento |
| `eslint.config.js` | modificado | Globals de Jest para los archivos de setup |
| `package.json`, `package-lock.json` | modificados | Una dependencia: AsyncStorage |
| `tests/setup/async-storage.js` | nuevo | Mock oficial de AsyncStorage bajo Jest |
| `tests/setup/reset-storage.js` | nuevo | Limpia el almacenamiento entre tests |
| `tests/unit/deck-name-uniqueness.test.ts` | nuevo | Normalización y unicidad, sin interfaz |
| `tests/unit/storage-serialization.test.ts` | nuevo | Serialización, hidratación y contrato del repositorio |
| `tests/unit/library.test.ts` | modificado | El duplicado pasa de permitido a rechazado |
| `tests/integration/persistence.test.tsx` | nuevo | Persistencia real destruyendo el proveedor |
| `tests/integration/navigation.test.tsx` | modificado | Regresión del crecimiento del stack |
| `tests/e2e/persistence-navigation.spec.ts` | nuevo | Recarga real e instancias en el DOM |
| `docs/PRODUCT.md` | modificado | Las siete decisiones confirmadas |
| `.harness/tasks/TASK-004.json`, `.harness/contracts/TASK-004.json` | nuevos | Task y contrato |
| `progress/current.md`, este archivo | modificado/nuevo | Estado y evidencia |

Todos dentro de `allowed_paths`: `SCOPE: OK (TASK-004)`.

## Prueba real de persistencia

No se comprueba el estado en memoria. `tests/integration/persistence.test.tsx` **desmonta la
aplicación entera** y la vuelve a montar con el mismo repositorio, de modo que el estado de React
desaparece por completo y lo único que puede devolver los datos es el almacenamiento:

```ts
montarApp(repositorio);          // crear el mazo y la carta
screen.unmount();                // se destruye todo el árbol y el proveedor
montarApp(repositorio, '/mazo/mazo-1');
expect(await screen.findByText('to overlook')).toBeTruthy();
```

Además se afirma sobre el medio directamente, leyendo lo escrito con `peek()` y parseándolo, para
comprobar que el mazo está serializado y no solo en memoria.

Y en E2E se hace la prueba definitiva, `page.reload()`: una recarga real del navegador, que destruye
todo el estado de JavaScript.

## Prueba de regresión de navegación

Mide **acumulación**, no qué pantalla se ve. Dos niveles:

- **Integración** (`tests/integration/navigation.test.tsx`): 15 ciclos detalle -> destino de primer
  nivel, comprobando en cada vuelta `router.canGoBack() === false` y `router.canDismiss() === false`.
  Con el comportamiento anterior, tras la primera vuelta ya hay historial acumulado.
- **E2E** (`tests/e2e/persistence-navigation.spec.ts`): los mismos 15 ciclos contando **todas** las
  instancias del DOM, visibles e invisibles, con `.count()`. Es la medida exacta que usó QA para
  encontrar el problema. Además se comprueba que ninguna pantalla invisible conserva un borrador
  escrito antes.

**Demostración de que falla al reintroducir el comportamiento anterior:**

```text
=== A) Con la corrección (goToTopLevel + dismissAll) ===
Tests:       49 passed, 49 total

=== B) Reintroduciendo el bug (router.replace(href) a secas, como en TASK-003) ===
  ● Navegación base › repetir 15 ciclos detalle -> destino de primer nivel no acumula stack
Tests:       1 failed, 48 passed, 49 total

=== C) Restaurando ===
    goToTopLevel(router, () => router.replace(href));
Tests:       49 passed, 49 total
```

## Comandos ejecutados y resultados

```text
$ ./init.sh                       # baseline           -> exit 0
$ npx expo install @react-native-async-storage/async-storage   -> exit 0 (2.2.0)
$ npm run typecheck                                    -> exit 0
$ npm run lint                                         -> exit 0
$ npm test                                             -> exit 0, 97 tests PASS (89 antes del review #1)
$ npm run test:integration                             -> exit 0, 53 tests PASS (49 antes del review #1)
$ npm run test:e2e                                     -> exit 0, 63 passed / 3 skipped
$ ./init.sh                       # final              -> exit 0
```

Los 3 saltados del E2E son las comprobaciones táctiles en `desktop-chrome`, con motivo declarado.

Totales respecto a TASK-003: unit 62 -> **100**, integration 33 -> **54**, e2e 33 -> **63**.
Ningún test eliminado.

### Greps de verificación

```text
$ grep -rn "async-storage" app src --include="*.ts" --include="*.tsx" | grep -v "src/lib/storage/"
  sin coincidencias
$ grep -rn "lib/storage" app/
  ninguna pantalla importa la capa de almacenamiento
$ grep -rniE "supabase|autenticaci|password|google|apple|modo oscuro|estadístic|anki|sincroniz|editar mazo|eliminar mazo" app/ src/
  sin coincidencias
$ grep -rnE '\bany\b|TODO|FIXME|console\.log' app/ src/ tests/
  sin coincidencias
$ grep -rnE "#[0-9A-Fa-f]{3,8}\b|rgba?\(" app/ src/components/ src/lib/ src/features/
  sin coincidencias      (la apariencia de TASK-003 se conserva sin tocar los tokens)
```

## Acceptance -> evidencia

| # | Acceptance | Evidencia | Resultado |
|---|---|---|---|
| 1 | Repositorio persistente | `src/lib/storage/asyncStorageRepository.ts` + tests de contrato sobre ambas implementaciones | PASS |
| 2 | La UI no accede al almacenamiento | greps: cero importaciones fuera de `src/lib/storage/` | PASS |
| 3 | Crear mazo persiste | `persistence.test.tsx` lee el medio con `peek()` y encuentra el mazo | PASS |
| 4 | Crear carta persiste | Igual, con la carta y su `deckId` | PASS |
| 5 | Recargar conserva mazos | Integración desmontando el proveedor + E2E con `page.reload()` | PASS |
| 6 | Recargar conserva cartas | Igual | PASS |
| 7 | Las cartas siguen en su mazo | "las cartas siguen aisladas por mazo después de restaurar" | PASS |
| 8 | Varios mazos independientes | "varios mazos conservan sus datos de forma independiente" + E2E | PASS |
| 9 | Nombre vacío rechazado | `deck-name-uniqueness.test.ts` + `decks-flow.test.tsx` | PASS |
| 10 | Solo espacios rechazado | Igual | PASS |
| 11 | 'Inglés' con 'INGLÉS' existente | `deck-name-uniqueness.test.ts` | PASS |
| 12 | 'Inglés' con ' Inglés ' existente | `deck-name-uniqueness.test.ts` | PASS |
| 13 | La validación no depende de la pantalla | El test invoca `createDeck` sin render | PASS |
| 14 | Mensaje visible y comprensible | Integración y E2E: "Ya tienes un mazo con ese nombre. Elige otro." | PASS |
| 15 | El duplicado no altera lo persistido | Se compara `peek()` antes y después: idéntico | PASS |
| 16 | La segunda carta no borra la primera | "dos cartas seguidas se conservan las dos" | PASS |
| 17 | Restaurar no duplica | "rehidratar dos veces no duplica los datos" + E2E con dos recargas | PASS |
| 18 | Estado vacío inicial | "un almacenamiento vacío lleva al estado vacío, no a un error" | PASS |
| 19 | Almacenamiento vacío manejado | `parseStoredLibrary(null)` -> `empty`, sin error | PASS |
| 20 | Sin falso estado vacío | "muestra el estado de carga antes de decidir que no hay nada" + E2E tras recarga | PASS |
| 21 | Estado de carga | `decks-loading`, `deck-loading`, `study-loading` | PASS |
| 22 | Errores de almacenamiento controlados | Cinco tests: lectura fallida, escritura fallida con aviso, uso posterior, contenido roto no borrado y medio ilegible sin sobrescribir | PASS |
| 23 | Elimina el crecimiento ilimitado | Regresión de integración y E2E | PASS |
| 24 | 15 ciclos sin crecimiento proporcional | Ambos niveles, con el mismo escenario que midió QA | PASS |
| 25 | Solo la profundidad necesaria | `canGoBack`/`canDismiss` en `false` en la raíz, `true` dentro del detalle | PASS |
| 26 | Sin pantallas invisibles con estado | E2E: el borrador escrito no sobrevive y el campo vuelve vacío | PASS |
| 27-32 | Mis mazos, abrir mazo, estudio, volver, sidebar y navegación móvil | Suites heredadas de TASK-003 más el recorrido E2E completo en 3 dispositivos | PASS |
| 33 | Sin rutas rotas | E2E con `consoleErrors` vacío y URLs comprobadas | PASS |
| 34-36 | Flujo completo en los 3 proyectos | 63 tests E2E repartidos en desktop-chrome, mobile-chrome y mobile-safari | PASS |
| 37 | Sin overflow nuevo | Comprobado en todas las rutas y proyectos | PASS |
| 38 | Objetivos táctiles | Medición de `boundingBox` en los proyectos móviles | PASS |
| 39 | Tests anteriores siguen pasando | `./init.sh` con la suite completa | PASS |
| 40 | Unit de normalización y unicidad | `deck-name-uniqueness.test.ts`, 12 tests | PASS |
| 41 | Duplicado rechazado desde la lógica | El mismo, sin montar pantallas | PASS |
| 42 | Serialización e hidratación | `storage-serialization.test.ts`, 26 tests, incluida la suite de contrato sobre ambas implementaciones | PASS |
| 43 | Integración crear mazo -> persistir -> reconstruir | `persistence.test.tsx` | PASS |
| 44 | Integración crear carta -> persistir -> reconstruir | `persistence.test.tsx` | PASS |
| 45 | Aislamiento de cartas tras restaurar | `persistence.test.tsx` | PASS |
| 46 | Regresión real del stack | Integración (historial) + E2E (instancias del DOM) | PASS |
| 47 | Falla al reintroducir el bug | Demostrado más arriba, con las tres salidas | PASS |
| 48 | Sin debilitar tests | Totales al alza en las tres capas; ningún archivo eliminado | PASS |
| 49 | Sin decisiones de producto adicionales | `docs/PRODUCT.md` recoge solo las siete confirmadas | PASS |
| 50 | `./init.sh` exit 0 | Diez gates en `[OK]` | PASS |
| 51 | Evidencia registrada | Este archivo | PASS |

### Test heredado que cambió

| Test | Antes | Ahora |
|---|---|---|
| `tests/unit/library.test.ts` | "permite un nombre repetido, porque nadie ha decidido prohibirlo" | "rechaza un nombre repetido". El usuario tomó la decisión el 2026-08-18; el test anterior afirmaba justo lo contrario de la nueva acceptance. Además se añade el mensaje de duplicado a la comprobación de textos |

Ningún otro test cambió de aserción. Los de TASK-001, TASK-002 y TASK-003 siguen intactos.

## Corrección de los hallazgos del review #1

El review #1 emitió **CHANGES_REQUIRED** con un hallazgo alto y cinco menores. La task volvió a
`IMPLEMENTING` solo para cerrarlos.

### F1 (ALTO) — Identificadores reemitidos: dos mazos podían compartir id

Defecto real de corrupción de datos, introducido por esta tarea. Al rehidratar, el contador se
reiniciaba con `decks.length + cards.length`. Pero `generateId` se invoca como argumento de
`createDeck`/`addCard`, así que **también se consume cuando la operación se rechaza**: cada intento
fallido quemaba un número. Tras recargar, el contador volvía por debajo del mayor id ya emitido y
lo reemitía. El reviewer lo reprodujo:

```text
MAZOS PERSISTIDOS: [{"id":"mazo-2","name":"Alemán"},{"id":"mazo-2","name":"Francés"}]
ENCABEZADO DE LA PANTALLA ABIERTA: ["Alemán"]   <- se pulsó la fila de "Francés"
```

Corrección: `nextCounterFrom` deduce el siguiente número del **mayor sufijo ya emitido**, no del
recuento. Los intentos fallidos dejan huecos en la numeración, que es inofensivo.

Tres tests de regresión nuevos en `persistence.test.tsx`, que intercalan intentos rechazados antes
y después de rehidratar. **Demostración de que detectan el defecto:**

```text
=== Reintroduciendo el contador por recuento ===
  ● no reemite identificadores aunque haya habido intentos rechazados
  ● abrir un mazo tras rehidratar muestra ese mazo y no otro
  ● las cartas nuevas no reusan el id de una carta restaurada
Tests:       3 failed, 50 passed, 53 total

=== Restaurando ===
Tests:       53 passed, 53 total
```

### F2 (MEDIO) — Romper la persistencia real dejaba unit e integración en verde

El contrato exigía que los tests corrieran "contra ambas implementaciones" y no lo hacían: solo el
E2E detectaba una rotura de `asyncStorageRepository`.

Corrección: `storage-serialization.test.ts` incorpora una **suite de contrato con `describe.each`**
que ejecuta los mismos casos contra la implementación en memoria y contra la de AsyncStorage.

**Demostración**, esta vez anulando de verdad `save()` (el primer intento del reviewer no llegó a
aplicarse por una diferencia de indentación, y por eso vio verde):

```text
=== Rompiendo save() de la implementación persistente ===
  ● contrato de LibraryRepository: AsyncStorage › lo guardado se recupera exactamente igual
  ● contrato de LibraryRepository: AsyncStorage › guardar dos veces conserva lo último, sin mezclar
  ● contrato de LibraryRepository: AsyncStorage › conserva la pertenencia de cada carta a su mazo
Tests:       3 failed, 94 passed, 97 total

=== Restaurando ===
Tests:       97 passed, 97 total
```

### F3 (MEDIO) — Tras un error de lectura se sobrescribían datos que podían ser válidos

Si el medio no se puede leer, ahí abajo puede haber datos buenos. La versión anterior avisaba pero
la primera acción de la persona usuaria escribía encima.

Corrección: cuando la carga falla con `ilegible`, **se suspende la escritura durante la sesión**.
La aplicación sigue usable, y el mensaje ahora lo dice: *"Para no sobrescribirlos, en esta sesión no
se guardará nada nuevo."* Con `contenido-invalido` sí se permite escribir, porque ese contenido es
definitivamente inservible. Cubierto por el test *"si no se pudo leer, no se sobrescribe con la
biblioteca vacía"*, que comprueba el medio con `peek()` después de crear un mazo.

### F4, F5 y F6 (BAJOS)

- **F4**: eliminado el tipo `StackRouter`, exportado y sin usar.
- **F5**: el barrel `src/lib/storage/index.ts` deja de reexportar los dobles de prueba; los tests
  los importan de `memoryRepository` directamente. El código de producción ya no puede alcanzarlos.
- **F6**: `createAsyncStorageRepository()` ya no se evalúa en cada render; se crea una sola vez.

Gates tras la corrección: `./init.sh` exit 0; **97 unit**, **53 integration**, 63 e2e (+3 skipped).

## Corrección de los hallazgos del review #2

El review #2 confirmó cerrados F1-F6 y encontró dos huecos de verificación, **uno de ellos
introducido por mi propia ronda de correcciones**.

### G1 (MEDIO) — La corrección de F3 dejó inerte un test

Al suspender las escrituras tras un error de lectura, `createFailingRepository` (que falla al leer)
dejó de llegar nunca a `save()`. El test *"un fallo de escritura no rompe la aplicación"* pasó a ser
un duplicado del anterior: su nombre afirmaba algo que ya no verificaba, y la rama
`save().catch(...)` del proveedor quedó sin cubrir en ninguna capa.

Corrección: nuevo doble `createWriteFailingRepository`, que **lee bien y falla solo al guardar**, que
es la única forma de llegar a esa rama. El test ahora afirma además que el aviso aparece, y se añade
uno que comprueba que la aplicación sigue usándose después del fallo.

```text
=== Anulando el aviso de fallo de escritura ===
  ● un fallo de escritura no rompe la aplicación y se avisa
  ● tras un fallo de escritura se puede seguir usando la aplicación
Tests:       2 failed, 52 passed, 54 total

=== Restaurando ===
Tests:       54 passed, 54 total
```

### G2 (BAJO) — La rama `catch` de `load()` real seguía sin cubrir

Corrección: tres tests que inyectan el medio por parámetro en `createAsyncStorageRepository`, uno
con `getItem` que lanza, otro con `setItem` que lanza, y otro que comprueba que se escribe bajo la
clave versionada esperada.

```text
=== Alterando la rama catch de load() ===
  ● asyncStorageRepository: fallos del medio › informa de un medio ilegible en lugar de lanzar
Tests:       1 failed, 99 passed, 100 total

=== Restaurando ===
Tests:       100 passed, 100 total
```

Gates tras la corrección: `./init.sh` exit 0; **100 unit**, **54 integration**, 63 e2e (+3 skipped).

## Riesgos

- **La persistencia es local al dispositivo o navegador.** Borrar los datos del sitio, usar
  navegación privada o cambiar de dispositivo hace desaparecer la biblioteca. Es exactamente lo
  confirmado, no un descuido.
- **Sin editar ni borrar** mazos ni cartas: un mazo con el nombre equivocado no se puede corregir, y
  ahora además persiste. Está fuera de scope, pero el efecto es más visible que antes.
- **Un contenido guardado inválido deja la aplicación en biblioteca vacía** hasta que se guarde algo
  nuevo, momento en que se sobrescribe. No se borra al arrancar, pero tampoco se recupera.
- **La escritura es completa en cada cambio**: se reescribe todo el documento. Con volúmenes grandes
  esto habría que revisarlo; con los tamaños actuales no es un problema.
- **`version: 1` sin migraciones.** Un cambio futuro de forma dejará los datos existentes como
  inválidos hasta que se escriba una migración. Deliberado: no se inventa un sistema que todavía no
  hace falta.

## No verificado

- **Ejecución real en simulador o dispositivo físico iOS/Android.** La persistencia se verifica en
  web con `page.reload()` y bajo Jest con el mock oficial de AsyncStorage; en nativo se apoya en
  que la librería expone la misma API en las tres plataformas, sin comprobación en dispositivo.
- **Cerrar y reabrir la aplicación nativa**: comprobado el equivalente en web (recarga completa),
  no el ciclo de vida de una app nativa.
- **Límites de cuota del almacenamiento**: no se ha probado qué ocurre al llenar `localStorage`.
- **Concurrencia entre pestañas**: dos pestañas abiertas escriben sobre la misma clave sin
  coordinación; la última escritura gana. No lo pide ninguna acceptance.
- **Playwright en CI**: la configuración lo contempla, sin ejecución en un CI real.
