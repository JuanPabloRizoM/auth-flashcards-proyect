# TASK-008 — Evidencia de implementación

**Autenticación con correo y Google mediante Supabase Auth**

Estado: entregado a revisión. El implementer no se autoaprueba.

## 0. Baseline

```text
./init.sh   → exit 0   (antes de tocar nada)
```

Gates del baseline: typecheck, lint, 636 unitarios, 229 de integración y 204 E2E
(+6 skipped condicionales) en los tres perfiles de Playwright.

TASK-007 estaba `DONE` y no había ninguna otra tarea activa.

## 1. Qué se ha construido

### Arquitectura

```text
Pantallas (/login, /registro, /auth/callback, cerrar sesión)
        │
        ▼
AuthProvider              src/lib/AuthProvider.tsx
        │
        ▼
AuthService               src/features/auth/types.ts     contrato propio
        │
        ├── SupabaseAuthService   src/features/auth/supabase/supabaseAuthService.ts
        │        ├── googleOAuth.ts      ida y vuelta a Google, por plataforma
        │        └── client.ts           ÚNICO archivo que importa @supabase/supabase-js
        │
        └── FakeAuthService       src/features/auth/fakeAuthService.ts   (tests)
```

`src/features/auth/service.ts` elige: Supabase si hay configuración, un servicio que rechaza
todo si falta, y el doble **solo** en desarrollo y con `EXPO_PUBLIC_AUTH_FAKE=1`.

La sesión del dominio es `{ user: { id, email }, expiresAt }`. **Sin tokens**: se quedan
dentro de supabase-js.

### Rutas

Las rutas existentes se han movido a dos grupos de Expo Router. Los paréntesis no aparecen en
la URL: las direcciones son exactamente las de antes.

```text
app/_layout.tsx      AuthProvider + Stack
app/(auth)/          público    /login  /registro  /auth/callback
app/(app)/           privado    /  /estadisticas  /componentes  /mazo/[id]…
```

El guard (`src/lib/AuthGate.tsx`) vive en el layout de cada grupo, no en el raíz. Es lo que
permite **no montar** una pantalla privada sin sesión, en vez de montarla y taparla: sin eso
habría un fotograma de contenido privado antes de la redirección.

### Datos locales por cuenta

```text
flashcards:user:<USER_ID>:library:v1
flashcards:user:<USER_ID>:history:v1:meta
flashcards:user:<USER_ID>:history:v1:month:AAAA-MM
```

- `src/lib/storage/keys.ts` construye las claves a partir del **`user.id`**, nunca del correo,
  y rechaza un identificador vacío o con `:` que pudiera fabricar la clave de otro espacio.
- `createAsyncStorageRepository(key, …)` y `createStudyHistoryRepository(prefix, …)` reciben
  ahora su espacio como parámetro **obligatorio**: ya no existe un valor por defecto que un
  punto de creación olvidado pudiera usar para escribir en el espacio de todos.
- `src/lib/UserScopedData.tsx` monta los dos proveedores con `key={user.id}`. Al cambiar de
  cuenta React destruye el subárbol y lo recrea; ninguna escritura en vuelo del usuario
  anterior alcanza al siguiente.

### Migración de los datos anteriores a las cuentas

`src/lib/storage/legacyMigration.ts`. Cinco reglas, todas con test:

1. una sola vez (marca global `flashcards:legacy-migration:v1`, con el `user.id` que los recibió);
2. no destructiva (las claves originales no se borran nunca);
3. no sobrescribe (si el destino ya tiene contenido, se respeta);
4. verificada antes de marcar (se relee del medio lo copiado; un fallo no deja marca y el
   arranque siguiente reintenta);
5. idempotente.

## 2. Dependencias añadidas

Instaladas con `npx expo install`, para que las versiones sean las compatibles con el SDK 57.

