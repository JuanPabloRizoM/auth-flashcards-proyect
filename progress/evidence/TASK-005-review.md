# TASK-005 — Revisión independiente

**Fecha:** 2026-08-22
**Alcance:** task, contrato, diff completo, evidencia de implementación, arquitectura,
convenciones y `CHECKPOINTS.md`.
**Modo:** solo lectura. No se ha editado ningún archivo del proyecto. Los sondeos
adversariales se ejecutaron con una configuración de Jest fuera del repositorio.

---

## Ronda 1 — `CHANGES_REQUIRED`

### Qué se ha comprobado

| Checkpoint | Resultado |
|---|---|
| C1 Harness sano | `./init.sh` exit 0. Una sola tarea activa. Contrato anterior a IMPLEMENTING. |
| C2 Scope | `check_scope.py` OK. `allowed_paths` de task y contrato **idénticos** (comparados campo a campo). Acceptance sin tocar desde el congelado: SHA256 coincide. |
| C3 Implementación | Los 91 criterios tienen código y evidencia. Ver desglose abajo. |
| C4 Verificación | typecheck, lint, 235 unit, 112 integration, 147 e2e. Todo verde. |
| C5 Revisión | Esta revisión. Dos findings, abajo. |

### Coherencia task ↔ contrato

Se comprobó que no se repite la divergencia histórica de TASK-001:

```text
allowed_paths coherentes: True
acceptance coherentes:    True
required_docs coherentes: True
out_of_scope coherentes:  True
```

### Decisiones de producto

`docs/PRODUCT.md` recoge exactamente las 23 decisiones del enunciado, más la resolución de la
única `open_question`, con fecha. **No se ha colado ninguna decisión adicional.** Se retiró de
"decisiones NO tomadas" la línea de editar/eliminar, que ahora sí está decidida; el resto sigue
igual. Correcto.

### Sondeos adversariales

Diecisiete sondeos deliberados. Quince pasan con el comportamiento correcto:

| # | Sondeo | Resultado | Juicio |
|---|---|---|---|
| R2 | Fila con más campos que encabezados | Se recorta a las columnas declaradas | Correcto |
| R3 | Encabezados repetidos `Frente, Frente` | `{front:0, back:null}` | Correcto: no hay candidato de reverso, decide la persona |
| R4 | `  PREGUNTA  ` / `RESPUESTA` | `{front:0, back:1}` | Correcto |
| R5 | Markdown con separador de distinto ancho que el encabezado | `sin-tabla` | Correcto: la guarda de anchura funciona |
| R6 | Tabla Markdown sin pipes en los extremos | Se lee bien | Correcto |
| R7 | Markdown con dos tablas | Coge la primera, no mezcla | Correcto |
| R9 | Fila con datos solo en una columna fuera del mapeo | Contada como problema y comunicada | Correcto: no se pierde en silencio |
| R10 | Índice de columna no entero (`0.5`) | `columna-inexistente` | Correcto |
| R11 | Renombrar `Mi␣␣mazo` a `Mi␣mazo` | Aceptado | Correcto: la normalización confirmada **no** colapsa espacios interiores |
| R12 | Borrar el mismo mazo dos veces | `mazo-inexistente` | Correcto |
| R13 | Documento v1 con un `updatedAt` de más | Se ignora y se rellena con la marca de migración | Correcto |
| R14 | Documento v2 con `updatedAt` numérico | `contenido-invalido` | Correcto |
| R15 | ZIP válido que no es un libro de Excel | `archivo-ilegible` | Correcto |
| R16 | Archivo sin extensión | `formato-no-soportado` | Correcto |
| R17 | Extensión en mayúsculas `.CSV` | Se importa | Correcto |

Los casos que el enunciado pedía probar deliberadamente están todos cubiertos por la suite del
implementer y se han vuelto a ejecutar: comas y comillas en CSV, encabezados desconocidos,
columnas invertidas, Excel con varias hojas, Markdown con prosa más tabla, filas vacías, 125
tarjetas, nombres con acentos y archivo malformado.

---

### FINDING 1 — `[ALTO]` El comentario de `csv.ts` afirma un comportamiento que el código no tiene

