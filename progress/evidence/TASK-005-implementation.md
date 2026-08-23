# TASK-005 — Evidencia de implementación

**Tarea:** Gestión completa de mazos y cartas, mejora de Mis mazos e importación estructurada
**Fecha:** 2026-08-22
**Acceptance congelada:** 91 criterios, SHA256 `e16e6b7e2ce389deabdc90a94c33d24d9c60f58f78d1b31c4ab1309f4aff83fc`

## Baseline

`./init.sh` ejecutado **antes** de tocar nada: **exit 0**. TASK-004 en `DONE` y ninguna otra
tarea activa (`scripts/verify.py`: OK; `scripts/agent_context.sh`: "No hay tarea activa").

Conteos de partida: unit 100, integration 54, e2e 63 (+3 skipped).

## Decisión de producto que estaba abierta

El enunciado obligaba a tratar como `open_question` la política de filas parcialmente
inválidas. Se paró antes de implementarla y la resolvió el usuario el 2026-08-22:

> Importar solo las filas válidas, avisando antes de confirmar del recuento de válidas y con
> problemas, y enumerando las descartadas en el resultado.

Queda registrada en `docs/PRODUCT.md` y en `resolved_questions` del contrato. No se ha tomado
ninguna otra decisión de producto.

## Archivos

### Dominio y datos

| Archivo | Qué cambia |
|---|---|
| `src/types/domain.ts` | `Deck` gana `updatedAt` (ISO 8601). |
| `src/lib/storage/serialization.ts` | Documento en versión 2; se sigue leyendo la 1 y se migra rellenando `updatedAt`. |
| `src/lib/storage/asyncStorageRepository.ts` | Solo comentario: por qué la clave conserva el sufijo `v1`. |
| `src/features/decks/library.ts` | `renameDeck`, `deleteDeck`, `editCard`, `deleteCard`, `addCards`, `findCard`; `createDeck` y `addCard` marcan el mazo como modificado. |
| `src/features/decks/libraryView.ts` | **Nuevo.** `filterDecks`, `sortDecks`, `buildDeckSummaries`, `formatUpdatedAt`. |
| `src/lib/LibraryProvider.tsx` | Expone las operaciones nuevas; reloj monótono para `updatedAt`; `importCards` escribe antes de publicar. |

### Importación

| Archivo | Qué hace |
|---|---|
| `src/features/import/types.ts` | `ParsedTable`, `ParsedSheet`, `ParsedWorkbook`, `PickedFile`, errores y mensajes. |
| `src/features/import/parsers/table.ts` | Matriz cruda -> tabla normalizada. Encabezado, relleno de celdas, filas en blanco. |
| `src/features/import/parsers/csv.ts` | CSV con papaparse. Quita el BOM de Excel. |
| `src/features/import/parsers/markdown.ts` | Tablas Markdown. Rechaza explícitamente lo que no es una tabla. |
| `src/features/import/parsers/xlsx/xml.ts` | Escaneo dirigido del XML de una hoja: elementos, atributos, entidades, referencias de celda. |
| `src/features/import/parsers/xlsx/index.ts` | Lector de `.xlsx` sobre fflate: hojas, relaciones, cadenas compartidas, celdas. |
| `src/features/import/parsers/index.ts` | Reparto por extensión. Decodifica UTF-8 con `strFromU8`. |
| `src/features/import/detector.ts` | `FieldDetector` y `headerHeuristicDetector`. Sinónimos y normalización con acentos. |
| `src/features/import/mapping.ts` | `validateMapping`, `buildPreview`, `describePreview`. |
| `src/lib/files/types.ts` | Puerto `FilePicker`. |
| `src/lib/files/documentPicker.ts` | Único archivo que conoce expo-document-picker y expo-file-system. |

### Interfaz

