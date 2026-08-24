# TASK-006 — Evidencia de implementación

**Tarea:** Estadísticas avanzadas de estudio, historial persistente y generación de reportes PDF
**Estado al escribir esta evidencia:** IMPLEMENTING → VERIFYING
**Fecha:** 2026-08-23

---

## 0. Baseline

`./init.sh` antes de editar: **exit 0**.

```text
[OK] Harness válido      [OK] typecheck      [OK] test (251)
[OK] Scope válido        [OK] lint           [OK] test:integration (114)
[OK] Sin temporales      [OK] Evidencia      [OK] test:e2e (150 + 3 skipped)
```

Precondiciones comprobadas antes de crear la tarea:

- `AGENTS.md` leído; protocolo A seguido en orden.
- `progress/current.md`: proyecto IDLE, sin tarea activa.
- `scripts/agent_context.sh`: «No hay tarea activa».
- TASK-005: `status: "DONE"`.
- `docs/PRODUCT.md` y `docs/DESIGN.md` leídos.
- Modelo persistente, flujo de estudio y migraciones de TASK-004/005 inspeccionados.
- PDF de Anki analizado antes de escribir el contrato (`~/Downloads/anki-stats-2026-08-04@00-59-31.pdf`,
  5 páginas, texto extraído y páginas renderizadas).

---

## 1. Correspondencia con el informe de Anki

El PDF de referencia se usó para entender qué presenta Anki, cómo lo agrupa, qué filtros
ofrece y qué gráficas usa. No se copió su aspecto: la identidad visual sigue siendo la
definida en `docs/DESIGN.md`.

| Sección de Anki  | TASK-006 | Qué se hizo y por qué |
|---|---|---|
| Today            | **Implementada/adaptada** | Tarjetas estudiadas, únicas, tiempo activo, s/tarjeta, sesiones y mazos estudiados. Se omiten «Again count», «Learn/Review/Relearn/Filtered» y «mature cards»: son categorías del scheduler. |
| Future Due       | **Diferida** | Necesita un scheduler que fije cuándo vuelve a tocar cada carta. No se dibuja a cero. |
| Calendar         | **Implementada** | Mapa de calor por día local, con detalle de tarjetas, tiempo y sesiones, filtro por mazo y estado sin datos. |
| Reviews          | **Adaptada a actividad** | Misma idea (cuántas preguntas respondiste por día) con las mismas cifras derivadas: días estudiados, total, promedio del periodo y promedio en días activos. Se evita la palabra «review»: aquí no hay repasos programados. |
| Card Counts      | **Adaptada** | Total, nunca estudiadas y estudiadas al menos una vez, más estudiadas hoy. Sin New/Learning/Relearning/Young/Mature/Suspended/Buried, que son estados del scheduler. |
| Review Intervals | **Diferida** | Sin repetición espaciada no hay intervalos programados que medir. |
| Card Ease        | **Diferida** | El Ease lo produce el algoritmo de repetición. |
| Retention        | **Diferida** | Necesita saber si un repaso se acertó o se falló; el estudio actual no califica. Nada se llama «retención». |
| Hourly Breakdown | **Adaptada a actividad** | Tarjetas por hora local. Sin la tasa de acierto del eje derecho de Anki, que necesitaría éxito/fallo. |
| Answer Buttons   | **Diferida** | No existen Again/Hard/Good/Easy, y no se crean botones para llenar una gráfica. |
| Added            | **Implementada/adaptada** | Altas por día desde el tracking, más el baseline anterior contado aparte y sin fecha inventada. |

Las cinco diferidas se **declaran explícitamente** con su motivo, tanto en la pantalla
(«Métricas todavía no disponibles») como en el PDF. No aparecen como ceros ni se omiten en
silencio: ver `deferredMetrics` en `src/features/stats/engine.ts`.

**Métricas añadidas que Anki no tiene** en ese informe: tiempo de estudio por día con sesión
promedio y sesión más larga; velocidad (s/tarjeta) por día con día más rápido y más lento;
racha actual, mejor racha y días estudiados; comparación de mazos; y origen de las tarjetas
(Manual/CSV/XLSX/Markdown/desconocido).

