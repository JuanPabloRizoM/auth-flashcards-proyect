# TASK-007 — Evidencia de QA

**Tarea:** Repetición espaciada FSRS, cola diaria de estudio y estadísticas de revisión
**Modalidad:** QA independiente, read only sobre el código, conduciendo la aplicación real en un navegador
**Fecha:** 2026-08-30

---

## Veredicto

# APPROVED

Sin bugs bloqueantes. Cuatro hallazgos bajos, tres corregidos y uno documentado como
limitación conocida.

---

## Cómo se probó

Aplicación levantada con `npx expo start --web --port 8123` y conducida a mano en un
navegador real sobre `http://localhost:8123`, partiendo de `localStorage.clear()`. QA no
tocó ningún archivo del repositorio ni el reloj del sistema operativo.

---

## Recorrido y resultados

### Persistencia de partida
Tras crear los mazos, `flashcards:library:v1` contiene `"version": 3` y el bloque real del
scheduler:

```json
{"id":"fsrs","version":"ts-fsrs v5.4.1 using FSRS-6.0",
 "parameters":{"requestRetention":0.9,"maximumIntervalDays":36500,
 "learningSteps":["1m","10m"],"relearningSteps":["10m"],
 "enableFuzz":false,"enableShortTerm":true,"weights":[…21 pesos…]}}
```

Retención 0,90 y fuzz desactivado, como declara la evidencia. Historial en `version: 2` con
`ratedSince: null` antes de calificar.

### Resumen del mazo
- Inglés (4 cartas): **Nuevas 4 · Aprendiendo 0 · Repasar 0**.
- Matemáticas (3 cartas): **Nuevas 3 · Aprendiendo 0 · Repasar 0**.
- Con cero cartas el resumen no aparece y se invita a añadir alguna.

### Calificaciones
Antes de *Mostrar respuesta* **no hay ningún botón de calificación**. Después aparecen
exactamente cuatro, en español, con intervalo y ayuda corta:

```text
Otra vez  1 min    No la recordaste
Difícil   6 min    La recordaste con dificultad
Bien      10 min   La recordaste con esfuerzo normal
Fácil     8 días   La recordaste sin esfuerzo
```

**No son literales.** Los mismos cuatro botones cambian con el estado real de la carta: sobre
una carta ya en aprendizaje mostraron `1 min / 6 min / 2 días / 4 días`, y sobre otra
`1 min / 6 min / 10 min / 1 día`.

**El preview coincide con lo que produce calificar**: *Fácil 8 días* dejó `scheduledDays: 8`;
*Bien 2 días* dejó `scheduledDays: 2`; *Fácil 1 día* dejó `scheduledDays: 1`.

*Otra vez* dejó la carta en `aprendiendo` con vencimiento a un minuto y **la devolvió a la
sesión**. En disco: `previousState: "nueva" → newState: "aprendiendo"`, `stability: 0.212`,
`difficulty: 6.4133`, que son valores de FSRS-6, no cifras inventadas.

### Terminar sesión
Con `5 respuestas · 2 pendientes` se volvió al mazo, y las tarjetas no respondidas quedaron
intactas. Prueba limpia adicional: entrar a estudiar y salir sin responder deja la carta en
`{state:"nueva", due:null, lastReview:null, stability:0, difficulty:0, reps:0, lapses:0}`.

### Recarga
La programación completa —estado, vencimiento, estabilidad, dificultad, repeticiones y
lapsos— sobrevive a recargar la página. Las cartas con vencimiento a 2 y a 8 días **no** se
cuentan en *Repasar*: una tarjeta futura no aparece como vencida.

### Segunda sesión
La cola respetó lo ya calificado: solo apareció la carta de aprendizaje vencida, y quedaron
fuera los repasos futuros y la carta de aprendizaje que todavía no tocaba.

### Estadísticas, contrastadas contra el estado real en disco

