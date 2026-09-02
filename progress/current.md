# Sesión actual

- **Task activa:** ninguna — proyecto en estado IDLE
- **Última tarea cerrada:** TASK-008 — Autenticación con correo y Google mediante Supabase Auth (`DONE`, 2026-09-02)
- **Estado del harness:** `./init.sh` exit 0
- **Repositorio:** rama `main`, remoto `https://github.com/JuanPabloRizoM/auth-flashcards-proyect.git`

No hay tarea en curso. El usuario decide cuál es la siguiente; el harness no propone roadmap.

## Estado del proyecto

- **Entorno** (TASK-001): Expo SDK 57, React Native, Expo Router, TypeScript. Plataformas: iOS, Android y web.
- **Base visual** (TASK-002): `AppShell` con sidebar en desktop y barra compacta en móvil; componentes compartidos.
- **Producto** (TASK-003): paleta confirmada, Mis mazos, detalle del mazo y estudio simple.
- **Datos** (TASK-004): persistencia local detrás del contrato `LibraryRepository`; unicidad de nombre de mazo; stack de navegación acotado.
- **Gestión e importación** (TASK-005): renombrar y eliminar mazos con cascada, editar y eliminar cartas, búsqueda y orden en Mis mazos, e importación desde `.csv`, `.xlsx` y `.md` con detección determinista y vista previa obligatoria.
- **Estadísticas** (TASK-006): sección `/estadisticas` con filtro de ámbito y de periodo; historial de estudio persistente y append-only; motor de estadísticas puro; once secciones; y reporte PDF real multipágina generado por el mismo motor que el panel.
- **Autenticación** (TASK-008): cuentas reales con Supabase Auth —correo y contraseña, y
  Google— detrás de la abstracción propia `AuthService`; sesión persistente que se restaura al
  arrancar sin enseñar contenido privado por el camino; registro con las dos vías y soporte de
  los dos comportamientos de confirmación de correo; cierre de sesión; rutas repartidas en un
  grupo público y otro privado con el guard en el layout de cada uno; y datos locales
  aislados por `user.id`, con migración de una sola vez de lo que existía antes de que hubiera
  cuentas. Supabase se usa **solo** para autenticación: no hay ninguna tabla de producto.
- **Repetición espaciada** (TASK-007): scheduler FSRS real (`ts-fsrs` 5.4.1, FSRS-6.0, retención objetivo 0,90, sin fuzz) detrás de la abstracción propia `SpacedRepetitionScheduler`; reloj inyectable; estado de scheduling persistente por carta; cuatro calificaciones en español con el intervalo real de cada una; cola determinista y contadores del mazo derivados del estado; registro de calificaciones append-only; y ocho secciones nuevas de estadísticas —Próximos repasos, Calificaciones, Retención real, Intervalos de repaso, Estabilidad, Dificultad, Probabilidad de recuerdo y conteo por estado— en el panel y en el PDF.
- **Rutas**: privadas `/`, `/estadisticas`, `/componentes`, `/mazo/[id]`, `/mazo/[id]/estudiar` y `/mazo/[id]/importar`; públicas `/login`, `/registro` y `/auth/callback`. Los grupos `(app)` y `(auth)` no aparecen en la URL.
- **Gates**: `typecheck`, `lint`, `test` (749), `test:integration` (287), `test:e2e` (374 + 10 skipped condicionales en desktop-chrome, Pixel 5 e iPhone 13), más `smoke:web` y `e2e:install`.
- **Almacenamiento**: biblioteca en un documento JSON `version: 3`, con migración desde la 1 y la 2. Historial de estudio aparte, `version: 2`, particionado por mes, con migración desde la 1. Desde TASK-008 ambos cuelgan del usuario: `flashcards:user:<USER_ID>:…`.

## Preguntas abiertas para el usuario

- Ninguna.

## Pendientes registrados (ninguno bloquea el harness)

### De TASK-008

