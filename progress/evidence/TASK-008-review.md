# TASK-008 — Revisión

Revisión independiente, **read only**. En ningún pase se ha editado código.

Leídos: `AGENTS.md`, `.harness/tasks/TASK-008.json`, `.harness/contracts/TASK-008.json`,
`docs/ARCHITECTURE.md`, `docs/CONVENTIONS.md`, `docs/DESIGN.md`, `docs/SECURITY.md`,
`docs/VERIFICATION.md`, `CHECKPOINTS.md`, `progress/evidence/TASK-008-implementation.md` y el
diff completo (102 archivos, +8971 / −231).

---

# Pase 1 — CHANGES_REQUIRED

Cuatro hallazgos exigían cambiar código o tests. Según la regla de veredicto acordada, la
existencia de cualquier hallazgo que el equipo decida corregir obliga a este veredicto: no se
aprueba y luego se corrige.

## R1 — Scope

Los archivos tocados caen dentro de `allowed_paths` o de las rutas meta siempre permitidas.
`python3 scripts/check_scope.py` → `SCOPE: OK (TASK-008)`.

`init.sh` **no** se ha tocado, pese a que su comprobación de higiene marca `.env.example`
mientras está sin commitear. Correcto: está fuera de `allowed_paths`.

Las cuatro dependencias nuevas están justificadas una a una y se instalaron con
`npx expo install`. No hay librería de gráficas, iconos ni formularios.

No se ha creado ninguna tabla en PostgreSQL: `grep -rn "\.from(\|create table" src app` no
devuelve nada del dominio. Supabase se usa solo para autenticación, como exige el contrato.

## R2 — Correctitud contra acceptance

### Comprobado y correcto

- **Route bypass.** Entrada por URL directa a `/`, `/estadisticas`, `/componentes`,
  `/mazo/mazo-1`, `/mazo/mazo-1/estudiar` y `/mazo/mazo-1/importar` sin sesión: las seis
  acaban en `/login` y el marco de la aplicación ni siquiera se monta. El guard vive en el
  layout del grupo, lo que lo hace real y no cosmético.
- **Session flash.** Con `getSession` colgado a propósito, el árbol no contiene ningún nodo
  privado ni la pantalla de acceso: solo `auth-bootstrap`.
- **Bucle de redirecciones.** `decideRoute` es pura y su test comprueba la propiedad que
  importa: aplicarla al destino que ella misma produce da siempre `mostrar`.
- **Contraseñas.** No aparecen en ningún `setItem`.
- **Tokens.** La sesión del dominio tiene exactamente `user` y `expiresAt`; hay un test que
  mete tokens en la respuesta simulada y comprueba que no salen. Ningún `console.*` real en
  `src/` ni en `app/`.
- **Secretos.** `service_role` solo aparece en documentación que la prohíbe; `.env` ignorado;
  `.env.example` solo con marcadores.
- **Enumeración de cuentas.** `user_not_found` e `invalid_credentials` colapsan en el mismo
  código y el mismo mensaje; `email_exists` no confirma que la dirección exista.
- **Fuga A → B.** Comprobada leyendo los repositorios, no solo la pantalla.
- **Migración legacy.** Las cinco reglas tienen test, incluido el medio que acepta la
  escritura pero no guarda nada.
- **Logout y teardown.** Cierra, vuelve a `/login`, no borra datos, el botón atrás no
  devuelve contenido privado, y `key={user.id}` destruye y recrea los proveedores.
- **Tests que no engañan.** La evidencia distingue AUTOMATED AUTH CONTRACT de LIVE SUPABASE
  VERIFICATION y no afirma haber probado Google real.

### Hallazgos

**F1 — El sidebar de escritorio pasa de 240 px a 656 px · alta.** `flex: 1` en
`styles.sidebar`: el contenedor es una fila y `main` también lleva `flex: 1`, así que con
`flexBasis: 0` en los dos el ancho fijo deja de mandar. Medido a 1280×800: sidebar 656,5 px,
contenido 623,5 px. Regresión visual de una pantalla ya aprobada, y ninguna suite la detecta
porque nada afirma sobre el ancho. Hay que corregirla **y** fijarla con una comprobación.

**F2 — En iOS y Android `/auth/callback` se queda cargando para siempre · media.** El cliente
nativo se crea con `detectSessionInUrl: false` y el OAuth nativo se resuelve dentro de
`openAuthSessionAsync`, así que esa ruta no se usa para Google. Pero **sí** para la
confirmación de correo: `signUp` envía `emailRedirectTo` a `flashcards://auth/callback`. Quien
llegue por ahí verá «Estamos terminando de iniciar tu sesión…» indefinidamente: el efecto está
guardado tras `Platform.OS !== 'web'` y nadie procesa el enlace. Sin sesión, sin error y sin
salida. Contradice la PARTE O del encargo.