| Sección | Mostrado | Comprobación |
|---|---|---|
| Estado de las tarjetas | Total 7 · Nuevas 3 · Aprendiendo 1 · Reaprendiendo 0 · Young 3 · Mature 0 | 3+1+0+3+0 = 7 |
| Próximos repasos | Programadas 4 · Vencidas 0 · Días con repasos 4 | coherente con los vencimientos |
| Calificaciones | 6 calificadas · Otra vez 1 · Difícil 1 · Bien 2 · Fácil 2 · Sin calificar 0 | coincide con las 6 respuestas dadas |
| Retención real | sin tabla, con la nota de desde cuándo hay datos y "6 respuestas quedan fuera por ser de tarjetas que todavía se estaban aprendiendo" | correcto: ninguna revisión fue de una carta en repaso, y **no dibuja 0 %** |
| Intervalos de repaso | 3 cartas · mediana 2 días · media 4 días · máx 8 | intervalos reales 1, 2 y 8 |
| Estabilidad | 4 cartas · mediana 2 días · media 3 · máx 8 | S = 0,424 / 1,293 / 2,307 / 8,296 |
| Dificultad | 4 cartas · mediana 3.6 · media 3.4 · máx 5.2 | D = 1 / 2,111 / 5,112 / 5,200 |
| Probabilidad de recuerdo | 3 cartas · 100 % | recién calificadas |

Las once secciones de TASK-006 siguen presentes y con datos.

### Aislamiento por mazo
- **Ámbito Inglés**: Total 4 · Nuevas 0 · Aprendiendo 1 · Young 3. **Ni una cifra de
  Matemáticas.**
- **Ámbito Matemáticas** (sin estudiar): Nuevas 3 y el resto a 0; Calificaciones y Retención
  muestran su nota; Intervalos, Estabilidad, Dificultad y Retrievability dicen que todavía no
  hay nada que medir; Próximos repasos, que no hay ninguno programado. Las cifras escalares
  se rinden como `—`, **no como 0**. **Ni una cifra de Inglés.**

### Periodos
Los cuatro responden de forma coherente: el promedio del periodo baja al ampliar la ventana
(0.2 → 0.1 → 0.0 por día), el eje de Próximos repasos se alarga, y con "Todo" el horizonte se
declara sin límite. Las métricas de inventario no cambian con el periodo, que es la decisión
declarada en el contrato.

### PDF
Bytes interceptados y analizados directamente.

- **Todos los mazos / Todo**: `%PDF-1.4`, 29 252 bytes, **5 páginas**. Contiene las ocho
  secciones nuevas con **las mismas cifras del panel** (Intervalos 2/4/8, Estabilidad 2/3/8,
  Dificultad 3.6/3.4/5.2, Estado 3/1/0/3/0, Calificaciones 1/1/2/2, Próximos repasos 4).
- **Inglés**: 28 182 bytes, 5 páginas, cabecera `MAZO / Inglés`. **No contiene la cadena
  "Matem" en ninguna parte**, y muestra `NUEVAS 0`: las tres nuevas de Matemáticas no se
  filtran.
- **Matemáticas**: no contiene "Ingl"; todas las secciones nuevas salen con su nota
  informativa en vez de gráficas de ceros.

### Avance del reloj
QA no tocó el reloj del sistema. Verificado por la vía de integración: leyó el test
`adelantar el reloj devuelve la tarjeta a la cola`
(`tests/integration/study-fsrs-flow.test.tsx`), comprobó que no es vacuo —califica, ve la
cola vacía, adelanta 30 días y afirma que la tarjeta vuelve— y lo ejecutó: **1 passed**.

### Consola
**Cero errores y cero warnings** en todo el recorrido. Solo los mensajes informativos de
Expo en desarrollo.

### Regresión
- **Renombrar mazo**: persistido y reflejado en la lista.
- **Editar carta**: el contenido cambia y **la programación se conserva intacta**
  (`state:"repaso"`, `due`, `stability: 8.2956`, `difficulty: 1`, `scheduledDays: 8`).
- **Eliminar carta**: desaparece de la biblioteca, del conteo (7→6) y de Próximos repasos
  (4→3), **pero su calificación sigue contando** en Calificaciones. Exactamente O1.
- **Eliminar mazo**: desaparece de la lista y del selector de ámbito; el conteo baja.
- **Estadísticas de TASK-006**: Hoy, actividad, calendario, tiempo, velocidad, racha y
  actividad por hora siguen presentes y con datos.

### Gates ejecutados por QA
```text
npm run typecheck          OK
npm run lint               OK
npm run test               633 passed · 33 suites
npm run test:integration   227 passed · 19 suites
study-fsrs.spec.ts         26 passed, 1 skipped (los tres proyectos)
```

---

## Hallazgos

### Corregidos tras el QA

