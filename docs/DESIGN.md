# DESIGN

## Objetivo

Interfaz moderna, clara, consistente y agradable en desktop y móvil.

## Dirección visual confirmada

Aplicación de estudio: limpia, académica, tranquila y profesional.

Queda descartada explícitamente la estética de IA, el neón, el glow y el futurismo.

## Paleta

Fuente de verdad en código: `src/theme/tokens.ts`. Ningún componente declara color propio.

| Token | Valor | Uso |
|---|---|---|
| Fondo principal | `#F7F5F0` | Crema cálido. Lienzo de la aplicación. |
| Superficie | `#FFFFFF` | Tarjetas, filas y barras sobre el fondo. |
| Texto principal | `#20242A` | Carbón. Títulos y contenido. |
| Texto secundario | `#6B7280` | Etiquetas, ayudas y metadatos. |
| Primario | `#315B7D` | Azul tinta. Acción principal y destino activo. |
| Primario suave | `#E7EEF4` | Fondo del destino activo y de las insignias. |
| Éxito / acento | `#52705A` | Verde académico. Confirmaciones y progreso. |
| Borde | `#DDDAD3` | Separadores y contornos de 1 px. |
| Advertencia | `#A86F32` | Ámbar. Avisos. |
| Error | `#A84A4A` | Rojo apagado. Errores y acciones destructivas. |

Solo tema claro. El modo oscuro no está decidido.

## Tipografía

- **Sans-serif** para toda la interfaz: navegación, botones, etiquetas, formularios y listas.
- **Serif** reservada al contenido de las flashcards: frente y reverso.

La distinción es semántica, no decorativa: serif es lo que se estudia, sans es lo que se opera.
No usar serif para títulos de pantalla ni para texto de interfaz.

## Principios

- Jerarquía visual clara.
- Espaciado consistente.
- Pocos colores de énfasis.
- Estados loading/empty/error visibles.
- Controles cómodos para touch.
- Responsive desde el inicio.
- No crear variantes visuales nuevas sin necesidad.

## Componentes base

Implementados:

- Button
- Card
- Input
- EmptyState
- Loading
- Message
- FlashcardFace

Todavía no implementados. Crear solo cuando una tarea lo requiera:

- TextArea
- Modal
- Dialog
- Tabs
- Badge
- ProgressBar
- Toast
- IconButton

## Gráficas

Se dibujan con vistas, sin librería de gráficas: una barra es un rectángulo con altura
proporcional y el calendario es una rejilla de celdas. Funciona igual en web, iOS y Android
y no añade ninguna dependencia (docs/CONVENTIONS.md, reglas 2 y 8).

Reglas:

- Los colores salen de `chart` en `src/theme/tokens.ts`. Ningún componente declara el suyo.
- La paleta es la académica: azul tinta para la actividad, verde académico para el tiempo, y
  una escala de cinco pasos del crema al azul para el calendario. Sin neón y sin brillos.
- **El color nunca es el único portador de información.** Cada barra y cada celda llevan una
  etiqueta accesible con su fecha y su valor; la escala del calendario se explica además con
  palabras, y las celdas con actividad llevan borde.
- Toda gráfica tiene estado sin datos, y dice que no hay datos en vez de dibujar ceros.
- El eje rotula el valor del pico: sin referencia numérica una altura no informa.
- Con muchos puntos se rotula una etiqueta de cada N; las barras nunca se rotulan todas.
- Las series llegan agregadas por día o por hora. Nunca se renderiza un punto por evento.

## Pantallas de acceso (TASK-008)

Iniciar sesión y crear cuenta usan la misma identidad visual que el resto: fondo crema,
superficie blanca, azul tinta para la acción principal y sans-serif. No introducen nada nuevo.

- **No llevan `AppShell`.** Sin sesión no hay destinos que ofrecer, y una barra cuyos enlaces
  redirigen a esta misma pantalla sería ruido.
- Una columna centrada de 420 px como máximo, dentro de un `ScrollView`: a 320 px de ancho y
  con el teclado abierto todo el formulario sigue siendo alcanzable, sin desbordar en
  horizontal.
- El separador entre el acceso por correo y el de Google es la palabra «o» entre dos reglas.
- Los campos son el `Input` de siempre, ampliado con las propiedades que un formulario de
  acceso necesita de verdad: `secureTextEntry`, `autoComplete`, `textContentType`,
  `keyboardType` y envío desde el teclado. No es una variante visual nueva.

**El botón de Google no lleva su logotipo.** Dibujar una aproximación del mark de Google
incumpliría sus normas de marca, y usar el oficial exige incorporar su recurso, que el
proyecto no tiene. Un botón secundario con el texto «Continuar con Google» dice lo mismo sin
aparentar una autorización que no existe. Añadirlo más adelante es cambiar un icono, no el
flujo.

## Navegación

Desktop: sidebar.
Mobile: tabs/navegación compacta.

Destinos de primer nivel: Mis mazos, Estadísticas y Componentes.

**Cerrar sesión** no es un destino, así que no entra en esa lista. En desktop vive al pie del
sidebar, junto al correo de la cuenta; en móvil, en la cabecera. La barra inferior sigue
siendo solo de destinos: meter ahí un cuarto elemento que no navega a ninguna parte
confundiría lo que esa barra significa.

El destino activo se marca con color y, además, se anuncia: `accessibilityState.selected`
para iOS y Android y `aria-current="page"` para web, porque react-native-web no traduce el
primero en un elemento con rol de enlace y el estado quedaría solo en el color.

Los destinos de primer nivel sustituyen la ruta actual; no se apilan. Las pantallas de detalle sí
se apilan y ofrecen una vuelta explícita.

## Referencia visual

El boceto aprobado de pantallas (acceso, mis mazos, mazos con contadores, detalle del mazo y
estudio) es la referencia. Se adapta a desktop y móvil: no se copia ciegamente cuando el dibujo
plantea un problema de usabilidad.

Regla derivada del boceto: un espacio reservado a una funcionalidad no decidida puede mantenerse
como espacio estructural, pero nunca debe aparentar que la funcionalidad está disponible.

## Regla

Antes de crear un componente nuevo, comprobar si uno existente puede extenderse.