**Filtros tomados de Anki:** el ámbito `deck` vs `collection` se convierte en «Todos los
mazos» vs un mazo concreto, y los periodos `1 month / 3 months / 1 year / all` se conservan
tal cual.

---

## 2. Arquitectura del historial

```text
LibraryRepository                 StudyHistoryRepository
 (mazos y cartas)                  (sesiones, eventos y altas)
        │                                    │
   LibraryProvider   ←LibraryHistoryBridge→  StudyHistoryProvider
        │                                    │
        └──────────────► StatsEngine ◄───────┘
                              │
                   ┌──────────┴──────────┐
                   ▼                     ▼
          Pantalla /estadisticas    Generador de PDF
```

Los dos repositorios van **separados a propósito**: la biblioteca es un estado pequeño que se
reescribe entero y del que se borran cosas; el historial es una bitácora que solo crece y que
tiene que sobrevivir a esos borrados. Meterlos en el mismo documento obligaría a reescribir
todo el historial al renombrar un mazo y a borrar historial al borrar un mazo, que es lo
contrario de lo pedido.

**Entidades** (`src/features/stats/types.ts`):

- `StudySession`: id, deckId, startedAt, endedAt, activeMs, completedCards, localDay.
- `StudyCardEvent`: id, sessionId, deckId, cardId, shownAt, revealedAt, completedAt,
  activeMs, localDay, localHour.
- `CardAddedEvent`: id, deckId, cardId, addedAt, origin, localDay.
- `DeckSnapshot`: deckId, name, lastSeenAt.

`activeMs` y `completedCards` de la sesión se derivan de sus cartas completadas y nunca se
editan sueltos, así que sesión y eventos no pueden discrepar al recalcular.

**Identidad:** siempre `deckId` y `cardId`. El nombre solo acompaña, en `DeckSnapshot`.

---

## 3. Persistencia, formato y migración

Documentado en `docs/DATABASE.md` y en el encabezado de
`src/lib/storage/historySerialization.ts`.

```text
flashcards:history:v1:meta          { version, trackedSince, decks[] }
flashcards:history:v1:month:AAAA-MM { version, month, sessions[], cardEvents[], cardAdditions[] }
```

- **Versión:** 1. Cuando haya una 2, la 1 se seguirá leyendo y migrando al vuelo, como ya hace
  la biblioteca.
- **Migración:** no hay historial anterior que migrar. `trackedSince` se fija la primera vez
  que arranca la aplicación con TASK-006 y no vuelve a moverse.
- **Crecimiento:** una partición por mes natural. Completar una carta reescribe solo el mes en
  curso; los meses cerrados no se tocan. Verificado en
  `tests/unit/history-serialization.test.ts` («escribe cada mes en su propia clave y no toca
  los demás»: julio queda byte a byte igual tras escribir en agosto).
- **Descubrimiento:** por recorrido de claves, no por un índice guardado. Un índice
  desincronizado dejaría invisible un mes que sigue estando ahí.
- **Escrituras serializadas:** cada `append` hace lectura-mezcla-escritura sobre la partición.
  Se encadenan en una cola. **Este fue un bug real encontrado por los tests de integración**:
  sin la cola, dos cartas completadas casi a la vez producían una actualización perdida y
  desaparecían eventos.
- **Recuperación:** cada documento se valida por separado. Un mes ilegible se omite, se
  informa en pantalla y se deja intacto; los demás se siguen leyendo. Metadatos ilegibles →
  se pierde `trackedSince` y se reconoce desconocido, no se inventa. Nada se borra.

---

## 4. Tracking real y tiempo activo

- La sesión se abre al entrar en estudiar con cartas, y se cierra al salir por cualquier vía
  (la limpieza del efecto), no con un botón que podría no pulsarse.