`src/features/import/parsers/csv.ts` dice:

> `// El delimitador se autodetecta: un CSV exportado con punto y coma es habitual en Excel`
> `// en español y romperlo por comas produciría una sola columna gigante.`

Es falso. Comprobado contra papaparse 5.6.0:

```text
Papa.parse('Frente;Reverso\nHola;Hello\nCasa;House\n')
  data: [["Frente;Reverso"],["Hola;Hello"],["Casa;House"]]
  meta: { "delimiter": "," }
```

El adivinador de papaparse puntúa por consistencia en el número de campos. Un archivo con
punto y coma partido por comas da **una** columna en todas las filas, que es perfectamente
consistente, así que la coma gana y el punto y coma nunca se prueba de verdad.

**Por qué es alto y no cosmético.** Se juntan dos cosas:

1. Un comentario que miente sobre el comportamiento del código incumple `docs/CONVENTIONS.md`
   regla 7 y es exactamente el tipo de afirmación en la que se apoyaría quien toque esto
   después.
2. El efecto para la persona usuaria es un callejón sin salida, no una molestia. Excel en
   español exporta CSV con punto y coma por defecto. Ese archivo produce **una sola columna**
   llamada `Frente;Reverso`; el detector no reconoce nada, la pantalla pide elegir las dos
   columnas a mano, y solo hay una: elegir la misma para las dos caras está prohibido, así que
   **no hay ninguna combinación que permita importar**. En una aplicación en español, ese es el
   CSV más probable que va a recibir.

**Corrección exigida.** Que el comentario sea verdad: elegir el delimitador de forma
determinista entre un conjunto cerrado, a partir de la línea de encabezados, y pasárselo a
papaparse explícitamente. No es scope nuevo: el enunciado pide "el parser debe manejar CSV
correctamente" y "utiliza una solución robusta". Alternativa aceptable si se prefiere no tocar
comportamiento: borrar el comentario y declarar la limitación en la evidencia. **Lo que no es
aceptable es dejar el comentario como está.**

### FINDING 2 — `[BAJO]` El fondo del `ConfirmDialog` se anuncia como un segundo botón "Cancelar"

`src/components/ui/ConfirmDialog.tsx` monta el fondo pulsable así:

```tsx
<Pressable accessibilityLabel={cancelLabel} accessibilityRole="button" ... />
```

Pulsar fuera para cancelar está bien. Exponerlo al árbol de accesibilidad no: un lector de
pantalla encuentra dos controles llamados "Cancelar", uno de ellos ocupando toda la pantalla y
por delante del diálogo. `docs/CONVENTIONS.md` pide accesibilidad básica con etiquetas claras.

**Corrección exigida.** Ocultar el fondo de la accesibilidad. El botón de cancelar real ya
existe y es el que debe anunciarse.

---

### Lo que NO es un finding

- **`updatedAt` empatado en los mazos migrados de la versión 1.** Es inevitable: la versión 1
  no guardaba la fecha y no hay de dónde sacarla. Está documentado en la evidencia y el
  desempate es estable. Correcto.
- **El reloj monótono se adelanta hasta unos pocos milisegundos.** Es el precio de que
  "modificado más reciente" signifique algo con resolución de milisegundo, y se reajusta solo.
  Bien razonado y con test que lo respalda.
- **La rama nativa de lectura de archivos sin ejecutar.** El gate E2E es web. Está aislada en
  un archivo, declarada como no verificada en la evidencia y no se disfraza de comprobada.
  Es una limitación honesta, no un defecto oculto.
- **Cambios en cinco archivos de test existentes.** Revisados uno a uno. Ninguno debilita nada:
  dos se vuelven más estrictos (comprueban además `updatedAt`), dos pasan de texto exacto a
  expresión regular porque la tarjeta de mazo muestra ahora más información, y uno añade una
  ruta. Los conteos suben de 100/54/63 a 235/112/147.

### Veredicto ronda 1

`CHANGES_REQUIRED` — 1 finding alto, 1 bajo.

---

## Ronda 2 — `APPROVED`

El implementer corrigió los dos findings. Se vuelve a revisar el diff de la corrección y se
reverifica con sondeos nuevos.

