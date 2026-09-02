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
- [2026-08-23] La aplicación tiene una sección principal de Estadísticas.
- [2026-08-23] Las estadísticas pueden consultarse para todos los mazos o para un mazo concreto.
- [2026-08-23] El filtro de mazo afecta a todas las métricas y gráficas aplicables.
- [2026-08-23] El filtro de mazo afecta también al reporte PDF.
- [2026-08-23] Los periodos principales son 1 mes, 3 meses, 1 año y todo el historial.
- [2026-08-23] Se conserva el historial estadístico aunque después se elimine el mazo o la flashcard.
- [2026-08-23] Eliminar un mazo elimina sus datos actuales y sus cartas, como ya estaba definido, pero
  NO elimina su historial de estudio.
- [2026-08-23] Eliminar una flashcard tampoco elimina los eventos históricos de estudio asociados.
- [2026-08-23] Las estadísticas anteriores a TASK-006, que nunca se registraron, no se inventan ni se
  reconstruyen.
- [2026-08-23] Debe quedar claro desde qué fecha existe historial estadístico fiable.
- [2026-08-23] Los datos estadísticos permanecen locales al dispositivo o navegador en esta etapa.
- [2026-08-23] No se envía telemetría de estudio a ningún servicio externo.
- [2026-08-23] La aplicación puede generar un reporte PDF real de estadísticas.
- [2026-08-23] El reporte puede generarse para todos los mazos o para un mazo concreto.
- [2026-08-23] El reporte utiliza el periodo seleccionado.
- [2026-08-23] Las gráficas del reporte se derivan de los mismos datos que las gráficas de la
  aplicación.
- [2026-08-23] Todavía no se implementa ni se simula repetición espaciada, Ease, retención ni botones
  Again/Hard/Good/Easy.
- [2026-08-23] Las estadísticas que requieren un algoritmo de repetición no muestran datos falsos.
- [2026-08-30] La aplicación utiliza repetición espaciada.
- [2026-08-30] El scheduler es FSRS. No se crea un algoritmo de repetición propio.
- [2026-08-30] El usuario califica cada respuesta con cuatro botones: Otra vez, Difícil, Bien y Fácil.
- [2026-08-30] Semántica de las calificaciones: Otra vez = no recordó correctamente; Difícil =
  recordó correctamente, pero con dificultad; Bien = recordó correctamente con esfuerzo normal;
  Fácil = recordó correctamente con poco o ningún esfuerzo.
- [2026-08-30] Difícil es una calificación aprobatoria, no un fallo.
- [2026-08-30] La retención objetivo inicial es del 90 %.
- [2026-08-30] La retención objetivo no es configurable por el usuario en esta etapa.
- [2026-08-30] Todavía no hay configuración avanzada de FSRS.
- [2026-08-30] Cada carta tiene estado de scheduling persistente.
- [2026-08-30] Los estados conceptuales de una carta son Nueva, Aprendiendo, Repaso y Reaprendiendo.
- [2026-08-30] Las cartas nuevas, creadas a mano o importadas, empiezan como Nueva.
- [2026-08-30] Las cartas anteriores a TASK-007 también empiezan como Nueva para el scheduler.
- [2026-08-30] No se reconstruyen calificaciones FSRS anteriores que nunca se registraron.
- [2026-08-30] El historial estadístico anterior a TASK-007 se conserva, pero los eventos sin
  calificación no cuentan como acierto ni como fallo en las estadísticas que dependen de la
  calificación.
- [2026-08-30] Las fechas de revisión futura se persisten.
- [2026-08-30] Estudiar un mazo prioriza las tarjetas que de verdad corresponde estudiar.
- [2026-08-30] El usuario puede terminar voluntariamente una sesión aunque queden tarjetas.
- [2026-08-30] No hay límite configurable de tarjetas nuevas por día ni de repasos por día.
- [2026-08-30] No hay presets ni optimización personalizada de parámetros.
- [2026-08-30] Las estadísticas de FSRS se derivan de datos reales del scheduler y del registro de
  revisiones.
- [2026-08-30] No se muestran estadísticas de FSRS para datos históricos anteriores a TASK-007.
- [2026-08-30] El scheduler y la calificación funcionan por completo sin conexión, sobre la
  persistencia local existente. Calcular la programación de una tarjeta nunca hace una petición
  externa.
- [2026-09-02] La aplicación tendrá cuentas de usuario.
- [2026-09-02] El proveedor de autenticación será Supabase Auth.
- [2026-09-02] El usuario puede iniciar sesión mediante correo electrónico y contraseña.
- [2026-09-02] El usuario puede iniciar sesión mediante Google.
- [2026-09-02] El usuario puede registrarse mediante correo electrónico y contraseña.
- [2026-09-02] El usuario puede registrarse mediante Google.
- [2026-09-02] La sesión debe persistir entre reinicios de la aplicación cuando siga siendo válida.
- [2026-09-02] Sin sesión válida no se puede acceder a las pantallas privadas.
- [2026-09-02] El usuario puede cerrar sesión.
- [2026-09-02] Supabase se utiliza en TASK-008 únicamente para autenticación.
- [2026-09-02] Los mazos, cartas, scheduling FSRS, historial y estadísticas continúan almacenados
  localmente.
- [2026-09-02] No existe todavía sincronización entre dispositivos.
- [2026-09-02] Los datos locales deben quedar aislados por usuario autenticado.
- [2026-09-02] Dos usuarios distintos que utilicen el mismo dispositivo no deben ver los datos locales
  del otro.
- [2026-09-02] El acceso mediante Google en Login y Registro utiliza el mismo proveedor OAuth
  subyacente, aunque la presentación corresponda a cada pantalla.
- [2026-09-02] No se implementa Apple Sign In en esta task.
- [2026-09-02] No se implementa recuperación de contraseña en esta task.
- [2026-09-02] No se implementan perfiles sociales ni nombres de usuario en esta task.
- [2026-09-02] No se implementa edición de perfil en esta task.
- [2026-09-02] No se mueve ningún dato de producto a Supabase Database en esta task.
```

## Decisiones todavía NO tomadas

No asumir ni completar automáticamente temas como:

- base de datos remota y persistencia en la nube de los datos de producto (Supabase Database
  incluida);
- sincronización entre dispositivos;
- modelo de suscripción;
- configuración avanzada de FSRS;
- parámetros personalizados de FSRS;
- optimización automática de parámetros;
- presets por mazo;
- límite de tarjetas nuevas por día;
- máximo de repasos por día;
- bury;
- suspend;
- leeches;
- sibling cards;
- custom study;
- reprogramación manual de una tarjeta;
- deshacer una calificación;
- subcategorías anidadas dentro de un mazo;
- modo oscuro;
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