- Cada carta registra los tres instantes: mostrada, revelada y completada.
- Se persiste **carta a carta**: recargar a mitad de sesión no pierde lo ya estudiado.
- Una carta abandonada sin pasar a la siguiente no cuenta ni en tarjetas ni en tiempo.
- Una sesión sin ninguna carta completada no se guarda.

**Tiempo activo** (`src/features/stats/activeTime.ts`): el cronómetro solo acumula mientras la
superficie está visible. Web: `visibilitychange`. Nativo: `AppState`, con `background` e
`inactive` deteniéndolo. Verificado con reloj y visibilidad controlados: tres horas en segundo
plano no producen tres horas de estudio.

**Limitaciones documentadas:** mide visibilidad, no atención (una ventana visible y desatendida
sigue sumando); en web `visibilitychange` no cubre tapar la ventana con otra aplicación encima;
la rama nativa nunca se ha ejecutado en dispositivo ni simulador.

**Fechas y zona horaria:** el día local (`YYYY-MM-DD`) y la hora local (0..23) se **congelan al
registrar** el evento y a partir de ahí se tratan como texto. Agrupar no vuelve a pasar por
ninguna zona horaria. Verificado ejecutando la misma agregación con `TZ=UTC`,
`TZ=Pacific/Kiritimati`, `TZ=Pacific/Honolulu` y `TZ=Europe/Madrid`: resultado idéntico. La
aritmética de días se hace en UTC sobre la clave, así que un día con cambio de horario sigue
siendo un día.

---

## 5. Tracking start

`trackedSince` se fija al primer arranque. Las cartas anteriores **no reciben fecha de alta**:
son baseline, se cuentan aparte («Anteriores al tracking») y su origen es «Origen desconocido /
anterior al tracking». La pantalla y la portada del PDF dicen «Historial de estudio registrado
desde [fecha]. Lo anterior a esa fecha no se registró y no se ha reconstruido».

---

## 6. Stats Engine

`buildStatsReport(input, query)` en `src/features/stats/engine.ts`. Función pura, sin React,
sin reloj y sin almacenamiento.

```text
StatsQuery = { scope: {all} | {deck, deckId}, period: 1m|3m|1y|all, today: 'AAAA-MM-DD' }
```

`today` se **inyecta** en vez de leerse del reloj: es lo que permite afirmar sobre fronteras
de fecha concretas.

Convenios que atraviesan el motor:

1. La unidad de «estudiada» es la **carta completada**. Así actividad, tiempo y velocidad son
   siempre coherentes entre sí.
2. **Lo desconocido es `null`, nunca `0`.** Un promedio sin muestras no es cero.
3. El **periodo filtra la actividad, no el inventario**: el conteo de tarjetas y el origen
   describen el estado actual de la biblioteca.

Un solo filtrado por ámbito y periodo alimenta todas las secciones, que es lo que impide que
pueda haber leakage en una sección y no en otra.

---

## 7. Pruebas matemáticas del motor

Dataset del enunciado, en `tests/unit/stats-engine.test.ts`:

```text
Mazo A (Inglés):       día 1 → 10 tarjetas,  día 2 → 20 tarjetas
Mazo B (Matemáticas):  día 1 →  5 tarjetas
```

| Consulta | día 1 | día 2 | total | Verificado |
|---|---|---|---|---|
| Todos los mazos | 15 | 20 | 35 | sí |
| Filtro mazo A   | 10 | 20 | 30 | sí |
| Filtro mazo B   |  5 |  0 |  5 | sí |

Además: `total(A) + total(B) === total(global)` y `tiempo(A) + tiempo(B) === tiempo(global)`.

Otras comprobaciones con resultado calculado a mano:

- **Hoy:** 4 eventos, uno repetido → estudiadas 4, únicas 3, tiempo 150 s, 150/4 = **37.5 s**.
- **Promedios:** 35 tarjetas en 2 días activos dentro de 30 → 35/30 = **1.2**; 35/2 = **17.5**.
- **Velocidad:** día 1 dos de 20 s → 20 s/tarjeta; día 2 dos de 40 s → 40 s/tarjeta; global
  120 s / 4 = **30 s**.
