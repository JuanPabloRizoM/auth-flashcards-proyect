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
```

## Decisiones todavía NO tomadas

No asumir ni completar automáticamente temas como:

- autenticación, y su método (correo/contraseña, Google, Apple u otros);
- base de datos remota y persistencia en la nube (Supabase incluida);
- sincronización entre dispositivos;
- cuentas de usuario y colaboración;
- editar o eliminar mazos y flashcards;
- modelo de suscripción;
- algoritmo de repetición espaciada, y cualquier botón o escala de calificación;
- estadísticas;
- subcategorías anidadas dentro de un mazo;
- modo oscuro;
- funcionamiento offline;
- importación desde Anki;
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