| Paquete | Por qué |
|---|---|
| `@supabase/supabase-js` | El proveedor de autenticación pedido. Sin él no hay task. |
| `react-native-url-polyfill` | supabase-js usa `URL`/`URLSearchParams`, incompletos en React Native. Lo indica la guía oficial de Supabase para Expo. |
| `expo-web-browser` | La sesión de navegador del sistema para el OAuth nativo (`openAuthSessionAsync`). Es la pieza que la documentación oficial usa. |
| `expo-auth-session` | `makeRedirectUri` y `QueryParams.getQueryParams`: derivar la URL de regreso de la identidad real de la app y leer el enlace de vuelta, en vez de componer cadenas a mano. |

`expo-linking` y `@react-native-async-storage/async-storage` ya estaban. No se ha añadido
ninguna librería de gráficas, de iconos ni de formularios.

`npx expo install` registró además el plugin `expo-web-browser` en `app.json`. El `scheme`
`flashcards` ya existía desde TASK-001 y no se ha inventado ninguno nuevo.

## 3. Decisiones que conviene mirar en revisión

- **El botón de Google no lleva logotipo.** Dibujar una aproximación del mark incumpliría las
  normas de marca de Google, y usar el oficial exige incorporar su recurso, que el proyecto no
  tiene. Un botón secundario con el texto «Continuar con Google» dice lo mismo sin aparentar
  una autorización que no existe. Documentado en `docs/DESIGN.md`.
- **`app/_layout.tsx` no se ejercita en los tests de Jest.** El arnés de integración monta un
  layout equivalente para poder inyectar el servicio de autenticación. El archivo real sí se
  ejercita en los E2E, que corren la aplicación entera en un navegador.
- **`.env.example` hace fallar la comprobación de higiene de `init.sh` mientras está sin
  commitear**, porque el patrón `\.env\.` también lo caza. Es transitorio: la comprobación
  mira `git status --porcelain`, así que desaparece en cuanto el archivo está en el índice.
  `init.sh` está fuera de `allowed_paths` y no se ha tocado. Se deja anotado.

## 4. Acceptance → evidencia

