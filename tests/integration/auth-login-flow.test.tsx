import { screen } from 'expo-router/testing-library';

import {
  escribirCredenciales,
  montarConAuth,
  pulsar,
  pulsarSinEsperar,
  servicioProgramable,
  vaciarCola,
} from './authHarness';

/**
 * La pantalla de acceso, montada dentro de la aplicación real.
 *
 * Lo que se comprueba aquí es lo que no se ve en un test unitario del servicio: el estado de
 * carga, la protección contra el doble envío y qué mensaje acaba en pantalla.
 */

describe('Inicio de sesión con correo', () => {
  it('mientras la autenticación está en curso el botón queda ocupado e inactivo', async () => {
    const service = servicioProgramable({ signInColgado: true });
    montarConAuth(service, '/login');
    await screen.findByTestId('login-submit');

    await escribirCredenciales('ana@example.com', 'secreto');
    pulsarSinEsperar('login-submit');
    await vaciarCola();

    const boton = screen.getByTestId('login-submit');
    expect(boton.props.accessibilityState).toMatchObject({ busy: true, disabled: true });
  });

  it('un segundo envío mientras hay uno en curso no llama otra vez al servicio', async () => {
    const service = servicioProgramable({ signInColgado: true });
    montarConAuth(service, '/login');
    await screen.findByTestId('login-submit');

    await escribirCredenciales('ana@example.com', 'secreto');
    pulsarSinEsperar('login-submit');
    pulsarSinEsperar('login-submit');
    pulsarSinEsperar('login-submit');
    await vaciarCola();

    expect(service.calls.signIn).toBe(1);
  });

  it('con credenciales válidas entra a la aplicación', async () => {
    const service = servicioProgramable();
    montarConAuth(service, '/login');
    await screen.findByTestId('login-submit');

    await escribirCredenciales('ana@example.com', 'secreto');
    await pulsar('login-submit');

    expect(await screen.findByTestId('create-deck-button')).toBeTruthy();
  });

  it('con credenciales inválidas muestra el mensaje genérico y no entra', async () => {
    const service = servicioProgramable({ signIn: { ok: false, error: 'credenciales-invalidas' } });
    montarConAuth(service, '/login');
    await screen.findByTestId('login-submit');

    await escribirCredenciales('ana@example.com', 'incorrecta');
    await pulsar('login-submit');

    const error = await screen.findByTestId('login-error');
    expect(error).toBeTruthy();
    expect(screen.getByText('No pudimos iniciar sesión con esos datos.')).toBeTruthy();
    expect(screen.queryByTestId('create-deck-button')).toBeNull();
  });

  it('el mensaje no revela si la dirección existe', async () => {
    const service = servicioProgramable({ signIn: { ok: false, error: 'credenciales-invalidas' } });
    montarConAuth(service, '/login');
    await screen.findByTestId('login-submit');

    await escribirCredenciales('nadie@example.com', 'x');
    await pulsar('login-submit');

    // El mismo texto que produce una contraseña incorrecta, palabra por palabra.
    expect(screen.getByText('No pudimos iniciar sesión con esos datos.')).toBeTruthy();
    expect(screen.queryByText(/no existe|no encontrad|no registrad/i)).toBeNull();
  });

  it('los campos obligatorios se piden antes de llamar al servicio', async () => {
    const service = servicioProgramable();
    montarConAuth(service, '/login');
    await screen.findByTestId('login-submit');

    await pulsar('login-submit');

    expect(service.calls.signIn).toBe(0);
    expect(screen.getByTestId('login-email-error')).toBeTruthy();
    expect(screen.getByTestId('login-password-error')).toBeTruthy();
  });

  it('un fallo de red se explica como tal, sin excepciones internas', async () => {
    const service = servicioProgramable({ signIn: { ok: false, error: 'sin-conexion' } });
    montarConAuth(service, '/login');
    await screen.findByTestId('login-submit');

    await escribirCredenciales('ana@example.com', 'secreto');
    await pulsar('login-submit');

    expect(screen.getByText(/No hay conexión con el servicio de acceso/)).toBeTruthy();
  });
});

describe('Acceso con Google desde el inicio de sesión', () => {
  it('el botón está y usa el servicio, no una implementación propia de la pantalla', async () => {
    const service = servicioProgramable();
    montarConAuth(service, '/login');
    await screen.findByTestId('login-google');

    await pulsar('login-google');

    expect(service.calls.google).toBe(1);
    expect(await screen.findByTestId('create-deck-button')).toBeTruthy();
  });

  it('cancelar deja la pantalla utilizable y el botón otra vez activo', async () => {
    const service = servicioProgramable({ google: { ok: false, error: 'oauth-cancelado' } });
    montarConAuth(service, '/login');
    await screen.findByTestId('login-google');

    await pulsar('login-google');

    expect(screen.getByText('Has cancelado el acceso con Google.')).toBeTruthy();
    expect(screen.getByTestId('login-google').props.accessibilityState).toMatchObject({
      disabled: false,
      busy: false,
    });
    expect(screen.queryByTestId('create-deck-button')).toBeNull();
  });

  it('un fallo del proveedor se muestra como error controlado', async () => {
    const service = servicioProgramable({ google: { ok: false, error: 'oauth-fallido' } });
    montarConAuth(service, '/login');
    await screen.findByTestId('login-google');

    await pulsar('login-google');

    expect(screen.getByText('No hemos podido completar el acceso con Google.')).toBeTruthy();
  });
});
