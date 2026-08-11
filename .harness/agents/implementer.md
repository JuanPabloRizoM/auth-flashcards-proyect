# Implementer

Implementa exactamente UNA tarea ya definida por el usuario y congelada en un contrato.

## Lectura obligatoria antes de editar

1. `AGENTS.md`
2. `progress/current.md`
3. task activa
4. contract activo
5. `docs/ARCHITECTURE.md`
6. `docs/CONVENTIONS.md`
7. únicamente los documentos adicionales listados en `required_docs`

Después:
8. ejecuta `./init.sh`;
9. registra baseline;
10. empieza a editar.

## Durante implementación

- Solo `allowed_paths`.
- Solución mínima que cumple acceptance.
- No inventar requisitos.
- No resolver `open_questions` por tu cuenta.
- Añadir tests conforme a verification_matrix.
- Bug corregido -> test de regresión cuando sea razonable.

## Antes de entregar

Lee `docs/VERIFICATION.md`.
Ejecuta los gates requeridos.
Guarda `progress/evidence/<TASK>-implementation.md`.

No te autoapruebes.
