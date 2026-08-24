# TASK-006 — Revisión independiente

**Revisor:** independiente, READ ONLY sobre el código.
**Fecha:** 2026-08-23
**Lectura:** `AGENTS.md`, task, contract, `docs/ARCHITECTURE.md`, `docs/CONVENTIONS.md`,
`docs/DESIGN.md`, `docs/DATABASE.md`, `docs/VERIFICATION.md`, `CHECKPOINTS.md`,
`progress/evidence/TASK-006-implementation.md` y el diff completo.

---

## Veredicto de la primera pasada

**`CHANGES_REQUIRED`** — tres hallazgos, todos en el generador de PDF. Ninguno afecta a las
fórmulas ni al aislamiento por mazo, que se verificaron por separado y son correctos.

---

## R1 — Scope

`python3 scripts/check_scope.py` → `SCOPE: OK (TASK-006)`.

51 rutas tocadas, todas dentro de `allowed_paths`. `task.allowed_paths` y
`contract.allowed_paths` son idénticos. El acceptance no se modificó después de entrar en
IMPLEMENTING: el contrato conserva las 22 entradas y la verification matrix sus 125 filas.

Una dependencia nueva, `expo-sharing`, justificada en la evidencia y aislada en un único
archivo detrás del puerto `FileSaver`. Aceptable.

Cambio de API no anunciado en la evidencia pero legítimo y necesario: `LibraryValue.addCard`
pasa a devolver `{ ok, cardId }` e `importCards` añade `cardIds`. Sin eso no se puede
registrar el alta de una carta con su origen, porque solo el proveedor conoce el id que
emite. Deducirlo mirando "la última carta del mazo" habría sido frágil. Correcto.

---

## R2 — Correctitud de las fórmulas: recálculo independiente

No me he fiado de los tests del implementer. He construido un dataset propio y he recalculado
**64 cifras a mano**, comparándolas después con lo que devuelve `buildStatsReport`.

Dataset:

```text
A: 2026-08-21 → a1 10s, a2 20s, a3 30s | 2026-08-23 → a1 40s | 2026-05-01 → a9 70s
B: 2026-08-21 → b1 50s, b2 60s
Biblioteca: A tiene a1..a4 (4 cartas), B tiene b1,b2. Hoy = 2026-08-23.
```

Muestra de lo comprobado (las 64 coinciden):

| Cifra | Calculado a mano | Motor |
|---|---|---|
| 1m global total | 3+1+2 = **6** | 6 |
| 1m global tiempo | 10+20+30+40+50+60 = **210 s** | 210 000 ms |
| 1m global s/tarjeta | 210/6 = **35** | 35 |
| 1m promedio del periodo | 6/30 = **0.2** | 0.2 |
| 1m promedio días activos | 6/2 = **3** | 3 |
| 1m sesión promedio | (60+40+110)/3 = **70 000 ms** | 70 000 |
| all global total | **7** | 7 |
| ámbito A total / tiempo / s-tarjeta | **5** / 170 s / **34** | 5 / 170 000 / 34 |
| ámbito B total / tiempo / s-tarjeta | **2** / 110 s / **55** | 2 / 110 000 / 55 |
| A + B = global | 5+2 = **7**; 170+110 = **280 s** | 7 / 280 000 |
| Hoy: estudiadas/únicas/tiempo/s-tarjeta | 1 / 1 / 40 s / **40** | idéntico |
| Conteo: total/estudiadas/nunca | 6 / 5 / **1** | idéntico |
| Horas global | {8:1, 9:4, 14:1, 22:1} | idéntico |
| Horas ámbito B | {9:1, 22:1} — **sin la 8 ni la 14 de A** | idéntico |
| Racha B | estudió el 21, ni el 22 ni hoy → **0** | 0 |
| Calendario 2026-08-21 | 5 tarjetas, 170 000 ms, 2 sesiones, nivel **4** | idéntico |
| Velocidad por día | 05-01: 70, 08-21: **34**, 08-23: 40 | idéntico |
| Comparación | A: 5/170 000/3/34 · B: 2/110 000/1/55 | idéntico |
| 3m excluye 2026-05-01 | total **6**, 90 días | 6 / 90 |

Resultado: **TODO COINCIDE**. Sin discrepancias en ninguna de las 64.

Comprobaciones estructurales que también pasan:

- `total(A) + total(B) === total(global)` y lo mismo con el tiempo. No se pierde ni se
  duplica ningún evento al filtrar.
- `studiedAtLeastOnce + neverStudied === total` en todos los ámbitos.
- El conteo de tarjetas es idéntico con `1m` y con `all`: es estado actual y no depende del
  periodo, como declara el motor.
- `decksStudied` es `null` en ámbito de un mazo, no `1`. Correcto: en ese ámbito la métrica
  no informa de nada.

---

## R3 — Filtrado por mazo y ausencia de leakage

Correcto. El motor hace **un solo filtrado** por ámbito y periodo al principio y todas las
secciones parten de ahí (`scopedEvents`, `rangedEvents`, `scopedSessions`, `scopedAdditions`,
`scopedCards`). Es la estructura adecuada: impide que una sección filtre y otra se olvide.

Verificado en el recálculo que las horas exclusivas de A (8 y 14) no aparecen en el ámbito de
B, y que el calendario del ámbito de B suma exactamente lo que hizo B.

En el PDF, verificado con **pdftotext**, herramienta externa al proyecto:

```text
reporte-ingles.pdf   'Matemáticas' → 0    'Programación' → 0
                     'Historia (eliminado)' → 0    'Comparación de mazos' → 0
reporte-global.pdf   'Matemáticas' → 1    'Programación' → 1    'Historia (eliminado)' → 1
```

---

## R4 — Fronteras temporales

Correctas y deterministas.

- Las ventanas son días naturales, no meses de calendario, así que la frontera no depende de
  si el mes tenía 28 o 31 días. `1m` → primer día `2026-07-25`; `3m` → `2026-05-26`; `1y` →
  `2025-08-24`, todos verificados contra `daysBetween(from, to) + 1 === días del periodo`.
- El día local se **congela al registrar** y después se compara como texto. El orden
  lexicográfico de `YYYY-MM-DD` coincide con el cronológico, así que las comparaciones de
  frontera son exactas.
- La aritmética de días se hace en UTC sobre la clave. Comprobado que un día con cambio de
  horario de verano (2026-10-25) sigue contando como un día.
- Zona horaria: la misma agregación con `TZ=UTC`, `Pacific/Kiritimati` (UTC+14),
  `Pacific/Honolulu` (UTC-10) y `Europe/Madrid` da resultados idénticos.
- `today` se inyecta en la consulta en vez de leerse del reloj dentro del motor. Es la
  decisión correcta: sin ella no se podría afirmar sobre una frontera concreta.

Nota, no defecto: la racha se calcula dentro del periodo seleccionado. Está documentado como
limitación y es una elección coherente con "el periodo se combina con todo".

---

## R5 — Retención del historial y borrado

Correcto, y la arquitectura es lo que lo garantiza, no una comprobación puntual.

`LibraryProvider` y `StudyHistoryProvider` son independientes. `deleteDeck` y `deleteCard`
viven en `src/features/decks/library.ts`, que no importa nada del historial y no podría
tocarlo aunque quisiera. El único puente, `LibraryHistoryBridge`, va en un solo sentido y solo
transporta nombres de mazo.

Verificado que el mazo eliminado sigue en la comparación con su snapshot y `deleted: true`, y
que sin snapshot se nombra "Mazo eliminado" en vez de inventarse un nombre. La pantalla lo
etiqueta "(eliminado)" y **no** lo ofrece en el selector de ámbito: no aparenta seguir en la
biblioteca.

Renombrado: la identidad es el `id`. El snapshot solo avanza (`lastSeenAt >= previous`), así
que un nombre viejo no puede pisar a uno nuevo. No se crea un segundo historial.

---

## R6 — Migraciones y formato

Correcto. Versión 1, un solo formato, sin migración pendiente porque no había historial
anterior. `trackedSince` se fija una vez y no se mueve — verificado que un segundo `append`
con otro valor no lo cambia.

La validación es estricta y por documento: rechaza eventos incompletos, un `localDay`
imposible (`2026-02-31`), una `localHour` fuera de rango y un `origin` inexistente. Bien: un
validador laxo dejaría entrar basura que después rompería las cifras en silencio.

