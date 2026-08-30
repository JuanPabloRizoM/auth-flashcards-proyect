# TASK-007 — Evidencia de implementación

**Tarea:** Repetición espaciada FSRS, cola diaria de estudio y estadísticas de revisión
**Contrato:** `.harness/contracts/TASK-007.json` (149 filas de verification matrix)
**Fecha:** 2026-08-30

---

## 1. Dependencia FSRS elegida

| | |
|---|---|
| **Paquete** | `ts-fsrs` |
| **Versión** | `5.4.1` (implementa **FSRS-6.0**; la librería lo declara como `v5.4.1 using FSRS-6.0`, y esa cadena es la que se persiste, leída de la librería y no escrita a mano) |
| **Autor** | [open-spaced-repetition](https://github.com/open-spaced-repetition/ts-fsrs), el mismo grupo que desarrolla el algoritmo |
| **Licencia** | MIT |
| **Publicada** | 2026-05-22 (rama 6.0.0 en beta activa; 5.4.1 es la etiqueta `latest`) |
| **Dependencias en runtime** | ninguna |
| **Tamaño** | 60 KB el bundle ESM, 24 KB los tipos |

### Comprobaciones hechas **antes** de instalarla

Se descargó el paquete con `npm pack` y se inspeccionó el bundle publicado, en vez de
confiar en la descripción:

- **Mantenimiento.** Publicaciones en 2025 y 2026 (5.2.0, 5.2.1, 5.3.0, 5.4.0, 5.4.1) y ocho
  betas de la 6.0.0. No es un paquete abandonado.
- **Licencia.** MIT, en el `LICENSE` del propio tarball.
- **Node.** `engines.node >= 20.0.0`; el proyecto exige `>= 20.19.4`. Compatible.
- **APIs exclusivas de Node.** Ninguna. El escaneo del bundle no encuentra `process`,
  `Buffer`, `__dirname` ni imports `node:*`; la única coincidencia textual de `process.` está
  dentro de un comentario de JSDoc.
- **Formatos.** Publica ESM (`dist/index.mjs`), CommonJS (`dist/index.cjs`), UMD y tipos, con
  `exports` bien declarados: Metro resuelve el ESM y Jest el CJS, sin adaptadores.
- **Red.** No hace ninguna petición: `grep` de `fetch(`, `XMLHttpRequest` y `https://` sobre
  `src/features/scheduler` no devuelve nada. El scheduling se calcula entero en el dispositivo.
- **Determinismo.** `enable_fuzz` es `false` por defecto y se mantiene en `false`. Sin fuzz no
  hay generador aleatorio en juego, el preview coincide exactamente con la calificación y los
  tests golden pueden comparar contra valores fijos.

Se probó además con una ejecución real antes de decidir: secuencia de calificaciones,
comprobación de que `repeat` no muta la carta de entrada y de que dos llamadas idénticas dan
resultados idénticos.

**No se escribieron las fórmulas a mano y no se sustituyó FSRS por SM-2**, que era una
decisión de producto explícita.

---

## 2. Parámetros

Los de la propia librería (`generatorParameters`), con la retención objetivo confirmada:

```text
request_retention  0.9        ← decisión de producto, y a la vez el valor por defecto
maximum_interval   36500 días
learning_steps     ["1m", "10m"]
relearning_steps   ["10m"]
enable_fuzz        false      ← fijado a propósito
enable_short_term  true
w                  los 21 pesos por defecto de FSRS-6.0
```

No se copiaron parámetros optimizados de terceros y no se implementó optimización
automática: ambas cosas están fuera de scope. Los parámetros se persisten con la biblioteca
(`library.scheduler`) para que una migración futura pueda compararlos en vez de adivinarlos.

No existe interfaz para cambiar la retención objetivo, tal y como se pidió.

---

## 3. Abstracción del scheduler

```text
Pantallas ─► features/study ─► SpacedRepetitionScheduler ─► fsrsAdapter.ts ─► ts-fsrs
                features/stats ─┘
```

- `src/features/scheduler/types.ts` — contrato y tipos propios: `CardScheduling`,
  `ReviewRating` (`otra-vez | dificil | bien | facil`), `SchedulingState`
  (`nueva | aprendiendo | repaso | reaprendiendo`) y `SpacedRepetitionScheduler` con
  `preview`, `rate`, `getRetrievability` e `isDue`.
- `src/features/scheduler/fsrsAdapter.ts` — **el único archivo del proyecto que importa
  `ts-fsrs`**. Comprobable: `grep -rn "ts-fsrs" app src` devuelve solo ese archivo.
- `src/features/scheduler/format.ts` — cómo se lee un intervalo (`1 min`, `6 min`, `2 días`).

Ningún componente React, ni el motor de estadísticas, ni el historial conocen la librería.

---

## 4. Reloj

`src/lib/clock.ts` expone `Clock` (`now()` en milisegundos), `systemClock` y
`createTestClock` con `set`, `advance` y `advanceDays`. El scheduler **no lee el reloj**:
recibe el instante como argumento. Las pantallas de estudio, detalle del mazo y estadísticas
aceptan un `clock` inyectable.

Comprobación de que no queda ninguna lectura dispersa:

```bash
grep -rn "new Date()\|Date.now()" src/features/scheduler src/features/study
# sin resultados
```

Esto es lo que permite el test que fija `2026-03-10T09:00`, califica, adelanta el reloj 30
días y comprueba que la tarjeta vuelve a la cola.

---

## 5. Modelo de Card y migración

### Modelo

`Card` gana `scheduling`:

```text
state, due (null solo en Nueva), lastReview, stability, difficulty,
elapsedDays, scheduledDays, learningSteps, reps, lapses
```

`learningSteps` está porque FSRS-6 lo necesita para los pasos cortos; sin él no se puede
reproducir el cálculo. No hay campos redundantes.

`due` es `null` en las cartas Nueva a propósito: una carta nueva está *disponible* siempre,
pero no está *programada* para ningún día. Representarlo como "ahora" habría fabricado un
dato y habría metido las cartas nuevas en Future Due.

### Migración

Documento de biblioteca: **versión 2 → 3**, misma clave `flashcards:library:v1`.
Documento de historial: **versión 1 → 2**, mismas claves.

Las versiones 1 y 2 de la biblioteca se siguen leyendo y se migran al vuelo. Cada carta
anterior recibe `newScheduling` (estado Nueva). **No se le fabrica ninguna revisión, ninguna
calificación ni ninguna fecha de vencimiento.** El historial de TASK-006 se conserva íntegro
y sus eventos **no** se convierten en calificaciones: registran que una carta se estudió, no
cómo salió.

Fixtures reales en `tests/fixtures/migration/`, con la forma exacta que tenían los documentos
de las versiones anteriores, montados en los repositorios con sus claves de verdad
(`tests/integration/library-migration.test.tsx`, 15 tests).

---

## 6. Cola de estudio y sesión

**Orden**, documentado en `src/features/study/queue.ts`:

1. aprendizaje y reaprendizaje ya vencidos,
2. repasos vencidos, del más atrasado al menos,
3. cartas nuevas, en el orden en que se crearon.

Desempate estable por posición. Sin aleatoriedad: la misma biblioteca y el mismo instante dan
siempre la misma cola.

**Dentro de la sesión**, una carta que tras calificarse sigue en aprendizaje o reaprendizaje
vuelve al final de la cola; una que pasa a repaso sale. Es determinista y no depende del
minuto exacto, así que se puede probar sin esperar.

**Contadores del mazo**: Nuevas / Aprendiendo / Repasar describen exactamente lo que la cola
contendría ahora mismo. Una tarjeta programada para el futuro no se cuenta como vencida. Las
que están aprendiendo pero cuyo turno llega en unos minutos se anuncian aparte, en una frase,
en vez de desaparecer sin explicación.

**Terminar sesión** está siempre disponible: cierra la `StudySession`, persiste, no toca las
tarjetas no respondidas y vuelve al mazo.

---

## 7. Calificaciones y preview

Tras *Mostrar respuesta* aparecen cuatro botones, en español, cada uno con el intervalo que
produce:

```text
[ Otra vez ]  [ Difícil ]  [ Bien ]  [ Fácil ]
   1 min        6 min       10 min    8 días
```

Los cuatro valores salen de `scheduler.preview(...)`. **Ninguno está escrito a mano**, y hay
un test que comprueba que el intervalo del botón es exactamente
`formatSchedulingInterval(preview[rating].intervalMs)`.

Sin fuzz y con el mismo instante, calificar produce **exactamente** el mismo resultado que el
preview: `expect(scheduler.rate(s, r, now)).toEqual(preview[r])` para las cuatro.

Ayuda visual discreta: una línea corta bajo cada etiqueta (*"La recordaste con dificultad"*).
No es un tutorial permanente.

**Difícil es aprobatoria.** `isPassingRating` lo centraliza y `tests/unit/rating-semantics.test.ts`
existe precisamente para que nadie lo trate como fallo.

---

## 8. Registro de revisiones

`StudyReviewEvent` en el historial, append-only, particionado por mes como el resto:

```text
id, sessionId, deckId, cardId, reviewedAt, rating,
previousState, newState, previousDue, newDue,
previousIntervalDays, newIntervalDays, elapsedDays,
stability, difficulty, durationMs,
schedulerId, schedulerVersion, localDay, localHour
```

Guarda de dónde venía la carta y a dónde fue: con el intervalo previo, una estadística puede
clasificar la revisión por la madurez que la carta tenía *en ese momento*, que es lo que
separa Young de Mature.

`ratedSince` se fija con la primera calificación y no se mueve. Es la frontera entre lo que
se midió y lo que no.

---

## 9. Consistencia al calificar

Dos almacenes sin transacción común. Estrategia, en `src/features/study/review.ts` y
documentada en `docs/DATABASE.md`:

1. biblioteca primero, esperando confirmación;
2. si falla, no se escribe nada más y **no se avanza de tarjeta**;
3. si sale bien, historial, esperando confirmación;
4. si el historial falla, **se revierte la biblioteca** al valor anterior;
5. si la compensación también falla, se dice explícitamente.

En ninguna rama se avanza en silencio. **Límite conocido y documentado:** no es atomicidad
real; un corte entre 1 y 3 deja la programación aplicada sin registro. La consecuencia es
acotada y no es corrupción.

Doble pulsación: cerrojo síncrono con `useRef` (un estado de React llegaría tarde) más
`disabled` en los cuatro botones mientras se guarda.

---

## 10. Estadísticas desbloqueadas

Todas se derivan de datos reales del scheduler y del registro de calificaciones. Se extendió
el `StatsEngine` de TASK-006; **no hay un segundo sistema de estadísticas**.

| Sección | Qué mide | Filtro |
|---|---|---|
| **Próximos repasos** (Future Due) | revisiones programadas por día, con atraso y "más allá del horizonte" | ámbito + periodo como horizonte |
| **Calificaciones** (Answer Buttons) | veces que se usó cada botón, y aparte las sin calificar | ámbito + periodo |
| **Retención real** (True Retention) | % de aciertos, Young / Mature / Total | ámbito + sus propias ventanas |
| **Intervalos de repaso** | distribución y mediana de intervalos reales | ámbito |
| **Estabilidad** | distribución y mediana | ámbito |
| **Dificultad** | distribución 1–10 y mediana | ámbito |
| **Probabilidad de recuerdo** (Retrievability) | R calculada en el instante actual | ámbito |
| **Estado de las tarjetas** | Nuevas / Aprendiendo / Reaprendiendo / Young / Mature | ámbito |

**Por qué las de inventario no llevan periodo.** Un intervalo, una estabilidad o una
dificultad no tienen un "hace tres meses": son los de hoy. Es el mismo convenio que TASK-006
ya seguía con el conteo de tarjetas y el origen, y está escrito en `src/features/stats/fsrs.ts`.

**True Retention** usa la primera revisión calificable de cada tarjeta en cada día, y solo
las de tarjetas que ya estaban en repaso —es la definición de la métrica: mide si te
acordabas de algo ya aprendido—. Las revisiones de aprendizaje excluidas se cuentan y se
exponen en `excludedLearning`, para que la omisión no sea invisible. Young es intervalo
previo < 21 días; Mature, ≥ 21.

**Nada se dibuja a cero.** Sin calificaciones, las secciones muestran una nota que dice desde
cuándo hay datos, y la retención se rinde como `null`, no como 0 %.

**Card Ease** queda como única métrica diferida, con su motivo: pertenece a SM-2 y FSRS no la
calcula; su equivalente es Difficulty, que sí se muestra.

---

## 11. PDF

Las ocho secciones nuevas se incorporan al reporte existente, con el mismo motor, el mismo
ámbito y el mismo periodo. Cuando no hay calificaciones, el PDF escribe la nota explicativa
en vez de una gráfica de ceros. Un reporte de un mazo no contiene el nombre ni las cifras de
otro, y hay un test que lo comprueba literalmente.

---

## 12. Tests

| Gate | Antes | Ahora |
|---|---|---|
| `npm run test` (unit) | 430 | **636** |
| `npm run test:integration` | 172 | **229** |
| `npm run test:e2e` | 178 + 6 skipped | **204 + 6 skipped** |

### Golden tests — `tests/unit/scheduler-golden.test.ts` (32 tests)

Fixture `tests/fixtures/scheduler/golden.json`, que registra **versión de la librería,
parámetros completos con los 21 pesos, retención objetivo, fecha de partida, calificaciones y
resultados esperados**. La secuencia recorre los cuatro estados y las cuatro calificaciones:

```text
2026-01-01T10:00  Nueva          → Bien      → Aprendiendo    due 10:10
2026-01-01T10:10  Aprendiendo    → Bien      → Repaso         due 2026-01-03T10:10
2026-01-03T10:10  Repaso         → Otra vez  → Reaprendiendo  due 10:20   lapses 1
2026-01-03T10:20  Reaprendiendo  → Difícil   → Reaprendiendo  due 10:35
2026-01-03T10:35  Reaprendiendo  → Fácil     → Repaso         due 2026-01-04T10:35
```

Se compara vencimiento exacto, intervalo, estado, estabilidad, dificultad, `reps`, `lapses`,
`scheduledDays`, `elapsedDays` y `learningSteps`, y además los cuatro intervalos del preview
en cada paso. Si mañana se sube la versión de FSRS y el scheduling cambia, esto se pone en
rojo. Regenerar es deliberado:

```bash
npx tsx tests/fixtures/scheduler/generar_golden.ts > tests/fixtures/scheduler/golden.json
```

### Otros ficheros nuevos

- `tests/unit/scheduler-fsrs.test.ts` (25) — contrato de la abstracción: estados,
  transiciones, contadores, preview sin mutación, retrievability que baja con el tiempo.
- `tests/unit/study-queue.test.ts` (25) — selección y orden de la cola; contadores del mazo.
- `tests/unit/rating-semantics.test.ts` (15) — Otra vez = fallo, Difícil/Bien/Fácil = acierto,
  y que Difficulty no es el botón Difícil.
- `tests/unit/stats-fsrs.test.ts` (61) — las ocho secciones, con datasets calculables a mano.
- `tests/unit/clock.test.ts` (5) — el reloj inyectable.
- `tests/unit/study-session.test.ts` — reescrito para la sesión con calificación.
- `tests/integration/study-fsrs-flow.test.tsx` (20) — flujo real por la interfaz:
  ocultar/mostrar calificaciones, intervalos reales, persistencia, doble pulsación, cola,
  avance del reloj, terminar sesión, contadores del mazo.
- `tests/integration/study-atomicity.test.tsx` (8) — fallo al guardar la biblioteca, fallo al
  registrar la revisión, compensación, y las cuatro ramas de `commitReview`.
- `tests/integration/library-migration.test.tsx` (15) — migración con fixtures reales.
- `tests/integration/stats-fsrs-flow.test.tsx` (7) — estadísticas en la aplicación,
  aislamiento por mazo, borrado de carta y de mazo.
- `tests/e2e/study-fsrs.spec.ts` (9, ×3 proyectos) — navegador real: ciclo completo,
  recarga, doble clic, objetivos táctiles, estadísticas tras estudiar.

### Volumen

`tests/unit/stats-performance.test.ts`: **1.000 tarjetas programadas y 10.000
calificaciones**. Se comprueba exactitud (las 10.000 se cuentan y se reparten), aislamiento
por mazo, y que la salida está agregada: las distribuciones tienen menos de 20 tramos y
Future Due un punto por día del horizonte, no uno por revisión.

### Aislamiento entre mazos

10 revisiones en un mazo y 30 en otro: global 40, A 10, B 30. Answer Buttons, Future Due y
True Retention respetan el mismo aislamiento (`tests/unit/stats-fsrs.test.ts`).

---

## 13. Resultado observable

- **Detalle del mazo:** tarjeta "Resumen de estudio" con Nuevas / Aprendiendo / Repasar.
- **Estudiar:** frente → *Mostrar respuesta* → frente + reverso → cuatro botones con su
  intervalo → siguiente tarjeta. *Terminar sesión* siempre visible.
- **Estadísticas:** ocho secciones nuevas, con los selectores de ámbito y periodo existentes.
- **PDF:** las mismas ocho secciones, con las mismas cifras.

Verificado en Chrome de escritorio, Pixel 5 y iPhone 13/WebKit por el gate E2E, sin
desbordamiento horizontal y con los cuatro botones por encima del mínimo táctil de 44 px.

---

## 14. Riesgos y limitaciones

- **No hay atomicidad real** entre los dos almacenes locales. La estrategia de compensación
  acota el daño y está documentada; un corte de corriente en mitad de una calificación puede
  dejar la programación aplicada sin su registro.
- **El PDF recorta el texto al ancho de su columna.** Es el comportamiento de TASK-006; las
  notas explicativas de las secciones nuevas se escribieron cortas a propósito.
- **La retrievability se fija al abrir la pantalla**, igual que "hoy" en TASK-006. Dejar la
  pantalla abierta no la actualiza sola. Es preferible a que las cifras bailen.
- **La cola de la sesión se construye una vez, al entrar.** Una tarjeta que venza mientras se
  estudia no se añade sobre la marcha; entra en la sesión siguiente.
- **Aprendiendo cuenta solo lo disponible ahora.** Las que vencen en unos minutos se anuncian
  aparte. El resumen se calcula al montar la pantalla y cuando cambia la biblioteca, no con
  el reloj: hay que volver a entrar al mazo para que el contador refleje el paso del tiempo.
  Es la misma decisión que en TASK-006 con "hoy", y es preferible a que las cifras bailen.
- **Sin límites de nuevas/día ni de repasos/día**, porque son decisiones de producto no
  tomadas. Un mazo recién importado ofrece todas sus cartas nuevas de una vez.
- **La rama nativa sigue sin ejecutarse.** El gate E2E es solo web, como en TASK-006. El
  scheduler no usa nada específico de plataforma, pero el estudio con calificación no se ha
  probado nunca en iOS ni en Android.
- **`tsx` no es dependencia del proyecto.** Regenerar los fixtures golden usa `npx tsx`, que
  lo descarga al vuelo. El fixture está commiteado, así que los tests no lo necesitan.
- **La concurrencia entre pestañas sigue sin coordinarse.** Calificar la misma tarjeta en dos
  pestañas a la vez sigue el patrón de TASK-004: la última escritura gana.

---

## 15. Gates

```text
npm run typecheck        OK
npm run lint             OK
npm run test             636 tests, 33 suites
npm run test:integration 229 tests, 19 suites
npm run test:e2e         204 passed, 6 skipped (desktop-chrome, Pixel 5, iPhone 13)
./init.sh                exit 0
```

---

## 16. Correcciones tras el primer review

El reviewer independiente emitió **APPROVED** con un finding medio y once bajos. Se cerraron
los que afectan a corrección o a honestidad de lo que se muestra; el resto se decidió caso
por caso.

| Finding | Qué se hizo |
|---|---|
| **M-1** — el emparejamiento revisión↔evento para "sin calificar" era un invariante implícito y sin test | Se extrajo `countUnratedEvents` en `stats/fsrs.ts`, con el invariante documentado; se añadió un comentario en `StudyHistoryProvider.review` explicando por qué el instante es uno solo; y **cinco tests nuevos**: cuatro unitarios sobre el helper y uno de integración que califica de verdad y afirma `unrated === 0` |
| **B-1** — `excludedLearning` se documentaba como visible y no se mostraba | Ahora se muestra: nota bajo la tabla de retención en la pantalla y línea en el PDF, en los dos casos también cuando la tabla está vacía, que es cuando más falta hace. Con test de integración |
| **B-2** — exports muertos | Eliminados `noRatings`, `horizonOf`, `scopedCards` (el duplicado), `sessionFromQueue`, `isMatureInterval` y `schedulingStateLabels` |
| **B-3** — `averagePerDay` documentado como `null` y devolvía `0` | Devuelve `null` sin nada programado, como decía su documentación |
| **B-4** — versión de la librería escrita a mano | Sale de `FSRSVersion`, leído de la propia librería: `ts-fsrs v5.4.1 using FSRS-6.0`. Fixture golden regenerado |
| **B-5** — render impuro en el detalle del mazo | `deckStudySummary` dentro de `useMemo`, como en las otras dos pantallas |
| **B-6** — ventana teórica al soltar el cerrojo | Segundo guardia: se recuerda la última *aparición* calificada (carta + turno en la sesión) y se rechaza repetirla |
| **B-7** — asimetría con el historial suspendido, no documentada | Documentada en `docs/DATABASE.md` y comentada en el proveedor, con el porqué |
| **B-8** — `ratedSince` podía quedar en disco sin revisiones | `writePatch` escribe primero las particiones y después los metadatos |
| **B-9** — `Math.min(...values)` sobre la muestra completa | Sustituido por un `reduce` |
| **B-10** — extensiones `.ts` en la matriz del contrato | **Sin cambios: el finding no se sostiene.** Las 40 filas de integración ya citaban `.tsx`; comprobado con `grep` sobre el contrato |
| **B-11** — `progress/current.md` desalineado y sin los pendientes heredados | Se corrige al cerrar la tarea, con el estado real y los pendientes de las cinco tareas anteriores restaurados y actualizados |

---

## 17. Correcciones tras el segundo review

Un reviewer independiente **nuevo** repitió la revisión completa sobre el trabajo ya
corregido. Veredicto: **APPROVED**, con un finding medio y siete bajos. El medio era un bug
real que el primer reviewer no vio.

| Finding | Qué se hizo |
|---|---|
| **F-1 (medio)** — reintentar tras una escritura parcial del historial podía **duplicar la revisión**: el `id` se emitía nuevo en cada intento, así que `upsertById` añadía una segunda entrada en vez de reemplazar. Una sola respuesta habría contado dos veces en Answer Buttons y en True Retention | El id se deriva ahora del evento de la carta, que es estable durante toda la aparición: `` `${pending.id}-review` ``. Con eso el registro es idempotente frente a reintentos. **Cuatro tests nuevos**: dos unitarios sobre el repositorio (mismo id no duplica, ids distintos sí se guardan) y uno de integración que rompe el medio, lo arregla, reintenta por la interfaz y afirma una sola revisión y `reps === 1` |
| **F-2 (medio)** — `progress/current.md` desalineado y sin los pendientes heredados | Corregido al cerrar la tarea, con el estado real y los pendientes de las cinco tareas anteriores restaurados |
| **F-3** — la nota de exclusión del PDF se dibujaba sin reservar espacio y podía caer bajo el margen inferior | `ensure(document, flow, 26)` antes de escribirla |
| **F-4** — dos exports nuevos usados solo dentro de su archivo | `firstReviewPerCardPerDay` y `distributionBars` dejan de exportarse |
| **F-5** — comentarios con la forma antigua de la versión | Actualizados en `serialization.ts` y en `fsrsAdapter.ts`: ya no fijan un número a mano |
| **F-6** — cobertura ausente en varias correcciones | **Diez tests nuevos**: `averagePerDay` nulo sin nada programado; `min`/`max`/`average` nulos sin muestra; `retentionExclusionNotice` en singular, plural y vacío; la línea del PDF con su cifra; el orden de escritura del historial (partición antes que metadatos) |
| **F-7** — la evidencia describía mal el contador tras memoizarlo | §14 corregida: el resumen se recalcula al montar y al cambiar la biblioteca, no con el reloj |
| **F-8** — `queue.isAvailable` y `scheduler.isDue` divergían ante una carta sin vencimiento | Alineadas: sin vencimiento no hay nada que esperar. Test parametrizado que compara las dos sobre seis estados, incluido el imposible-pero-aceptado por el validador |

---

## 18. Correcciones tras QA

QA independiente condujo la aplicación en un navegador real y emitió **APPROVED** con cuatro
hallazgos bajos. Tres se corrigieron; el cuarto se documenta.

| Hallazgo | Qué se hizo |
|---|---|
| **QA-2** — *Actividad por hora* seguía diciendo "el estudio todavía no califica", cierto en TASK-006 y falso ahora | Texto sustituido en la pantalla y en el PDF, con test en los dos |
| **QA-3** — el horizonte de Próximos repasos se anunciaba como "último mes", una etiqueta de pasado para algo que mira adelante | Ahora dice "Repasos programados para los próximos 30 días", y "sin límite de horizonte" con Todo. Con test en pantalla y en PDF |
| **QA-4** — el panel mostraba la **mínima** probabilidad de recuerdo y el PDF el **máximo** | El helper de distribuciones acepta qué extremo mostrar; retrievability pide el mínimo en los dos. Test que compara la cifra del PDF con la que produce `retrievabilityMetrics` |
| **QA-1** — un doble clic revela la respuesta de la tarjeta siguiente | **No corregido, con motivo.** La protección de doble pulsación funciona: no se califica dos veces ni se escribe un segundo registro, que es lo que exige L1. El efecto es de maquetación —el segundo clic cae donde ahora está *Mostrar respuesta*— y ninguna corrección es limpia: un antirrebote temporal haría el comportamiento dependiente del reloj, consumir la primera pulsación posterior rompería calificar y revelar seguido, y mover los controles desplazaría el problema a *Terminar sesión*. Queda como pendiente registrado |
