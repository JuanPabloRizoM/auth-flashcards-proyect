# TASK-005 — QA

**Fecha:** 2026-08-22
**Modo:** solo lectura sobre el repositorio. Se prueba comportamiento observable de la
aplicación real servida en `http://localhost:8090`, no se relee la suite del implementer.
**Commit probado:** `3d434c6`

## Cómo se ha probado

1. **Exploración manual** en el navegador, sobre la aplicación real: crear mazos, buscar,
   ordenar, renombrar, confirmar borrados, y lectura directa de `localStorage` para comprobar
   qué se ha guardado de verdad y no solo qué se pinta.
2. **Diez escenarios nuevos** con Playwright contra la misma instancia, elegidos por no estar
   en la suite del implementer y por encadenar operaciones que en su suite viven separadas.

---

## Ronda 1 — `QA_FAILED`

### Exploración manual: lo que funciona

| Prueba | Observado |
|---|---|
| Crear tres mazos | Cabecera "3 mazos". La tarjeta de búsqueda y orden aparece solo cuando ya hay mazos, no antes. |
| Duplicado `  INGLÉS  ` existiendo `Inglés` | Rechazado, mensaje visible junto al campo, nada escrito en `localStorage`. Regresión de TASK-004 intacta. |
| Orden A-Z inicial | `anatomía, Inglés, Química`. Ordena por nombre sin que la mayúscula inicial mande. |
| Orden "Modificado más reciente" | `Química, anatomía, Inglés`: exactamente el orden inverso de creación. Los tres mazos se crearon en segundos distintos, y el orden es correcto. |
| Buscar `TOM` | Encuentra `anatomía`. Insensible a mayúsculas y por subcadena, no por prefijo. |
| Buscar `TOMZZZ` | Estado vacío propio: "Sin coincidencias — Ningún mazo coincide con "TOMZZZ"", con botón de limpiar. El estado vacío de biblioteca no aparece. La cabecera sigue diciendo "3 mazos", no "0". |
| Limpiar búsqueda | Vuelven los tres, y el orden elegido antes se conserva. |
| Renombrar a `  QUÍMICA  ` teniendo otro mazo `Química` | Rechazado con mensaje visible. Título sin cambiar. `localStorage` idéntico. |
| Renombrar a `INGLÉS técnico` | Guardado. En `localStorage`: `version: 2`, mismo `id` `mazo-1`, `updatedAt` actualizado. El formulario se cierra solo. |
| Pantalla de detalle | Renombrar, Importar tarjetas y Eliminar mazo visibles. El destructivo en rojo, separado de los otros dos. |
| Pantalla de importación | Dice a qué mazo va a importar y que el archivo solo se lee. Solo se ve el paso 1 hasta que hay archivo. |

### Escenarios encadenados

| # | Escenario | Resultado |
|---|---|---|
| QA2 | Importar el mismo archivo dos veces | 6 cartas, 6 ids distintos. No se deduplica en silencio, que es la decisión de producto vigente. |
| QA3 | Importar en dos mazos y borrar uno | La confirmación dice "las 3 cartas que contiene". Tras confirmar y recargar quedan el otro mazo y sus 2 cartas exactas. |
| QA4 | Renombrar después de importar | Mismo `id`, todas las cartas siguen con su `deckId`. |
| QA5 | Importar en el mazo más antiguo | Pasa a ser el primero al ordenar por más reciente: importar cuenta como modificar. |
| QA6 | Editar y borrar una carta importada, con recarga | Quedan las dos correctas, con el contenido editado. |
| QA7 | Estudiar un mazo de 125 cartas importadas | "Carta 1 de 125", revelar y avanzar funcionan. Regresión de TASK-003 sobre datos importados. |
| QA8 | Cancelar el selector | Pantalla intacta, sin error, sin preview. |
| QA9 | `.md` cuya tabla acaba sin salto de línea final | Se importa 1 tarjeta. |
| QA10 | `.xlsx` roto, luego `.md` sin tabla, luego CSV bueno | Los dos primeros dan error controlado, el tercero importa 3 cartas. Cero errores de página en toda la cadena. |

**Nueve de diez pasan.**

---

### FINDING QA-1 — `[MEDIO]` El número de fila que se anuncia no es el del archivo

**Cómo reproducirlo.** Un CSV cuyo encabezado no está en la primera línea:

```text
1: (en blanco)
2: (en blanco)
3: Pregunta;Respuesta;
4: ¿Capital de Francia?;París;
5: "Dijo ""hola"", y se fue";Said "hi";
6: ;solo reverso;          <- esta es la fila mala
7: (en blanco)
8: Última;Last;
```

**Lo que se importa es correcto:** 3 tarjetas, la fila sin frente descartada, las líneas en
blanco ignoradas, el punto y coma reconocido, las comillas escapadas bien. Nada se corrompe.

**Lo que está mal es el aviso.** Dice:

> Se descartará la **fila 4** del archivo: les falta el frente o el reverso.

La fila mala es la 6. La 4 es `¿Capital de Francia?;París;`, que es perfectamente válida y sí
se importa. Quien abra su archivo por la línea 4 no encontrará nada que arreglar.

**Por qué pasa.** `buildPreview` calcula `line = index + 2`, es decir, cuenta como si el
encabezado fuera siempre la primera línea del archivo. En cuanto hay algo antes —líneas en
blanco, o una fila de título, que es habitual en hojas exportadas— el número se desplaza. En
`.xlsx` pasa lo mismo respecto al número de fila de la hoja.

