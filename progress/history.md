# Historial — append-only

No reescribas entradas anteriores. Cada cierre añade una entrada.

## 2026-08-09 — TASK-001 implementación completada (pendiente de review + QA)

- Entorno base instalado: Expo SDK 57.0.11, React Native 0.86.2, React 19.2.3, TypeScript 6.0.3, Expo Router 57.0.11.
- Herramientas: ESLint 9 (`eslint-config-expo`), Jest 29 + `jest-expo` (proyectos `unit` e `integration`), Playwright 1.62 (E2E web).
- Scripts reproducibles: `typecheck`, `lint`, `test`, `test:integration`, `test:e2e`, `e2e:install`, `smoke:web`.
- Gates: `./init.sh` exit 0 (typecheck, lint, unit, integration, e2e todos [OK]); `expo-doctor` 20/20; reinstalación limpia con `npm ci` verificada.
- Decisión: Supabase/PostgreSQL NO instalados en esta tarea (fuera de scope; requiere decisiones del usuario).
- Riesgo detectado: iCloud Drive duplicó directorios dentro de `node_modules` (`* 2`), rompiendo ESLint; resuelto con `npm ci`. Recomendado mover el proyecto fuera de `~/Documents`.
- Evidencia: `progress/evidence/TASK-001-implementation.md`.

## 2026-08-11 — TASK-001 cerrada: DONE

Ciclo completo del harness ejecutado hasta el cierre.

