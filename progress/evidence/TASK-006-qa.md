# TASK-006 — QA independiente

**QA:** independiente, READ ONLY sobre el código.
**Fecha:** 2026-08-24
**Lectura previa:** task, contract, `docs/VERIFICATION.md`, evidencia de implementación y de
revisión.

QA **no se ha limitado a leer los tests**. Se ha levantado la aplicación real
(`expo start --web`), se ha conducido con un navegador de verdad en tres perfiles de
dispositivo, se han creado mazos con datos distinguibles, se han descargado PDF reales y se
han inspeccionado con herramientas externas al proyecto.

**Resultado: 41 de 41 comprobaciones observables OK. Cero errores de consola.**

---

## Escenario principal

El pedido en el contrato, con cifras deliberadamente distinguibles:

```text
Inglés        10 tarjetas creadas y estudiadas
Matemáticas   30 tarjetas creadas y estudiadas
```

Todo creado y estudiado por la interfaz real: escribir el nombre del mazo, crear, abrir,
añadir cada carta con su frente y su reverso, entrar a estudiar y recorrer el ciclo
«Mostrar respuesta → Siguiente carta» carta por carta.

### Verificación visual de los tres ámbitos

| Ámbito | Esperado | Visto | |
|---|---|---|---|
| Todos los mazos | 40 | **40** | ✓ |
| Inglés | 10 | **10** | ✓ |
| Matemáticas | 30 | **30** | ✓ |

Además, en el ámbito global: 2 mazos estudiados y 40 en el conteo de tarjetas. Con Inglés
seleccionado, el conteo baja a 10 y el calendario anuncia «Máximo: 10 tarjetas en un día»;
con Matemáticas, 30. **Cero leakage observado entre mazos.**

Captura: `02-todos.png`, `03-ingles.png`, `04-matematicas.png`.

---

## Filtros de mazo

- El selector ofrece «Todos los mazos» y un botón por mazo, con el activo anunciado.
- Cambiar de ámbito actualiza en el acto el resumen, el conteo, el calendario y las gráficas.
- **La comparación de mazos aparece solo en el ámbito global** y desaparece al elegir un mazo
  concreto. Comprobado que el nodo no existe, no que esté oculto.

## Filtros de periodo

| Periodo | Días del periodo | Visto |
|---|---|---|
| 1 mes | 30 | **1 de 30** ✓ |
| 3 meses | 90 | **1 de 90** ✓ |
| 1 año | 365 | **1 de 365** ✓ |
| Todo | — | total sigue en **40** ✓ |

El filtro de periodo se combina con el de mazo sin interferencias.

## Sin datos

Con el historial vacío:

- Se muestra el estado vacío «Sin actividad en este periodo».
- Los segundos por tarjeta se rinden como **«—»**, no como 0, con la aclaración «Todavía sin
  tarjetas hoy».
- Las gráficas de actividad, calendario y velocidad muestran su estado vacío en vez de barras
  a cero.
- **No aparece `NaN`, `Infinity` ni `undefined`** en ninguna parte del texto de la pantalla.
- Se declara desde cuándo hay historial fiable.

Captura: `01-sin-datos.png`.

## Recargar

Tras recargar la página: el total global sigue en 40 y el ámbito de Inglés sigue en 10. Los
datos vienen del almacenamiento, no de un estado que sobrevivió.

## Borrar después de estudiar

Este es el caso obligatorio del contrato. Con Inglés ya estudiado, se elimina el mazo por la
interfaz real, con su diálogo de confirmación:

| Comprobación | Resultado |
|---|---|
| El total global histórico sigue en 40 | ✓ **no cambió retroactivamente** |
| El conteo actual de tarjetas baja a 30 | ✓ la biblioteca sí se vació |
| Inglés desaparece del selector de ámbito | ✓ no vuelve a la biblioteca |
| Inglés sigue en la comparación, como «Inglés (eliminado)» | ✓ nombrado y etiquetado |
| Tras recargar, el historial sigue en 40 | ✓ persistió el borrado |

Captura: `05-tras-borrar.png`.

## Gráficas

