# PRODUCT — Fuente de verdad del producto

Este documento contiene únicamente decisiones de producto confirmadas por el usuario.

## Producto

Aplicación de flashcards.

## Objetivo general confirmado

Construir una experiencia de flashcards cuidada, usable en web y preparada para funcionar también en móvil.

## Decisiones confirmadas

Añade aquí únicamente decisiones que el usuario haya tomado explícitamente.

```text
- [2026-08-18] Dirección visual: aplicación de estudio limpia, académica, tranquila y profesional.
- [2026-08-18] Queda descartada la estética de IA, el neón, el glow y el futurismo.
- [2026-08-18] Tipografía: sans-serif para la interfaz; serif reservada al contenido de las flashcards.
- [2026-08-18] El boceto aprobado de pantallas es la referencia visual. Se adapta a desktop y móvil;
  no se copia ciegamente cuando el dibujo plantea un problema de usabilidad.
- [2026-08-18] La aplicación tiene navegación real entre secciones.
- [2026-08-18] Existe una sección "Mis mazos".
- [2026-08-18] Se pueden crear mazos.
- [2026-08-18] Se puede entrar al detalle de un mazo.
- [2026-08-18] Se pueden crear flashcards con Frente y Reverso.
- [2026-08-18] Las cartas creadas se muestran dentro de su mazo.
- [2026-08-18] Los botones visibles de estas pantallas tienen comportamiento real.
- [2026-08-18] Experiencia de estudio simple: Frente -> Mostrar respuesta -> Frente + Reverso ->
  Siguiente carta. Sin calificación.
- [2026-08-18] La zona reservada a botones de calificación puede eliminarse o quedar como espacio
  estructural no interactivo, pero nunca debe aparentar una funcionalidad disponible.
- [2026-08-18] No se permiten dos mazos con el mismo nombre.
- [2026-08-18] Para comprobar duplicados: eliminar espacios al principio y al final, y comparar sin
  distinguir mayúsculas y minúsculas. No se aplica ninguna otra normalización.
- [2026-08-18] Debe existir persistencia local de mazos y flashcards.
- [2026-08-18] La persistencia es local al dispositivo o navegador.
- [2026-08-18] La persistencia remota, la sincronización y Supabase siguen fuera de scope.
- [2026-08-18] El acceso a almacenamiento vive detrás de la abstracción de repositorio, para poder
  sustituir la implementación después sin reescribir las pantallas.
- [2026-08-18] Debe corregirse el crecimiento ilimitado del stack de navegación detectado tras
  TASK-003.
- [2026-08-22] Los mazos pueden editarse.
- [2026-08-22] Los mazos pueden eliminarse.
- [2026-08-22] Las flashcards pueden editarse.
- [2026-08-22] Las flashcards pueden eliminarse.
- [2026-08-22] El usuario debe confirmar antes de eliminar permanentemente un mazo.
- [2026-08-22] El usuario debe confirmar antes de eliminar permanentemente una flashcard.
- [2026-08-22] Al eliminar un mazo también se eliminan las flashcards que pertenecen a ese mazo.
- [2026-08-22] La regla existente de nombres únicos de mazo continúa aplicándose al renombrar.
- [2026-08-22] Mis mazos tendrá búsqueda.
- [2026-08-22] Mis mazos permitirá ordenar los mazos.
- [2026-08-22] Cada mazo mostrará al menos su número de flashcards.
- [2026-08-22] Puede mostrarse la fecha de última modificación si la arquitectura persistente de
  TASK-004 permite mantenerla correctamente.
- [2026-08-22] La aplicación permitirá importar flashcards desde archivos estructurados.
- [2026-08-22] Los formatos iniciales soportados serán .md, .csv y .xlsx.
- [2026-08-22] La importación debe utilizar Frente + Reverso, igual que las flashcards actuales.
- [2026-08-22] El sistema puede intentar detectar automáticamente qué campos corresponden a Frente
  y Reverso.
- [2026-08-22] La detección automática no utilizará IA ni servicios externos en esta task.
- [2026-08-22] Si el sistema no puede determinar el mapeo con suficiente seguridad, el usuario debe
  decidirlo manualmente.
- [2026-08-22] Siempre debe existir una vista previa antes de confirmar una importación.
- [2026-08-22] Una importación nunca debe ejecutarse silenciosamente solo porque el sistema cree
  haber reconocido el formato.
- [2026-08-22] Los archivos importados no deben modificar otras flashcards o mazos existentes.
- [2026-08-22] No se eliminan automáticamente flashcards duplicadas durante una importación. La
  política de duplicados de flashcards sigue sin estar decidida.
- [2026-08-22] Filas parcialmente inválidas en una importación: se importan solo las filas válidas.
  Antes de confirmar debe informarse de cuántas son válidas y cuántas presentan problemas, y el
  resultado debe enumerar las descartadas.
```

## Decisiones todavía NO tomadas

No asumir ni completar automáticamente temas como:

- autenticación, y su método (correo/contraseña, Google, Apple u otros);
- base de datos remota y persistencia en la nube (Supabase incluida);
- sincronización entre dispositivos;
- cuentas de usuario y colaboración;
- modelo de suscripción;
- algoritmo de repetición espaciada, y cualquier botón o escala de calificación;
- estadísticas;
- subcategorías anidadas dentro de un mazo;
- modo oscuro;
- funcionamiento offline;
- importación desde Anki y exportación a Anki;
- notificaciones;
- colaboración;
- IA;
- cualquier feature no pedida explícitamente.

## Regla

Los agentes NO convierten posibilidades en requisitos.

Si una implementación depende de una decisión de producto no confirmada:
1. anótala como `open_question` en la tarea;
2. no inventes la respuesta;
3. mantén la tarea en PLANNING/BLOCKED hasta que el usuario la defina.
