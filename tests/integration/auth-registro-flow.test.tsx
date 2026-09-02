import { fireEvent, screen } from 'expo-router/testing-library';

import { montarConAuth, pulsar, servicioProgramable } from './authHarness';

/**
 * Crear cuenta.
 *
 * Los dos comportamientos válidos de un proyecto de Supabase —sesión inmediata y verificación
 * pendiente— y la validación que la pantalla hace por su cuenta.
 */

async function abrirFormulario() {
  await screen.findByTestId('registro-con-correo');
  await pulsar('registro-con-correo');
  await screen.findByTestId('registro-email');
}

function rellenar(email: string, password: string, confirmacion: string) {
  fireEvent.changeText(screen.getByTestId('registro-email'), email);
  fireEvent.changeText(screen.getByTestId('registro-password'), password);
  fireEvent.changeText(screen.getByTestId('registro-password-confirm'), confirmacion);
}

describe('La pantalla de opciones', () => {
  it('ofrece primero las dos maneras de crear cuenta, sin campos todavía', async () => {
    montarConAuth(servicioProgramable(), '/registro');

    expect(await screen.findByTestId('registro-con-correo')).toBeTruthy();
    expect(screen.getByTestId('registro-google')).toBeTruthy();
    expect(screen.queryByTestId('registro-email')).toBeNull();
    expect(screen.queryByTestId('registro-password')).toBeNull();
  });

  it('el formulario de correo aparece al pedirlo, con los tres campos', async () => {
    montarConAuth(servicioProgramable(), '/registro');
    await abrirFormulario();

    expect(screen.getByTestId('registro-password')).toBeTruthy();
    expect(screen.getByTestId('registro-password-confirm')).toBeTruthy();
  });

  it('desde el formulario se puede volver a las opciones', async () => {
    montarConAuth(servicioProgramable(), '/registro');
    await abrirFormulario();

    await pulsar('registro-volver');

    expect(screen.getByTestId('registro-con-correo')).toBeTruthy();
    expect(screen.queryByTestId('registro-email')).toBeNull();
  });
});

describe('Validación antes de llamar al servicio', () => {
  it('dos contraseñas distintas se rechazan sin llamar a signUp', async () => {
    const service = servicioProgramable();
    montarConAuth(service, '/registro');
    await abrirFormulario();

    rellenar('nueva@example.com', 'secreto-largo', 'otro-secreto');
    await pulsar('registro-submit');

    expect(service.calls.signUp).toBe(0);
    expect(screen.getByText('Las dos contraseñas no coinciden.')).toBeTruthy();
  });

  it('los campos vacíos se piden sin llamar a signUp', async () => {
    const service = servicioProgramable();
    montarConAuth(service, '/registro');
    await abrirFormulario();

    await pulsar('registro-submit');

    expect(service.calls.signUp).toBe(0);
    expect(screen.getByTestId('registro-email-error')).toBeTruthy();
    expect(screen.getByTestId('registro-password-error')).toBeTruthy();
    expect(screen.getByTestId('registro-password-confirm-error')).toBeTruthy();
  });
});

describe('Alta contra el proveedor', () => {
  it('con autoconfirmación se entra directamente a la aplicación', async () => {
    const service = servicioProgramable();
    montarConAuth(service, '/registro');
    await abrirFormulario();

    rellenar('nueva@example.com', 'secreto-largo', 'secreto-largo');
    await pulsar('registro-submit');

    expect(service.calls.signUp).toBe(1);
    expect(await screen.findByTestId('create-deck-button')).toBeTruthy();
  });

  it('con verificación requerida se informa y NO se simula sesión', async () => {
    const service = servicioProgramable({
      signUp: { ok: true, session: null, verificationRequired: true },
    });
    montarConAuth(service, '/registro');
    await abrirFormulario();

    rellenar('nueva@example.com', 'secreto-largo', 'secreto-largo');
    await pulsar('registro-submit');

    expect(await screen.findByTestId('registro-verificacion')).toBeTruthy();
    expect(screen.getByText('Revisa tu correo para confirmar tu cuenta.')).toBeTruthy();
    // Sigue sin sesión: la aplicación privada no se ha montado.
    expect(screen.queryByTestId('create-deck-button')).toBeNull();
  });

  it('un rechazo del servidor se cuenta en español y sin detalles internos', async () => {
    const service = servicioProgramable({ signUp: { ok: false, error: 'password-rechazada' } });
    montarConAuth(service, '/registro');
    await abrirFormulario();

    rellenar('nueva@example.com', '123', '123');
    await pulsar('registro-submit');

    expect(await screen.findByTestId('registro-error')).toBeTruthy();
    expect(screen.getByText(/El servicio no ha aceptado esa contraseña/)).toBeTruthy();
  });

  it('el botón de Google del registro usa la misma operación que el del acceso', async () => {
    const service = servicioProgramable();
    montarConAuth(service, '/registro');
    await screen.findByTestId('registro-google');

    await pulsar('registro-google');

    expect(service.calls.google).toBe(1);
    expect(service.calls.signUp).toBe(0);
    expect(await screen.findByTestId('create-deck-button')).toBeTruthy();
  });
});
