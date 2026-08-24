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

## Almacenamiento local actual

Hasta que exista una decisión de base de datos remota, todo vive en el almacenamiento local
del dispositivo o navegador, detrás de dos contratos de repositorio.

### Biblioteca (TASK-004, TASK-005)

```text
clave:   flashcards:library:v1
formato: { "version": 2, "decks": [...], "cards": [...] }
```

Un único documento JSON. La versión 1 (sin `updatedAt` en los mazos) se sigue leyendo y se
migra al vuelo. La clave conserva el sufijo `v1` con el que nació: la versión vive dentro
del documento, que es donde puede migrarse.

### Historial de estudio (TASK-006)

```text
clave:   flashcards:history:v1:meta
formato: { "version": 1, "trackedSince": 1787…, "decks": [{ deckId, name, lastSeenAt }] }

clave:   flashcards:history:v1:month:AAAA-MM
formato: { "version": 1, "month": "2026-08",
            "sessions":      [{ id, deckId, startedAt, endedAt, activeMs, completedCards, localDay }],
            "cardEvents":    [{ id, sessionId, deckId, cardId, shownAt, revealedAt,
                                completedAt, activeMs, localDay, localHour }],
            "cardAdditions": [{ id, deckId, cardId, addedAt, origin, localDay }] }
```

- **Versión.** Solo existe la 1. Cuando haya una 2, la lectura de la 1 se conservará y se
  migrará al vuelo, como ya se hace con la biblioteca.
- **Migración desde antes del tracking.** No hay ninguna: no existía historial que migrar.
  `trackedSince` se fija la primera vez que arranca la aplicación con TASK-006 y ya no se
  mueve. Lo que existiera antes es baseline sin fecha, y no se le inventa ninguna.
- **Estrategia de crecimiento.** Una partición por mes natural. Completar una carta
  reescribe solo la partición del mes en curso, así que el coste de escribir depende de la
  actividad de ese mes y no del historial acumulado. Los meses cerrados no se tocan nunca.
- **Descubrimiento.** Las particiones se encuentran recorriendo las claves del
  almacenamiento, no un índice guardado: un índice desincronizado dejaría invisible un mes
  entero que sigue estando ahí.
- **Escrituras serializadas.** Cada `append` hace lectura, mezcla y escritura sobre la
  partición del mes. Se encadenan en una cola para que dos no se pisen: sin ella, dos
  cartas completadas casi a la vez producirían una actualización perdida.
- **Recuperación ante datos inválidos.** Cada documento se valida por separado. Una
  partición ilegible se omite, se informa en pantalla y se deja intacta; las demás se siguen
  leyendo. Si los metadatos no se pueden leer, se pierde la fecha de inicio del tracking y
  se reconoce desconocida en vez de inventarse. Nada se borra nunca.
- **Borrado.** Eliminar un mazo o una carta toca solo la biblioteca. El historial no se
  modifica: es lo confirmado en `docs/PRODUCT.md` el 2026-08-23.
- **Identidad.** Siempre el `deckId` y el `cardId`. El nombre del mazo se resuelve contra la
  biblioteca actual y, si el mazo ya no existe, contra el snapshot de `meta`, marcado como
  eliminado. Renombrar actualiza el snapshot y no crea un historial nuevo.