**F3 — Código muerto · baja.** `src/features/auth/index.ts` (barrel que nadie importa),
`useOptionalAuth`, `completeAuthSessionIfNeeded` y la prop `style` de `AuthBootstrap`.
`docs/CONVENTIONS.md`, regla 2.

**F4 — La rama de fallo de la migración no la ejercita ningún test · baja.** `UserScopedData`
tiene tres estados y solo dos están cubiertos; el aviso se renderiza fuera del marco y no se
ha visto nunca. `migrateLegacyData` se llama sin inyección, así que ese camino no era
alcanzable.

## R3 — Evidencia y regresiones (pase 1)

La matriz cubre los 116 criterios y marca honestamente como pendientes A113, A114, A115 y
A116. El baseline era 636 / 229 / 204: ningún test existente se ha debilitado ni eliminado.
Los cambios en tests previos son mecánicos —claves con espacio de nombres, rutas movidas a los
grupos y una sesión sembrada— y sus afirmaciones siguen siendo las mismas.

## R4 y R5 (pase 1)

Arquitectura, convenciones y decisiones de producto: correctas. Detalle en el pase 2, que las
vuelve a comprobar sobre el código final.

**Veredicto del pase 1: CHANGES_REQUIRED.**

---

# Pase 2 — APPROVED

Revisión nueva sobre el código corregido. Se ha vuelto a leer el diff entero, no solo lo que
cambió entre pases.

## Verificación de los cuatro hallazgos

**F1 — corregido y fijado.** `flex: 1` fuera. Medido a 1280×800: sidebar 240 px, contenido
1040 px, que es exactamente `sizes.sidebarWidth` y el resto. Dos tests nuevos en
`tests/e2e/responsive-navigation.spec.ts` fijan el ancho contra el token y comprueban que el
bloque de cuenta queda al pie y dentro del sidebar. La comprobación que faltaba, existe.

**F2 — corregido, y por el camino apareció algo peor.** `sessionFromRedirectUrl` sale de
`googleOAuth.ts` y la reutilizan el regreso de Google y el enlace de confirmación;
`AuthService` gana `completeSessionFromUrl`; la pantalla la usa en nativo, canjea cada enlace
una sola vez y **siempre** ofrece salida, también mientras espera.

Al escribir el test apareció un fallo de fondo que el hallazgo original tapaba: cuando la
sesión nacía dentro del primer efecto de la pantalla de callback —justo lo que pasa al abrir
la aplicación desde el enlace del correo— `AuthGate` redirigía **durante el renderizado** y
competía con el montaje del navegador hasta que React cortaba por «Maximum update depth
exceeded». Es decir: el flujo de confirmación de correo en nativo no habría funcionado, y no
por la pantalla, sino por el guard.

La redirección ha pasado a un efecto. He comprobado explícitamente que eso **no** reintroduce
el destello: `AuthGate` sigue devolviendo `AuthBootstrap` en cuanto la decisión no es
`mostrar`, así que los hijos no llegan a renderizarse; lo único que cambia es cuándo se
navega, no qué se ve. Lo confirman los tests de «no flash» y los 17 de guard en los tres
perfiles. Y no puede quedarse rebotando: el efecto depende del destino, y `decideRoute`
garantiza que el destino es un punto fijo.

**F3 — corregido.** Los cuatro exports muertos ya no están. `grep` confirma que nadie los
buscaba.

**F4 — corregido.** `UserScopedData` acepta `migrate` inyectable y
`tests/integration/auth-scoped-data.test.tsx` cubre los cuatro estados. El aviso va dentro de
un envoltorio que conserva el alto del marco, de modo que el mensaje no empuja la aplicación
fuera de la pantalla.

## R1 — Scope (pase 2)

Sin cambios respecto al pase 1. `SCOPE: OK (TASK-008)`. Las correcciones no han añadido
dependencias ni han tocado nada fuera de `allowed_paths`.

## R2 — Correctitud (pase 2)

Todo lo verificado en el pase 1 sigue siendo cierto sobre el código final, y además:

- El contrato `AuthService` ha crecido en una operación, y las **tres** implementaciones la
  tienen: Supabase, la de «sin configuración» —que la rechaza con `sin-configuracion`— y el
  doble. No hay ninguna que la deje sin definir.
