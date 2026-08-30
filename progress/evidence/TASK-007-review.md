# TASK-007 — Evidencia de review

**Tarea:** Repetición espaciada FSRS, cola diaria de estudio y estadísticas de revisión
**Modalidad:** dos revisiones independientes y consecutivas, ambas READ ONLY sobre el código
**Fecha:** 2026-08-30

---

## Veredicto final

# APPROVED

Emitido por el segundo reviewer independiente, sobre el trabajo ya corregido. Sin findings
críticos ni altos abiertos (CHECKPOINTS C5).

---

## Review 1

**Veredicto: APPROVED.** 1 finding medio, 11 bajos.

### Qué revisó y cómo

Task, contrato (149 filas de verification matrix, 22 acceptance), `docs/PRODUCT.md`,
`ARCHITECTURE`, `CONVENTIONS`, `DATABASE`, `VERIFICATION`, `CHECKPOINTS`, la evidencia de
implementación y el diff real completo (45 archivos modificados y 20 nuevos, leídos íntegros
los de producción).

Ejecutó los gates por su cuenta en vez de fiarse de la evidencia, y comprobó que los números
coincidían: `typecheck` OK, `lint` OK, 613 unit, 224 integration, 204 e2e + 6 skipped,
`verify.py` / `check_scope.py` / `check_evidence.py` a 0.

Reprodujo además las comprobaciones estáticas de la matriz e **inspeccionó
`node_modules/ts-fsrs` directamente**: 5.4.1, MIT, cero dependencias en runtime,
`engines.node >= 20`, ESM+CJS+UMD+tipos, y ninguna API exclusiva de Node —la única
coincidencia textual de `process.` está dentro de un JSDoc—.

### Intentos de rotura, y su resultado

| Intento | Resultado |
|---|---|
| FSRS real vs algoritmo casero | No se rompe. `grep` confirma un único importador |
| Difícil tratado como fallo | No se rompe. `isPassingRating` es la única frontera |
| Pérdida de datos en la migración (v1 / v2 / v3 / inválido) | No se rompe |
| Carta futura apareciendo antes en cola, contadores o Future Due | No se rompe. La misma regla en los tres caminos |
| `Date.now()` disperso | Ninguno en scheduler ni en estudio |
| Scheduling obsoleto entre dos calificaciones seguidas | No se rompe. `libraryRef` evita el closure viejo |
| Doble pulsación | No se rompe. Cerrojo síncrono antes de cualquier `await` |
| Avance de tarjeta tras un fallo de persistencia | No ocurre en ninguna rama |
| Off-by-one en los tramos de las distribuciones | Ninguno. Recorrió los cuatro juegos de tramos |
| Leakage entre mazos | No se rompe. Un solo filtrado alimenta todas las secciones |
| PDF de un mazo con datos de otro | No se rompe |
| Tests vacuos | No encontrados en lo nuevo |
| Golden que no cazaría un cambio de versión de FSRS | Falla por dos vías independientes |
| Evento histórico contado como calificación | No se rompe |

### Findings

- **M-1 (medio).** El emparejamiento revisión↔evento para el recuento "sin calificar" era un
  invariante implícito y sin test.
- **B-1..B-11 (bajos).** `excludedLearning` calculado pero no mostrado; exports muertos;
  `averagePerDay` documentado como `null` y devolviendo `0`; versión de la librería escrita a
  mano; render impuro en el detalle del mazo; ventana teórica al soltar el cerrojo; asimetría
  del historial suspendido sin documentar; `ratedSince` escribible sin revisiones;
  `Math.min(...)` sobre la muestra completa; extensiones de archivo en el contrato;
  `progress/current.md` desalineado.

### Correcciones aplicadas

Diez de los doce se corrigieron (ver §16 de la evidencia de implementación). **B-10 se
rechazó con motivo**: el finding no se sostenía, las 40 filas de integración del contrato ya
citaban `.tsx`, comprobado con `grep`. **B-11 se difirió al cierre**, que es cuando
`progress/current.md` debe quedar exacto.

---

## Review 2

Reviewer independiente **nuevo**, sobre el trabajo ya corregido, con el encargo explícito de
no dar nada por bueno porque otro lo hubiera aprobado.

**Veredicto: APPROVED.** 1 finding medio, 7 bajos. Ninguno crítico ni alto.

### Verificación de las nueve correcciones