Recuperación: un mes dañado se omite, se informa y **se deja intacto** (verificado byte a
byte); los demás se siguen leyendo. Metadatos ilegibles → se pierde `trackedSince` y se
reconoce desconocido en vez de inventarse. Nada se borra. Correcto.

---

## R7 — Crecimiento del almacenamiento

Correcto y verificado, no solo afirmado. Una partición por mes; escribir en agosto deja el
documento de julio idéntico byte a byte. El descubrimiento por recorrido de claves en vez de
por índice guardado es la decisión acertada: un índice desincronizado ocultaría un mes entero.

**Mención especial al defecto que el implementer encontró y corrigió**: sin serializar los
`append`, dos cartas completadas casi a la vez producían una actualización perdida. Era un
fallo real de pérdida de datos, lo detectaron los tests de integración y la cola de escritura
lo resuelve correctamente, encadenando también el caso de fallo para que un error puntual no
bloquee las escrituras posteriores. Bien visto.

---

## R8 — Separación motor / interfaz

Correcta. `app/estadisticas.tsx` no contiene ni una agregación: no hay `reduce`, ni `filter`
sobre eventos, ni aritmética de métricas. Llama a `buildStatsReport` y pasa el informe a las
funciones de `view.ts`, que solo dan formato. El motor no importa React, ni el reloj, ni
almacenamiento.

---

## R9 — Consistencia dashboard ↔ PDF

Correcta. Una sola implementación de las fórmulas. `buildStatsPdf` recibe un `StatsReport` ya
calculado y no vuelve a agregar nada. Revisado el archivo entero buscando cálculos propios: no
hay ninguno, solo lectura de campos del informe y conversión de milisegundos a minutos para el
eje de la gráfica de tiempo, que es presentación.

---

## R10 — Accesibilidad

Correcta, y por encima de lo mínimo.

- Cada barra, cada celda del calendario, cada casilla de cifra y cada fila de tabla llevan una
  etiqueta accesible con el dato en texto. El color nunca es el único portador.