| Archivo | Qué cambia |
|---|---|
| `src/components/ui/ConfirmDialog.tsx` | **Nuevo.** Confirmación de acciones destructivas sobre `Modal`. |
| `src/components/ui/Select.tsx` | **Nuevo.** Elección entre pocas opciones, como grupo de radios. |
| `src/components/ui/Button.tsx` | Variante `danger` (rojo reservado a acciones destructivas en `docs/DESIGN.md`). |
| `src/components/decks/DeckCardRow.tsx` | **Nuevo.** Carta en modo lectura o edición, con borrador local. |
| `src/components/decks/DeckRenameForm.tsx` | **Nuevo.** Formulario precargado con el nombre actual. |
| `app/index.tsx` | Búsqueda, orden e información por mazo. |
| `app/mazo/[id]/index.tsx` | Renombrar, eliminar mazo, editar y borrar cartas, entrada a importación. |
| `app/mazo/[id]/importar.tsx` | **Nuevo.** El flujo completo de importación. |

## Cambios del modelo de datos

`Deck` pasa de `{ id, name }` a `{ id, name, updatedAt }`. `Card` no cambia.

El documento persistido sube de `version: 1` a `version: 2`. **Se migra, no se invalida:**
`parseStoredLibrary` acepta las dos versiones y, al leer una de la 1, rellena `updatedAt` con
la marca que se le pase. Subir la versión sin migración habría marcado como
`contenido-invalido` la biblioteca de cualquiera que ya estuviera usando la aplicación. La
clave de AsyncStorage se queda en `flashcards:library:v1` por el mismo motivo: la versión vive
dentro del documento, que es donde puede migrarse.

Cuenta como modificación de un mazo: crearlo, renombrarlo y añadir, editar, importar o borrar
una de sus cartas. Borrar un mazo no marca nada, porque el mazo deja de existir.

### Reloj monótono

`Date.now()` tiene resolución de milisegundo y dos operaciones seguidas caen dentro del mismo.
Se detectó en un test de orden: tres mazos creados de golpe empataban y "modificado más
reciente" no podía distinguirlos. El proveedor emite ahora las marcas con un reloj que nunca
repite ni retrocede, y que al rehidratar se coloca por delante de la marca más alta ya
guardada.

## Detección de patrones

Capa aparte, fuera de React:

```text
parsePickedFile -> ParsedWorkbook -> FieldDetector -> FieldMapping -> ImportPreview -> importCards
```

`FieldDetector` es un tipo (`(columns) => FieldDetection`) y `headerHeuristicDetector` su única
implementación. `detectFields(table, detector)` recibe la estrategia como parámetro, así que
enchufar otra no obliga a tocar parsers, vista previa ni escritura. Hay un test que lo
demuestra inyectando un detector alternativo.

La heurística compara encabezados normalizados (recorte, minúsculas y borrado de marcas
diacríticas vía `NFD`) contra dos listas cerradas: front/frente/question/pregunta/term/
termino/prompt y back/reverso/answer/respuesta/definition/definicion. **No elige por descarte:**
`Columna A | Columna B` devuelve `{front: null, back: null}` aunque solo haya dos columnas,
porque adivinar produciría mazos con las caras invertidas.

## Dependencias nuevas

| Paquete | Versión | Por qué |
|---|---|---|
| `papaparse` | ^5.6.0 | CSV RFC 4180: comillas, comas y saltos de línea dentro de campos. Cero dependencias, 265 KB, JS puro, mantenido (2026-08-13). |
| `@types/papaparse` | ^5.5.2 (dev) | Tipos. |
| `fflate` | ^0.8.3 | Inflate del ZIP que es un `.xlsx`. Cero dependencias, JS puro, funciona en navegador, Hermes y Node. También aporta `strFromU8`, que evita depender de `TextDecoder`. |
| `expo-document-picker` | ~57.0.1 | Único selector de archivos con implementación real en web, iOS y Android. Alineado con Expo SDK 57. |
| `expo-file-system` | ~57.0.2 | Ya estaba en el árbol de forma transitiva; ahora se importa, así que se declara. Solo para leer el archivo en nativo. |

**Descartadas y por qué:**

- `xlsx` (SheetJS): la copia de npm está congelada en 0.18.5, con avisos conocidos de
  prototype pollution y ReDoS. Descartada por seguridad.
