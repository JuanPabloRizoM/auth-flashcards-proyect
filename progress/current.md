# Sesión actual

- **Task activa:** ninguna — proyecto en estado IDLE
- **Última tarea cerrada:** TASK-002 — Crear la base visual responsive y la estructura principal de navegación (`DONE`, 2026-08-17)
- **Estado del harness:** `./init.sh` exit 0
- **Repositorio:** rama `main`, remoto `https://github.com/JuanPabloRizoM/auth-flashcards-proyect.git`

No hay tarea en curso. El usuario decide cuál es la siguiente; el harness no propone roadmap.

## Estado del proyecto

Entorno (TASK-001) y base visual (TASK-002) terminados. No hay ninguna funcionalidad de producto
implementada.

- Expo SDK 57, React Native, Expo Router, TypeScript. Plataformas declaradas: iOS, Android y web.
- Sistema de diseño en `src/theme/`: única fuente de color, tipografía, espaciado, radios, tamaños
  y breakpoint.
- Componentes compartidos en `src/components/ui/`: Button, Input, Card, Loading, EmptyState, Message.
- Layout en `src/components/layout/`: `AppShell` con sidebar en desktop y barra compacta en móvil.
- Rutas existentes: `/` (Inicio) y `/componentes` (catálogo del sistema visual). Ambas son
  andamiaje; no representan secciones de producto.
- Gates: `typecheck`, `lint`, `test` (36), `test:integration` (8), `test:e2e` (19 + 2 skipped sobre
  desktop-chrome, mobile-chrome y mobile-safari), más `smoke:web` y `e2e:install`.
- `src/features/` sigue vacío.

## Pendientes registrados (ninguno bloquea el harness)

- **Playwright en máquina nueva**: ejecutar `npm run e2e:install` una vez (instala chromium y
  webkit) antes de `npm run test:e2e`.
- **Botón Atrás del navegador** entre destinos de primer nivel: `router.replace` no deja historial.
  Es el comportamiento habitual de una navegación por tabs y fue una decisión consciente, pero si
  el usuario quiere historial habría que replantearlo.
- **Estado activo de navegación en web**: se transmite por color; react-native-web no traduce
  `accessibilityState.selected` a `aria-current` sobre `role="link"`.
- **Contrato vs task de TASK-001**: el `allowed_paths` del contrato omite `.claude/**`, que el task
  sí incluye y es el que aplica `check_scope.py`. Para el planner en una tarea futura.
- **Sin iconos propios** ni modo oscuro: ninguno lo pide una acceptance; los tokens están
  centralizados, así que añadir tema oscuro después no obliga a tocar los componentes uno a uno.
- **Decisiones de producto no tomadas**: Supabase/PostgreSQL, autenticación, mazos, flashcards,
  estudio, repetición espaciada y estadísticas siguen sin decidir ni implementar.

## Evidencia

- TASK-001: `progress/evidence/TASK-001-{implementation,review,qa}.md`
- TASK-002: `progress/evidence/TASK-002-{implementation,review,qa}.md`