**QA-2 — Texto obsoleto que se contradecía con la propia funcionalidad.**
*Actividad por hora* decía "No incluye tasa de acierto: **el estudio todavía no califica**",
frase cierta en TASK-006 y falsa desde esta task. Aparecía en la pantalla y en el PDF.
Sustituida por "El acierto por hora no se desglosa aquí: para eso están Calificaciones y
Retención real", con test en los dos sitios.

**QA-3 — El horizonte de Próximos repasos se anunciaba con una etiqueta de pasado.**
Decía "Horizonte: último mes" para algo que mira hacia delante, porque reutilizaba la
etiqueta del selector de periodo. Ahora dice "Repasos programados para los próximos 30 días"
y, con "Todo", "sin límite de horizonte". Con test en pantalla y en PDF.

**QA-4 — El PDF y el panel mostraban distinta cuarta cifra en Probabilidad de recuerdo.**
El panel mostraba la **mínima** —la tarjeta que peor se recuerda, que es lo informativo— y el
PDF el **máximo**, porque reutilizaba el helper genérico de distribuciones. Con
retrievabilidades dispares habrían mostrado números distintos para la misma sección, y
AC-PDF exige que coincidan. Corregido: el helper acepta cuál de los dos extremos mostrar, y
la sección de retrievability pide el mínimo. Con test que compara la cifra del PDF contra la
que produce `retrievabilityMetrics`.

### Documentado como limitación conocida

**QA-1 — Un doble clic sobre una calificación revela la respuesta de la tarjeta siguiente.**

La protección de doble pulsación **funciona**: no se aplica la calificación dos veces ni se
escribe un segundo registro. Lo que ocurre es que el segundo clic cae sobre el botón
*Mostrar respuesta* de la tarjeta siguiente, que ocupa el mismo espacio vertical que la fila
de calificaciones que acaba de desaparecer.

Reproducción: mazo con dos cartas nuevas, *Estudiar*, *Mostrar respuesta*, doble clic sobre
*Bien*. Resultado: `1 respuesta · 2 pendientes` —una sola calificación, correcto— pero la
tarjeta siguiente aparece ya revelada.

**No se corrigió, y el motivo es que ninguna corrección es limpia.** Un antirrebote temporal
haría el comportamiento dependiente del reloj y frágil en tests; consumir la primera
pulsación posterior rompería el uso legítimo de calificar y revelar seguido; y mover los
controles solo desplaza el problema a *Terminar sesión*, que estaría debajo. El contrato
exige que una doble pulsación no califique dos veces (L1), y eso se cumple y está probado en
integración y en E2E. Queda anotado en `progress/current.md` como pendiente registrado.

---

## Lo que no se pudo probar, y por qué

- **Estados Reaprendiendo y Mature**: exigen calificar *Otra vez* sobre una carta ya en
  repaso, o alcanzar un intervalo de 21 días o más. Las dos cosas requieren adelantar el
  reloj, que QA no debe tocar. Cubierto por la vía de integración: los tests golden recorren
  `repaso → Otra vez → reaprendiendo` con `lapses: 1`, y `stats-fsrs.test.ts` cubre Mature.
- **Tiempo de estudio y velocidad salen en 0 s** en el panel automatizado, porque
  `document.visibilityState === "hidden"`: el cronómetro de tiempo activo de TASK-006 no
  suma con la superficie oculta, que es su comportamiento correcto. No es un fallo de esta
  task.
- **Viewport móvil**: la maquetación a 375×812 es correcta (navegación inferior, resumen
  apilado, sin desbordamiento), pero el panel dejó de aceptar clics sintéticos al activarse
  la emulación táctil. Cubierto por el gate E2E, que sí mide con `boundingBox()` que los
  cuatro botones superan el objetivo táctil en Pixel 5 e iPhone 13.
- **Importación CSV, XLSX y Markdown**: no hay forma de subir un archivo desde el panel.
  Cubierto por la suite de integración y E2E existente.
- **Rama nativa (iOS y Android)**: fuera del alcance del gate web, como declara la propia
  evidencia de implementación.

---

## Estado final tras las correcciones de QA

```text
npm run typecheck          OK
npm run lint               OK
npm run test               636 passed · 33 suites
npm run test:integration   229 passed · 19 suites
npm run test:e2e           204 passed, 6 skipped
./init.sh                  exit 0
```
