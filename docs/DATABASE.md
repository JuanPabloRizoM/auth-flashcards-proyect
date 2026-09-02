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

- RLS obligatorio para datos privados. **Todavía no aplica**: TASK-008 no crea ninguna tabla
  de producto en PostgreSQL, así que no hay datos remotos que proteger. Las tablas del
  esquema `auth` las gestiona Supabase.
- Un usuario no puede leer/modificar datos de otro. Hoy esto se cumple **en local**, con el
  espacio de nombres por `user.id` que describe la sección de almacenamiento.
- Toda modificación de esquema crea migración versionada.
- Preferir integration tests reales para políticas RLS importantes.

## Almacenamiento local actual

Hasta que exista una decisión de base de datos remota, todo vive en el almacenamiento local
del dispositivo o navegador, detrás de dos contratos de repositorio.

Desde TASK-008 existen cuentas, y los datos de producto **cuelgan del usuario autenticado**.
Supabase sabe quién eres; qué estudias sigue siendo local (docs/PRODUCT.md, 2026-09-02).

### Espacio de nombres por usuario (TASK-008)

```text
flashcards:user:<USER_ID>:library:v1
flashcards:user:<USER_ID>:history:v1:meta
flashcards:user:<USER_ID>:history:v1:month:AAAA-MM
```

- El identificador es **`user.id`**, nunca el correo: el correo puede cambiar, y con él
  cambiaría el espacio y la persona perdería de vista sus propios datos.
- Biblioteca e historial se derivan **del mismo prefijo**, de modo que no puede ocurrir que
  la biblioteca sea de una cuenta y el historial de otra.
- `src/lib/storage/keys.ts` rechaza un identificador vacío o con `:`, que podría fabricar la
  clave de otro espacio.
- Al cambiar de sesión, `src/lib/UserScopedData.tsx` destruye y recrea los proveedores con
  `key={user.id}`: ninguna escritura en vuelo del usuario anterior alcanza al siguiente.

### Datos anteriores a las cuentas, y su migración (TASK-008)

Quien venía usando la aplicación tiene sus datos en las claves de antes, sin dueño:
`flashcards:library:v1` y `flashcards:history:v1:*`. Se entregan **una sola vez** al primer
usuario que inicia sesión (`src/lib/storage/legacyMigration.ts`):

1. **Una sola vez.** `flashcards:legacy-migration:v1` registra qué `user.id` los recibió.
   Cualquier cuenta posterior encuentra la marca y no recibe nada. Una marca ilegible también
   cuenta como marca: en la duda, no se reparte.
2. **No destructiva.** Las claves originales no se borran nunca.
3. **No sobrescribe.** Si el destino ya tiene contenido, se respeta.
4. **Verificada antes de marcar.** Se relee del medio todo lo copiado antes de escribir la
   marca. Un fallo deja el original intacto, sin marca, y el arranque siguiente reintenta.
5. **Idempotente.** Repetirla no cambia nada.

### Biblioteca (TASK-004, TASK-005)

```text
clave:   flashcards:user:<USER_ID>:library:v1
formato: { "version": 3,
           "decks": [{ id, name, updatedAt }],
           "cards": [{ id, deckId, front, back, scheduling }],
           "scheduler": { id, version, parameters } | null }
```

Un único documento JSON. La clave conserva el sufijo `v1` con el que nació: la versión vive
dentro del documento, que es donde puede migrarse.

- **Versión 1** (TASK-004): mazos sin `updatedAt`, cartas sin `scheduling`.
- **Versión 2** (TASK-005): mazos con `updatedAt`.
- **Versión 3** (TASK-007): cartas con `scheduling`, y metadata del scheduler.

Las tres se leen y las dos anteriores se migran al vuelo.

### `scheduling` de una carta (TASK-007)

```text
{ "state": "nueva" | "aprendiendo" | "repaso" | "reaprendiendo",
  "due": 1787040000000 | null,   "lastReview": 1786953600000 | null,
  "stability": 12.34,            "difficulty": 5.67,
  "elapsedDays": 4,              "scheduledDays": 12,
  "learningSteps": 0,            "reps": 7,   "lapses": 2 }
```

`due` es `null` solo en las cartas `nueva`: nunca se han calificado y no tienen una fecha
real de revisión. Se representa como ausencia y no como "ahora" para no fabricar un dato;
una carta nueva está disponible siempre, pero no está *programada* para hoy, y por eso no
aparece en Future Due.

### Migración a la versión 3