### FINDING 1 — cerrado

`src/features/import/parsers/csv.ts` ya no afirma nada que no haga: el delimitador se elige
explícitamente entre `,`, `;` y tabulador, quedándose con el que parte la fila de encabezados
en más columnas, y se le pasa a papaparse. El conteo se hace sobre la fila **ya parseada** con
cada candidato, no con `split`, de modo que un separador que solo aparece dentro de un campo
entrecomillado no puntúa. El comentario explica ahora por qué el adivinador de papaparse no
sirve aquí, que es la información que hacía falta.

Reverificación, ocho sondeos, todos correctos:

| # | Entrada | Resultado |
|---|---|---|
| S1 | `Frente;Reverso` (el caso que fallaba) | `["Frente","Reverso"]` |
| S2 | `Front,Back` | `["Front","Back"]` — sin regresión |
| S3 | `"Hola, ¿qué tal?","Hi, there"` | Dos campos — sin regresión |
| S4 | Separado por tabuladores | `["A","B"]` |
| S5 | Una sola columna de verdad | `["Palabra"]` — no se inventa una segunda |
| S6 | `A,B;C` (empate posible) | `["A","B;C"]` — gana la coma, la preferencia declarada |
| S7 | `"a;b",c` | `["a;b","c"]` — el `;` de dentro del campo no gana |
| S8 | Líneas en blanco antes del encabezado | `["Frente","Reverso"]` |

Regresión añadida: cinco casos en `tests/unit/import-parsers.test.ts` más dos fixtures reales
(`punto-y-coma.csv` con campos entrecomillados que contienen `;`, y `tabulador.csv`). El
comentario del test explica el fallo original, así que si alguien vuelve a delegar el
delimitador en papaparse, el test cae y dice por qué.

### FINDING 2 — cerrado

El fondo del `ConfirmDialog` lleva ahora `accessibilityElementsHidden` e
`importantForAccessibility="no-hide-descendants"`, y se le ha quitado el rol y la etiqueta.
Sigue cancelando al pulsarlo.

Regresión añadida en `tests/unit/confirm-dialog.test.tsx`, y bien planteada: no comprueba las
props a ciegas, sino que **el fondo ya no aparece en una consulta normal** de Testing Library
—que solo ve lo que vería un lector de pantalla— y que solo hay un control anunciado como
"Cancelar". Seis tests en total para el componente.

### Gates tras la corrección

```text
typecheck              exit 0
lint                   exit 0
npm test               245 tests, 18 suites   (eran 235/17)
npm run test:integration 112 tests, 9 suites
npm run test:e2e       147 passed, 3 skipped
./init.sh              exit 0
```

Ningún test se ha eliminado ni relajado para cerrar los findings: los conteos solo suben.

### Checkpoints

| | |
|---|---|
| C1 Harness sano | OK |
| C2 Scope controlado | OK. Sin cambios fuera de `allowed_paths`. Cinco dependencias, todas justificadas y con las alternativas descartadas por escrito. |
| C3 Implementación correcta | OK. 91 acceptance con código y evidencia. Sin logs de depuración, sin TODOs sin contexto, sin archivos temporales. |
| C4 Verificación por capas | OK. Las cinco fases, más regresión completa. |
| C5 Revisión independiente | OK. Findings cerrados con test de regresión cada uno. |

### Veredicto

**`APPROVED`.** Sin findings críticos ni altos abiertos.

Las limitaciones que la evidencia declara —rama nativa sin ejecutar, lector `.xlsx` limitado a
texto de celdas, fechas empatadas en los mazos migrados— están correctamente identificadas
como limitaciones y no disfrazadas de comprobadas. Pasa a QA.

---

## Ronda 3 — `APPROVED` (tras el finding de QA)

QA devolvió `QA_FAILED` con un finding medio: el número de fila que anuncia la vista previa no
era el del archivo cuando el encabezado no estaba en la primera línea. Se revisa la corrección.

### Qué se ha cambiado

`ParsedTable` gana `rowLines: number[]`, en paralelo a `rows`: de dónde viene cada fila en el
origen. Lo rellena cada parser, que es el único que lo sabe:

