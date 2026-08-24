# Sesión actual

- **Task activa:** ninguna — proyecto en estado IDLE
- **Última tarea cerrada:** TASK-006 — Estadísticas avanzadas de estudio, historial persistente y generación de reportes PDF (`DONE`, 2026-08-24)
- **Estado del harness:** `./init.sh` exit 0
- **Repositorio:** rama `main`, remoto `https://github.com/JuanPabloRizoM/auth-flashcards-proyect.git`

No hay tarea en curso. El usuario decide cuál es la siguiente; el harness no propone roadmap.

## Estado del proyecto

- **Entorno** (TASK-001): Expo SDK 57, React Native, Expo Router, TypeScript. Plataformas: iOS, Android y web.
- **Base visual** (TASK-002): `AppShell` con sidebar en desktop y barra compacta en móvil; componentes compartidos.
- **Producto** (TASK-003): paleta confirmada, Mis mazos, detalle del mazo y estudio simple.
- **Datos** (TASK-004): persistencia local detrás del contrato `LibraryRepository`; unicidad de nombre de mazo; stack de navegación acotado.
- **Gestión e importación** (TASK-005): renombrar y eliminar mazos con cascada, editar y eliminar cartas, búsqueda y orden en Mis mazos, e importación desde `.csv`, `.xlsx` y `.md` con detección determinista y vista previa obligatoria.
- **Estadísticas** (TASK-006): sección `/estadisticas` con filtro de ámbito (todos los mazos o uno concreto) y de periodo (1 mes, 3 meses, 1 año, todo); historial de estudio persistente y append-only con sesiones, eventos de carta y altas; motor de estadísticas puro; once secciones (hoy, actividad, calendario, tiempo, velocidad, racha, hora, conteo, añadidas, comparación de mazos y origen); y reporte PDF real multipágina generado por el mismo motor que el panel.
- **Rutas**: `/`, `/estadisticas`, `/componentes`, `/mazo/[id]`, `/mazo/[id]/estudiar` y `/mazo/[id]/importar`.
- **Gates**: `typecheck`, `lint`, `test` (430), `test:integration` (172), `test:e2e` (178 + 6 skipped condicionales en desktop-chrome, Pixel 5 e iPhone 13), más `smoke:web` y `e2e:install`.
- **Almacenamiento**: biblioteca en un documento JSON `version: 2`, con migración desde la 1. Historial de estudio aparte, `version: 1`, particionado por mes.

## Preguntas abiertas para el usuario

- Ninguna.

## Pendientes registrados (ninguno bloquea el harness)

- **La lectura de archivos en iOS y Android no se ha ejecutado nunca.** El gate E2E es solo web. La rama nativa vive en `src/lib/files/documentPicker.ts` y usa `expo-file-system`; está tipada y aislada, pero sin probar en dispositivo ni simulador. Es el pendiente más importante.
- **El guardado y compartido del PDF en iOS y Android tampoco se ha ejecutado nunca.** Mismo motivo y misma forma: `src/lib/files/saveFile.ts` usa `expo-file-system` y `expo-sharing`, está tipada y aislada, y no se ha probado en dispositivo ni simulador. En web sí está probada de verdad: el E2E descarga el archivo y comprueba sus bytes en Chrome de escritorio, Pixel 5 e iPhone 13/WebKit.
- **El tiempo activo mide visibilidad, no atención.** Una ventana visible pero desatendida sigue sumando tiempo de estudio. En web, `visibilitychange` no detecta que otra aplicación tape la ventana.
- **La pantalla de estadísticas fija "hoy" al montarse.** Dejarla abierta al cruzar la medianoche sigue mostrando el día anterior hasta volver a entrar. Es la alternativa a leer el reloj en cada renderizado, que haría bailar las cifras solas.
- **La racha se calcula dentro del periodo seleccionado.** Con "Todo" es la racha de todo el historial; con "1 mes" solo mira esos 30 días.
- **La serie de tarjetas añadidas es histórica y el baseline es estado actual.** Una carta añadida y luego borrada sigue contando en la serie del día en que se añadió, porque se añadió.
- **El calendario de "Todo" abarca desde el primer día con actividad.** Con años de historial la rejilla será larga; hoy el historial empieza en la activación del tracking.
- **Las estadísticas anteriores a TASK-006 no existen.** Las cartas creadas antes son baseline sin fecha de alta y con origen desconocido. No se han reconstruido ni se reconstruirán.
- **El lector `.xlsx` es propio** y cubre el texto de las celdas. Las fórmulas se leen por su resultado almacenado; los formatos numéricos y las fechas con estilo se leen por su valor crudo, así que una fecha puede aparecer como número de serie de Excel.
- **En CSV, el número de fila que se anuncia es el del registro.** Coincide con la línea salvo que un campo entrecomillado contenga saltos de línea, en cuyo caso los siguientes quedan desplazados.
- **Los mazos migrados desde la versión 1 comparten fecha de modificación.** La versión 1 no la guardaba y no hay de dónde deducirla; entre ellos el orden por modificación cae en el desempate estable.
- **La política de duplicados de flashcards sigue sin decidirse.** Importar dos veces el mismo archivo crea las tarjetas dos veces, tal y como se pidió.
- **La persistencia es local al navegador o dispositivo.** Borrar los datos del sitio, usar navegación privada o cambiar de dispositivo hace desaparecer la biblioteca.
- **Contenido guardado inválido**: la aplicación arranca vacía y lo deja intacto, pero no lo recupera.
- **Escritura completa en cada cambio**: se reescribe todo el documento. Con volúmenes grandes habría que revisarlo.
- **Concurrencia entre pestañas**: dos pestañas escriben sobre las mismas claves sin coordinación; la última gana. La cola de escritura del historial serializa dentro de una pestaña, no entre pestañas.
- **Playwright en máquina nueva**: ejecutar `npm run e2e:install` una vez.
- **Regenerar las fixtures `.xlsx`** necesita Python con `openpyxl` y `xlsxwriter`, que no son dependencias del proyecto. Ver `tests/fixtures/import/README.md`.
- **Contrato vs task de TASK-001**: el `allowed_paths` del contrato omite `.claude/**`. Para el planner en una tarea futura.
- **Decisiones de producto no tomadas**: autenticación, base de datos remota, sincronización, cuentas, algoritmo de repetición espaciada, escala y botones de calificación, Ease, scheduler, retención por aprobación/fallo, Future Due, subcategorías, modo oscuro, importación/exportación Anki, notificaciones, colaboración, IA, papelera, y la política de duplicados de flashcards.
- **Métricas de Anki todavía no calculables**: Future Due, Review Intervals, Card Ease, Retention y Answer Buttons. Se declaran con su motivo en la pantalla y en el PDF; no se muestran a cero ni se simulan.

## Evidencia

- TASK-001: `progress/evidence/TASK-001-{implementation,review,qa}.md`
- TASK-002: `progress/evidence/TASK-002-{implementation,review,qa}.md`
- TASK-003: `progress/evidence/TASK-003-{implementation,review,qa}.md`
- TASK-004: `progress/evidence/TASK-004-{implementation,review,qa}.md`
- TASK-005: `progress/evidence/TASK-005-{implementation,review,qa}.md`
- TASK-006: `progress/evidence/TASK-006-{implementation,review,qa}.md`
