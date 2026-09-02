# ARCHITECTURE

## Stack

- TypeScript
- Expo
- React Native
- Expo Router
- Supabase
- PostgreSQL
- Unit tests
- Integration tests
- Playwright E2E web

## Organización

```text
app/
src/
  features/
    auth/
    decks/
    cards/
    study/
    statistics/
    settings/
  components/
  lib/
  theme/
  types/
tests/
```

## Estadísticas (TASK-006)

Dos almacenes separados a propósito, y un motor puro entre los datos y las pantallas:

```text
LibraryRepository          StudyHistoryRepository
 (mazos y cartas)           (sesiones, eventos y altas)
        │                            │
        └──────────► StatsEngine ◄───┘
                          │
                          ├──► Pantalla de Estadísticas
                          └──► Generador de PDF
```

- **Los dos repositorios van separados** porque tienen ciclos de vida opuestos: la
  biblioteca es un estado pequeño que se reescribe entero y del que se borran cosas, y el
  historial es una bitácora que solo crece y que sobrevive a esos borrados.
- **`StatsEngine` es una función pura** de `(biblioteca, historial, consulta)` a informe. No
  conoce React, no lee el reloj y no toca almacenamiento.
- **Las pantallas no agregan.** Piden un informe y lo pintan. El PDF pide el mismo informe.
  Las fórmulas viven en un solo sitio para que dashboard y reporte no puedan divergir.
- **El día y la hora locales se congelan al registrar cada evento**, no al consultarlo. Es
  lo que hace deterministas el calendario y la distribución horaria frente al horario de
  verano y a la zona horaria en la que se ejecuten los tests.
- La arquitectura admite añadir después métricas de repetición espaciada: serían campos
  nuevos en los eventos y secciones nuevas del informe, sin rehacer nada de lo anterior.

## Repetición espaciada (TASK-007)

El scheduler es FSRS, y vive detrás de una abstracción propia. Ninguna pantalla, ni el motor
de estadísticas, ni el historial conocen la librería que hay debajo:

```text
Pantallas (estudiar, detalle del mazo, estadísticas)
        │
        ▼
features/study            features/stats
 (cola, sesión,            (motor puro)
  confirmación)
        │                        │
        └────────► SpacedRepetitionScheduler ◄────┘
                          │
                          ▼
                  fsrsAdapter.ts        ← único archivo que importa ts-fsrs
                          │
                          ▼
                      ts-fsrs
```

- **`src/features/scheduler/types.ts`** define el contrato y los tipos propios:
  `CardScheduling`, `ReviewRating`, `SchedulingState` y `SpacedRepetitionScheduler`, con
  `preview`, `rate`, `getRetrievability` e `isDue`. Todo en español y en milisegundos desde
  epoch, como el resto del dominio.
- **`src/features/scheduler/fsrsAdapter.ts`** traduce en los dos sentidos. Cambiar de versión
  de FSRS, o de implementación, se reduce a reescribir este archivo.
- **`src/lib/clock.ts`** es el reloj. El scheduler no lo lee: recibe el instante como
  argumento, y las pantallas reciben un `Clock` inyectable. Es lo que permite fijar una
  fecha, calificar, adelantar el reloj y volver a consultar.
- **`src/features/study/queue.ts`** construye la cola y los contadores del mazo a partir del
  estado de cada carta, nunca de su posición.
- **`src/features/study/review.ts`** confirma una calificación sobre los dos almacenes, con
  su compensación explícita si el segundo falla.
- **`src/features/stats/fsrs.ts`** son las secciones nuevas del informe. Las llama
  `engine.ts`, que es quien decide el filtrado por ámbito y periodo, de modo que no puedan
  existir dos criterios distintos.

El estado de scheduling vive **con la carta**, en la biblioteca, porque su ciclo de vida es
exactamente el de la carta. El registro de calificaciones vive **en el historial**, porque es
una bitácora que solo crece y que sobrevive al borrado de la carta.

## Autenticación (TASK-008)

Supabase entra en el proyecto, y entra **solo como proveedor de identidad**. Detrás de una
abstracción propia, como el scheduler:

```text
Pantallas (/login, /registro, /auth/callback, cerrar sesión)
        │
        ▼
   AuthProvider          estado: loading / authenticated / unauthenticated
        │
        ▼
   AuthService           contrato propio, en español, sin tokens
        │
        ├── SupabaseAuthService ──► client.ts ──► @supabase/supabase-js
        └── FakeAuthService                       (tests deterministas)
```

- **`src/features/auth/types.ts`** define el contrato: `signInWithEmail`, `signUpWithEmail`,
  `signInWithGoogle`, `signOut`, `getSession` y `onAuthStateChange`.
- **`src/features/auth/supabase/client.ts`** es el único archivo que importa la librería.
  Cambiar de proveedor de identidad se reduce a escribir otro adaptador.
- **La sesión del dominio no lleva tokens.** Se queda con identificador, correo y caducidad;
  los tokens viven dentro de supabase-js, que es quien firma las peticiones.

Las rutas se separan en dos grupos de Expo Router, y el guard vive en el layout de cada uno:

```text
app/_layout.tsx     AuthProvider + Stack
app/(auth)/         público    /login  /registro  /auth/callback
app/(app)/          privado    /  /estadisticas  /componentes  /mazo/[id]…
```

Los paréntesis no aparecen en la URL. Que el guard esté en el layout del grupo, y no en el
raíz, es lo que permite **no montar** una pantalla privada sin sesión, en vez de montarla y
taparla.

Los proveedores de datos dejan de estar en el layout raíz y pasan a
`src/lib/UserScopedData.tsx`, dentro del grupo privado, con `key={user.id}`: al cambiar de
cuenta el subárbol se destruye y se vuelve a crear con el espacio de nombres del usuario
nuevo. Sin eso, una escritura en vuelo del usuario anterior acabaría en el espacio del
siguiente.

La configuración externa —panel de Supabase, Google Cloud, redirects y deep links— está en
`docs/AUTH.md`.

## Reglas

1. UI no contiene lógica compleja de negocio.
2. Acceso a Supabase centralizado.
3. Scheduler/repetición espaciada debe ser testeable sin UI.
4. Componentes reutilizables viven en `src/components/`.
5. Evitar duplicación.
6. Migraciones versionadas.
7. Cada feature debe poder verificarse de forma independiente.
8. Preferir la solución mínima que satisface el contrato.

## Dirección

UI -> feature logic -> data access -> almacenamiento local

UI -> AuthProvider -> AuthService -> SupabaseAuthService -> Supabase Auth

Los datos de producto **no** pasan por Supabase: Supabase sabe quién eres, no qué estudias
(docs/PRODUCT.md, 2026-09-02).