Se dibujan y se leen: la de actividad rotula su pico («40 tarjetas»), el calendario explica su
escala con palabras («Sin actividad», «Máximo: N tarjetas en un día») y las celdas con
actividad llevan borde además de color. La paleta es la académica; sin neón ni brillos.

## Responsive

| Perfil | Estudiadas | Overflow horizontal | Gráfica | Calendario | Navegación |
|---|---|---|---|---|---|
| Escritorio 1280×900 | 40 ✓ | — | ✓ | ✓ | sidebar ✓ |
| Pixel 5 | 5 ✓ | **0** ✓ | ✓ | ✓ | barra inferior ✓ |
| iPhone 13 | 5 ✓ | **0** ✓ | ✓ | ✓ | barra inferior ✓ |

Capturas: `06-pixel5.png`, `06-iphone13.png`.

---

## PDF

Descargados dos reportes reales desde el navegador, con el flujo completo: «Generar reporte
PDF» → elegir ámbito → «Descargar reporte».

```text
estadisticas-todos-los-mazos-1m-2026-08-24.pdf   20 191 bytes
estadisticas-ingles-1m-2026-08-24.pdf            18 750 bytes
```

### Validez, comprobada con herramientas externas al proyecto

**PyMuPDF** abre los dos: `is_pdf: True`, **3 páginas** cada uno.

```text
pdf-todos   título: 'Reporte de estudio — Todos los mazos — Último mes'
pdf-ingles  título: 'Reporte de estudio — Inglés — Último mes'
```

**pdftotext** extrae el texto correctamente, con los acentos bien.

### Inspección visual, no solo estructural

Las tres páginas de cada reporte se renderizaron a imagen y se miraron. No son un PDF
técnicamente válido pero visualmente roto: la maquetación es correcta, las barras y el
calendario se dibujan, las cifras están alineadas en sus columnas y ninguna etiqueta se pisa
con la vecina.

### Aislamiento del PDF de Inglés

| Búsqueda | Ocurrencias | |
|---|---|---|
| «Matemáticas» | **0** | ✓ |
| «Comparación de mazos» | **0** | ✓ |
| cifra 40 (total global) | **0** | ✓ |
| cifra 30 (las tarjetas de Matemáticas) | 4 | **investigado** |

Las cuatro ocurrencias de «30» se localizaron una por una: tres son «30 jul», una etiqueta de
fecha del eje horizontal, y la cuarta es «1 de 30», los días del periodo. **Ninguna es dato de
Matemáticas.** Sin fuga.

El PDF global sí contiene «Inglés», «Matemáticas» y «Comparación de mazos», como debe.

### Coincidencia con el panel

El reporte de Inglés declara «TARJETAS ESTUDIADAS 10», exactamente lo que mostraba la pantalla
para ese ámbito. Portada con la aplicación, el mazo, el periodo, la fecha de generación y
«Historial de estudio registrado desde 24 de agosto de 2026. Las estadísticas anteriores a esa
fecha no existen y no se han reconstruido».

---

## Errores de consola

**Ninguno** en toda la sesión: creación de mazos, 40 cartas, dos sesiones de estudio, cambios
de ámbito y periodo, recarga, dos descargas de PDF y el borrado de un mazo.

---

## Lo que QA no ha podido probar

- **El guardado y compartido del PDF en iOS y Android nativos.** No se ejecutó. Los perfiles de
  móvil de esta sesión son navegadores web con viewport de móvil, no dispositivos. Coincide con
  lo declarado por el implementer y con el pendiente que ya existía desde TASK-005.
- **El comportamiento del cronómetro con la aplicación en segundo plano real.** Se verificó en
  tests unitarios con visibilidad controlada, no cambiando de aplicación en un dispositivo.

Ambas limitaciones están declaradas en la evidencia de implementación. QA no afirma soporte
que no haya ejecutado.

---

## Veredicto

**`APPROVED`**

Las 41 comprobaciones observables pasan. El escenario obligatorio del contrato —dos mazos con
datos distinguibles, verificación visual de 40 / 10 / 30, dos PDF generados y aislamiento del
PDF por mazo— se cumple. El borrado tras estudiar conserva el historial y las estadísticas
globales no cambian retroactivamente. No se ha observado ningún dato inventado ni ninguna
métrica desconocida presentada como cero.