- **Tiempo:** 4×30 s + 2×30 s = **180 000 ms**, promedio por día activo **90 000 ms**; la
  sesión abierta cuenta como sesión pero no entra en la media ni en la más larga.
- **Intensidad del calendario:** 100/75/50/25 sobre máximo 100 → niveles **4/3/2/1**, y un día
  sin actividad → **0**.
- **Racha:** global 12 días, mazo B 4 días, sobre el mismo dataset. Sigue viva si se estudió
  ayer y aún no hoy; se rompe al perder un día entero, y la mejor racha recuerda la más larga.
- **Comparación:** Inglés 4 tarjetas / 120 000 ms → 30 s; Matemáticas 2 / 90 000 ms → 45 s.
- **Fronteras:** en cada periodo, el evento del primer día entra y el del día anterior queda
  fuera. `1m` → primer día `2026-07-25`; `3m` → `2026-05-26`; `1y` → `2025-08-24`.

---

## 8. Gráficas

Se dibujan con vistas de React Native, **sin librería de gráficas**. Justificación: lo que hace
falta es rectángulos y texto; una barra es una vista con altura proporcional y el calendario es
una rejilla de celdas. Eso funciona igual en web, iOS y Android, no añade dependencia y no mete
un motor de renderizado aparte. Traer una librería para dibujar rectángulos sería
desproporcionado (`docs/CONVENTIONS.md`, reglas 2 y 8).

Implementadas: `BarChart` (actividad, tiempo, velocidad, añadidas, actividad por hora),
`CalendarHeatmap`, `MetricGrid` y `StatsTable` (comparación de mazos, origen, diferidas).

Colores: `chart` en `src/theme/tokens.ts`. Ningún componente declara el suyo. Paleta académica,
sin neón ni brillos.

**El color no es el único portador de información:** cada barra y cada celda llevan etiqueta
accesible con su fecha y su valor; la escala del calendario se explica con palabras y las celdas
con actividad llevan borde; cada fila de tabla se anuncia entera. Verificado en
`tests/unit/stats-charts.test.tsx` y en E2E.

---

## 9. PDF

**Escritor propio** (`src/features/stats/pdf/writer.ts`): PDF 1.4 real con cabecera, objetos
indirectos, catálogo, árbol de páginas, flujos de contenido, tabla `xref` con desplazamientos
calculados y `trailer`. Fuentes base-14 (Helvetica y Helvetica-Bold) con `WinAnsiEncoding`, sin
incrustar nada.

Justificación de escribirlo en vez de añadir dependencia: el proyecto ya escribe su propio
lector de `.xlsx` por la misma razón. Lo que hace falta es un subconjunto pequeño y estable del
formato (texto y rectángulos), y las alternativas o pesan mucho más de lo que se usa, o dependen
del navegador y no podrían ejercitarse en los tests unitarios, que es donde hay que demostrar
que el PDF sale bien. Con escritor propio los tests afirman sobre los bytes de verdad, con un
lector independiente que no comparte código con el escritor
(`tests/fixtures/stats/pdfReader.ts`).

**Contenido**: portada (aplicación, ámbito, periodo, fecha de generación, trackingStart),
resumen de nueve cifras, actividad, calendario, tiempo, velocidad, conteo, añadidas, actividad
por hora, comparación de mazos (solo si es global), origen y métricas diferidas. Multipágina
real, con salto cuando una sección no cabe entera.

**Aislamiento por mazo**: verificado. El PDF de Inglés no contiene «Matemáticas»,
«Programación» ni «Historia» como textos dibujados, ni sus cifras exclusivas (310, 180, 90,
1000), ni la sección de comparación.

**Coherencia con el panel**: los dos llaman a `buildStatsReport`. No hay una segunda
implementación de ninguna fórmula. Verificado leyendo la cifra de la pantalla y encontrándola
literalmente en el PDF generado.

**Exportación**: `src/lib/files/saveFile.ts`, mismo patrón de puerto que el selector de
archivos.