Las nueve hacen lo que dicen, verificado con archivo y línea. Detalles que confirmó:

- `countUnratedEvents` recibe los dos lados del **mismo** filtrado por ámbito y periodo, así
  que no puede haber asimetría de ventana.
- La nota de exclusión está **fuera** del ternario en pantalla y en PDF, así que aparece
  también cuando la tabla está vacía, que es cuando más falta hace.
- El guardia `lastRated` **no bloquea calificaciones legítimas**: probó la carta que vuelve
  tras "Otra vez" (`answered` incrementa, la aparición es otra), dos cartas distintas, y el
  reintento tras un fallo (`lastRated` solo se asigna tras el `ok`, y `answered` es
  estrictamente creciente, así que una aparición nunca se repite).
- La reordenación de `writePatch` no rompe `trackedSince` ni `deckSnapshots`: esos caminos no
  pasan por las particiones.
- El golden **se refuerza** con la versión derivada: ahora falla por la versión *además* de
  por los valores.

### Findings nuevos

- **F-1 (medio).** *La corrección B-8 cerraba una ventana y abría otra.* Con el orden nuevo,
  si la partición se escribe y los metadatos fallan, el `StudyReviewEvent` ya está en disco;
  al reintentar, el `StudyCardEvent` se deduplicaba por id estable pero **la revisión no**,
  porque su id se emitía nuevo en cada intento. Una sola respuesta acabaría contando dos
  veces en Answer Buttons y en True Retention.
- **F-2 (medio).** `progress/current.md` incumplía C1 en ese momento. Condición para DONE.
- **F-3..F-8 (bajos).** Nota del PDF sin reservar espacio; dos exports nuevos sin usar fuera
  de su archivo; comentarios de versión stale; cobertura ausente en varias correcciones; una
  frase inexacta en la evidencia; y `queue.isAvailable` divergiendo de `scheduler.isDue` ante
  una carta sin vencimiento.

### Intentos de rotura propios

Repitió los suyos —Difícil como fallo, carta futura en los tres caminos, doble calificación,
recarga, borrado tras programar, leakage, evento histórico como calificación, tests vacuos,
golden frente a un cambio de versión— y **todos resistieron**. El único hallazgo fue F-1, que
encontró razonando sobre escrituras parciales del historial, no ejecutando.

### Gates que ejecutó

```text
npm run typecheck          OK
npm run lint               OK
npm run test               619 passed · 33 suites
npm run test:integration   226 passed · 19 suites
npm run test:e2e           204 passed, 6 skipped
verify.py / check_scope.py / check_evidence.py   exit 0
```

Coincidían exactamente con la evidencia de ese momento, y verificó también los subtotales por
archivo nuevo.

### Correcciones aplicadas tras el review 2

Las ocho, incluida F-1 con cuatro tests nuevos que fijan la idempotencia del reintento (ver
§17 de la evidencia de implementación). F-2 se cierra con el commit de cierre de la tarea.

---

## R1–R5

| | Resultado |
|---|---|
| **R1 Scope** | OK. Todo dentro de `allowed_paths`; `check_scope.py` en verde. Una sola dependencia nueva, `ts-fsrs`, justificada en `technical_decisions` y verificada en `node_modules` por los dos reviewers. Sin cambios oportunistas |
| **R2 Correctitud contra acceptance** | OK. Los 22 acceptance tienen implementación y evidencia ejecutable |
| **R3 Evidencia y regresiones** | OK. Los números declarados son los que salen al ejecutar. Las suites de TASK-004, 005 y 006 siguen verdes, adaptadas al `now` obligatorio de `StatsQuery` y al ciclo de calificación, no debilitadas |
| **R4 Arquitectura y convenciones** | OK. La dirección UI → features → abstracción → adaptador → librería se respeta sin excepciones |
| **R5 Decisiones de producto no autorizadas** | Ninguna. Las tres que podían parecerlo —la carta en aprendizaje vuelve a la cola de la sesión, las métricas de inventario no llevan periodo, y calificar no toca el `updatedAt` del mazo— están declaradas en `technical_decisions` del contrato y razonadas en el código |

---

## Estado final tras las correcciones

```text
npm run typecheck          OK
npm run lint               OK
npm run test               633 passed · 33 suites
npm run test:integration   227 passed · 19 suites
npm run test:e2e           204 passed, 6 skipped
./init.sh                  exit 0
```

**Findings críticos o altos abiertos: ninguno.**