- `exceljs`: 21 MB y nueve dependencias orientadas a Node (`archiver`, `unzipper`,
  `readable-stream`, `tmp`). Sin publicar desde 2024.
- `read-excel-file`: 2,4 MB y cuatro dependencias, entre ellas `worker-f` y `unzipper-esm`,
  que asumen Web Workers y ESM. Riesgo bajo Metro y jest-expo, y depende de fflate igualmente.

`npm audit` no añade ningún aviso nuevo: los que hay (metro, `@expo/*`, `xcode`, `uuid`,
`image-size`) ya estaban antes de esta tarea y vienen del toolchain de Expo.

`expo-file-system` **no sirve como selector**: se comprobó que su implementación web
(`ExpoFileSystem.web.ts`) es un stub que solo emite `console.warn`. Por eso hace falta
`expo-document-picker` y por eso el lector tiene dos ramas.

## Fixtures

`tests/fixtures/import/` contiene archivos reales, no tablas construidas dentro del test.
Los `.xlsx` los generan **dos escritores independientes** a propósito, porque un `.xlsx` puede
guardar su texto de dos formas y un lector que solo entendiera una fallaría con la mitad de
los archivos del mundo real:

- **openpyxl** escribe cadenas en línea (`t="inlineStr"`) y rutas absolutas en las relaciones:
  `basico.xlsx`, `multihoja.xlsx`.
- **XlsxWriter** escribe tabla de cadenas compartidas (`t="s"`) y rutas relativas:
  `compartidas.xlsx`.

`roto.xlsx` son los primeros 300 bytes de `basico.xlsx`. Ninguna de las dos herramientas es
dependencia del proyecto; `tests/fixtures/import/README.md` documenta cómo regenerarlas.

## Comandos y resultados

```text
npm run typecheck        exit 0
npm run lint             exit 0
npm test                 235 tests, 17 suites, exit 0   (antes: 100 / 11)
npm run test:integration 112 tests,  9 suites, exit 0   (antes:  54 /  6)
npm run test:e2e         147 passed, 3 skipped, exit 0  (antes:  63 / 3 skipped)
./init.sh                exit 0
```

Los 3 skipped son los mismos de siempre: comprobaciones específicas de disposición que cada
proyecto de Playwright se salta cuando no le aplican.

## Tests que no son vacuos

**Edición y borrado** (`tests/integration/deck-management.test.tsx`): cada caso opera desde la
interfaz, mira el repositorio con `peek()` para comprobar el medio y no el estado de React, y
en los casos de persistencia desmonta el proveedor y monta otro con el mismo repositorio. Los
casos de cancelar comparan la cadena serializada **byte a byte** antes y después.

**Importación** (`tests/integration/import-flow.test.tsx`): archivo real del disco -> parser
real -> detector real -> mapeo -> vista previa -> escritura -> recrear proveedor -> comprobar
lo persistido. Lo único sustituido es el selector del sistema, que no puede abrirse en un test.

**E2E** (`tests/e2e/import-flow.spec.ts`): el archivo entra por el evento `filechooser` de
Playwright, así que se ejercita expo-document-picker y la lectura del `File` del navegador sin
sustituir nada. Se comprobó que el click sintético que hace expo-document-picker sí abre el
selector y que Playwright lo intercepta.

## Casos adversariales cubiertos

- CSV con comas, comillas escapadas y salto de línea dentro de un campo entrecomillado.
- CSV con BOM de Excel.
- CSV de 125 filas.
- Encabezados desconocidos (`Columna A | Columna B`): no se preselecciona nada.
- Columnas invertidas: mapeo manual `front=1, back=0`, y detección de `Reverso | Frente`.
- Misma columna para las dos caras: rechazada, sin botón de importar.
- `.xlsx` con tres hojas, una de ellas sin tabla: no se ofrece.
- `.xlsx` con cadenas compartidas y con cadenas en línea.
- `.xlsx` con entidades XML (`Tom & Jerry`, `Dibujos <animados>`) y acentos (`Ñandú`, `Árbol`).
- `.csv` renombrado a `.xlsx`.
- `.xlsx` truncado.
- Markdown con prosa antes y después de la tabla.
- Markdown sin tabla y lista con guiones: rechazados.
- Markdown con pipe escapado dentro de una celda.
- Filas vacías, frente vacío y reverso vacío en el mismo archivo.
- Archivo vacío y archivo solo con encabezados.
- Fallo de escritura durante la importación, comprobando que lo guardado no cambia.
- Renombrar a `INGLÉS` existiendo ` inglés `, y renombrar al propio nombre con otras mayúsculas.