- **El acceso real contra Supabase y contra Google nunca se ha ejecutado.** No hay proyecto ni
  credenciales en el repositorio. Está implementado y cubierto por tests deterministas —el
  adaptador contra un cliente simulado y la aplicación entera contra un doble de
  autenticación—, pero eso es el contrato de autenticación, no la integración. Para
  ejecutarlo de verdad hacen falta `EXPO_PUBLIC_SUPABASE_URL` y
  `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` en un `.env`, el proveedor Google habilitado en el
  panel de Supabase y las URLs de redirección registradas. Todo está en `docs/AUTH.md`.
- **El deep link `flashcards://auth/callback` está configurado y probado, no ejecutado.** La
  aplicación no se ha abierto nunca en iOS ni en Android en esta tarea.
- **El botón de Google no lleva su logotipo.** Dibujar una aproximación incumpliría sus normas
  de marca y usar el oficial exige incorporar su recurso. Añadirlo más adelante es cambiar un
  icono, no el flujo.
- **La comprobación de higiene de `init.sh` marca `.env.example` mientras está sin
  commitear**, porque su patrón `\.env\.` también lo caza. Es transitorio —mira
  `git status --porcelain`— y `init.sh` está fuera de los `allowed_paths` de TASK-008, así que
  no se tocó. Queda para quien decida la próxima tarea.
- **`app/_layout.tsx` no se ejercita en Jest**: el arnés de integración monta un layout
  equivalente para poder inyectar el servicio de autenticación. Sí se ejercita en los E2E.
- **La contraseña la valida el servidor, no el cliente.** La pantalla solo comprueba que los
  campos estén y que la confirmación coincida: duplicar aquí la política de longitud de
  Supabase sería inventarse una regla que podría no ser la suya.

### De TASK-007

- **Un doble clic sobre una calificación revela la respuesta de la tarjeta siguiente.** La protección funciona —no se califica dos veces ni se escribe un segundo registro—, pero el segundo clic cae donde acaba de aparecer *Mostrar respuesta*. Ninguna corrección es limpia: un antirrebote temporal ataría el comportamiento al reloj, consumir la primera pulsación posterior rompería calificar y revelar seguido, y mover los controles desplazaría el problema a *Terminar sesión*.
- **No hay atomicidad real entre los dos almacenes locales.** La estrategia de compensación acota el daño y está documentada en `docs/DATABASE.md`, pero un corte de corriente en mitad de una calificación puede dejar la programación aplicada sin su registro. Si el historial no se pudo *leer* al arrancar, el registro queda suspendido toda la sesión y calificar aplica la programación sin registrar nada, con el aviso en pantalla.
- **La cola de la sesión se construye una vez, al entrar.** Una tarjeta que venza mientras se estudia no se añade sobre la marcha; entra en la sesión siguiente.
- **El resumen del mazo se recalcula al montar la pantalla y al cambiar la biblioteca, no con el reloj.** Hay que volver a entrar al mazo para que los contadores reflejen el paso del tiempo. Es la misma decisión que con "hoy" en TASK-006.
- **La probabilidad de recuerdo se fija al abrir Estadísticas.** Dejar la pantalla abierta no la actualiza sola.
- **Sin límites de nuevas por día ni de repasos por día**, porque son decisiones de producto no tomadas. Un mazo recién importado ofrece todas sus cartas nuevas de una vez.
- **El estudio con calificación no se ha ejecutado nunca en iOS ni en Android.** El gate E2E es solo web. El scheduler no usa nada específico de plataforma, pero la rama nativa sigue sin probarse.
- **Regenerar los fixtures golden usa `npx tsx`**, que no es dependencia del proyecto y se descarga al vuelo. El fixture está commiteado, así que los tests no lo necesitan.

### Heredados de tareas anteriores