- `completeSessionFromUrl` cubre los dos formatos que un proyecto de Supabase puede devolver:
  tokens en la URL y código PKCE. Los casos de enlace caducado, enlace con error del proveedor
  y URL ilegible devuelven fallo controlado, sin lanzar.
- La ruta de callback ofrece salida en los tres estados: esperando, con error y sin enlace.
- No queda ningún `.only`, ningún `TODO` y ningún `console.*` real.
- Los `test.skip` nuevos son condicionales por dispositivo y declaran su motivo: no hay
  sidebar que medir en un móvil.

## R3 — Evidencia y regresiones (pase 2)

```text
npm run typecheck        exit 0
npm run lint             exit 0
npm run test             749 pasan  (42 suites)   — baseline 636
npm run test:integration 287 pasan  (27 suites)   — baseline 229
npm run test:e2e         374 pasan, 10 skipped    — baseline 204 + 6
```

Los 10 skipped son los 6 condicionales de siempre más los 4 de sidebar en perfiles móviles.
Ningún test se ha debilitado: los recuentos suben en las tres capas y las suites previas
conservan sus afirmaciones.

La matriz de la evidencia cubre los 116 criterios y sigue marcando como pendientes A113
(`./init.sh` final), A114, A115 y A116, que es lo correcto en este punto del proceso.

## R4 — Arquitectura y convenciones

La dirección UI → AuthProvider → AuthService → SupabaseAuthService → librería se respeta.
`@supabase/supabase-js` se importa en un solo archivo, y las demás menciones son comentarios.
Ninguna pantalla construye URLs de OAuth ni maneja tokens. Los repositorios exigen su espacio
de nombres como parámetro, lo que convierte en error de compilación un olvido que antes habría
sido una fuga silenciosa.

La identidad visual se conserva y ningún texto promete sincronización: la única coincidencia
de `grep -rniE "sincroniz|en la nube|todos tus dispositivos"` es la palabra «desincronizado»
dentro de un comentario de `historySerialization.ts`, anterior a esta task.

## R5 — Decisiones no autorizadas

Ninguna. Las veinte decisiones de producto están en `docs/PRODUCT.md` con fecha 2026-09-02 tal
y como el usuario las enunció, y las tres retiradas de «no tomadas» son exactamente las tres
que pidió retirar. No hay tablas, ni sincronización, ni proveedores extra, ni recuperación de
contraseña, ni perfiles.

La ausencia de logotipo en el botón de Google está documentada y razonada en `docs/DESIGN.md`,
y es la decisión conservadora correcta.

## Observaciones que NO requieren cambio

**NON_BLOCKING_OBSERVATION 1.** El E2E «después de entrar no quedan datos de autenticación en
la URL» es débil: con el doble de autenticación nunca hay tokens en la URL, así que la
afirmación se cumple sola. La cobertura real de A017 es el unitario de `cleanAuthUrl`, que es
lo que el contrato declara como método. El E2E se queda como red contra una regresión futura,
no como prueba principal.

**NON_BLOCKING_OBSERVATION 2.** En web, si la navegación hacia Google no llegara a ocurrir, el
botón se quedaría en carga. No es alcanzable en la práctica: `signInWithOAuth` sin
`skipBrowserRedirect` provoca una navegación de nivel superior, no una ventana emergente, y si
esa navegación no ocurre el documento tampoco sigue vivo.

**NON_BLOCKING_OBSERVATION 3.** `app/_layout.tsx` no se ejercita en Jest: el arnés de
integración monta un layout equivalente para poder inyectar el servicio. Sí se ejercita en los
E2E, que cargan la aplicación entera. Es la misma decisión que ya tomaba `statsHarness`.

**NON_BLOCKING_OBSERVATION 4.** La comprobación de higiene de `init.sh` marca `.env.example`
mientras está sin commitear, porque su patrón `\.env\.` también lo caza. Es transitorio —mira
`git status --porcelain`— y `init.sh` está fuera de `allowed_paths`, así que no se toca aquí.
Queda anotado como pendiente para quien decida la próxima tarea.

**NON_BLOCKING_OBSERVATION 5.** El flujo real contra Supabase y contra Google no se ha
ejecutado: no hay proyecto ni credenciales. La evidencia lo declara como
`CONFIGURATION_REQUIRED` y no lo cuenta como probado, que es exactamente lo que el contrato
exige. No es un defecto de la implementación.

## Veredicto

**APPROVED**

No queda ningún hallazgo que exija modificar código, tests, contrato, evidencia ni
documentación. Las cinco observaciones anteriores son informativas y no se tocan durante el
cierre.
