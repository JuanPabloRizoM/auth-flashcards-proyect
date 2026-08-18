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

## Navegación

Desktop: sidebar.
Mobile: tabs/navegación compacta.

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