| # | Criterio | Método | Comando o procedimiento | Resultado |
|---|---|---|---|---|
| A001 | Existe una pantalla pública de inicio de sesión en /login con el título "Iniciar sesión". | e2e | npm run test:e2e -- tests/e2e/auth-login.spec.ts | PASS |
| A002 | La pantalla de login tiene un campo de correo electrónico con etiqueta real y autocompletado de correo. | e2e | npm run test:e2e -- tests/e2e/auth-login.spec.ts | PASS |
| A003 | La pantalla de login tiene un campo de contraseña con etiqueta real. | e2e | npm run test:e2e -- tests/e2e/auth-login.spec.ts | PASS |
| A004 | El campo de contraseña oculta el texto introducido. | e2e | npm run test:e2e -- tests/e2e/auth-login.spec.ts | PASS |
| A005 | Existe un botón "Iniciar sesión" que envía el formulario. | e2e | npm run test:e2e -- tests/e2e/auth-login.spec.ts | PASS |
| A006 | Mientras la autenticación está en curso el botón muestra estado de carga y queda inactivo. | integration | npm run test:integration -- tests/integration/auth-login-flow.test.tsx | PASS |
| A007 | Un segundo envío mientras hay uno en curso no produce una segunda llamada al servicio de autenticación. | integration | npm run test:integration -- tests/integration/auth-login-flow.test.tsx | PASS |
| A008 | Con credenciales válidas se crea sesión. | unit | npm run test -- tests/unit/auth-service-supabase.test.ts tests/unit/auth-fake-service.test.ts | PASS |
| A009 | Con credenciales inválidas no se crea sesión. | unit | npm run test -- tests/unit/auth-service-supabase.test.ts | PASS |
| A010 | El error de credenciales se muestra con un mensaje genérico, no revela si la dirección existe y nunca expone la excepción interna de Supabase. | integration | npm run test:integration -- tests/integration/auth-login-flow.test.tsx ; npm run test -- tests/unit/auth-errors.test.ts | PASS |
| A011 | Tras iniciar sesión correctamente la aplicación navega a la aplicación privada. | e2e | npm run test:e2e -- tests/e2e/auth-login.spec.ts | PASS |
| A012 | En /login hay un botón "Continuar con Google" visible. | e2e | npm run test:e2e -- tests/e2e/auth-login.spec.ts | PASS |
| A013 | El botón de Google invoca el adaptador OAuth del servicio de autenticación; la pantalla no implementa OAuth a mano. | inspection | Inspección de app/login.tsx, app/registro.tsx y src/features/auth/** | PASS |
| A014 | Un callback OAuth correcto produce sesión. | unit | npm run test -- tests/unit/auth-google-oauth.test.ts | PASS |
| A015 | Un callback OAuth con error se traduce a un error controlado. | unit | npm run test -- tests/unit/auth-google-oauth.test.ts | PASS |
| A016 | La cancelación del flujo OAuth se traduce a un estado cancelado y deja la pantalla utilizable. | unit | npm run test -- tests/unit/auth-google-oauth.test.ts ; npm run test:integration -- tests/integration/auth-login-flow.test.tsx | PASS |
| A017 | En web, tras procesar el callback no quedan tokens ni parámetros de autenticación en la URL. | unit | npm run test -- tests/unit/auth-callback-url.test.ts | PASS |
| A018 | Un OAuth correcto deja sesión persistente igual que el login por correo. | e2e | npm run test:e2e -- tests/e2e/auth-login.spec.ts | PASS |
| A019 | En /login hay un enlace "Registrarse" que lleva a /registro. | e2e | npm run test:e2e -- tests/e2e/auth-registro.spec.ts | PASS |
| A020 | /registro muestra primero la pantalla de opciones: registrarse con correo o continuar con Google. | e2e | npm run test:e2e -- tests/e2e/auth-registro.spec.ts | PASS |
| A021 | Pulsar "Registrarse con correo electrónico" muestra el formulario de correo. | e2e | npm run test:e2e -- tests/e2e/auth-registro.spec.ts | PASS |
| A022 | El formulario de registro tiene campo de correo electrónico con etiqueta real. | e2e | npm run test:e2e -- tests/e2e/auth-registro.spec.ts | PASS |
| A023 | El formulario de registro tiene campo de contraseña oculto. | e2e | npm run test:e2e -- tests/e2e/auth-registro.spec.ts | PASS |
| A024 | El formulario de registro tiene campo de confirmación de contraseña oculto. | e2e | npm run test:e2e -- tests/e2e/auth-registro.spec.ts | PASS |
| A025 | Si la contraseña y la confirmación no coinciden se rechaza el envío y no se llama al servicio. | integration | npm run test:integration -- tests/integration/auth-registro-flow.test.tsx | PASS |
| A026 | Con datos válidos se llama a la operación real de registro del servicio. | unit | npm run test -- tests/unit/auth-service-supabase.test.ts | PASS |
| A027 | Si el registro requiere verificación de correo se informa y no se simula sesión. | integration | npm run test:integration -- tests/integration/auth-registro-flow.test.tsx | PASS |
| A028 | Si el registro devuelve sesión inmediata se entra a la aplicación. | integration | npm run test:integration -- tests/integration/auth-registro-flow.test.tsx | PASS |
| A029 | El botón Google de /registro usa el mismo flujo OAuth que el de /login. | inspection | Inspección de app/registro.tsx y app/login.tsx | PASS |
| A030 | Desde el formulario de correo se puede volver, y desde /registro se puede ir a /login. | e2e | npm run test:e2e -- tests/e2e/auth-registro.spec.ts | PASS |
| A031 | Al arrancar, la aplicación restaura la sesión existente sin pedir credenciales otra vez. | integration | npm run test:integration -- tests/integration/auth-session.test.tsx | PASS |
| A032 | En web, recargar la página mantiene la sesión y la pantalla privada. | e2e | npm run test:e2e -- tests/e2e/auth-session.spec.ts | PASS |
| A033 | Desmontar y volver a montar la aplicación sobre el mismo almacenamiento restaura la sesión. | integration | npm run test:integration -- tests/integration/auth-session.test.tsx | PASS |
| A034 | Mientras la sesión se resuelve se muestra un estado de carga. | integration | npm run test:integration -- tests/integration/auth-session.test.tsx | PASS |
| A035 | Durante el arranque no se muestra en ningún momento contenido privado. | integration | npm run test:integration -- tests/integration/auth-session.test.tsx | PASS |
| A036 | Un cambio de estado de autenticación emitido por el servicio actualiza la aplicación. | integration | npm run test:integration -- tests/integration/auth-session.test.tsx | PASS |
| A037 | Una sesión expirada o revocada deja la aplicación en estado no autenticado. | integration | npm run test:integration -- tests/integration/auth-session.test.tsx | PASS |
| A038 | Cerrar sesión deja la aplicación sin sesión y en /login. | e2e | npm run test:e2e -- tests/e2e/auth-session.spec.ts | PASS |
| A039 | La ruta / es privada. | e2e | npm run test:e2e -- tests/e2e/auth-guard.spec.ts | PASS |
| A040 | La ruta /estadisticas es privada. | e2e | npm run test:e2e -- tests/e2e/auth-guard.spec.ts | PASS |
| A041 | La ruta /mazo/[id] es privada. | e2e | npm run test:e2e -- tests/e2e/auth-guard.spec.ts | PASS |
| A042 | La ruta /mazo/[id]/estudiar es privada. | e2e | npm run test:e2e -- tests/e2e/auth-guard.spec.ts | PASS |
| A043 | La ruta /mazo/[id]/importar es privada. | e2e | npm run test:e2e -- tests/e2e/auth-guard.spec.ts | PASS |
| A044 | La ruta /componentes es privada. | e2e | npm run test:e2e -- tests/e2e/auth-guard.spec.ts | PASS |
| A045 | La ruta /login es pública. | e2e | npm run test:e2e -- tests/e2e/auth-guard.spec.ts | PASS |
| A046 | La ruta /registro es pública. | e2e | npm run test:e2e -- tests/e2e/auth-guard.spec.ts | PASS |
| A047 | Un usuario autenticado que abre /login o /registro acaba en la aplicación. | e2e | npm run test:e2e -- tests/e2e/auth-guard.spec.ts | PASS |
| A048 | No existen bucles de redirección. | unit | npm run test -- tests/unit/auth-guard.test.ts | PASS |
| A049 | Las claves del almacenamiento local de datos de producto incluyen el user.id autenticado. | unit | npm run test -- tests/unit/storage-namespace.test.ts | PASS |
| A050 | La biblioteca queda aislada por usuario. | integration | npm run test:integration -- tests/integration/auth-data-isolation.test.tsx | PASS |
| A051 | Las cartas quedan aisladas por usuario. | integration | npm run test:integration -- tests/integration/auth-data-isolation.test.tsx | PASS |
| A052 | El estado de programación FSRS queda aislado por usuario. | integration | npm run test:integration -- tests/integration/auth-data-isolation.test.tsx | PASS |
| A053 | El historial de estudio queda aislado por usuario. | integration | npm run test:integration -- tests/integration/auth-data-isolation.test.tsx | PASS |
| A054 | Las estadísticas quedan aisladas por usuario. | integration | npm run test:integration -- tests/integration/auth-data-isolation.test.tsx | PASS |
| A055 | El reporte PDF usa los datos del usuario actual. | integration | npm run test:integration -- tests/integration/auth-data-isolation.test.tsx | PASS |
| A056 | El usuario A no ve los datos del usuario B. | e2e | npm run test:e2e -- tests/e2e/auth-account-switch.spec.ts | PASS |
| A057 | El usuario B no ve los datos del usuario A. | e2e | npm run test:e2e -- tests/e2e/auth-account-switch.spec.ts | PASS |
| A058 | Cerrar sesión no borra los datos locales. | integration | npm run test:integration -- tests/integration/auth-data-isolation.test.tsx | PASS |
| A059 | Volver a iniciar sesión con el mismo usuario recupera sus datos. | e2e | npm run test:e2e -- tests/e2e/auth-account-switch.spec.ts | PASS |
| A060 | Se detectan los datos locales anteriores a TASK-008. | unit | npm run test -- tests/unit/legacy-migration.test.ts | PASS |
| A061 | El primer usuario autenticado después de TASK-008 recibe la migración. | unit | npm run test -- tests/unit/legacy-migration.test.ts | PASS |
| A062 | La migración conserva los identificadores. | integration | npm run test:integration -- tests/integration/auth-legacy-migration.test.tsx | PASS |
| A063 | La migración conserva los mazos. | integration | npm run test:integration -- tests/integration/auth-legacy-migration.test.tsx | PASS |
| A064 | La migración conserva las cartas. | integration | npm run test:integration -- tests/integration/auth-legacy-migration.test.tsx | PASS |
| A065 | La migración conserva el estado de programación. | integration | npm run test:integration -- tests/integration/auth-legacy-migration.test.tsx | PASS |
| A066 | La migración conserva el historial de estudio. | integration | npm run test:integration -- tests/integration/auth-legacy-migration.test.tsx | PASS |
| A067 | La migración conserva las estadísticas derivadas. | integration | npm run test:integration -- tests/integration/auth-legacy-migration.test.tsx | PASS |
| A068 | Una segunda cuenta no recibe los datos legacy. | unit | npm run test -- tests/unit/legacy-migration.test.ts | PASS |
| A069 | La migración es idempotente. | unit | npm run test -- tests/unit/legacy-migration.test.ts | PASS |
| A070 | Un fallo de la migración no destruye los datos legacy. | unit | npm run test -- tests/unit/legacy-migration.test.ts | PASS |
| A071 | No se usa la clave service_role en el cliente. | static | grep -rn 'service_role' en el árbol versionado | PASS |
| A072 | No se commitean secretos. | static | git status/diff y grep de patrones de clave | PASS |
| A073 | .env está ignorado por git. | static | git check-ignore -v .env | PASS |
| A074 | Existe .env.example solo con marcadores de posición. | inspection | Inspección de .env.example | PASS |
| A075 | La contraseña nunca se persiste. | inspection | Inspección de src/features/auth/** y de las pantallas | PASS |
| A076 | Los tokens no se registran en logs. | static | grep de console.* en src/ y app/ | PASS |
| A077 | La evidencia no contiene tokens. | inspection | Inspección de progress/evidence/TASK-008-*.md | PASS |
| A078 | Los mensajes de error no exponen información innecesaria. | unit | npm run test -- tests/unit/auth-errors.test.ts | PASS |
| A079 | Una URL privada abierta directamente está protegida. | e2e | npm run test:e2e -- tests/e2e/auth-guard.spec.ts | PASS |
| A080 | Las pantallas de autenticación funcionan en desktop. | e2e | npm run test:e2e -- --project=desktop-chrome tests/e2e/auth-responsive.spec.ts | PASS |
| A081 | Las pantallas de autenticación funcionan en Pixel 5. | e2e | npm run test:e2e -- --project=mobile-chrome tests/e2e/auth-responsive.spec.ts | PASS |
| A082 | Las pantallas de autenticación funcionan en iPhone 13 / WebKit. | e2e | npm run test:e2e -- --project=mobile-safari tests/e2e/auth-responsive.spec.ts | PASS |
| A083 | Las pantallas de autenticación funcionan a 320 px de ancho. | e2e | npm run test:e2e -- tests/e2e/auth-responsive.spec.ts | PASS |
| A084 | Los formularios son utilizables con teclado. | e2e | npm run test:e2e -- tests/e2e/auth-responsive.spec.ts | PASS |
| A085 | No hay desbordamiento horizontal en ninguna de las anchuras probadas. | e2e | npm run test:e2e -- tests/e2e/auth-responsive.spec.ts | PASS |
| A086 | Los objetivos táctiles cumplen el tamaño mínimo del sistema visual. | e2e | npm run test:e2e -- tests/e2e/auth-responsive.spec.ts | PASS |
| A087 | Los campos tienen etiquetas accesibles. | e2e | npm run test:e2e -- tests/e2e/auth-responsive.spec.ts | PASS |
| A088 | Crear un mazo sigue funcionando. | e2e | npm run test:e2e | PASS |
| A089 | Editar un mazo sigue funcionando. | e2e | npm run test:e2e | PASS |
| A090 | Eliminar un mazo sigue funcionando. | e2e | npm run test:e2e | PASS |
| A091 | Crear una carta sigue funcionando. | e2e | npm run test:e2e | PASS |
| A092 | Editar una carta sigue funcionando. | e2e | npm run test:e2e | PASS |
| A093 | Eliminar una carta sigue funcionando. | e2e | npm run test:e2e | PASS |
| A094 | La importación CSV sigue funcionando. | e2e | npm run test:e2e | PASS |
| A095 | La importación XLSX sigue funcionando. | e2e | npm run test:e2e | PASS |
| A096 | La importación Markdown sigue funcionando. | e2e | npm run test:e2e | PASS |
| A097 | El scheduler FSRS sigue funcionando. | unit | npm run test | PASS |
| A098 | Las calificaciones siguen funcionando. | e2e | npm run test:e2e | PASS |
| A099 | Las estadísticas siguen funcionando. | e2e | npm run test:e2e | PASS |
| A100 | El reporte PDF sigue funcionando. | integration | npm run test:integration | PASS |
| A101 | La navegación sigue funcionando. | e2e | npm run test:e2e | PASS |
| A102 | La falta de variables de entorno se maneja de forma controlada. | integration | npm run test:integration -- tests/integration/auth-sin-configuracion.test.tsx ; npm run test -- tests/unit/auth-config.test.ts | PASS |
| A103 | El cliente de Supabase solo se crea con configuración válida. | unit | npm run test -- tests/unit/auth-config.test.ts | PASS |
| A104 | Se usan las APIs actuales de Supabase Auth. | inspection | Inspección de src/features/auth/supabase/** contra la documentación oficial vigente | PASS |
| A105 | El redirect de Google queda documentado. | inspection | Inspección de docs/AUTH.md | PASS |
| A106 | El deep link nativo queda documentado y configurado. | inspection | Inspección de app.json y docs/AUTH.md | PASS |
| A107 | El redirect web queda documentado y configurado. | inspection | Inspección de docs/AUTH.md y de la ruta /auth/callback | PASS |
| A108 | typecheck pasa. | static | npm run typecheck | PASS |
| A109 | lint pasa. | static | npm run lint | PASS |
| A110 | Los tests unitarios pasan. | unit | npm run test | PASS |
| A111 | Los tests de integración pasan. | integration | npm run test:integration | PASS |
| A112 | Los tests E2E pasan. | e2e | npm run test:e2e | PASS |
| A113 | ./init.sh termina con exit code 0. | static | ./init.sh | PENDIENTE — en esta ejecución falla solo por la higiene sobre `.env.example` sin commitear (ver §3). Se comprueba en el cierre. |
| A114 | Reviewer independiente APPROVED. | review | Revisión read-only registrada en progress/evidence/TASK-008-review.md | PENDIENTE — el implementer no se autoaprueba. |
| A115 | QA independiente APPROVED. | review | QA read-only registrada en progress/evidence/TASK-008-qa.md | PENDIENTE. |
| A116 | La evidencia está completa. | inspection | Inspección de progress/evidence/TASK-008-*.md | PENDIENTE — falta la de reviewer y QA. |

## 5. Gates ejecutados

```text
npm run typecheck        exit 0
npm run lint             exit 0
npm run test             749 pasan  (42 suites)   — eran 636 en el baseline
npm run test:integration 287 pasan  (27 suites)   — eran 229 en el baseline
npm run test:e2e         374 pasan, 10 skipped    — eran 204 + 6, en 3 perfiles
```

De los 10 skipped, 6 son los condicionales que ya existían y 4 son los dos tests nuevos de
sidebar, que no aplican en los dos perfiles móviles porque allí no hay sidebar.

Perfiles de Playwright: `desktop-chrome` (1280×800), `mobile-chrome` (Pixel 5) y
`mobile-safari` (iPhone 13). Los E2E de autenticación fuerzan además 320 px.

### Tests nuevos

Unitarios: `auth-guard`, `auth-errors`, `auth-service-supabase`, `auth-google-oauth`,
`auth-callback-url`, `auth-config`, `auth-fake-service`, `storage-namespace`,
`legacy-migration`.

Integración: `auth-login-flow`, `auth-registro-flow`, `auth-session`,
`auth-sin-configuracion`, `auth-data-isolation`, `auth-legacy-migration`.

E2E: `auth-login`, `auth-registro`, `auth-guard`, `auth-session`, `auth-account-switch`,
`auth-responsive`.

Fixtures nuevos: `tests/fixtures/migration/library-v3.json`, `history-v2-meta.json` y
`history-v2-month.json`, generados con el propio serializador del proyecto para que sean
exactamente lo que escribía una instalación de TASK-007.

## 6. Seguridad

```text
grep -rn "service_role" src app tests
  → solo aparece en documentación que prohíbe usarla; ninguna llamada.

grep -rn "console\." src app
  → una sola coincidencia, dentro de un comentario. Ninguna traza real.

git check-ignore -v .env
  → .gitignore:38:.env

grep -rnE "(sb_secret|eyJhbGciOiJIUzI1NiI|GOCSPX-|client_secret\s*[:=])" src app tests docs .env.example
  → sin coincidencias.
```

- `.env.example` solo contiene `EXPO_PUBLIC_SUPABASE_URL=` y
  `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=`, ambas vacías.
- La contraseña vive en el estado del formulario que la pide y no llega a ningún almacén.
  `tests/unit/auth-service-supabase.test.ts` comprueba además que la sesión del dominio tiene
  exactamente las claves `user` y `expiresAt`, y que un token presente en la respuesta de
  Supabase no aparece en ella.
- Correo inexistente y contraseña incorrecta producen el mismo código y el mismo mensaje
  (`tests/unit/auth-errors.test.ts`, `tests/integration/auth-login-flow.test.tsx`,
  `tests/e2e/auth-login.spec.ts`).
- En web, los tokens del callback se retiran de la URL (`cleanAuthUrl`), y el E2E comprueba
  que después de entrar con Google la URL no contiene `access_token`, `refresh_token`,
  `code=` ni `token_type`.
- Esta evidencia no contiene ningún token ni ninguna clave de proyecto.

## 7. Qué se ha probado de verdad, y qué no

### AUTOMATED AUTH CONTRACT — ejecutado

Todo lo anterior. El adaptador de Supabase se ejercita contra un cliente simulado que
implementa la superficie declarada en `src/features/auth/supabase/authApi.ts`: qué API se
llama, con qué argumentos y en qué se convierte cada respuesta, incluidos los errores.

Los E2E corren la aplicación real en un navegador real, con un doble de autenticación
determinista sembrado en `localStorage`.

### LIVE SUPABASE VERIFICATION — **no ejecutado**

**CONFIGURATION_REQUIRED.** El repositorio no tiene proyecto Supabase ni credenciales de
Google: no existe `.env`, ni variables `EXPO_PUBLIC_SUPABASE_*` en el entorno.

No se puede afirmar, y no se afirma, que se haya probado:

- LIVE-1 — alta e inicio de sesión reales por correo contra un proyecto Supabase;
- LIVE-2 — Google OAuth real extremo a extremo en web;
- LIVE-3 — Google OAuth real en iOS y en Android con deep link;
- LIVE-4 — el comportamiento real de confirmación de correo del proyecto.

Lo que falta para poder ejecutarlas está en `docs/AUTH.md` y en el bloque final del informe.

### Nativo

La aplicación no se ha ejecutado nunca en iOS ni en Android en esta task. El deep link
`flashcards://auth/callback` está **configurado y cubierto por tests**, no **verificado en
ejecución**. Es el mismo pendiente que ya arrastraban la lectura de archivos y el guardado de
PDF desde TASK-005 y TASK-006.


## 8. Correcciones tras el veredicto CHANGES_REQUIRED del pase 1

La revisión devolvió cuatro hallazgos. Los cuatro están corregidos, con test que los fija.

### F1 — El sidebar volvía a 240 px

`flex: 1` fuera de `styles.sidebar`. El sidebar ya se estira a lo alto por el
`alignItems: stretch` de la fila, así que el `marginTop: 'auto'` del bloque de cuenta funciona
sin tocar el ancho. Medido después del cambio, a 1280×800:

```text
app-sidebar  →  width 240
app-scroll   →  width 1040
```

Dos tests nuevos en `tests/e2e/responsive-navigation.spec.ts` fijan el ancho contra
`sizes.sidebarWidth` y comprueban que el bloque de cuenta queda al pie y dentro del sidebar.
Sin ellos, el fallo original habría vuelto a pasar desapercibido.

### F2 — El callback nativo ya no se queda girando

- `sessionFromRedirectUrl` sale de `googleOAuth.ts` y pasa a ser reutilizable: es la misma
  lectura del enlace de vuelta para el regreso de Google y para la confirmación de correo.
- `AuthService` gana `completeSessionFromUrl(url)`, implementada por el adaptador de Supabase
  y rechazada con `sin-configuracion` por el servicio sin configurar.
- `app/(auth)/auth/callback.tsx` la usa en iOS y Android con el enlace que abrió la
  aplicación, canjea cada enlace una sola vez, cuenta el fallo cuando el enlace ya no sirve y
  **siempre** ofrece «Volver a iniciar sesión», también mientras espera.
- El enlace es inyectable (`linkUrl`), como el selector de archivos de la pantalla de
  importación, porque un deep link real no se puede provocar desde un test.

Al escribir el test apareció un segundo problema, más serio que el original: cuando la sesión
nacía dentro del primer efecto de la pantalla de callback —que es exactamente lo que ocurre
al abrir la aplicación desde el enlace del correo— el guard redirigía **durante el
renderizado** y competía con el montaje del propio navegador, hasta que React cortaba por
«Maximum update depth exceeded». La redirección de `AuthGate` ha pasado a un efecto: ocurre
con el árbol ya confirmado. Que los hijos no se rendericen sigue siendo lo que evita el
destello de contenido privado, y eso no ha cambiado; los tests de «no flash» y los 17 de
guard en los tres perfiles lo siguen demostrando.

Tests: cinco casos nuevos en `tests/unit/auth-google-oauth.test.ts`, dos en
`tests/unit/auth-service-supabase.test.ts` y `tests/integration/auth-callback.test.tsx`
completo.

### F3 — Código muerto retirado

Eliminados `src/features/auth/index.ts`, `useOptionalAuth`, `completeAuthSessionIfNeeded` y la
prop `style` de `AuthBootstrap`.

### F4 — La rama de fallo de la migración ya se ve

`UserScopedData` acepta `migrate` inyectable, y el aviso va dentro de un envoltorio que
conserva el alto del marco, de modo que el mensaje no empuja la aplicación fuera de la
pantalla. `tests/integration/auth-scoped-data.test.tsx` cubre los cuatro estados: en curso,
sin datos previos, ya migrado y fallo.

### Observaciones del pase 1

Las tres `NON_BLOCKING_OBSERVATION` se dejan como están, tal y como pedía el veredicto.
