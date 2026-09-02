# AUTH — Autenticación con Supabase (TASK-008)

Este documento describe cómo está montada la autenticación y **qué hay que configurar fuera
del repositorio** para que funcione contra un proyecto real.

## Qué hace Supabase aquí, y qué no

Supabase se usa **solo para autenticación**. Los mazos, las cartas, la programación FSRS, el
historial y las estadísticas siguen viviendo en el almacenamiento local del dispositivo
(docs/PRODUCT.md, 2026-09-02).

No hay tablas de producto en PostgreSQL, y por tanto tampoco políticas RLS de producto: no
hay nada remoto que proteger todavía. Las tablas internas del esquema `auth` las gestiona
Supabase.

**Esto no es sincronización.** Iniciar sesión en otro dispositivo da acceso a la aplicación,
no a los mazos creados en el primero. La interfaz no dice en ningún sitio "sincronizado",
"guardado en la nube" ni "disponible en todos tus dispositivos", porque hoy sería falso.

## Arquitectura

```text
Pantallas (/login, /registro, /auth/callback, cerrar sesión)
        │
        ▼
AuthProvider              src/lib/AuthProvider.tsx      estado: loading/authenticated/…
        │
        ▼
AuthService               src/features/auth/types.ts    contrato propio
        │
        ├── SupabaseAuthService   src/features/auth/supabase/supabaseAuthService.ts
        │        │
        │        ├── googleOAuth.ts   ida y vuelta a Google, por plataforma
        │        └── client.ts        ÚNICO archivo que importa @supabase/supabase-js
        │
        └── FakeAuthService       src/features/auth/fakeAuthService.ts   (tests)
```

`src/features/auth/service.ts` decide cuál se usa: el real si hay configuración, uno que
rechaza todo si falta, y el doble solo en desarrollo y con `EXPO_PUBLIC_AUTH_FAKE=1`.

La sesión que sale de `AuthService` lleva identificador, correo y caducidad. **Los tokens no
salen de supabase-js**: no se copian al estado de React ni se guardan en ningún sitio propio.

## Rutas

```text
app/
  _layout.tsx          AuthProvider + Stack
  (auth)/              PÚBLICO   /login  /registro  /auth/callback
  (app)/               PRIVADO   /  /estadisticas  /componentes  /mazo/[id]…
```

Los paréntesis no aparecen en la URL: las rutas son las mismas que antes de TASK-008. El
guard vive en el layout de cada grupo (`src/lib/AuthGate.tsx`), de modo que una pantalla
privada **no llega a montarse** sin sesión.

## Variables de entorno

| Variable | Qué es | Dónde se obtiene |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | URL del proyecto | Supabase Dashboard → Project Settings → API |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clave publicable (antes «anon») | Supabase Dashboard → Project Settings → API keys |

Copia `.env.example` a `.env` y rellénalas. `.env` está en `.gitignore` y **no se commitea**.

Las dos son públicas por diseño —viajan en el bundle del cliente— y por eso llevan el prefijo
`EXPO_PUBLIC_`, que es lo que hace que Expo las incruste al compilar.

**Nunca** pongas aquí `service_role` ni el `client_secret` de Google. La primera salta el RLS
por completo; el segundo permitiría suplantar a la aplicación ante Google. Ninguna de las dos
tiene nada que hacer en un cliente (docs/SECURITY.md).

Sin estas variables la aplicación arranca, la pantalla de acceso explica cuáles faltan y **no
se crea ninguna sesión**.

## Configuración externa

### 1. Supabase Dashboard

**Authentication → Providers → Google**: habilitar, y pegar el *Client ID* y el *Client
secret* de Google (el secreto vive en el panel de Supabase, no en el repositorio). El panel
muestra ahí la *Callback URL* del proyecto, con esta forma:

```text
https://<REF-DEL-PROYECTO>.supabase.co/auth/v1/callback
```

Esa es la URL que hay que registrar en Google, no una escrita a mano.

**Authentication → URL Configuration → Redirect URLs**: añadir las URLs a las que la
aplicación pide volver. Salen de la identidad real de la aplicación:

