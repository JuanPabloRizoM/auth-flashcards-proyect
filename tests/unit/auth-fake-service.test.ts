import {
  createFakeAuthService,
  fakeAuthState,
  FAKE_AUTH_STORAGE_KEY,
  type FakeAuthOptions,
} from '../../src/features/auth/fakeAuthService';

/**
 * El doble de autenticación.
 *
 * Un doble que no cumple el mismo contrato que la implementación real no demuestra nada, así
 * que se prueba como una implementación más: mismas operaciones, mismos resultados posibles.
 */

function conAlmacen(options: Partial<FakeAuthOptions> = {}, inicial?: string) {
  const mapa = new Map<string, string>();
  if (inicial !== undefined) mapa.set(FAKE_AUTH_STORAGE_KEY, inicial);
  const service = createFakeAuthService({
    storage: {
      getItem: async (key) => mapa.get(key) ?? null,
      setItem: async (key, value) => {
        mapa.set(key, value);
      },
    },
    ...options,
  });
  return { service, mapa };
}

describe('Registro y acceso por correo', () => {
  it('registrarse con autoconfirmación deja sesión abierta', async () => {
    const { service } = conAlmacen();

    const alta = await service.signUpWithEmail('ana@example.com', 'secreto');

    expect(alta.ok && alta.session?.user.email).toBe('ana@example.com');
    expect(await service.getSession()).not.toBeNull();
  });

  it('registrarse con verificación requerida crea la cuenta pero no la sesión', async () => {
    const { service } = conAlmacen({ emailConfirmation: 'required' });

    expect(await service.signUpWithEmail('ana@example.com', 'secreto')).toEqual({
      ok: true,
      session: null,
      verificationRequired: true,
    });
    expect(await service.getSession()).toBeNull();
  });

  it('una cuenta sin confirmar no puede entrar todavía', async () => {
    const { service } = conAlmacen({ emailConfirmation: 'required' });
    await service.signUpWithEmail('ana@example.com', 'secreto');

    expect(await service.signInWithEmail('ana@example.com', 'secreto')).toEqual({
      ok: false,
      error: 'verificacion-pendiente',
    });
  });

  it('registrar dos veces el mismo correo se rechaza sin confirmar que existe', async () => {
    const { service } = conAlmacen();
    await service.signUpWithEmail('ana@example.com', 'secreto');

    expect(await service.signUpWithEmail('ana@example.com', 'otra')).toEqual({
      ok: false,
      error: 'registro-rechazado',
    });
  });

  it('la contraseña equivocada y el correo inexistente dan el mismo error', async () => {
    const { service } = conAlmacen();
    await service.signUpWithEmail('ana@example.com', 'secreto');
    await service.signOut();

    const malaContrasena = await service.signInWithEmail('ana@example.com', 'incorrecta');
    const noExiste = await service.signInWithEmail('nadie@example.com', 'secreto');

    expect(malaContrasena).toEqual({ ok: false, error: 'credenciales-invalidas' });
    expect(noExiste).toEqual(malaContrasena);
  });

  it('el correo se recorta pero la contraseña no se toca', async () => {
    const { service } = conAlmacen();
    await service.signUpWithEmail('ana@example.com', '  con espacios  ');
    await service.signOut();

    expect((await service.signInWithEmail('  ana@example.com ', '  con espacios  ')).ok).toBe(true);
    expect((await service.signInWithEmail('ana@example.com', 'con espacios')).ok).toBe(false);
  });
});