**Por qué es medio y no bajo.** El único motivo por el que ese mensaje existe es que la
persona pueda ir a su archivo y arreglar la fila. Un número equivocado no es información
incompleta: es información falsa, y manda a mirar una fila que está bien. Es peor que no dar
ningún número.

**Corrección exigida.** Que el número señale la fila de verdad. Si no se quiere arrastrar el
origen de cada fila, la alternativa aceptable es dejar de nombrar filas concretas y dar solo el
recuento, que es lo que la acceptance 80 pide como mínimo. Lo que no vale es seguir dando un
número que no corresponde.

### Veredicto ronda 1

`QA_FAILED` — 1 finding medio. Sin findings críticos ni altos. Ningún problema de corrupción
de datos: lo que se importa y lo que se guarda es correcto en todos los escenarios probados.

### Nota sobre el entorno

El panel de navegador integrado no puede alimentar el selector de archivos: cancela el diálogo
nativo antes de que se pueda entregar nada, así que la importación se probó con Playwright,
que sí intercepta el selector. No es un problema del producto: la suite E2E ejercita el mismo
camino en Chrome de escritorio, Chrome móvil y WebKit móvil.

---

## Ronda 2 — segundo finding

Reprobado el build corregido. **QA-1 cerrado:** con el mismo CSV de encabezado desplazado, el
aviso dice ahora "Se descartará **la fila 6** del archivo", que es la fila correcta. Y lo
importado sigue siendo lo mismo de antes: 3 tarjetas, con el punto y coma, las comillas
escapadas y los acentos bien.

(Nota: la aserción de QA1 de la ronda 1 esperaba "fila 5". Estaba mal escrita por QA —contaba
desde el encabezado en vez de desde el archivo—; el número correcto es 6 y es el que da la
aplicación. Corregida la aserción, no el producto.)

Los otros nueve escenarios siguen pasando sin cambios.

### FINDING QA-2 — `[BAJO]` La confirmación advierte de cartas que no existen

Revisando el diálogo de borrado en móvil (375x812), con un mazo sin cartas:

> Se eliminará el mazo "INGLÉS técnico" y también **las 0 cartas** que contiene.

El botón decía además "Eliminar mazo **y cartas**". Se advierte de un borrado en cascada que no
va a ocurrir, y "las 0 cartas" no es castellano. La rama de singular y la de plural estaban
bien; faltaba la de cero.

**Corrección exigida.** Que un mazo vacío no mencione cartas.

### Lo demás de la revisión visual en móvil

| Prueba | Observado |
|---|---|
| Mis mazos a 375 px | Barra compacta abajo, sidebar oculto. Los cuatro chips de orden se reparten en dos filas sin cortarse. Sin scroll horizontal. |
| Diálogo de confirmación a 375 px | Centrado, con margen, fondo atenuado. Los botones se apilan en vez de comprimirse. El destructivo en rojo y por debajo del de cancelar. |
| Jerarquía de la pantalla de mazo | Renombrar e Importar en secundario, Eliminar en rojo. La acción peligrosa no se confunde con las otras dos. |

---

## Ronda 3 — `APPROVED`

Reverificado en el navegador real tras la corrección:

```text
¿Eliminar el mazo?
Se eliminará el mazo "INGLÉS técnico", que no tiene ninguna carta. Esta acción no se
puede deshacer.
[Cancelar]  [Eliminar mazo]
```

Ni "las 0 cartas" ni "y cartas" en el botón. Las ramas de una carta y de varias siguen bien.

Los diez escenarios encadenados vuelven a pasar: **10 passed**.

### Resumen de acceptance comprobadas por QA

| Bloque | Comprobado observando la aplicación |
|---|---|
| Mazos (1-10) | Renombrar con precarga, cancelar, persistencia, vacío, duplicado, propio nombre, borrado confirmado, cancelar borrado, cascada, aislamiento |
| Flashcards (11-19) | Editar frente, reverso y ambos, cancelar, validar, persistencia, borrar, cancelar, aislamiento |
| Biblioteca (20-29) | Búsqueda insensible a mayúsculas y por subcadena, sin coincidencias, limpiar, los cuatro órdenes, contador, responsive a 375 px, sin overflow |
| Importación (30-52) | CSV, XLSX de una y de varias hojas, Markdown; preview obligatoria; importación real; persistencia tras recarga |
| Reconocimiento (53-62) | Pregunta/Respuesta y Front/Back detectados; Columna A/B exige elegir; nada se importa sin confirmar |
| Seguridad (63-70) | Vacío, dañado, filas vacías, frente y reverso vacíos, misma columna, encadenar errores sin romper la app |
| Regresión (71-75) | Persistencia, unicidad, navegación y estudio de tareas anteriores, sobre datos importados |

### Veredicto

**`APPROVED`.** Los dos findings de QA están cerrados y reverificados sobre la aplicación en
ejecución. No queda ningún finding abierto.

Las limitaciones que la evidencia de implementación declara siguen siendo ciertas y siguen
estando bien declaradas. La que más conviene tener presente es que **la ruta de lectura de
archivos en iOS y Android no se ha ejecutado nunca**: el gate E2E es web y aquí no se ha
podido probar de otra forma.
