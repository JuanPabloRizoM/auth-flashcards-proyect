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

UI -> feature logic -> data access -> Supabase
