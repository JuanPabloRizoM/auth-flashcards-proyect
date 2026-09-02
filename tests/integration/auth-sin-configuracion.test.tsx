import { fireEvent, screen } from 'expo-router/testing-library';

import { createAuthService } from '../../src/features/auth/service';
import {
  SUPABASE_KEY_VAR,
  SUPABASE_URL_VAR,
} from '../../src/features/auth/supabase/config';

import { montarConAuth, pulsar } from './authHarness';

/**
 * La aplicación en una instalación sin configurar.
 *
 * Es el caso de quien clona el repositorio y arranca sin `.env`. No puede romperse con un
 * error de JavaScript, y sobre todo no puede inventarse una sesión para salir del paso.
 */

const sinConfigurar = () =>
  createAuthService({ ok: false, missing: [SUPABASE_URL_VAR, SUPABASE_KEY_VAR] });

describe('Sin variables de entorno', () => {
  const original = process.env.EXPO_PUBLIC_AUTH_FAKE;

  beforeEach(() => {
    // El doble de pruebas taparía justo lo que este test quiere ver.
    delete process.env.EXPO_PUBLIC_AUTH_FAKE;
  });

  afterEach(() => {
    if (original !== undefined) process.env.EXPO_PUBLIC_AUTH_FAKE = original;
  });

  it('la aplicación arranca y acaba en la pantalla de acceso', async () => {
    montarConAuth(sinConfigurar(), '/');

    expect(await screen.findByTestId('login-submit')).toBeTruthy();
  });

  it('explica qué falta, con los nombres exactos de las variables', async () => {
    montarConAuth(sinConfigurar(), '/login');
    await screen.findByTestId('login-sin-configuracion');

    expect(screen.getByText(new RegExp(SUPABASE_URL_VAR))).toBeTruthy();
    expect(screen.getByText(new RegExp(SUPABASE_KEY_VAR))).toBeTruthy();
  });

  it('intentar entrar no crea ninguna sesión', async () => {
    montarConAuth(sinConfigurar(), '/login');
    await screen.findByTestId('login-submit');

    fireEvent.changeText(screen.getByTestId('login-email'), 'ana@example.com');
    fireEvent.changeText(screen.getByTestId('login-password'), 'secreto');
    await pulsar('login-submit');

    expect(screen.getByTestId('login-error')).toBeTruthy();
    expect(screen.queryByTestId('create-deck-button')).toBeNull();
  });

  it('el botón de Google tampoco abre nada', async () => {
    montarConAuth(sinConfigurar(), '/login');
    await screen.findByTestId('login-google');

    await pulsar('login-google');

    expect(screen.queryByTestId('create-deck-button')).toBeNull();
  });

  it('la pantalla de registro avisa igual', async () => {
    montarConAuth(sinConfigurar(), '/registro');

    expect(await screen.findByTestId('registro-sin-configuracion')).toBeTruthy();
  });
});