describe('Acceso con Google', () => {
  it('crea la cuenta si no existía', async () => {
    const { service } = conAlmacen({ google: { outcome: 'exito', email: 'g@example.com' } });

    const resultado = await service.signInWithGoogle();

    expect(resultado.ok && resultado.session?.user.email).toBe('g@example.com');
  });

  it('entra a la cuenta existente si ya existía, sin duplicarla', async () => {
    const { service } = conAlmacen({ google: { outcome: 'exito', email: 'g@example.com' } });

    const primera = await service.signInWithGoogle();
    await service.signOut();
    const segunda = await service.signInWithGoogle();

    expect(primera.ok && segunda.ok && primera.session?.user.id).toBe(
      segunda.ok ? segunda.session?.user.id : undefined,
    );
  });

  it('la cancelación se distingue del fallo', async () => {
    const { service: cancelado } = conAlmacen({ google: { outcome: 'cancelado' } });
    const { service: fallido } = conAlmacen({ google: { outcome: 'fallo' } });

    expect(await cancelado.signInWithGoogle()).toEqual({ ok: false, error: 'oauth-cancelado' });
    expect(await fallido.signInWithGoogle()).toEqual({ ok: false, error: 'oauth-fallido' });
    expect(await cancelado.getSession()).toBeNull();
  });
});

describe('Sesión', () => {
  it('se restaura desde el almacenamiento en una instancia nueva', async () => {
    const mapa = new Map<string, string>();
    const storage = {
      getItem: async (key: string) => mapa.get(key) ?? null,
      setItem: async (key: string, value: string) => {
        mapa.set(key, value);
      },
    };

    const primera = createFakeAuthService({ storage });
    await primera.signUpWithEmail('ana@example.com', 'secreto');

    // Otra instancia sobre el mismo medio: es lo que hace un reinicio de la aplicación.
    const segunda = createFakeAuthService({ storage });
    expect((await segunda.getSession())?.user.email).toBe('ana@example.com');
  });

  it('una sesión caducada es lo mismo que ninguna sesión', async () => {
    const { service } = conAlmacen(
      {},
      fakeAuthState({
        accounts: [{ id: 'u-1', email: 'ana@example.com' }],
        signedInAs: 'u-1',
        expiresAt: Date.now() - 1_000,
      }),
    );

    expect(await service.getSession()).toBeNull();
  });

  it('los cambios de estado se anuncian a quien escucha, y darse de baja los corta', async () => {
    const { service } = conAlmacen();
    const recibidas: (string | null)[] = [];
    const cancelar = service.onAuthStateChange((session) => recibidas.push(session?.user.id ?? null));

    await service.signUpWithEmail('ana@example.com', 'secreto');
    await service.signOut();
    cancelar();
    await service.signInWithEmail('ana@example.com', 'secreto');

    expect(recibidas).toEqual(['usuario-1', null]);
  });

  it('cerrar sesión no borra las cuentas', async () => {
    const { service } = conAlmacen();
    await service.signUpWithEmail('ana@example.com', 'secreto');

    await service.signOut();

    expect(await service.getSession()).toBeNull();
    expect((await service.signInWithEmail('ana@example.com', 'secreto')).ok).toBe(true);
  });

  it('cuenta las llamadas, que es lo que permite comprobar el doble envío', async () => {
    const { service } = conAlmacen();

    await service.signUpWithEmail('ana@example.com', 'secreto');
    await service.signInWithEmail('ana@example.com', 'secreto');
    await service.signOut();

    expect(service.calls).toEqual({ signIn: 1, signUp: 1, google: 0, signOut: 1 });
  });
});

describe('Estado sembrado', () => {
  it('permite arrancar ya autenticado sin pasar por la interfaz', async () => {
    const { service } = conAlmacen(
      {},
      fakeAuthState({
        accounts: [{ id: 'usuario-a', email: 'ana@example.com', password: 'x' }],
        signedInAs: 'usuario-a',
      }),
    );

    expect(await service.getSession()).toMatchObject({
      user: { id: 'usuario-a', email: 'ana@example.com' },
    });
  });

  it('permite arrancar con cuentas pero sin sesión', async () => {
    const { service } = conAlmacen(
      {},
      fakeAuthState({ accounts: [{ id: 'usuario-a', email: 'ana@example.com', password: 'x' }] }),
    );

    expect(await service.getSession()).toBeNull();
    expect((await service.signInWithEmail('ana@example.com', 'x')).ok).toBe(true);
  });

  it('un estado ilegible no rompe: se arranca sin sesión', async () => {
    const { service } = conAlmacen({}, 'esto no es json');
    expect(await service.getSession()).toBeNull();
  });
});