- **Web**: `Blob` + enlace de descarga. **Probado de verdad** en E2E en Chrome de escritorio,
  Pixel 5 y iPhone 13/WebKit: se intercepta la descarga y se comprueba que los bytes empiezan
  por `%PDF-1.4` y terminan en `%%EOF`.
- **iOS y Android**: se escribe en el directorio de caché con `expo-file-system` y se ofrece con
  `expo-sharing`. **No se ha ejecutado nunca en dispositivo ni en simulador**; el gate E2E de
  este proyecto es solo web. Está tipada y aislada, pero no probada, igual que ya ocurre con la
  lectura de archivos de TASK-005.

---

## 10. Dependencias añadidas

| Dependencia | Versión | Por qué |
|---|---|---|
| `expo-sharing` | `~57.0.14` | Única forma apropiada de entregar un archivo en iOS y Android: guardar en un directorio de la caja de arena que la persona usuaria no puede abrir no cumple «compartir/guardar». Es un módulo del mismo SDK ya en uso, un solo paquete, y su uso está aislado en `saveFile.ts` detrás del puerto `FileSaver`. **No verificada en dispositivo.** |

No se añadió ninguna librería de gráficas ni de PDF, por lo explicado en §8 y §9.

---

## 11. Borrado y renombrado

**Borrado.** Eliminar un mazo o una carta toca solo `LibraryRepository`. `StudyHistoryProvider`
no se entera y no modifica un solo evento. Caso obligatorio verificado en
`tests/integration/stats-deletion.test.tsx`: 10 cartas estudiadas → eliminar el mazo → biblioteca
sin mazo ni cartas, historial con las 10 estudiadas y su tiempo, informe global idéntico antes y
después, y todo sigue igual tras reconstruir la aplicación. El mazo eliminado aparece en la
comparación nombrado por su snapshot y marcado «(eliminado)», y **no vuelve** al selector de
ámbito ni a la biblioteca. No se creó papelera ni restauración.

**Renombrado.** La identidad es el `id`, así que renombrar no crea un segundo historial: solo
avanza el snapshot de `meta`. Un snapshot más viejo nunca pisa a uno más reciente. El nombre
mostrado se resuelve contra la biblioteca actual y, si el mazo ya no existe, contra el snapshot.

---

## 12. Defectos encontrados y corregidos durante la implementación

1. **Actualizaciones perdidas en el historial.** Dos `append` concurrentes hacían
   lectura-modificación-escritura sobre la misma partición y se pisaban: al estudiar tres cartas
   seguidas solo se guardaban dos. Corregido serializando las escrituras en una cola
   (`studyHistoryRepository.ts`). Regresión cubierta por los tests de integración de tracking.
2. **Rango de series ciego a las altas.** El primer día del rango se calculaba solo con eventos
   de estudio, así que un periodo con tarjetas añadidas pero sin estudiar dejaba la gráfica de
   añadidas en blanco. Corregido en `engine.ts`; el divisor del promedio sigue siendo la
   actividad de estudio.
3. **Estado activo de navegación no accesible en web.** `react-native-web` descarta
   `accessibilityState.selected` en un elemento con rol de enlace: el destino activo quedaba
   marcado **solo por color**. Corregido añadiendo `aria-current="page"` en
   `NavigationItemButton`. Test de regresión en `tests/unit/responsive.test.tsx`.
4. **Formato de número dependiente de la plataforma.** `Intl.NumberFormat` depende del ICU que
   traiga cada plataforma, y una cifra no puede leerse distinto en el PDF de web y en el de un
   móvil. Sustituido por un agrupador propio y determinista.

## 12 bis. Correcciones tras la primera revisión

El reviewer devolvió `CHANGES_REQUIRED` con tres hallazgos, todos en el generador de PDF.
Corregidos, cada uno con test de regresión:

5. **Escala del calendario del PDF hardcodeada.** Los tres tonos intermedios estaban escritos
   a mano en `pdf/report.ts`, duplicando `chart.calendarScale` de `src/theme/tokens.ts`. Era
   una segunda fuente de verdad: cambiar la escala en el theme habría dejado la pantalla y el
   PDF con calendarios de distinto color sin aviso. Ahora se lee del theme. Regresión: el test
   comprueba que los cinco tonos del theme aparecen como operadores de relleno en el PDF.
