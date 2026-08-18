# Sesión actual

- **Task activa:** ninguna — proyecto en estado IDLE
- **Última tarea cerrada:** TASK-003 — Mazos, flashcards y estudio simple sobre la nueva dirección visual (`DONE`, 2026-08-18)
- **Estado del harness:** `./init.sh` exit 0
- **Repositorio:** rama `main`, remoto `https://github.com/JuanPabloRizoM/auth-flashcards-proyect.git`

No hay tarea en curso. El usuario decide cuál es la siguiente; el harness no propone roadmap.

## Estado del proyecto

- **Entorno** (TASK-001): Expo SDK 57, React Native, Expo Router, TypeScript. Plataformas
  declaradas: iOS, Android y web.
- **Base visual** (TASK-002): `AppShell` con sidebar en desktop y barra compacta en móvil;
  componentes compartidos Button, Card, Input, Loading, EmptyState y Message.
- **Producto** (TASK-003): paleta confirmada en los tokens; Mis mazos, detalle del mazo y estudio
  simple. Lógica pura en `src/features/`, acceso a datos centralizado en `src/lib/LibraryProvider`.
- **Rutas**: `/` (Mis mazos), `/componentes` (catálogo del sistema visual), `/mazo/[id]` y
  `/mazo/[id]/estudiar`.
- **Gates**: `typecheck`, `lint`, `test` (62), `test:integration` (33), `test:e2e` (33 + 3 skipped
  sobre desktop-chrome, Pixel 5 e iPhone 13), más `smoke:web` y `e2e:install`.

## Preguntas abiertas para el usuario

- **¿Deben permitirse dos mazos con el mismo nombre?** Hoy se permiten. La primera versión de
  TASK-003 los rechazaba, pero el review #1 señaló que prohibirlos es una decisión de producto que
  el agente no puede tomar. No bloquea nada.

## Pendientes registrados (ninguno bloquea el harness)

- **Los datos no se persisten.** Viven en memoria; al recargar la página se pierde todo. Es
  consecuencia directa de que la decisión de almacenamiento no esté tomada. El botón atrás del
  navegador tiene el mismo efecto.
- **El apilado crece sin límite** al pulsar un destino de primer nivel desde una pantalla apilada:
  quedan instancias montadas aunque solo una sea visible. Sin errores ni efecto observable, pero es
  de la misma familia que los dos bugs de navegación ya corregidos.
- **Sin editar ni borrar** mazos ni cartas: el usuario no lo ha pedido.
- **Playwright en máquina nueva**: ejecutar `npm run e2e:install` una vez antes de `npm run test:e2e`.
- **Contrato vs task de TASK-001**: el `allowed_paths` del contrato omite `.claude/**`, que el task
  sí incluye y es el que aplica `check_scope.py`. Para el planner en una tarea futura.
- **Sin iconos propios** ni modo oscuro.
- **Decisiones de producto no tomadas**: autenticación, base de datos y persistencia,
  sincronización, algoritmo de repetición espaciada y calificación, estadísticas, subcategorías
  anidadas, modo oscuro, importación desde Anki, notificaciones, colaboración e IA.

## Evidencia

- TASK-001: `progress/evidence/TASK-001-{implementation,review,qa}.md`
- TASK-002: `progress/evidence/TASK-002-{implementation,review,qa}.md`
- TASK-003: `progress/evidence/TASK-003-{implementation,review,qa}.md`
