# SECURITY

## Reglas

- Nunca secretos en Git.
- Nunca credenciales de producción a agentes.
- RLS obligatorio.
- Validar inputs.
- Separar dev/test/prod.
- Revisar especialmente auth, permisos, uploads y migraciones destructivas.

## Claves y sesión (TASK-008)

- En el cliente solo puede vivir la **clave publicable** del proyecto Supabase, y viene del
  entorno (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`), no del código.
- **`service_role` no se usa nunca en el cliente.** Salta el RLS por completo.
- El **client secret de Google** vive en el panel de Supabase, no en el repositorio.
- `.env` está ignorado; `.env.example` solo lleva marcadores.
- **Las contraseñas no se persisten.** Viven en el estado del formulario que las pide y
  desaparecen con él.
- **Los tokens no salen de supabase-js.** La sesión del dominio lleva identificador, correo y
  caducidad; nada más. No se registran en logs ni aparecen en la evidencia.
- **No se ayuda a enumerar cuentas.** Un correo que no existe y una contraseña incorrecta
  producen exactamente el mismo mensaje, y el registro no confirma que una dirección ya esté
  usada.
- Los mensajes de error son propios: el texto del proveedor no llega nunca a la pantalla.
- En web, los tokens del callback de OAuth se retiran de la URL en cuanto se procesan.
- Sin configuración válida no se crea ninguna sesión. El doble de autenticación de los tests
  solo puede activarse en desarrollo y con una variable explícita.
- **Aislamiento local por cuenta**: los datos de producto cuelgan del `user.id`, de modo que
  dos personas que compartan dispositivo no ven los datos de la otra. RLS todavía no aplica
  porque no hay tablas de producto remotas.

## Cambios sensibles

- autenticación
- autorización
- RLS
- pagos
- uploads
- secretos
- migraciones destructivas

En versiones posteriores pueden activar revisión de seguridad dedicada.
