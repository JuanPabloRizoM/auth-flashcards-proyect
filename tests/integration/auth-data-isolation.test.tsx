import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen } from 'expo-router/testing-library';

import {
  createFakeAuthService,
  fakeAuthState,
  FAKE_AUTH_STORAGE_KEY,
} from '../../src/features/auth/fakeAuthService';
import { newScheduling } from '../../src/features/scheduler/types';
import { createAsyncStorageRepository } from '../../src/lib/storage/asyncStorageRepository';
import { historyKeys } from '../../src/lib/storage/historySerialization';
import { historyPrefixFor, libraryKeyFor } from '../../src/lib/storage/keys';
import { createStudyHistoryRepository } from '../../src/lib/storage/studyHistoryRepository';
import type { SaveFileResult } from '../../src/lib/files/types';

import { montarConAuth, pulsar } from './authHarness';
import { crearEstudiarMazo, irA, montarApp } from './statsHarness';

/**
 * Aislamiento de los datos locales entre cuentas.
 *
 * El ciclo obligatorio del contrato: A crea algo, se va, B entra y no lo ve, B crea lo suyo,
 * y A vuelve y encuentra lo suyo y solo lo suyo.
 *
 * No basta con que la interfaz no lo enseñe. Cada afirmación sobre la pantalla va acompañada
 * de otra sobre el almacenamiento: qué claves existen y qué hay dentro de cada una.
 */

const USUARIO_A = { id: 'usuario-a', email: 'ana@example.com', password: 'contrasena-de-ana' };
const USUARIO_B = { id: 'usuario-b', email: 'bruno@example.com', password: 'contrasena-de-bruno' };

async function sembrarCuentas(): Promise<void> {
  await AsyncStorage.setItem(
    FAKE_AUTH_STORAGE_KEY,
    fakeAuthState({ accounts: [USUARIO_A, USUARIO_B] }),
  );
}

function servicio() {
  return createFakeAuthService({ storage: AsyncStorage });
}

async function iniciarSesion(cuenta: typeof USUARIO_A) {
  await screen.findByTestId('login-submit');
  fireEvent.changeText(screen.getByTestId('login-email'), cuenta.email);
  fireEvent.changeText(screen.getByTestId('login-password'), cuenta.password);
  await pulsar('login-submit');
  await screen.findByTestId('create-deck-button');
}

async function cerrarSesion() {
  await pulsar('cerrar-sesion');
  await screen.findByTestId('login-submit');
}

async function crearMazo(nombre: string) {
  fireEvent.changeText(screen.getByTestId('deck-name-input'), nombre);
  await pulsar('create-deck-button');
  await screen.findByText(nombre);
}

/** Los mazos que hay guardados bajo la clave de un usuario, leídos del medio. */
async function mazosGuardados(userId: string): Promise<string[]> {
  const resultado = await createAsyncStorageRepository(libraryKeyFor(userId)).load();
  return resultado.status === 'ok' ? resultado.library.decks.map((deck) => deck.name) : [];
}

describe('Ciclo A → B → A', () => {
  it('cada cuenta ve sus mazos y solo los suyos, en pantalla y en el almacenamiento', async () => {
    await sembrarCuentas();
    montarConAuth(servicio(), '/login');

    // ── A crea lo suyo ───────────────────────────────────────────────────────
    await iniciarSesion(USUARIO_A);
    await crearMazo('Privado A');
    await cerrarSesion();

    // ── B no ve nada de A ────────────────────────────────────────────────────
    await iniciarSesion(USUARIO_B);
    expect(screen.queryByText('Privado A')).toBeNull();
    expect(screen.getByTestId('decks-empty')).toBeTruthy();

    await crearMazo('Privado B');
    expect(screen.queryByText('Privado A')).toBeNull();
    await cerrarSesion();

    // ── A vuelve y encuentra lo suyo ─────────────────────────────────────────
    await iniciarSesion(USUARIO_A);
    expect(screen.getByText('Privado A')).toBeTruthy();
    expect(screen.queryByText('Privado B')).toBeNull();

    // ── Y el medio dice lo mismo que la pantalla ─────────────────────────────
    expect(await mazosGuardados(USUARIO_A.id)).toEqual(['Privado A']);
    expect(await mazosGuardados(USUARIO_B.id)).toEqual(['Privado B']);
  });

  it('cerrar sesión no borra los datos de nadie', async () => {
    await sembrarCuentas();
    montarConAuth(servicio(), '/login');

    await iniciarSesion(USUARIO_A);
    await crearMazo('Privado A');
    await cerrarSesion();

    // Sin sesión, lo guardado sigue exactamente donde estaba.
    expect(await mazosGuardados(USUARIO_A.id)).toEqual(['Privado A']);
    expect(await AsyncStorage.getItem(libraryKeyFor(USUARIO_A.id))).not.toBeNull();
  });
});

