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
