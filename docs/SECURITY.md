# SECURITY

## Reglas

- Nunca secretos en Git.
- Nunca credenciales de producción a agentes.
- RLS obligatorio.
- Validar inputs.
- Separar dev/test/prod.
- Revisar especialmente auth, permisos, uploads y migraciones destructivas.

## Cambios sensibles

- autenticación
- autorización
- RLS
- pagos
- uploads
- secretos
- migraciones destructivas

En versiones posteriores pueden activar revisión de seguridad dedicada.