- **CSV**: el número de registro que devuelve papaparse.
- **Markdown**: la línea del documento, calculada desde donde empieza la tabla, contando la
  fila separadora que no viaja en la matriz.
- **XLSX**: el atributo `r` de cada `<row>`, que es el número que se ve en Excel.

`buildPreview` usa `table.rowLines[index]` en lugar de `index + 2`.

La solución es la correcta, no un parche: el número lo aporta quien conoce el origen, no se
reconstruye a posteriori desde una posición que no lo sabe.

**Efecto lateral bueno:** en `.xlsx` el número sale del atributo `r`, así que ahora también es
correcto cuando la hoja omite filas, que era una limitación declarada en la evidencia.

### Reverificación

| # | Caso | Resultado | |
|---|---|---|---|
| T1 | CSV normal | `[2,3,4]` | Correcto |
| T2 | Encabezado tras dos líneas en blanco | `rowLines [4,5,6,7,8]`, rechazada la **6** | Correcto: era el caso que fallaba |
| T3 | CSV con un campo de dos líneas | `[2,3]`, rechazada la 3 | Desviación conocida, ver abajo |
| T4 | Tabla Markdown al final del documento | `[7,8]`, rechazada la 8 | Correcto |
| T5 | `.xlsx` básico | `[2,3,4]` | Correcto |
| T6 | `.xlsx` de varias hojas | `Inglés [2,3]`, `Historia [2,3]` | Correcto, cada hoja cuenta lo suyo |

### Sobre T3

Con un campo entrecomillado que contiene saltos de línea, el número es el del **registro**, no
el de la línea física: ese registro ocupa varias líneas y los siguientes quedan desplazados
hacia abajo. papaparse no expone la posición física por fila, así que corregirlo exigiría
recorrer el texto por segunda vez contando saltos.

Se acepta como limitación **porque está declarada donde toca**: el comentario de `csv.ts` y la
documentación de `rowLines` lo dicen explícitamente, en vez de prometer una precisión que no
hay. Es justo lo contrario del finding 1 de la ronda 1, y esta vez está bien resuelto. El caso
que motivaba el finding de QA —líneas en blanco o una fila de título antes del encabezado, que
es lo habitual en hojas exportadas— sí queda correcto.

### Regresión añadida

Seis tests unitarios (uno por formato más los dos del caso desplazado) y un E2E que comprueba
el mensaje visible y que además vuelve a verificar que lo importado sigue siendo lo correcto.
El E2E afirma tanto que aparece "la fila 6" como que **no** aparece "fila 4", así que una
vuelta al cálculo anterior lo tira.

### Gates

```text
typecheck  exit 0     lint  exit 0
unit         251 tests, 18 suites   (eran 245)
integration  112 tests,  9 suites
e2e          150 passed, 3 skipped  (eran 147)
./init.sh    exit 0
```

### Veredicto

**`APPROVED`.** Finding de QA cerrado en la capa correcta, con regresión en dos niveles y la
limitación restante declarada por escrito. Sin findings críticos ni altos abiertos.

---

## Ronda 4 — `APPROVED` (segundo finding de QA)

QA encontró en la revisión visual en móvil que la confirmación de borrado de un mazo vacío
decía "y también **las 0 cartas** que contiene".

### Corrección

La construcción del texto sale del JSX a una función con nombre, `deleteDeckDescription`, con
tres ramas: sin cartas, una carta y varias. El botón de confirmar también deja de prometer
"y cartas" cuando no hay ninguna.

Es el cambio proporcionado: el defecto era de redacción, no de comportamiento, y la corrección
no toca el dominio ni la persistencia.

### Regresión

Dos tests de integración: el mazo vacío no menciona cartas y el botón no promete borrarlas; y
el mazo de una carta usa el singular. El caso de varias cartas ya estaba cubierto por el E2E
("las 2 cartas que contiene"), así que las tres ramas quedan cubiertas.

### Gates

```text
typecheck  0    lint  0
unit         251 tests, 18 suites
integration  114 tests,  9 suites   (eran 112)
e2e          150 passed, 3 skipped
./init.sh    exit 0
```

### Veredicto

**`APPROVED`.** Sin findings abiertos de ninguna severidad.