- La escala del calendario se explica además con palabras ("Sin actividad", "Máximo: N
  tarjetas en un día") y las celdas con actividad llevan borde.
- Toda gráfica tiene estado sin datos y dice que no hay datos, en vez de dibujar ceros.

**El implementer encontró y corrigió un defecto de accesibilidad preexistente**:
`react-native-web` descarta `accessibilityState.selected` en un elemento con rol de enlace, de
modo que el destino activo de la navegación quedaba marcado **solo por color** en el
navegador. La corrección con `aria-current="page"` es la estándar y correcta, y deja test de
regresión. Es un arreglo dentro del alcance de A1 y bien acotado.

---

## R11 — Datos inventados

No he encontrado ninguno. Al contrario, el trato de lo desconocido es riguroso:

- `ratio()` devuelve `null` en vez de `NaN` o `Infinity` cuando no hay divisor, y ese `null`
  se propaga hasta la pantalla como "—".
- Las cartas anteriores al tracking no reciben fecha de alta y se cuentan aparte.
- Un origen no reconocido no se traduce a nada: la carta queda "desconocida".
- Las cinco métricas de Anki que no pueden calcularse se declaran con su motivo, en pantalla y
  en el PDF. No se dibujan a cero ni se omiten en silencio.
- Un mazo eliminado sin snapshot se nombra "Mazo eliminado", no con un nombre plausible.

Recorriendo el informe vacío completo, ningún número es `NaN` ni infinito.

---

## R12 — Calidad de los tests

No son vacuos. Los tests del motor usan datasets con resultados calculados a mano y los
escriben en el comentario, y comparan valores concretos: `37.5`, `17.5`, `30`, `90 000`,
niveles `4/3/2/1`. 113 aserciones en `stats-engine`, 36 en `stats-period`, 26 en
`stats-recorder`.

El lector de PDF de los tests **no comparte código con el escritor**, lo que evita que un
fallo común a ambos pase desapercibido. Comprueba que los desplazamientos de `xref` apuntan al
principio de un objeto de verdad y que cada flujo declara su longitud real.

Ningún test deshabilitado ni saltado incondicionalmente. Los `test.skip` de E2E son
condicionales por proyecto (accesibilidad táctil solo en móvil).

Los tres tests de integración preexistentes solo se envolvieron con `StudyHistoryProvider`.
Comprobado en el diff que **ninguna aserción anterior se tocó**.

---

## R13 — PDF: hallazgos

Validado con herramientas externas al proyecto. **PyMuPDF**: los dos reportes abren,
`is_pdf: True`, 3 páginas cada uno. **pdftotext**: extrae el texto correctamente. Páginas
renderizadas a imagen e inspeccionadas: la maquetación es correcta y respeta la paleta
académica.

### Hallazgo 1 — La escala del calendario del PDF está hardcodeada

`src/features/stats/pdf/report.ts` construye la escala con literales:

```ts
const levels: PdfColor[] = [
  ink.surfaceMuted,
  hexColor('#C9DAE7'),
  hexColor('#9BBBD3'),
  hexColor('#6690B0'),
  ink.primary,
];
```

Esos tres valores intermedios son exactamente `chart.calendarScale[1..3]` de
`src/theme/tokens.ts`, copiados. Incumple `docs/DESIGN.md`, que exige literalmente que los
colores vengan del theme y que no se dispersen colores hardcodeados, y crea una segunda fuente
de verdad: cambiar la escala en el theme dejaría la pantalla y el PDF con calendarios de
distinto color sin que nada avise.

**Severidad: media.** Debe leer `chart.calendarScale`.

### Hallazgo 2 — El título del documento se codifica mal

El `/Title` del diccionario `/Info` se escribe con los mismos bytes WinAnsi que el contenido
de página. Pero las cadenas de texto de `/Info` se interpretan por defecto como
PDFDocEncoding, donde `0x97` no es un guion largo. Herramientas externas leen:

```text
Reporte de estudio Š Todos los mazos Š Todo el historial
```

en lugar del `—` previsto. Es lo que se ve en el título de la pestaña de un lector de PDF.

**Severidad: baja**, pero es un dato visible y mal formado, y hay dos arreglos correctos
disponibles: emitir la cadena en UTF-16BE con BOM, o no usar caracteres fuera de ASCII en el
título.

### Hallazgo 3 — La rejilla de cifras del PDF no protege el ancho de columna

`metricGrid` reparte el ancho en columnas iguales y escribe cada etiqueta sin canalón ni
recorte. Con cuatro columnas el ancho es 124.8 pt y las etiquetas más largas miden 117.5 pt
("PROMEDIO EN DÍAS ESTUDIADOS") y 115.1 pt ("ESTUDIADAS AL MENOS UNA VEZ"): caben por 7 pt y
en la página renderizada se ven pegadas a la columna siguiente. Cualquier etiqueta algo más
larga se solaparía con la vecina sin ningún aviso.

Llama la atención porque el mismo archivo ya tiene `truncateText`, y lo usa en las tablas pero
no aquí.

**Severidad: baja**, pero es un defecto latente con arreglo trivial.

---

## Lo que NO es un hallazgo

- Que la racha se acote al periodo: es coherente y está documentado.
- Que la serie de añadidas sea histórica y el baseline sea estado actual: es la lectura
  correcta de lo pedido y está explicado en el código.
- Que la rama nativa de compartir no esté probada: está declarado sin ambigüedad en la
  evidencia y en la limitación, tal y como se exigía.
- Que la pantalla fije "hoy" al montarse: es la alternativa correcta a leer el reloj en cada
  renderizado, y la consecuencia está documentada.

---

## Resultado

**`CHANGES_REQUIRED`**

Corregir los hallazgos 1, 2 y 3. Ninguno afecta a las fórmulas, al aislamiento por mazo, a la
retención del historial ni a la persistencia, que quedan verificados como correctos.

Tras la corrección: gates de nuevo y **revisión nueva**.

---

# Segunda pasada

**Fecha:** 2026-08-23. Revisión de las correcciones y de que no hayan roto nada.

## Hallazgo 1 — resuelto

`src/features/stats/pdf/report.ts:239`:

```ts
const levels: PdfColor[] = chart.calendarScale.map(hexColor);
```

No queda ningún `hexColor('#…')` en el generador; comprobado por búsqueda. La escala tiene
ahora una sola fuente de verdad, `src/theme/tokens.ts`, compartida con el calendario de la
pantalla.

El test de regresión no se limita a comprobar que se importa el token: toma los cinco tonos
del theme, los convierte al formato de color del PDF y comprueba que los cinco aparecen como
operadores de relleno en el archivo generado. Si alguien volviera a copiar un tono a mano y
lo cambiara en el theme, el test caería.

## Hallazgo 2 — resuelto

`pdfInfoString` emite UTF-16BE con marca de orden de bytes cuando hay caracteres fuera de
ASCII, y deja el literal legible cuando no los hay. La distinción está bien pensada: no
convierte lo que no hace falta convertir.

Contempla además los pares suplentes para puntos de código fuera del plano básico, que no
hacían falta para este reporte pero evitan que la función emita basura si alguien pone un
emoji en el nombre de un mazo.

Verificado con **PyMuPDF**, herramienta externa:

```text
antes:    'Reporte de estudio Š Todos los mazos Š Todo el historial'
después:  'Reporte de estudio — Todos los mazos — Todo el historial'
```

El test de regresión comprueba los bytes reales (`/Title <FEFF0052…`, con `2014` para el
guion largo y `00E9` para la `é`) y que ya **no** se emite el literal, que es lo que impide
una vuelta atrás silenciosa.

## Hallazgo 3 — resuelto

Canalón de 10 pt y recorte con `truncateText`, la misma función que el archivo ya usaba en
las tablas. Se recorta la etiqueta y también el valor.

El test de regresión es de los buenos: no comprueba que se llame a `truncateText`, sino que
recorre **todas** las etiquetas del PDF generado y mide cada una contra el ancho útil de
columna. Es una aserción sobre el resultado, no sobre la implementación.

Verificado también en la página renderizada: "ESTUDIADAS AL MENOS UNA VE…" aparece recortada
con separación limpia de "ESTUDIADAS HOY".

## Regresiones

Ninguna. Reejecutado todo:

| Gate | Resultado |
|---|---|
| typecheck | OK |
| lint | OK, 0 errores y 0 avisos |
| unit | **430 pasan** (427 antes; +3 de regresión) |
| integration | **172 pasan**, sin cambios |
| e2e | **178 pasan**, 6 skipped condicionales |
| `./init.sh` | **exit 0** |

Validación externa repetida sobre los PDF regenerados: PyMuPDF los abre, 3 páginas cada uno,
título correcto. `pdftotext` sobre el reporte de Inglés sigue dando 0 ocurrencias de
"Matemáticas", "Programación", "Historia (eliminado)" y "Comparación de mazos". El
aislamiento por mazo no se rompió al tocar la maquetación.

Las 64 cifras del recálculo independiente siguen coincidiendo: las correcciones fueron todas
de presentación y no tocaron ni una fórmula.

## Comprobación final contra CHECKPOINTS.md

- **C1 Harness sano** — `./init.sh` exit 0; una sola tarea activa; contrato anterior a
  IMPLEMENTING.
- **C2 Scope controlado** — `check_scope.py` OK; acceptance intacto; una dependencia nueva
  justificada; sin cambios oportunistas. Las dos correcciones fuera del PDF que hizo el
  implementer (`aria-current` y el formato de número) están dentro del alcance de A1 y H1
  respectivamente y ambas dejan test de regresión.
- **C3 Implementación correcta** — cada acceptance implementado y con evidencia; casos
  límite cubiertos (división por cero, sin datos, mazo eliminado, mes dañado, carta
  abandonada, sesión abierta); sin logs de depuración ni TODOs; arquitectura respetada.
- **C4 Verificación por capas** — baseline verde antes de editar; los cinco gates pasan;
  regresión completa pasa.
- **C5 Revisión independiente** — revisada task, contract, diff y evidencia; no he editado
  código; los tres hallazgos están cerrados y no queda ninguno abierto.

---

## Veredicto

**`APPROVED`**

Los tres hallazgos están resueltos, cada uno con un test de regresión que afirma sobre el
resultado y no sobre la implementación. Las fórmulas, el aislamiento por mazo, las fronteras
temporales, la retención del historial, las migraciones, el crecimiento del almacenamiento, la
separación motor/interfaz, la consistencia dashboard/PDF y la accesibilidad quedan verificados
como correctos, con recálculo independiente de 64 cifras y validación del PDF con dos
herramientas externas al proyecto.

Sin decisiones de producto no autorizadas: todo lo implementado corresponde a decisiones
registradas en `docs/PRODUCT.md` el 2026-08-23, y lo que no puede calcularse se declara en
lugar de simularse.

Pasa a QA.