- **La lectura de archivos en iOS y Android no se ha ejecutado nunca.** El gate E2E es solo web. La rama nativa vive en `src/lib/files/documentPicker.ts` y usa `expo-file-system`; está tipada y aislada, pero sin probar en dispositivo ni simulador. Es el pendiente más importante.
- **El guardado y compartido del PDF en iOS y Android tampoco se ha ejecutado nunca.** Mismo motivo y misma forma: `src/lib/files/saveFile.ts` usa `expo-file-system` y `expo-sharing`. En web sí está probada de verdad: el E2E descarga el archivo y comprueba sus bytes en Chrome de escritorio, Pixel 5 e iPhone 13/WebKit.
- **El tiempo activo mide visibilidad, no atención.** Una ventana visible pero desatendida sigue sumando tiempo de estudio. En web, `visibilitychange` no detecta que otra aplicación tape la ventana.
- **La pantalla de estadísticas fija "hoy" al montarse.** Dejarla abierta al cruzar la medianoche sigue mostrando el día anterior hasta volver a entrar.
- **La racha se calcula dentro del periodo seleccionado.** Con "Todo" es la racha de todo el historial; con "1 mes" solo mira esos 30 días.
- **La serie de tarjetas añadidas es histórica y el baseline es estado actual.** Una carta añadida y luego borrada sigue contando en la serie del día en que se añadió, porque se añadió.
- **El calendario de "Todo" abarca desde el primer día con actividad.** Con años de historial la rejilla será larga.
- **Las estadísticas anteriores a TASK-006 no existen**, y las de calificación anteriores a TASK-007 tampoco. Ni se han reconstruido ni se reconstruirán.
- **El lector `.xlsx` es propio** y cubre el texto de las celdas. Las fórmulas se leen por su resultado almacenado; los formatos numéricos y las fechas con estilo se leen por su valor crudo, así que una fecha puede aparecer como número de serie de Excel.
- **En CSV, el número de fila que se anuncia es el del registro.** Coincide con la línea salvo que un campo entrecomillado contenga saltos de línea.
- **Los mazos migrados desde la versión 1 comparten fecha de modificación.** La versión 1 no la guardaba y no hay de dónde deducirla.
- **La política de duplicados de flashcards sigue sin decidirse.** Importar dos veces el mismo archivo crea las tarjetas dos veces, tal y como se pidió.
- **La persistencia es local al navegador o dispositivo.** Borrar los datos del sitio, usar navegación privada o cambiar de dispositivo hace desaparecer la biblioteca.
- **Contenido guardado inválido**: la aplicación arranca vacía y lo deja intacto, pero no lo recupera.
- **Escritura completa en cada cambio**: se reescribe todo el documento de biblioteca. Con volúmenes grandes habría que revisarlo.
- **Concurrencia entre pestañas**: dos pestañas escriben sobre las mismas claves sin coordinación; la última gana. La cola de escritura del historial serializa dentro de una pestaña, no entre pestañas. Calificar la misma tarjeta en dos pestañas a la vez sigue esa regla.
- **Playwright en máquina nueva**: ejecutar `npm run e2e:install` una vez.
- **Regenerar las fixtures `.xlsx`** necesita Python con `openpyxl` y `xlsxwriter`, que no son dependencias del proyecto. Ver `tests/fixtures/import/README.md`.
- **Contrato vs task de TASK-001**: el `allowed_paths` del contrato omite `.claude/**`. Para el planner en una tarea futura.
- **Decisiones de producto no tomadas**: base de datos remota para los datos de producto, sincronización, configuración avanzada de FSRS, parámetros personalizados, optimización automática, presets por mazo, límites de nuevas y de repasos por día, bury, suspend, leeches, sibling cards, custom study, reprogramación manual, deshacer una calificación, subcategorías, modo oscuro, importación y exportación de Anki, notificaciones, colaboración, IA, papelera, y la política de duplicados de flashcards.
- **Única métrica de Anki todavía no calculable: Card Ease.** Pertenece a SM-2; FSRS no la usa, y su equivalente —Difficulty— sí se muestra. Se declara con su motivo en la pantalla y en el PDF.

## Evidencia

- TASK-001: `progress/evidence/TASK-001-{implementation,review,qa}.md`
- TASK-002: `progress/evidence/TASK-002-{implementation,review,qa}.md`
- TASK-003: `progress/evidence/TASK-003-{implementation,review,qa}.md`
- TASK-004: `progress/evidence/TASK-004-{implementation,review,qa}.md`
- TASK-005: `progress/evidence/TASK-005-{implementation,review,qa}.md`
- TASK-006: `progress/evidence/TASK-006-{implementation,review,qa}.md`
- TASK-007: `progress/evidence/TASK-007-{implementation,review,qa}.md`
- TASK-008: `progress/evidence/TASK-008-{implementation,review,qa}.md`
