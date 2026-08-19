# Sesión actual

- **Task activa:** ninguna — proyecto en estado IDLE
- **Última tarea cerrada:** TASK-004 — Persistencia local, unicidad de mazos y estabilización de navegación (`DONE`, 2026-08-18)
- **Estado del harness:** `./init.sh` exit 0
- **Repositorio:** rama `main`, remoto `https://github.com/JuanPabloRizoM/auth-flashcards-proyect.git`

No hay tarea en curso. El usuario decide cuál es la siguiente; el harness no propone roadmap.

## Estado del proyecto

- **Entorno** (TASK-001): Expo SDK 57, React Native, Expo Router, TypeScript. Plataformas: iOS, Android y web.
- **Base visual** (TASK-002): `AppShell` con sidebar en desktop y barra compacta en móvil; componentes compartidos.
- **Producto** (TASK-003): paleta confirmada, Mis mazos, detalle del mazo y estudio simple.
- **Datos** (TASK-004): persistencia local detrás del contrato `LibraryRepository`; unicidad de nombre de mazo; stack de navegación acotado.
- **Rutas**: `/`, `/componentes`, `/mazo/[id]` y `/mazo/[id]/estudiar`.
- **Gates**: `typecheck`, `lint`, `test` (100), `test:integration` (54), `test:e2e` (63 + 3 skipped en desktop-chrome, Pixel 5 e iPhone 13), más `smoke:web` y `e2e:install`.

## Preguntas abiertas para el usuario

- Ninguna.

## Pendientes registrados (ninguno bloquea el harness)

- **La persistencia es local al navegador o dispositivo.** Borrar los datos del sitio, usar navegación privada o cambiar de dispositivo hace desaparecer la biblioteca.
- **Sin editar ni borrar** mazos ni cartas. Ahora que los datos persisten, un mazo mal nombrado se queda.
- **Contenido guardado inválido**: la aplicación arranca vacía y lo deja intacto, pero no lo recupera.
- **`version: 1` sin migraciones**: un cambio futuro de forma dejará los datos existentes como inválidos hasta que se escriba una migración.
- **Escritura completa en cada cambio**: se reescribe todo el documento. Con volúmenes grandes habría que revisarlo.
- **Concurrencia entre pestañas**: dos pestañas escriben sobre la misma clave sin coordinación; la última gana.
- **Playwright en máquina nueva**: ejecutar `npm run e2e:install` una vez.
- **Contrato vs task de TASK-001**: el `allowed_paths` del contrato omite `.claude/**`. Para el planner en una tarea futura.
- **Decisiones de producto no tomadas**: autenticación, base de datos remota, sincronización, cuentas, algoritmo de repetición espaciada y calificación, estadísticas, subcategorías, modo oscuro, importación/exportación Anki, notificaciones, colaboración e IA.

## Evidencia

- TASK-001: `progress/evidence/TASK-001-{implementation,review,qa}.md`
- TASK-002: `progress/evidence/TASK-002-{implementation,review,qa}.md`
- TASK-003: `progress/evidence/TASK-003-{implementation,review,qa}.md`
- TASK-004: `progress/evidence/TASK-004-{implementation,review,qa}.md`