Cada carta anterior recibe el estado `nueva`. Conserva su id, su mazo, su frente, su reverso
y el `updatedAt` de su mazo. **No se le fabrica ninguna revisión, ninguna calificación ni
ninguna fecha de vencimiento**: reconstruir un historial FSRS que nunca existió produciría
estadísticas falsas (docs/PRODUCT.md, 2026-08-30). El historial de estudio no se toca: vive
en otro almacén y sobrevive intacto.

La metadata del scheduler no existía antes de la versión 3, así que se lee como `null` y se
escribe la primera vez que se guarda la biblioteca. Guarda qué algoritmo, qué versión y qué
parámetros produjeron los vencimientos que ya están en disco, para que una migración futura
pueda compararlos en vez de adivinarlos.

### Historial de estudio (TASK-006)

```text
clave:   flashcards:user:<USER_ID>:history:v1:meta
formato: { "version": 2, "trackedSince": 1787…, "ratedSince": 1788… | null,
            "decks": [{ deckId, name, lastSeenAt }] }

clave:   flashcards:user:<USER_ID>:history:v1:month:AAAA-MM
formato: { "version": 2, "month": "2026-08",
            "sessions":      [{ id, deckId, startedAt, endedAt, activeMs, completedCards, localDay }],
            "cardEvents":    [{ id, sessionId, deckId, cardId, shownAt, revealedAt,
                                completedAt, activeMs, localDay, localHour }],
            "cardAdditions": [{ id, deckId, cardId, addedAt, origin, localDay }],
            "reviews":       [{ id, sessionId, deckId, cardId, reviewedAt, rating,
                                previousState, newState, previousDue, newDue,
                                previousIntervalDays, newIntervalDays, elapsedDays,
                                stability, difficulty, durationMs,
                                schedulerId, schedulerVersion, localDay, localHour }] }
```

- **Versión.** La 1 es la de TASK-006, sin calificaciones. La 2, de TASK-007, añade
  `reviews` a cada partición y `ratedSince` a los metadatos. La 1 se sigue leyendo y se
  migra al vuelo con `reviews` vacío y `ratedSince` nulo. **La migración no fabrica
  calificaciones**: los eventos de TASK-006 registran que una carta se estudió, no cómo
  salió, y convertirlos en aciertos o fallos sería inventarse el dato.
- **`reviews` es el registro de auditoría de la repetición espaciada.** Guarda de dónde
  venía la carta y a dónde fue, no solo el resultado: con el estado y el intervalo previos,
  una estadística puede clasificar la revisión por la madurez que la carta tenía *en ese
  momento*, que es lo que separa Young de Mature. Es append-only y sobrevive al borrado de
  la carta y del mazo.
- **`ratedSince`** se fija con la primera calificación y ya no se mueve. Es la frontera entre
  lo que se midió y lo que no, y permite decir "datos de calificación disponibles desde…" en
  vez de enseñar una gráfica vacía como si significara cero.
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

## Consistencia al calificar (TASK-007)

Calificar toca los dos almacenes: la biblioteca, donde vive la programación de la carta, y el
historial, donde viven el registro de la revisión y el evento estadístico. El almacenamiento
local no ofrece una escritura atómica que abarque a los dos, así que la estrategia es
explícita y está implementada en `src/features/study/review.ts`:

1. Se escribe **primero la biblioteca**, con la programación nueva, y se espera a que
   confirme.
2. Si falla, no se escribe nada más y **no se avanza de tarjeta**. Lo guardado sigue siendo
   exactamente lo de antes.
3. Si sale bien, se escribe el historial y se espera a que llegue al medio.
4. Si el historial falla, se **revierte la biblioteca** al valor anterior, que quien llama
   conserva en memoria. Es una compensación explícita, no un olvido.
5. Si la compensación también falla, se dice: el estado ha quedado adelantado respecto al
   registro y la sesión no debe continuar como si nada.

En ninguna rama se avanza a la carta siguiente.

**Segundo límite conocido.** Si el historial no se pudo *leer* al arrancar, el registro queda
suspendido durante toda la sesión para no escribir encima de datos que puede haber ahí abajo
(comportamiento heredado de TASK-006). En ese estado, calificar sí aplica la programación
pero no registra nada, así que la asimetría existe a propósito: se prefiere poder seguir
estudiando a bloquear la aplicación. La pantalla muestra el aviso del problema mientras dura.

**Límite conocido.** No es atomicidad real. Un corte de corriente entre el paso 1 y el 3 deja
la programación aplicada sin su registro de revisión. La consecuencia es acotada y no es
corrupción: la carta queda programada y esa calificación no aparece en las estadísticas de
calificación. Se prefiere a la alternativa —registrar primero y arriesgarse a contar una
calificación que nunca se aplicó—, porque lo que la persona usuaria ve al volver es la
programación, y el registro ya declara que solo cubre lo que llegó a escribirse.