- **Contexto previo**: el usuario inicializó Git, publicó el remoto `https://github.com/JuanPabloRizoM/auth-flashcards-proyect.git` y movió el proyecto de `~/Documents` (iCloud) a `~/Proyects`. Con ello `check_scope.py` dejó de omitirse y pasó a devolver `SCOPE: OK (TASK-001)`, sustituyendo el `[WARN] Git aún no inicializado` del gate 3 de `init.sh`.
- **Review #1: CHANGES_REQUIRED** con cuatro hallazgos, ninguno crítico ni alto: F1 evidencia desactualizada sobre Git/iCloud, F2 preguntas abiertas ya resueltas en `current.md`, F3 `.claude/settings.local.json` versionado, F4 `react-test-renderer` con caret frente a `react` exacto.
- **Corrección de proceso**: un primer veredicto se formuló como "APPROVED con cambios menores". Ese veredicto no existe. `.harness/agents/reviewer.md` admite únicamente `APPROVED` o `CHANGES_REQUIRED`; habiendo hallazgos que exigen modificación, el veredicto correcto es `CHANGES_REQUIRED` aunque el código y los gates estén verdes. Queda registrado como precedente para futuras revisiones.
- **Corrección F1-F4** (`REVIEW_FAILED -> IMPLEMENTING`), sin tocar funcionalidad ni ampliar scope: evidencia con tabla "Estado del repositorio" antes/después conservando el registro histórico; `current.md` sin preguntas abiertas obsoletas; `.claude/settings.local.json` fuera del tracking (`git rm --cached`, sigue en disco) y en `.gitignore`, manteniendo `.claude/settings.json` versionado; `react-test-renderer` fijado a `19.2.3` exacto con lockfile actualizado.
- **Review #2: APPROVED**. El reviewer comparó el lockfile entrada por entrada en lugar de fiarse del resumen: 1117 entradas antes y después, cero añadidas o eliminadas, y cero cambios en `version`, `resolved` e `integrity`; los 93 cambios restantes son reclasificaciones de metadatos `dev` -> `devOptional`. Rehízo además la reproducibilidad sobre el árbol ya corregido, porque F4 tocó el lockfile.
- **QA: APPROVED**, 18/18 acceptance re-verificadas ejecutando los comandos de forma independiente. Comprobación propia del arranque web más allá del test del implementer: `expo start --web` + descarga de la página, HTTP 200 con `Flashcards` y `Entorno base preparado.` ya renderizados en el HTML, cero errores de consola.
- **Reproducibilidad desde el remoto**: clon limpio de GitHub + `npm ci` + `./init.sh` -> exit 0. Demuestra que lo versionado basta para reconstruir el entorno, y no que funcione por estado residual de la máquina de desarrollo. Es la evidencia más fuerte de la tarea y queda registrada de forma permanente en la evidencia de implementación.
- **Gates finales**: `./init.sh` exit 0 con los diez gates en `[OK]`. `CHECKPOINTS.md` C1-C6 verificado.
- **Pendiente para el usuario, fuera del harness**: las correcciones F1-F4 y la evidencia de review/QA estaban sin commitear al cerrar la tarea; el commit `e9983e8` publicado en GitHub todavía no las contiene. Requiere commit + push.
- **Observación para el planner** (no corregida a propósito, cambiarla durante la implementación habría violado "acceptance congelado"): el `allowed_paths` del contrato omite `.claude/**`, que el task sí incluye y es el que aplica `check_scope.py`.
- Evidencia: `progress/evidence/TASK-001-implementation.md`, `progress/evidence/TASK-001-review.md` (revisiones #1 y #2), `progress/evidence/TASK-001-qa.md`.

## 2026-08-17 — TASK-002 cerrada: DONE

Base visual responsive y navegación principal. Ciclo completo del harness en una sola pasada.

- **Sistema de diseño** en `src/theme/`: tokens únicos de color, tipografía, espaciado, radios, tamaños y breakpoint. Cero literales de color fuera de `src/theme/`.
- **Componentes compartidos** en `src/components/ui/`: Button, Input, Card, Loading, EmptyState y Message. Solo los que exige la acceptance; `docs/DESIGN.md` lista más, pero `docs/CONVENTIONS.md` pide el cambio mínimo. `Input` reutiliza `Message` para su error, de modo que hay una sola forma de mostrar errores.
- **Layout y navegación** en `src/components/layout/`: `AppShell` se aplica una vez en el layout raíz; sidebar en desktop y barra inferior compacta en móvil, según `docs/DESIGN.md`. Un único `NavigationItemButton` sirve a ambas disposiciones. Responsive con `useWindowDimensions` y un breakpoint en los tokens, no con media queries CSS, para que funcione igual en web, Android e iOS.
- **Pantallas de andamiaje**: `/` (Inicio) y `/componentes` (catálogo). Demuestran el sistema visual sin simular mazos, login, estudio ni estadísticas.
- **Bug encontrado y corregido**: los destinos de primer nivel usaban `router.navigate`, que apilaba una segunda instancia de la pantalla al volver a una ruta ya visitada. Lo detectó el E2E multi-dispositivo, no los tests de integración iniciales. Corregido con `router.replace`.
- **Cobertura por dispositivo**: Playwright pasa de 1 a 3 proyectos — desktop-chrome (1280x800), mobile-chrome (Pixel 5) y mobile-safari (iPhone 13, motor WebKit de iOS). Verifican navegación, disposición por tamaño, ausencia de overflow horizontal y objetivos táctiles de 44px.
- **Sin dependencias nuevas**: `package-lock.json` no cambió. El único cambio de `package.json` es que `e2e:install` instala también webkit.
- **Review #1: CHANGES_REQUIRED**. El hallazgo importante (severidad alta) fue que el test presentado como regresión del bug de navegación era **vacuo**: el reviewer revirtió la corrección y demostró que el test pasaba igual, porque contaba nodos montados y en `renderRouter` la pantalla anterior se desmonta. El guardián real era el E2E. También: `current.md` desactualizado e `Input.multiline` sin consumidor.
- **Corrección**: el test de regresión pasa a comprobar el historial (`router.canGoBack() === false`), que es lo que de verdad distingue `replace` de `navigate`. Verificado empíricamente que ahora falla al reintroducir el bug y pasa con la corrección.
- **Review #2: APPROVED**, tras repetir el experimento de forma independiente y confirmar que ni se añadió ni se eliminó ningún test para conseguir verde.
- **QA: APPROVED**, 27/27 acceptance. Validación observable propia con un script Playwright en `/tmp`: 8 viewports x 2 rutas = 16 comprobaciones en las que exactamente una navegación existe y la otra tiene count 0, nunca coexisten; el corte cae exactamente en el breakpoint declarado (768 sidebar / 767 barra compacta); overflow horizontal de 0 px en las 16, incluido un ancho de 320 px; 45 mediciones de objetivo táctil, ninguna por debajo de 44x44; y consola sin errores en los 8 viewports.
- **Lección de proceso**: un test que acompaña a una corrección no cuenta como regresión hasta que se demuestra que falla sin la corrección. El review #1 lo comprobó reintroduciendo el bug, y esa comprobación es la que evitó cerrar la tarea con un guardián falso.
- **Gates finales**: `./init.sh` exit 0. 36 unit + 8 integration + 19 e2e (+2 skipped, los táctiles en desktop, con motivo declarado).
- **Commits**: `146cca4 feat(TASK-002): base visual responsive y navegación principal`.
- Evidencia: `progress/evidence/TASK-002-implementation.md`, `progress/evidence/TASK-002-review.md` (revisiones #1 y #2), `progress/evidence/TASK-002-qa.md`.

## 2026-08-18 — TASK-003 cerrada: DONE

Primer recorrido real del producto, sobre la dirección visual confirmada por el usuario.

- **Documentación previa**: el usuario confirmó catorce decisiones de producto, recogidas en `docs/PRODUCT.md`, y la dirección visual y la regla tipográfica en `docs/DESIGN.md`. La paleta entró dentro de esta tarea, no en una tarea aparte, por indicación expresa del usuario.
- **Dirección visual**: paleta crema/azul tinta aplicada en `src/theme/tokens.ts`. Cero literales de color fuera de ahí, así que no hubo que retocar ningún componente. Sans para la interfaz y serif reservada al contenido de las flashcards, en un único punto de uso (`FlashcardFace`): la distinción es semántica, serif es lo que se estudia y sans lo que se opera. Sin gradientes, sombras de color ni brillos.
- **Funcionalidad**: Mis mazos con lista, alta validada y estado vacío; detalle del mazo con sus cartas y alta de Frente/Reverso; estudio simple Frente -> Mostrar respuesta -> Frente + Reverso -> Siguiente carta, con progreso y cierre de sesión, sin calificación.
- **Arquitectura**: lógica pura en `src/features/` (no importa react-native ni componentes, se prueba sin montar interfaz) y acceso a datos centralizado en `LibraryProvider`. Los datos viven **en memoria**: la persistencia no está decidida y Supabase está fuera de scope. Consecuencia declarada: al recargar se pierden.
- **Del boceto se descartaron** la pantalla de acceso, los contadores nuevas/aprendiendo/repasar y la zona de calificación, por presuponer decisiones fuera de scope. La zona de calificación se eliminó en vez de conservarse como hueco, que era la opción más segura frente a la exigencia de no aparentar funcionalidad disponible.
- **Bug corregido**: volver del estudio al mazo con `replace` dejaba montada la instancia anterior del detalle. Se sale del apilado con `back`. Es el mismo patrón que el bug de TASK-002, ahora en rutas de detalle.
- **Tres rondas de revisión.** #1 CHANGES_REQUIRED: un error de formulario se anclaba al campo equivocado (faltando el Frente, el mensaje salía bajo el Reverso correctamente rellenado), y el rechazo de nombres de mazo duplicados era una decisión de producto que el agente se había inventado — que estuviera en `technical_decisions` no la confirmaba, porque ese contrato lo escribió el mismo agente. #2 CHANGES_REQUIRED: cuatro incoherencias **introducidas por la propia ronda de correcciones** (el contrato seguía exigiendo cobertura del caso retirado, la pregunta abierta no llegaba a `open_questions`, dos filas de la tabla de evidencia quedaron desfasadas y un literal señalado seguía sin tokenizar). #3 APPROVED, sin hallazgos nuevos.
- **Lección de proceso**: una ronda de correcciones es tan capaz de introducir defectos como la implementación original. El review #2 existió precisamente para eso y encontró cuatro.
- **QA: APPROVED**, 32/32 acceptance sobre comportamiento observable. Recorrido real en navegador en desktop 1280x800, móvil 390x844 y móvil estrecho 320x568; colores medidos con `getComputedStyle` uno a uno contra los confirmados; serif comprobada solo en el contenido de la carta; cero gradientes, sombras y filtros; sidebar y barra compacta nunca coexisten en 5 pantallas x 3 viewports; sin overflow horizontal en ninguna ruta; todos los controles móviles por encima de 44x44; los 11 controles visibles pulsados uno a uno con efecto observable y cero errores de consola.
- **Gates finales**: `./init.sh` exit 0. 62 unit + 33 integration + 33 e2e (+3 skipped) en desktop-chrome, Pixel 5 e iPhone 13. Sin dependencias nuevas.
- **Commits**: `3dc2c75 feat(TASK-003): mazos, flashcards y estudio simple`.
- **Pregunta abierta no bloqueante para el usuario**: ¿deben permitirse dos mazos con el mismo nombre? Hoy se permiten.
- **Dos observaciones del QA para tener en cuenta**: el apilado crece sin límite al pulsar un destino de primer nivel desde una pantalla apilada (16 instancias montadas tras 15 ciclos, aunque solo una visible y sin errores); y el botón atrás del navegador vacía la biblioteca, consecuencia genérica de la memoria, reproducible incluso en el camino más simple.
- Evidencia: `progress/evidence/TASK-003-implementation.md`, `progress/evidence/TASK-003-review.md` (revisiones #1, #2 y #3), `progress/evidence/TASK-003-qa.md`.


## 2026-08-18 — TASK-004 cerrada: DONE

Persistencia local, unicidad de mazos y estabilización de navegación.

- **Decisiones previas**: el usuario confirmó siete decisiones antes de crear la task, recogidas en `docs/PRODUCT.md`: prohibir mazos con el mismo nombre, la normalización exacta para compararlos (recortar extremos y comparar sin mayúsculas, y ninguna otra), persistencia local, alcance local al dispositivo, persistencia remota y Supabase siguen fuera, el almacenamiento detrás del repositorio, y corregir el crecimiento del stack.
- **Persistencia**: `@react-native-async-storage/async-storage` 2.2.0, instalada con `expo install`. Cubre web (localStorage), iOS y Android con la misma API, así que una sola implementación sirve para las tres plataformas. Se descartaron `expo-sqlite` por desproporcionado para un documento pequeño, y `localStorage`/`expo-file-system` por no existir en todas las plataformas.
- **Aislamiento**: contrato `LibraryRepository` en `src/lib/storage/`. La librería se importa en un único archivo y ninguna pantalla toca la capa de almacenamiento, así que sustituirla no obliga a reescribir la interfaz.
- **Forma persistida**: un solo documento JSON con `version`, `decks` y `cards`, para que no queden cartas huérfanas por escrituras parciales. Sin sistema de migraciones, que todavía no hace falta.
- **Datos**: leer nunca escribe. Si el medio no se pudo leer, las escrituras quedan suspendidas durante la sesión para no destruir datos que podrían ser válidos, y la aplicación lo dice. Hidratación asíncrona con estado de carga: no se muestra un estado vacío antes de saber qué hay guardado.
- **Navegación**: `goToTopLevel` vacía el apilado con `dismissAll` antes de sustituir la raíz. `replace` a secas dejaba debajo la pantalla anterior y el apilado crecía sin límite. Las pantallas de detalle siguen apilándose y el botón atrás conserva su comportamiento.
- **Tres rondas de revisión.** #1 CHANGES_REQUIRED: el hallazgo grave fue una **colisión de identificadores** introducida por esta tarea — el contador se reiniciaba con el recuento de entidades, pero los intentos rechazados consumían números, así que tras rehidratar se reemitían ids ya usados y dos mazos distintos podían compartir id; el reviewer lo reprodujo y abrir un mazo mostraba otro. #2 CHANGES_REQUIRED: dos huecos de verificación, **uno introducido por la propia ronda de correcciones** (suspender escrituras dejó inerte el test de fallo de escritura y su rama sin cubrir). #3 APPROVED.
- **Lección de proceso, repetida por segunda tarea consecutiva**: corregir hallazgos introduce hallazgos. Las rondas de corrección necesitan la misma revisión que la implementación original, y por eso el ciclo llegó a tres revisiones.
- **QA: APPROVED**, 51/51 acceptance sobre comportamiento observable, con seis scripts propios contra Chromium y WebKit: 154 comprobaciones. Verificó el documento real en `localStorage`, cinco recargas sin duplicar, muestreo del DOM cada 10 ms que demuestra la secuencia CARGANDO -> LISTA sin estado vacío falso, ids con huecos pero sin repetir tras intercalar rechazos, `localStorage` idéntico byte a byte tras un intento duplicado, 15 ciclos con una sola instancia en el DOM frente a las 16 de TASK-003, e `history.length` estable en 3 tras 30 navegaciones.
- **Gates finales**: `./init.sh` exit 0. 100 unit + 54 integration + 63 e2e (+3 skipped). Una dependencia nueva.
- **Commits**: `694ecf4 feat(TASK-004): persistencia local, unicidad de mazos y navegación estable`.
- Evidencia: `progress/evidence/TASK-004-implementation.md`, `progress/evidence/TASK-004-review.md` (revisiones #1, #2 y #3), `progress/evidence/TASK-004-qa.md`.