describe('Las claves del almacenamiento', () => {
  it('llevan el identificador del usuario, y ninguna cuenta escribe fuera del suyo', async () => {
    await sembrarCuentas();
    montarConAuth(servicio(), '/login');

    await iniciarSesion(USUARIO_A);
    await crearMazo('Privado A');
    await cerrarSesion();
    await iniciarSesion(USUARIO_B);
    await crearMazo('Privado B');

    const claves = (await AsyncStorage.getAllKeys()).filter((clave) =>
      clave.startsWith('flashcards:'),
    );
    const deDatos = claves.filter((clave) => clave.includes(':library:') || clave.includes(':history:'));

    expect(deDatos.length).toBeGreaterThan(0);
    for (const clave of deDatos) {
      expect(clave.startsWith('flashcards:user:')).toBe(true);
    }
    expect(claves).toContain(libraryKeyFor(USUARIO_A.id));
    expect(claves).toContain(libraryKeyFor(USUARIO_B.id));
  });

  it('las cartas y su programación viajan con su mazo, en el documento de su dueño', async () => {
    await sembrarCuentas();
    montarConAuth(servicio(), '/login');

    await iniciarSesion(USUARIO_A);
    await crearMazo('Privado A');
    await pulsar('deck-mazo-1');
    await screen.findByTestId('add-card-button');
    fireEvent.changeText(screen.getByTestId('card-front-input'), 'secreto de A');
    fireEvent.changeText(screen.getByTestId('card-back-input'), 'reverso de A');
    await pulsar('add-card-button');
    await screen.findByText('secreto de A');

    const deA = await createAsyncStorageRepository(libraryKeyFor(USUARIO_A.id)).load();
    const deB = await createAsyncStorageRepository(libraryKeyFor(USUARIO_B.id)).load();

    expect(deA.status === 'ok' && deA.library.cards.map((c) => c.front)).toEqual(['secreto de A']);
    // La programación FSRS de esa carta vive con ella, así que también queda aislada.
    expect(deA.status === 'ok' && deA.library.cards[0]?.scheduling.state).toBe('nueva');
    expect(deB.status).toBe('empty');
  });
});

describe('Historial y estadísticas', () => {
  it('la bitácora de estudio se escribe bajo el prefijo del usuario y B no la ve', async () => {
    await sembrarCuentas();
    montarConAuth(servicio(), '/login');

    await iniciarSesion(USUARIO_A);
    await crearMazo('Privado A');
    await cerrarSesion();

    const clavesDeA = (await AsyncStorage.getAllKeys()).filter((clave) =>
      clave.startsWith(historyPrefixFor(USUARIO_A.id)),
    );
    const clavesDeB = (await AsyncStorage.getAllKeys()).filter((clave) =>
      clave.startsWith(historyPrefixFor(USUARIO_B.id)),
    );

    expect(clavesDeA.length).toBeGreaterThan(0);
    expect(clavesDeB).toEqual([]);
  });

  it('las estadísticas de B no cuentan la actividad de A', async () => {
    await sembrarCuentas();
    // Historial de A ya escrito en su espacio, con actividad real.
    const historialDeA = createStudyHistoryRepository(historyPrefixFor(USUARIO_A.id));
    await historialDeA.append({
      trackedSince: Date.parse('2026-09-01T10:00:00.000Z'),
      deckSnapshots: [{ deckId: 'mazo-1', name: 'Privado A', lastSeenAt: Date.parse('2026-09-01T10:00:00.000Z') }],
    });
    await historialDeA.flush();

    montarConAuth(servicio(), '/login');
    await iniciarSesion(USUARIO_B);
    await irA('nav-estadisticas');

    // B no ha estudiado nada: el estado vacío, no las cifras de A.
    expect(await screen.findByTestId('stats-empty')).toBeTruthy();

    const claves = historyKeys(historyPrefixFor(USUARIO_A.id));
    expect(await AsyncStorage.getItem(claves.meta)).not.toBeNull();
  });
});

describe('El reporte PDF', () => {
  it('se genera con los datos del usuario actual, no con los del otro', async () => {
    // A tiene una biblioteca real en su espacio, con un mazo de nombre reconocible.
    await createAsyncStorageRepository(libraryKeyFor(USUARIO_A.id)).save({
      decks: [{ id: 'mazo-a', name: 'Privado A', updatedAt: '2026-09-01T10:00:00.000Z' }],
      cards: [
        {
          id: 'carta-a',
          deckId: 'mazo-a',
          front: 'secreto de A',
          back: 'reverso de A',
          scheduling: newScheduling,
        },
      ],
      scheduler: null,
    });

    const guardados: { name: string; bytes: Uint8Array }[] = [];
    // Y ahora la aplicación se monta con el espacio de B, que está vacío.
    montarApp({
      libraryRepository: createAsyncStorageRepository(libraryKeyFor(USUARIO_B.id)),
      historyRepository: createStudyHistoryRepository(historyPrefixFor(USUARIO_B.id)),
      fileSaver: (name: string, bytes: Uint8Array): SaveFileResult => {
        guardados.push({ name, bytes });
        return { status: 'ok', where: 'descarga' };
      },
    });
    await screen.findByTestId('create-deck-button');
    await crearEstudiarMazo('Solo de B', 'mazo-1', 3);

    await irA('nav-estadisticas');
    await screen.findByTestId('stats-scope');
    await irA('report-open');
    await screen.findByTestId('report-confirm');
    await irA('report-confirm');
    await screen.findByTestId('report-feedback');

    expect(guardados).toHaveLength(1);
    const texto = Buffer.from(guardados[0]!.bytes).toString('latin1');
    expect(texto).not.toContain('Privado A');
  });
});