| Plataforma | URL a registrar | De dónde sale |
|---|---|---|
| Web, desarrollo | `http://localhost:8081/auth/callback` | puerto por defecto de `expo start --web` |
| Web, producción | `https://<TU-DOMINIO>/auth/callback` | el dominio donde publiques la build |
| iOS y Android | `flashcards://**` | `scheme` de `app.json` |

El `scheme` es `flashcards`, declarado en `app.json` desde TASK-001. Los identificadores
nativos son `com.flashcards.app` en iOS y en Android.

La ruta `/auth/callback` no está escrita a mano en el código: la construye
`makeRedirectUri({ path: 'auth/callback' })` en `src/features/auth/supabase/platform.ts`, a
partir del origen en web y del `scheme` en nativo.

### 2. Google Cloud / Google Auth Platform

En el proyecto de Google del usuario, **APIs & Services → Credentials → OAuth 2.0 Client
IDs**, un cliente de tipo *Web application*:

- **Authorized JavaScript origins**: el origen desde el que se sirve la aplicación web
  (`http://localhost:8081` en desarrollo, `https://<TU-DOMINIO>` en producción).
- **Authorized redirect URIs**: la *Callback URL* que muestra el panel de Supabase, es decir
  `https://<REF-DEL-PROYECTO>.supabase.co/auth/v1/callback`.

El *Client ID* y el *Client secret* resultantes se pegan en el proveedor Google de Supabase.
Las credenciales son las del proyecto de cada persona: aquí no hay ninguna.

### 3. Confirmación de correo

El proyecto puede tener la confirmación activada o desactivada, y **la aplicación soporta las
dos**:

- si Supabase devuelve sesión al registrarse, se entra;
- si crea el usuario y exige confirmar, se muestra «Revisa tu correo para confirmar tu
  cuenta.» y **no se simula ninguna sesión**.

Esta task **no cambia** esa configuración. Si está activada, el enlace del correo vuelve por
la misma ruta de callback, que se envía como `emailRedirectTo`.

## El viaje a Google

```text
 web                                   iOS / Android
 ───                                   ─────────────
 signInWithOAuth(redirectTo)           signInWithOAuth(redirectTo, skipBrowserRedirect)
         │                                     │
 el navegador va a Google              WebBrowser.openAuthSessionAsync(url, redirectTo)
         │                                     │
 vuelve a /auth/callback               vuelve por el deep link flashcards://auth/callback
         │                                     │
 detectSessionInUrl crea la sesión     setSession / exchangeCodeForSession
         │                                     │
         └──────────────► sesión ◄─────────────┘
                            │
                            ▼
                     rutas privadas
```

La aplicación no construye URLs de Google, no maneja el `client_secret`, no genera ni valida
`state` y no implementa PKCE: todo eso lo hace Supabase.

En web, la pantalla de callback retira los tokens de la URL en cuanto se han procesado
(`src/features/auth/supabase/callbackUrl.ts`), para que no se queden en el historial ni viajen
en un enlace copiado.

## Datos locales por usuario

Desde TASK-008 los datos de producto cuelgan del `user.id`:

```text
flashcards:user:<USER_ID>:library:v1
flashcards:user:<USER_ID>:history:v1:meta
flashcards:user:<USER_ID>:history:v1:month:AAAA-MM
```

El identificador es `user.id` y nunca el correo, porque el correo puede cambiar. Ver
`src/lib/storage/keys.ts` y la sección correspondiente de docs/DATABASE.md.

## Qué está probado y qué no

- **AUTOMATED AUTH CONTRACT** — probado. Unitarios del adaptador de Supabase contra un
  cliente simulado, del flujo de Google, del mapeo de errores, del guard, del espacio de
  nombres y de la migración; integración de acceso, registro, sesión y aislamiento; y E2E en
  navegador real sobre un doble de autenticación determinista.
- **LIVE SUPABASE VERIFICATION** — no ejecutado. Necesita un proyecto Supabase y credenciales
  de Google, que este repositorio no tiene. Ver `external_verification_required` en
  `.harness/contracts/TASK-008.json` y la evidencia de la task.