## Regresión

Ningún test se ha eliminado ni debilitado. Cinco archivos de test existentes cambian, y en
los cinco el motivo es una acceptance de TASK-005:

| Archivo | Cambio | Motivo |
|---|---|---|
| `tests/unit/library.test.ts` | Relojes fijos y `updatedAt` en dos aserciones | El modelo guarda la fecha (acceptance 81). Las aserciones se hacen **más** estrictas: ahora también comprueban la marca. |
| `tests/unit/storage-serialization.test.ts` | `updatedAt` en dos fixtures; **+7 tests** de migración | Igual. |
| `tests/integration/decks-flow.test.tsx` | `getByText('0 cartas')` -> `getByText(/0 cartas/)` | La tarjeta de mazo muestra ahora "N cartas · Modificado el ..." (acceptance 27 y decisión 12). |
| `tests/integration/cards-flow.test.tsx` | Igual, con `·` en el patrón | Igual. |
| `tests/integration/persistence.test.tsx` | `toEqual` -> `toMatchObject` más comprobación de que `updatedAt` es una fecha válida | El reloj real no es predecible; se comprueba lo que sí se puede afirmar. |
| `tests/integration/routes.tsx` | Se añade la ruta de importación | Ruta nueva. |

## Comprobaciones de arquitectura

```text
grep -rn "async-storage|papaparse|fflate|expo-document-picker|expo-file-system" app/ src/components/
  -> sin coincidencias

grep -rniE "openai|anthropic|gemini|claude|axios|fetch\(|XMLHttpRequest|WebSocket" src/features/import/
  -> sin coincidencias
```

Las pantallas hablan solo con `useLibrary` y con el puerto `FilePicker`. El almacenamiento
concreto vive en `src/lib/storage/asyncStorageRepository.ts` y el acceso a archivos en
`src/lib/files/documentPicker.ts`. Los parsers no importan nada de React.

## Riesgos y lo que NO está verificado

1. **La ruta nativa de lectura de archivos (iOS y Android) no se ha ejecutado.** El gate E2E es
   solo web. `src/lib/files/documentPicker.ts` tiene una rama `Platform.OS !== 'web'` que usa
   `expo-file-system`; está tipada y aislada, pero **no se ha probado en un dispositivo ni en
   un simulador**. Es la limitación más importante de esta entrega.
2. **El lector `.xlsx` es propio y cubre lo que necesitan las flashcards: el texto de las
   celdas.** Las fórmulas se leen por su resultado almacenado; los formatos numéricos y las
   fechas con estilo se leen por su valor crudo, no formateado. Una fecha puede aparecer como
   número de serie de Excel.
3. **Las filas que un `.xlsx` omite del todo no se reconstruyen.** Si una hoja salta de la fila
   3 a la 8, se leen las que existen y no se inventan cinco filas en blanco en medio.
4. **La migración no puede recuperar una fecha que nunca se guardó.** Los mazos que vengan de
   la versión 1 reciben todos la misma marca, así que entre ellos el orden por modificación cae
   en el desempate estable por posición. Los mazos creados o tocados a partir de ahora sí se
   ordenan de verdad.
5. **La política de duplicados de flashcards sigue sin decidirse.** Importar dos veces el mismo
   archivo crea las tarjetas dos veces, que es lo que el usuario pidió expresamente (no
   deduplicar automáticamente).
6. **Persisten los pendientes de TASK-004**: almacenamiento local al navegador, escritura del
   documento completo en cada cambio y sin coordinación entre pestañas.
