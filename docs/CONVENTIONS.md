# CONVENTIONS — Cómo escribir código en este proyecto

Este documento define reglas transversales. Se lee antes de escribir código.

## Principios

1. Preferir código simple y explícito.
2. No introducir abstracciones sin una necesidad concreta de la tarea.
3. No duplicar lógica existente.
4. Nombres descriptivos.
5. Funciones/componentes pequeños cuando mejore comprensión.
6. Errores explícitos; no ocultar fallos.
7. No dejar logs de debug ni TODOs sin contexto.
8. No añadir dependencias sin justificarlo en el contrato.
9. Mantener separación entre UI, lógica de feature y acceso a datos.
10. Un cambio debe ser tan pequeño como permita cumplir la tarea correctamente.

## TypeScript

- Evitar `any` salvo justificación documentada.
- Preferir tipos explícitos en fronteras importantes.
- No ignorar errores de TypeScript para conseguir verde.

## UI

- Reutilizar componentes existentes.
- No crear una nueva variante visual si el sistema actual puede resolverla.
- Accesibilidad básica: labels, targets táctiles y estados claros.

## Tests

- Nombres que describan comportamiento.
- Verificar resultados concretos.
- Todo bug corregido debe dejar test de regresión cuando sea razonable.

## Regla de consistencia

Antes de inventar un patrón nuevo, busca cómo se resuelve algo equivalente dentro del proyecto.
