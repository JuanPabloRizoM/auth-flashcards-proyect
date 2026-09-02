import type { Page } from '@playwright/test';

import {
  fakeAuthState,
  FAKE_AUTH_STORAGE_KEY,
  type FakeAuthSeedAccount,
} from '../../../src/features/auth/fakeAuthService';

/**
 * Sesión determinista para los E2E.
 *
 * El servidor de pruebas arranca con `EXPO_PUBLIC_AUTH_FAKE=1`, así que la aplicación usa el
 * doble de autenticación en vez de Supabase. Aquí se le siembra el estado inicial en el
 * almacenamiento del navegador, antes de que cargue nada.
 *
 * Esto prueba **la aplicación frente a un servicio de autenticación**, con rutas, guards,
 * cambio de cuenta y aislamiento de datos reales. Lo que no prueba es la integración con
 * Supabase ni con Google: eso necesita credenciales y se verifica aparte.
 *
 * La siembra no pisa lo que ya haya: después de cerrar sesión el doble deja su estado sin
 * sesión, y una recarga no debe devolverla mágicamente.
 */

export const USUARIO_A: FakeAuthSeedAccount & { password: string } = {
  id: 'usuario-a',
  email: 'ana@example.com',
  password: 'contrasena-de-ana',
};

export const USUARIO_B: FakeAuthSeedAccount & { password: string } = {
  id: 'usuario-b',
  email: 'bruno@example.com',
  password: 'contrasena-de-bruno',
};

async function sembrar(page: Page, estado: string): Promise<void> {
  await page.addInitScript(
    ([clave, valor]) => {
      if (window.localStorage.getItem(clave) === null) {
        window.localStorage.setItem(clave, valor);
      }
    },
    [FAKE_AUTH_STORAGE_KEY, estado] as const,
  );
}

/** Las dos cuentas existen, pero nadie ha iniciado sesión. */
export async function sinSesion(page: Page): Promise<void> {
  await sembrar(page, fakeAuthState({ accounts: [USUARIO_A, USUARIO_B] }));
}

/** Sesión abierta como A: el punto de partida de todo lo que no va de acceso. */
export async function conSesion(page: Page): Promise<void> {
  await sembrar(
    page,
    fakeAuthState({ accounts: [USUARIO_A, USUARIO_B], signedInAs: USUARIO_A.id }),
  );
}

/** Ninguna cuenta existe todavía: para probar el registro. */
export async function sinCuentas(page: Page): Promise<void> {
  await sembrar(page, fakeAuthState({ accounts: [] }));
}

/** Inicia sesión por la interfaz, como lo haría una persona. */
export async function iniciarSesion(
  page: Page,
  cuenta: { email: string; password: string },
): Promise<void> {
  await page.getByTestId('login-email').fill(cuenta.email);
  await page.getByTestId('login-password').fill(cuenta.password);
  await page.getByTestId('login-submit').click();
}