6. **`/Title` mal codificado.** Las cadenas del diccionario `/Info` se leen en PDFDocEncoding,
   no en WinAnsi, así que el guion largo salía como `Š` en el título que muestran los lectores.
   Ahora se emiten en UTF-16BE con marca de orden de bytes cuando hay caracteres fuera de
   ASCII, y como literal legible cuando no los hay. Verificado con PyMuPDF: el título vuelve a
   leerse `Reporte de estudio — Todos los mazos — Todo el historial`.
7. **La rejilla de cifras del PDF no protegía el ancho de columna.** Sin canalón ni recorte,
   una etiqueta más larga que su columna se habría metido en la siguiente sin aviso; con
   cuatro columnas el margen sobrante era de 7 pt. Añadido canalón de 10 pt y recorte con
   `truncateText`, que el mismo archivo ya usaba en las tablas. Regresión: el test mide todas
   las etiquetas del PDF generado y comprueba que ninguna supera el ancho útil.

---

## 13. Gates

Todos ejecutados sobre el árbol final.

| Gate | Comando | Resultado |
|---|---|---|
| typecheck | `npm run typecheck` | **OK** |
| lint | `npm run lint` | **OK**, 0 errores y 0 avisos |
| unit | `npm run test` | **430 pasan** (251 antes; +179) |
| integration | `npm run test:integration` | **172 pasan** (114 antes; +58) |
| e2e | `npm run test:e2e` | **178 pasan**, 6 skipped, en desktop-chrome, Pixel 5 e iPhone 13 |
| final | `./init.sh` | **exit 0** |

Los 6 *skipped* de E2E son condicionales por proyecto: 3 preexistentes de accesibilidad táctil
(solo móvil) y 3 de la sección nueva por el mismo motivo. Ninguna aserción anterior se debilitó;
los tres tests de integración preexistentes que montaban su propio layout solo se envolvieron con
`StudyHistoryProvider`, sin tocar sus aserciones.

---

## 14. Limitaciones reales

1. **La rama nativa de guardado/compartir del PDF no se ha ejecutado nunca** en dispositivo ni
   simulador. El gate E2E es solo web.
2. **El tiempo activo mide visibilidad, no atención.** Una ventana visible pero desatendida sigue
   sumando. En web, `visibilitychange` no detecta que otra aplicación tape la ventana.
3. **La pantalla fija «hoy» al montarse.** Si se deja abierta al cruzar la medianoche, «Hoy»
   sigue mostrando el día anterior hasta volver a entrar.
4. **La racha se calcula dentro del periodo seleccionado.** Con «Todo» es la racha de todo el
   historial; con «1 mes» solo mira esos 30 días.
5. **La serie de añadidas es histórica y el baseline es estado actual.** Una carta añadida y
   luego borrada sigue contando en la serie del día en que se añadió, porque se añadió.
6. **El calendario de «Todo» abarca desde el primer día con actividad.** Con años de historial
   la rejilla será larga; hoy el historial empieza en la activación del tracking.
7. **Concurrencia entre pestañas** (heredada de TASK-004): dos pestañas escriben sobre las mismas
   claves sin coordinación entre procesos. La cola de escritura serializa dentro de una pestaña,
   no entre pestañas.
8. **Los datos son locales al navegador o dispositivo.** Borrar los datos del sitio o cambiar de
   dispositivo hace desaparecer también el historial.

## 15. Métricas de Anki que todavía no pueden calcularse

Future Due, Review Intervals, Card Ease, Retention y Answer Buttons. Todas dependen de
decisiones de producto que siguen sin tomarse: algoritmo de repetición espaciada, escala de
calificación, Ease, scheduler y retención por aprobación/fallo. Se declaran con su motivo en la
pantalla y en el PDF; no se muestran a cero ni se simulan.

---

**Implementer no se autoaprueba.** Pasa a revisión independiente.
