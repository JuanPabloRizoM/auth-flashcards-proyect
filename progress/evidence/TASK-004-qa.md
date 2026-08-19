# TASK-004 — QA independiente

- Task: TASK-004 — Persistencia local, unicidad de mazos y estabilización de navegación
- Agente: QA (READ ONLY sobre código y configuración, `qa_read_only: true`)
- Fecha: 2026-08-18
- Commit del candidato: `694ecf4 feat(TASK-004): persistencia local, unicidad de mazos y navegación estable`
- `origin/main` = `694ecf4` (mismo hash, publicado)
- Contrato: `.harness/contracts/TASK-004.json` (51 acceptance, 51 filas de `verification_matrix`)
- Revisiones previas: #1 CHANGES_REQUIRED (F1-F6), #2 CHANGES_REQUIRED (G1-G2), #3 APPROVED

## VEREDICTO

**APPROVED**

He validado el comportamiento observable en el navegador con mis propios scripts, escritos y
ejecutados fuera del repositorio, sin reutilizar los tests del implementer. **154 comprobaciones de
comportamiento observable, todas en verde.** Los cuatro gates reproducen exactamente los conteos que
afirma la evidencia.

Lo que más me importaba comprobar por mi cuenta, porque fue un defecto real que costó dos rondas de
review, es la reemisión de identificadores tras rehidratar. **No se reproduce**: intercalando
intentos rechazados antes y después de recargar, los ids salen `mazo-3`, `mazo-5`, `mazo-8`,
`mazo-10` —con huecos, que es inofensivo— y ninguno se repite; abrir cada mazo abre ese y no otro,
comprobado uno a uno contra su encabezado y su URL.

No he encontrado ningún defecto. Las observaciones que quedan (todas no bloqueantes) están al final
y ninguna exige modificar código ni tests.

## Documentos leídos

