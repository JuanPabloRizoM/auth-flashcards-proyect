# DATABASE

## Entidades iniciales

### profiles
- id
- username
- created_at

### decks
- id
- user_id
- name
- description
- created_at
- updated_at

### cards
- id
- deck_id
- front
- back
- created_at
- updated_at

### reviews
- id
- card_id
- user_id
- rating
- reviewed_at
- next_review_at
- interval

## Reglas

- RLS obligatorio para datos privados.
- Un usuario no puede leer/modificar datos de otro.
- Toda modificación de esquema crea migración versionada.
- Preferir integration tests reales para políticas RLS importantes.
