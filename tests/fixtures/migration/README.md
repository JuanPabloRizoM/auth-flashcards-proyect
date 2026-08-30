# Fixtures de migración

Documentos persistidos tal y como los escribían las versiones anteriores de la aplicación.
Se guardan como archivos, y no como literales dentro de un test, para que sean exactamente
lo que había en el almacenamiento de alguien que viene de esa versión y no una
reconstrucción aproximada.

- `library-v2.json` — biblioteca de TASK-005: `version: 2`, mazos con `updatedAt`, cartas
  **sin** `scheduling` y **sin** metadata del scheduler.
- `library-v1.json` — biblioteca de TASK-004: `version: 1`, mazos **sin** `updatedAt`.
- `history-v1-meta.json` — metadatos del historial de TASK-006: `version: 1`, sin
  `ratedSince`.
- `history-v1-month.json` — partición mensual de TASK-006: `version: 1`, sin `reviews`.

Las claves con las que se guardan son las reales:
`flashcards:library:v1`, `flashcards:history:v1:meta` y
`flashcards:history:v1:month:AAAA-MM`.