`AGENTS.md`, `.harness/agents/qa.md`, `.harness/tasks/TASK-004.json`,
`.harness/contracts/TASK-004.json` (51 acceptance + `verification_matrix`), `docs/VERIFICATION.md`,
`docs/TESTING.md`, `docs/PRODUCT.md`, `CHECKPOINTS.md`, `progress/current.md`,
`progress/evidence/TASK-004-implementation.md` y `progress/evidence/TASK-004-review.md`
(revisiones #1, #2 y #3 completas).

Código leído para construir mis pruebas, no para revisarlo: `app/index.tsx`,
`app/mazo/[id]/index.tsx`, `app/mazo/[id]/estudiar.tsx`, `src/lib/LibraryProvider.tsx`,
`src/lib/navigation.ts`, `src/components/layout/AppShell.tsx`, `src/features/decks/library.ts`,
`src/lib/storage/*`, `src/theme/tokens.ts`, `src/components/ui/FlashcardFace.tsx`.

## 1. Gates

| Gate | Comando | Resultado | Conteo afirmado por la evidencia | ¿Coincide? |
|---|---|---|---|---|
| Unit | `npm test` | **exit 0** — 11 suites, **100 passed / 100** | 100 unit | **sí** |
| Integration | `npm run test:integration` | **exit 0** — 6 suites, **54 passed / 54** | 54 integration | **sí** |
| E2E | `npm run test:e2e` | **exit 0** — **63 passed, 3 skipped** | 63 + 3 skipped | **sí** |
| Completo | `./init.sh` (inicial) | **exit 0** | exit 0 | **sí** |
| Completo | `./init.sh` (final, tras mis pruebas) | **exit 0** | — | — |

Salida de los diez gates de `./init.sh`, idéntica en las dos ejecuciones:

```text
[OK]   Harness válido
SCOPE: OK (TASK-004)
[OK]   Scope válido
[OK]   Sin temporales/secretos obvios
[OK]   typecheck
[OK]   lint
[OK]   test              -> Tests: 100 passed, 100 total
[OK]   test:integration  -> Tests:  54 passed,  54 total
[OK]   test:e2e          -> 63 passed, 3 skipped
EVIDENCE: OK
[OK]   Evidencia coherente
[OK]   Estado verificable
```

Los 3 saltados del E2E son las comprobaciones táctiles en `desktop-chrome`, con motivo declarado.

## 2. Cómo probé el comportamiento observable

Levanté la aplicación con `npx expo start --web --port 8092` y la conduje con scripts Playwright
propios, escritos **en `/tmp/qa004/`, fuera del repositorio**, contra Chromium y WebKit reales:

| Script | Qué cubre | Comprobaciones |
|---|---|---|
| `/tmp/qa004/persistence.js` | Persistencia, recargas, contexto nuevo, falso vacío | 29 |
| `/tmp/qa004/ids-uniqueness.js` | Identificadores con rechazos intercalados, unicidad | 37 |
| `/tmp/qa004/navigation.js` + `navigation2.js` | 15 ciclos, instancias en el DOM, atrás, estado residual | 38 |
| `/tmp/qa004/typo.js` | Serif solo en el contenido de las flashcards | 5 |
| `/tmp/qa004/visual.js` | Paleta, overflow y objetivos táctiles en 3 dispositivos | 28 |
| `/tmp/qa004/storage-robustez.js` | Almacenamiento ausente, roto, versión desconocida | 17 |
| | **Total** | **154, todas PASS** |

Dos comprobaciones fallaron por errores de **mis propios scripts**, no del producto, y las corregí
tras investigarlas; quedan documentadas más abajo para que no se confundan con hallazgos.

### 2.1 Persistencia

Estado inicial sin datos:

```text
PASS  estado vacío visible (decks-empty)
PASS  no hay mensaje de error de almacenamiento
PASS  localStorage sin la clave al arrancar en limpio -> null
PASS  sin errores de consola en arranque limpio
```

Forma real del documento guardado, leída del `localStorage` del navegador (clave
`flashcards:library:v1`, sin prefijo: la implementación web de AsyncStorage escribe la clave tal
cual):

```json
{"version":1,
 "decks":[{"id":"mazo-1","name":"Inglés"}],
 "cards":[{"id":"carta-2","deckId":"mazo-1","front":"to overlook","back":"pasar por alto"}]}
```

```text
PASS  documento con clave version (version=1)
PASS  documento con array decks
PASS  documento con array cards
PASS  claves del documento son exactamente version/decks/cards  -> ["version","decks","cards"]
PASS  la carta apunta al mazo creado  (card.deckId=mazo-1, deck.id=mazo-1)
PASS  tras recargar el detalle, la carta sigue en su mazo
PASS  tras recargar, el encabezado sigue siendo el mazo correcto
```

Cinco recargas seguidas, midiendo lo persistido y las filas del DOM en cada una:

```text
recarga 1: decks=1 cards=1     recarga 4: decks=1 cards=1
recarga 2: decks=1 cards=1     recarga 5: decks=1 cards=1
recarga 3: decks=1 cards=1
-> ninguna recarga duplica nada.
```

**Cierre de pestaña y apertura de una nueva sobre el mismo perfil de almacenamiento**: cerré el
contexto del navegador y abrí otro heredando su `storageState`, que es el equivalente real a cerrar
y reabrir la pestaña:

```text
PASS  contexto nuevo: el mazo persistido aparece
PASS  contexto nuevo: no se muestra el estado vacío
PASS  contexto nuevo: sin duplicación (decks=1 cards=1)
PASS  contexto nuevo: la carta sigue dentro de su mazo
PASS  contexto nuevo: sin errores de consola
```

**Falso estado vacío**: instrumenté la página con un `initScript` que muestrea el DOM cada 10 ms
desde el primer instante del arranque, teniendo datos guardados. Secuencia observada:

```text
secuencia de estados (9 muestras): CARGANDO -> LISTA
PASS  nunca se observó el estado vacío teniendo datos guardados
PASS  se observó un estado de carga durante la hidratación
```

El estado vacío **nunca** aparece: se pasa de la carga a la lista. Y el estado de carga sí es
observable, no es una afirmación de código.

### 2.2 Identificadores (el defecto que se corrigió)

Escenario con intentos **rechazados intercalados** entre creaciones válidas y recargas de por medio:

```text
a) nombre vacío        -> rechazado, nada persistido (localStorage = null)
b) solo espacios       -> rechazado, nada persistido
c) crear "Alemán"      -> {"decks":[{"id":"mazo-3","name":"Alemán"}]}
d) RECARGA
e) duplicado "ALEMÁN"  -> rechazado
f) crear "Francés"     -> mazo-5
g) RECARGA + "" + " francés " (rechazados) + "Italiano" -> mazo-8
   RECARGA + "   " (rechazado) + "Portugués"            -> mazo-10

MAZOS PERSISTIDOS:
[{"id":"mazo-3","name":"Alemán"},{"id":"mazo-5","name":"Francés"},
 {"id":"mazo-8","name":"Italiano"},{"id":"mazo-10","name":"Portugués"}]

PASS  ningún id de mazo repetido  -> ["mazo-3","mazo-5","mazo-8","mazo-10"]
```

Abrir cada mazo abre **ese** y no otro, comprobado contra encabezado y URL:

```text
PASS  una sola fila con testID deck-mazo-3   PASS  abrir "Alemán"    -> ["Alemán"]    /mazo/mazo-3
PASS  una sola fila con testID deck-mazo-5   PASS  abrir "Francés"   -> ["Francés"]   /mazo/mazo-5
PASS  una sola fila con testID deck-mazo-8   PASS  abrir "Italiano"  -> ["Italiano"]  /mazo/mazo-8
PASS  una sola fila con testID deck-mazo-10  PASS  abrir "Portugués" -> ["Portugués"] /mazo/mazo-10
```

Cartas creadas sobre esa numeración con huecos, tras otra recarga:

```text
CARTAS PERSISTIDAS:
[{"id":"carta-11","deckId":"mazo-3","front":"der Hund","back":"el perro"},
 {"id":"carta-12","deckId":"mazo-5","front":"le chien","back":"el perro"}]

PASS  ningún id de carta repetido
PASS  ningún id repetido entre mazos y cartas
PASS  "der Hund" pertenece al primer mazo   PASS  "le chien" pertenece al segundo
PASS  cada mazo tiene exactamente 1 carta
PASS  el mazo francés NO muestra la carta del alemán (count=0)
```

Además, partiendo de un documento **válido escrito a mano** con `mazo-1`, `mazo-2`, `carta-3` y
`carta-4`, el primer mazo creado después es `mazo-5`: la numeración continúa por encima del mayor
sufijo restaurado y no choca con nada.

El escenario del review #1 (`mazo-2` emitido dos veces, encabezado "Alemán" al pulsar "Francés")
**no se reproduce en ningún caso**.

### 2.3 Unicidad de mazos

```text
guardado con "INGLÉS": {"version":1,"decks":[{"id":"mazo-1","name":"INGLÉS"}],"cards":[]}
PASS  "Inglés" con "INGLÉS" existente -> rechazado y mensaje visible
PASS  el mensaje ocupa espacio real en pantalla -> boundingBox {x:324,y:255,width:875,height:20}
PASS  el intento fallido NO modifica lo guardado
      antes:   {"version":1,"decks":[{"id":"mazo-1","name":"INGLÉS"}],"cards":[]}
      después: {"version":1,"decks":[{"id":"mazo-1","name":"INGLÉS"}],"cards":[]}   (idéntico)
PASS  sigue habiendo 1 solo mazo

guardado con " Inglés ": {"version":1,"decks":[{"id":"mazo-1","name":"Inglés"}],"cards":[]}
PASS  el nombre se guarda recortado -> "Inglés"
PASS  "Inglés" con " Inglés " existente -> rechazado
PASS  el intento fallido NO modifica lo guardado
```

El mensaje es **visible y comprensible**: *"Ya tienes un mazo con ese nombre. Elige otro."*, anclado
al campo del nombre, con caja de 875x20 px medida en pantalla. También comprobé el otro rechazo:
*"Escribe un nombre para el mazo."*

**La normalización es solo trim + minúsculas, y nada más.** Lo verifiqué por el lado positivo, que
es el que detectaría una normalización de más:

```text
PASS  SÍ deja crear un nombre que difiere en espacios interiores  -> ["Inglés","In  glés"]
PASS  SÍ deja crear un nombre que difiere en acentos              -> ["Inglés","In  glés","Ingles"]
PASS  los tres mazos coexisten (n=3)
PASS  tras recargar siguen los tres, sin duplicar
      [{"id":"mazo-1","name":"Inglés"},{"id":"mazo-3","name":"In  glés"},{"id":"mazo-4","name":"Ingles"}]
```

No se ha reintroducido el colapso de espacios interiores de TASK-003, y no se eliminan acentos.

### 2.4 Navegación

**15 ciclos abrir mazo -> destino de primer nivel**, contando **todas** las instancias del DOM
(visibles e invisibles) con `[data-testid="..."]` después de cada vuelta:

```text
censo inicial: {"decksList":1,"deckNameInput":1,"cardsList":0,"cardFrontInput":0,"appShell":1,"scroll":1}
ciclo  1: {"decksList":1,"deckNameInput":1,"cardsList":0,"cardFrontInput":0,"appShell":1,"scroll":1}
ciclo  5: {"decksList":1,"deckNameInput":1,"cardsList":0,"cardFrontInput":0,"appShell":1,"scroll":1}
ciclo 10: {"decksList":1,"deckNameInput":1,"cardsList":0,"cardFrontInput":0,"appShell":1,"scroll":1}
ciclo 15: {"decksList":1,"deckNameInput":1,"cardsList":0,"cardFrontInput":0,"appShell":1,"scroll":1}

PASS  "decksList"      no crece en 15 ciclos (inicio 1, fin 1, máx 1)
PASS  "deckNameInput"  no crece en 15 ciclos (inicio 1, fin 1, máx 1)
PASS  "cardsList"      no crece en 15 ciclos (inicio 0, fin 0, máx 0)
PASS  "cardFrontInput" no crece en 15 ciclos (inicio 0, fin 0, máx 0)
PASS  "appShell"       no crece en 15 ciclos (inicio 1, fin 1, máx 1)
PASS  "scroll"         no crece en 15 ciclos (inicio 1, fin 1, máx 1)
PASS  no queda ninguna instancia de la pantalla de detalle tras volver

history.length: 3 -> 3 tras 30 navegaciones
```

Medí también **desde dentro del detalle** en cada uno de los 15 ciclos, que es donde se vería la
acumulación si existiera:

```text
ciclo  1 (en detalle): {"decksListDebajo":1,"cardsList":1,"cardFrontInput":1}
ciclo 15 (en detalle): {"decksListDebajo":1,"cardsList":1,"cardFrontInput":1}
PASS  dentro del detalle queda exactamente 1 instancia de la pantalla padre en los 15 ciclos
PASS  dentro del detalle hay exactamente 1 instancia del propio detalle en los 15 ciclos
```

La profundidad se mantiene constante en 2 nodos (padre + detalle apilado), que es exactamente la
necesaria para representar el estado de navegación correcto. Frente a las **16 instancias tras 15
ciclos** que midió QA en TASK-003, ahora es **1**. El crecimiento está eliminado.

**Botón atrás del navegador**, coherente en los tres saltos:

```text
/ -> abrir mazo -> /mazo/mazo-1
PASS  atrás desde el detalle vuelve a Mis mazos           -> http://localhost:8092/
PASS  tras atrás, una sola instancia de decks-list        -> n=1
PASS  tras atrás, ninguna instancia del detalle           -> n=0
PASS  adelante vuelve al detalle                          -> /mazo/mazo-1
PASS  una sola instancia del detalle tras adelante        -> n=1
PASS  atrás desde el estudio vuelve al detalle            -> /mazo/mazo-1
PASS  atrás otra vez vuelve a Mis mazos                   -> /
PASS  sin instancias residuales tras la doble vuelta atrás
```

**Ninguna pantalla invisible conserva texto escrito antes**:

```text
escribo "BORRADOR-MAZO-QA" en Mis mazos, abro el mazo, escribo "BORRADOR-CARTA-QA" dentro
PASS  el borrador vive en 1 sola instancia (la pantalla padre del stack actual), no en varias
pulso el destino de primer nivel:
PASS  tras el destino de primer nivel, el borrador de mazo ha desaparecido (valor="")
PASS  no queda ningún borrador en ninguna instancia del DOM (n=0)
PASS  ninguna instancia invisible del detalle sobrevive (n=0)
PASS  al reabrir el mazo, el frente vuelve vacío (valor="")
```

**Todo sigue funcionando después de todas las vueltas**:

```text
PASS  Mis mazos lista el mazo
PASS  abrir el mazo sigue funcionando
PASS  el estudio abre y muestra la carta (una sola instancia)
PASS  se ve el frente -> "FRENTE\nto overlook"
PASS  el reverso no se muestra antes de revelar
PASS  mostrar respuesta revela el reverso -> "REVERSO\npasar por alto"
PASS  volver del estudio devuelve al detalle del mazo
PASS  no queda instancia de la pantalla de estudio
PASS  el sidebar navega a /componentes y vuelve a Mis mazos
PASS  la barra compacta de móvil navega entre destinos
PASS  alternar destinos no acumula instancias
PASS  los datos siguen ahí tras todo el recorrido
PASS  sin errores de consola en todo el bloque de navegación
```

### 2.5 Regresión visual y responsive

Colores medidos con `getComputedStyle` en el navegador y cotejados contra `src/theme/tokens.ts`:

```text
fondo del shell   -> rgb(247, 245, 240)   = colors.background (#F7F5F0)   PASS
sidebar fondo     -> rgb(255, 255, 255)   = colors.surface    (#FFFFFF)   PASS
sidebar borde     -> rgb(221, 218, 211)   = colors.border     (#DDDAD3)   PASS
botón primario    -> rgb(49, 91, 125)     = colors.primary    (#315B7D)   PASS
```

Tipografía: enumeré **todas** las familias realmente computadas en la pantalla de detalle. Solo hay
dos, y la serif cae exactamente donde debe:

```text
[-apple-system, "system-ui", "Segoe UI", Roboto, Helvetica, Arial, sans-serif]
  -> "Flashcards","Mis mazos","Componentes","1 mazo","Crear un mazo","Nombre del mazo",
     "Crear mazo","Inglés","1 carta","‹ Mis mazos","Estudiar","Añadir una carta","Frente",
     "Reverso","Añadir carta","FRENTE","REVERSO"

["Iowan Old Style", Palatino, Georgia, serif]
  -> "to overlook","pasar por alto"

PASS  la serif se usa exactamente en el contenido de las dos caras de la carta
PASS  las etiquetas FRENTE/REVERSO no usan serif
PASS  los títulos y botones de la interfaz no usan serif
PASS  en estudio, la serif solo en el frente de la carta
PASS  tras revelar, la serif en frente y reverso y solo ahí
```

Overflow horizontal (`scrollWidth` vs `clientWidth`, en documento y body) y objetivos táctiles
(`boundingBox` de todo control interactivo **visible**), en las cuatro rutas y tres dispositivos:

| Dispositivo | Ruta | doc scroll/client | Controles medidos | Menores de 44x44 |
|---|---|---|---|---|
| Desktop Chrome 1280x800 | `/` | 1280/1280 | — | — |
| Desktop Chrome | `/mazo/mazo-1` | 1280/1280 | — | — |
| Desktop Chrome | `/mazo/mazo-1/estudiar` | 1280/1280 | — | — |
| Desktop Chrome | `/componentes` | 1280/1280 | — | — |
| Mobile Chrome (Pixel 5) 393x727 | `/` | 393/393 | 5 | **0** |
| Mobile Chrome | `/mazo/mazo-1` | 393/393 | 7 | **0** |
| Mobile Chrome | `/mazo/mazo-1/estudiar` | 393/393 | 4 | **0** |
| Mobile Chrome | `/componentes` | 393/393 | 10 | **0** |
| Mobile Safari/WebKit (iPhone 13) 390x844 | `/` | 390/390 | 5 | **0** |
| Mobile Safari/WebKit | `/mazo/mazo-1` | 390/390 | 7 | **0** |
| Mobile Safari/WebKit | `/mazo/mazo-1/estudiar` | 390/390 | 4 | **0** |
| Mobile Safari/WebKit | `/componentes` | 390/390 | 10 | **0** |

Sin overflow horizontal en ninguna ruta ni dispositivo. En móvil se usa la barra compacta
(`app-tabbar` presente, `app-sidebar` ausente) y en desktop el sidebar. La persistencia también
sobrevive a la recarga en **WebKit**, comprobado aparte.

### 2.6 Robustez del almacenamiento

| Contenido en `flashcards:library:v1` | Resultado observado | ¿Se borra lo guardado? |
|---|---|---|
| ausente | estado vacío, sin aviso de error, sin excepciones | no hay nada |
| `{esto no es json` | aviso controlado, app usable | **no**, sigue byte a byte |
| `{"version":99,...}` | aviso controlado, app usable | **no**, sigue con `version: 99` |
| documento válido escrito a mano | se hidratan los 2 mazos y sus 2 cartas, sin aviso | — |

```text
aviso mostrado: "Problema con el almacenamiento | Tus datos guardados no tienen un formato
                 reconocible. Se han dejado intactos y se empieza con la biblioteca vacía."
PASS  la app arranca sin romperse (0 pageerror en los cuatro casos)
PASS  el contenido roto NO se borra al arrancar
PASS  la app sigue usable: se puede crear un mazo
PASS  el mazo alemán muestra solo su carta -> "FRENTE | der Hund | REVERSO | el perro"
```

## 3. Acceptance orientadas a la persona usuaria -> resultado

Las 51 acceptance del contrato, con lo que **yo** observé. Las de método `unit`/`review` puro las
marco como verificadas por gate reproducido, sin reclamar observación de navegador que no hice.

| # | Acceptance (orientada al usuario) | Cómo lo comprobé | Resultado |
|---|---|---|---|
| 1 | Repositorio persistente | Gate unit 100/100 + documento real en `localStorage` | **PASS** |
| 2 | La UI no accede al almacenamiento concreto | Gate `./init.sh` + lectura de `app/**` | **PASS** |
| 3 | Crear un mazo lo persiste | `localStorage` tras crear: mazo serializado | **PASS** |
| 4 | Crear una flashcard la persiste | `localStorage` tras crear: carta con su `deckId` | **PASS** |
| 5 | Recargar conserva los mazos | 5 recargas + contexto nuevo | **PASS** |
| 6 | Recargar conserva las flashcards | Igual, con la carta visible tras recargar | **PASS** |
| 7 | Las cartas siguen en el mazo correcto tras restaurar | 2 mazos, 2 cartas, recarga; ninguna cruzada | **PASS** |
| 8 | Varios mazos conservan datos independientes | 4 mazos, ids únicos, cada uno abre el suyo | **PASS** |
| 9 | Nombre vacío rechazado | Rechazado, nada persistido, mensaje visible | **PASS** |
| 10 | Solo espacios rechazado | Rechazado, nada persistido | **PASS** |
| 11 | No "Inglés" si existe "INGLÉS" | Rechazado, `localStorage` idéntico | **PASS** |
| 12 | No "Inglés" si existe " Inglés " | Rechazado, `localStorage` idéntico | **PASS** |
| 13 | La validación no depende de la pantalla | Gate unit (`deck-name-uniqueness.test.ts`) | **PASS** |
| 14 | Mensaje visible y comprensible | Texto leído + `boundingBox` 875x20 en pantalla | **PASS** |
| 15 | Un duplicado no modifica lo persistido | Comparación byte a byte antes/después | **PASS** |
| 16 | La segunda carta no borra la primera | 2 cartas en mazos distintos, ambas tras recargar | **PASS** |
| 17 | Restaurar no crea copias duplicadas | 5 recargas: decks=1 cards=1 siempre | **PASS** |
| 18 | Estado vacío inicial correcto | `decks-empty` visible, sin error | **PASS** |
| 19 | Almacenamiento vacío manejado | Clave ausente -> vacío, 0 excepciones | **PASS** |
| 20 | Sin falso estado vacío perceptible | Muestreo cada 10 ms: CARGANDO -> LISTA, nunca VACIO | **PASS** |
| 21 | Existe estado de carga | `decks-loading` observado en el muestreo | **PASS** |
| 22 | Error de almacenamiento controlado, sin fallo | 3 contenidos rotos: aviso, app usable, nada borrado | **PASS** |
| 23 | Elimina el crecimiento ilimitado | 15 ciclos: instancias constantes en 1 | **PASS** |
| 24 | 15 ciclos sin crecimiento proporcional | Censo del DOM en cada ciclo, máx = inicio | **PASS** |
| 25 | Solo la profundidad necesaria | Padre + detalle = 2 nodos, constante | **PASS** |
| 26 | Ninguna pantalla invisible conserva estado | Borradores desaparecen; 0 residuos en el DOM | **PASS** |
| 27 | Mis mazos sigue funcionando | Lista y crea tras todas las vueltas | **PASS** |
| 28 | Abrir un mazo sigue funcionando | Cada uno de los 4 abre el suyo | **PASS** |
| 29 | Abrir el estudio sigue funcionando | Frente visible, reverso oculto, revelar funciona | **PASS** |
| 30 | Volver del estudio sigue funcionando | `back-to-deck` y atrás del navegador | **PASS** |
| 31 | Navegación por el sidebar de desktop | `/` <-> `/componentes` sin acumular | **PASS** |
| 32 | Navegación compacta de móvil | `app-tabbar` navega en Pixel 5 | **PASS** |
| 33 | No aparecen rutas rotas | 0 errores de consola, URLs correctas en 4 rutas | **PASS** |
| 34 | Flujo completo en desktop Chrome | Recorrido completo, 1280x800 | **PASS** |
| 35 | Flujo completo en mobile Chrome | Pixel 5, 4 rutas | **PASS** |
| 36 | Flujo completo en mobile Safari/WebKit | iPhone 13, 4 rutas + persistencia tras recarga | **PASS** |
| 37 | Sin overflow horizontal nuevo | `scrollWidth <= clientWidth` en 12 combinaciones | **PASS** |
| 38 | Objetivos táctiles mantenidos | 0 controles por debajo de 44x44 en móvil | **PASS** |
| 39 | Tests de TASK-001/002/003 siguen pasando | `./init.sh` con la suite completa, exit 0 | **PASS** |
| 40 | Unit de normalización y unicidad | Gate unit 100/100 | **PASS** |
| 41 | Duplicado rechazado desde la lógica | Gate unit 100/100 | **PASS** |
| 42 | Tests de serialización e hidratación | Gate unit 100/100 | **PASS** |
| 43 | Integración crear mazo -> persistir -> reconstruir | Gate integración 54/54 | **PASS** |
| 44 | Integración crear carta -> persistir -> reconstruir | Gate integración 54/54 | **PASS** |
| 45 | Aislamiento de cartas entre mazos tras restaurar | Gate integración + comprobado en navegador | **PASS** |
| 46 | Regresión real del crecimiento del stack | Gate integración + mi censo del DOM | **PASS** |
| 47 | El test de regresión falla si se reintroduce el bug | Demostrado por reviewer #1/#2/#3 (N5, W6, X9) | **PASS** |
| 48 | No se han debilitado ni eliminado tests | Conteos al alza; 100/54/63 confirmados | **PASS** |
| 49 | No hay decisiones de producto adicionales | `docs/PRODUCT.md`: solo las confirmadas | **PASS** |
| 50 | `./init.sh` exit 0 | Dos ejecuciones, ambas exit 0 | **PASS** |
| 51 | Evidencia en `TASK-004-implementation.md` | Leída completa; conteos exactos | **PASS** |

**51 de 51 en PASS. Ninguna requiere modificación.**

## 4. Hallazgos

**Ninguno.** No he encontrado ningún defecto que exija modificar código, tests o configuración.

### Errores de mis propios scripts, no del producto

Los registro para que no se confundan con hallazgos, porque en una primera pasada aparecieron como
fallos:

1. Conté como "borrador filtrado en una pantalla invisible" la pantalla padre que queda montada
   debajo del detalle apilado. **No es un defecto**: es un stack de profundidad 1, el comportamiento
   correcto y necesario para que el botón atrás funcione. Lo verifiqué midiendo que ese número es
   **exactamente 1 en los 15 ciclos** y que el destino de primer nivel lo limpia.
2. Mi detector de serif usaba el patrón `/serif/`, que también casa con `sans-serif`, así que marcó
   toda la interfaz como serif. Al enumerar las familias realmente computadas quedó claro que solo
   hay dos pilas y que la serif cae exactamente en las dos caras de la flashcard.

## 5. Observaciones no bloqueantes

- **Q1** — `progress/current.md` está desfasado: dice `Estado: REVIEWING`, agente
  *implementer (entregado)*, y su plan corto marca *"13. Review #2 independiente — pendiente"* y
  *"14. Commit del candidato, QA y cierre — pendiente"*, cuando ya hubo tres revisiones, commit y
  publicación. Coincide con la observación O8 del reviewer #3. No afecta al comportamiento y no toca
  una acceptance, pero **CHECKPOINTS C1 y C6 exigen que sea exacto antes de declarar DONE**.
- **Q2** — En la tabla *acceptance -> evidencia* de `TASK-004-implementation.md`, la fila 22 sigue
  diciendo *"Cinco tests"* como *"Tres tests"* y la fila 42 dice *"26 tests"* como *"16 tests"*
  (O7 del reviewer #3). Desajuste de recuento en una tabla resumen; la cobertura real existe y la he
  verificado. No bloqueante.
- **Q3** — El working tree tiene `.harness/tasks/TASK-004.json` modificado y **sin commitear**: el
  único cambio es `"status": "REVIEWING"` -> `"QA"`. Es decir, el commit publicado `694ecf4` todavía
  declara la tarea en `REVIEWING`. Es un artefacto normal del ciclo, pero conviene que el commit de
  cierre lo recoja. No lo he tocado.
- **Q4** — La numeración de identificadores deja huecos cuando hay intentos rechazados
  (`mazo-3`, `mazo-5`, `mazo-8`, `mazo-10`). Es la consecuencia deliberada y correcta de la
  corrección de F1, es inofensiva y no es visible para la persona usuaria, que nunca ve los ids.
- **Q5** — No he podido comprobar el ciclo de vida real de una app **nativa** iOS/Android ni un
  dispositivo físico: no hay simulador en juego y la acceptance se verifica en web con recarga
  completa y cierre/apertura de contexto. Coincide con lo que la evidencia declara honestamente en
  "No verificado". No es un defecto: la compatibilidad nativa se apoya en que AsyncStorage expone la
  misma API en las tres plataformas.
- **Q6** — Dos pestañas abiertas a la vez escriben sobre la misma clave sin coordinación (gana la
  última escritura). Está declarado en Riesgos y ninguna acceptance lo pide. No lo he probado.

## 6. Confirmación de rol

QA **read-only** (`qa_read_only: true`). **No he editado, creado ni borrado ningún archivo de
código, test, documentación o configuración.** El único archivo que he escrito en el repositorio es
este, `progress/evidence/TASK-004-qa.md`.

No he tocado `.harness/tasks/TASK-004.json`, `.harness/contracts/TASK-004.json`,
`progress/current.md`, `progress/history.md`, ni ningún archivo de `app/`, `src/`, `tests/` o de
configuración. **No he aplicado ninguna mutación al código**: a diferencia del reviewer, mi trabajo
era validar el comportamiento del candidato tal cual está publicado, así que el árbol de trabajo no
se ha alterado en ningún momento.

Todos mis scripts y registros se escribieron **fuera del repositorio**, en `/tmp/qa004/` y
`/tmp/qa004-*.log`, para no alterar `check_scope.py`. El servidor de desarrollo que levanté en el
puerto 8092 quedó **detenido**.

Estado del repositorio al terminar:

```text
$ git status --porcelain
 M .harness/tasks/TASK-004.json      <- preexistente (status REVIEWING -> QA), no lo he tocado yo

$ git status --porcelain --untracked-files=all | grep '^??'
(ninguno)                            <- ningún artefacto mío dentro del repositorio

$ git rev-parse HEAD origin/main
694ecf4040b4b3d6d90ca2e5ce5aca594b597e4c
694ecf4040b4b3d6d90ca2e5ce5aca594b597e4c
```

`./init.sh` final: **exit code 0**, con 100 unit, 54 integration y 63 passed + 3 skipped en e2e.
