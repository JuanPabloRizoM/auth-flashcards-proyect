# TASK-008 — QA

QA independiente, **read only** sobre el código. Todo lo que sigue se ha hecho a mano en un
navegador real (Chromium, 1280×720, y luego 375×812 y 320×640), sobre la aplicación servida
con `npx expo start --web`, además de la suite automatizada.

## 1. Instalación sin configurar

Servidor arrancado **sin** ninguna variable de entorno, que es lo que le pasa a quien clona el
repositorio y arranca.

| Qué se hizo | Qué pasó |
|---|---|
| Abrir directamente `/estadisticas` | Acaba en `/login`. No se ve nada de la aplicación. |
| Mirar la pantalla | Aviso: «El acceso no está configurado en esta instalación. Faltan estas variables de entorno: EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.» |
| Escribir correo y contraseña y enviar | Error controlado, el botón vuelve a estar activo, no se crea sesión. |
| Consola del navegador | Sin errores. |
| `Object.keys(localStorage)` | `[]` — ni una clave. No hay sesión falsa. |

La contraseña se escribe con puntos, no en claro.

## 2. Recorrido completo con cuentas

Servidor arrancado con el servicio de autenticación inyectable, que es lo que permite probar
el comportamiento sin credenciales. **No es Supabase**: ver el apartado 6.

### Acceso y guard

| Qué se hizo | Qué pasó |
|---|---|
| Abrir `/mazo/mazo-1/estudiar` sin sesión | Acaba en `/login`. |
| Pulsar «Registrarse» | Va a `/registro`. |
| Ver `/registro` | Primero las dos opciones: «Registrarse con correo electrónico» y «Continuar con Google». Ningún campo todavía. |
| Pulsar la opción de correo | Aparecen los tres campos: correo (`type=email`, `autocomplete=email`), contraseña y confirmación (`type=password`, `autocomplete=new-password`). |
| Enviar con contraseñas distintas | «Las dos contraseñas no coinciden.», el campo se marca en rojo y no se crea nada. |
| Corregir y enviar | Entra a la aplicación. |

### Aislamiento entre cuentas

| Qué se hizo | Qué pasó |
|---|---|
| Como `ana@example.com`, crear el mazo «Privado A» | Aparece en Mis mazos. Claves: `flashcards:user:usuario-1:library:v1` y `…:history:v1:meta`. |
| Cerrar sesión | Vuelve a `/login`. La clave de la biblioteca de A **sigue existiendo**. |
| Entrar con «Continuar con Google» | Cuenta nueva (`cuenta.google@example.com`), biblioteca vacía. «Privado A» **no** aparece. |
| Abrir `/mazo/mazo-1` (el mazo de A) por URL | «Ese mazo ya no existe». Ni por la URL directa. |
| Crear «Privado B» | Se guarda bajo `flashcards:user:usuario-2:library:v1`. |
| Comprobar los dos documentos | El de A no contiene «Privado B»; el de B no contiene «Privado A». |
| Cerrar sesión y volver a entrar como A | Ve «Privado A». **No** ve «Privado B». |

El ciclo A → B → A del contrato se cumple, y no solo en la pantalla: se ha leído el contenido
de cada documento del almacenamiento.

### Errores y sesión

| Qué se hizo | Qué pasó |
|---|---|
| Entrar con la contraseña equivocada | «No pudimos iniciar sesión con esos datos.» Sigue en `/login`. |
| Entrar con un correo que no existe | El mismo mensaje, palabra por palabra. No se puede averiguar qué direcciones existen. |
| Recargar estando en `/estadisticas` | Sigue dentro, en `/estadisticas`, con la sesión puesta. |
| URL después de entrar con Google | `http://localhost:8091/` — sin `access_token`, sin `code`, sin nada. |
| Abrir `/login` con sesión | Acaba en `/`, en Mis mazos. |

## 3. Responsive

| Ancho | Qué se comprobó |
|---|---|
| 1280 | Sidebar de 240 px con la navegación arriba y, al pie, el correo y «Cerrar sesión». El contenido ocupa los 1040 restantes. |
| 375 (iPhone) | El correo y «Cerrar sesión» pasan a la cabecera; la barra inferior sigue teniendo solo los tres destinos. Sin desbordamiento horizontal. |
| 320 | Login completo y utilizable: los dos campos, los dos botones y el enlace. Desbordamiento horizontal 0. El botón principal mide 44 px de alto, el mínimo del sistema visual. |

La identidad visual es la de siempre: crema, superficie blanca, azul tinta, sans-serif. Nada
de neón ni de brillos, y ninguna pantalla nueva se sale del estilo.

## 4. Textos

No aparece «sincronizado», ni «en la nube», ni «disponible en todos tus dispositivos» en
ninguna pantalla. Correcto: hoy sería falso.

## 5. Suite automatizada

```text
npm run typecheck        exit 0
npm run lint             exit 0
npm run test             749 pasan
npm run test:integration 287 pasan
npm run test:e2e         374 pasan, 10 skipped   (escritorio, Pixel 5, iPhone 13)
```

Los 10 skipped son condicionales por dispositivo y declaran su motivo.

## 6. Lo que NO se ha podido probar

**El acceso real contra Supabase y contra Google no se ha ejecutado.** Este repositorio no
tiene proyecto ni credenciales, así que lo probado en el apartado 2 es el comportamiento de la
aplicación frente a un servicio de autenticación, no la integración con Supabase.

Queda pendiente, y declarado como blocker de verificación externa —no de implementación—:

- alta e inicio de sesión reales por correo, con su sesión, su recarga y su cierre;
- Google real de extremo a extremo en web;
- Google real en iOS y en Android con deep link;
- el comportamiento de confirmación de correo del proyecto.

La implementación de esos caminos está hecha y cubierta por tests; lo que falta es la
ejecución contra un proyecto real. Lo que hace falta para poder hacerla está en `docs/AUTH.md`
y en el informe final.

**Nada se ha inventado en esta evidencia.** Cada fila de las tablas corresponde a una
interacción real ejecutada en el navegador.

## Veredicto

**APPROVED**

No hay ningún hallazgo que exija cambiar nada antes del cierre. Las limitaciones del apartado
6 estaban declaradas en el contrato desde antes de implementar y no son defectos del trabajo
entregado.
