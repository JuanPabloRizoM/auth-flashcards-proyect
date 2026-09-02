import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen } from 'expo-router/testing-library';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  createFakeAuthService,
  fakeAuthState,
  FAKE_AUTH_STORAGE_KEY,
} from '../../src/features/auth/fakeAuthService';
import { buildStatsReport } from '../../src/features/stats/engine';
import { createAsyncStorageRepository } from '../../src/lib/storage/asyncStorageRepository';
import { historyKeys } from '../../src/lib/storage/historySerialization';
import {
  historyPrefixFor,
  libraryKeyFor,
  LEGACY_HISTORY_PREFIX,
  LEGACY_LIBRARY_KEY,
} from '../../src/lib/storage/keys';
import { createStudyHistoryRepository } from '../../src/lib/storage/studyHistoryRepository';

import { montarConAuth, pulsar } from './authHarness';

/**
 * Los datos que había en el dispositivo antes de que existieran las cuentas.
 *
 * Se parte de los documentos reales de una instalación de TASK-007 —archivos de
 * `tests/fixtures/migration/`, escritos por el propio serializador del proyecto— colocados en
 * las claves que esa versión usaba. Después entra la primera cuenta, y se comprueba que **no
 * se pierde nada, no se inventa nada y no se reparte dos veces**.
 */

const USUARIO_A = { id: 'usuario-a', email: 'ana@example.com', password: 'contrasena-de-ana' };
const USUARIO_B = { id: 'usuario-b', email: 'bruno@example.com', password: 'contrasena-de-bruno' };

const clavesPrevias = historyKeys(LEGACY_HISTORY_PREFIX);

function fixture(nombre: string): string {
  return readFileSync(join(__dirname, '..', 'fixtures', 'migration', nombre), 'utf8');
}

/** Deja el almacenamiento como el de alguien que venía usando la aplicación sin cuenta. */
async function instalacionAnterior(): Promise<void> {
  await AsyncStorage.setItem(LEGACY_LIBRARY_KEY, fixture('library-v3.json').trim());
  await AsyncStorage.setItem(clavesPrevias.meta, fixture('history-v2-meta.json'));
  await AsyncStorage.setItem(clavesPrevias.month('2026-08'), fixture('history-v2-month.json'));
  await AsyncStorage.setItem(
    FAKE_AUTH_STORAGE_KEY,
    fakeAuthState({ accounts: [USUARIO_A, USUARIO_B] }),
  );
}

async function iniciarSesion(cuenta: typeof USUARIO_A) {
  await screen.findByTestId('login-submit');
  fireEvent.changeText(screen.getByTestId('login-email'), cuenta.email);
  fireEvent.changeText(screen.getByTestId('login-password'), cuenta.password);
  await pulsar('login-submit');
  await screen.findByTestId('create-deck-button');
}

/** Lee del medio, con repositorios nuevos: nada de estado de React que haya sobrevivido. */
async function leerEspacioDe(userId: string) {
  const biblioteca = await createAsyncStorageRepository(libraryKeyFor(userId)).load();
  const historial = await createStudyHistoryRepository(historyPrefixFor(userId)).load();
  return { biblioteca, historial };
}

describe('El primer usuario recibe lo que había', () => {
  it('la biblioteca aparece entera en su pantalla', async () => {
    await instalacionAnterior();
    montarConAuth(createFakeAuthService({ storage: AsyncStorage }), '/login');

    await iniciarSesion(USUARIO_A);

    expect(await screen.findByText('Inglés')).toBeTruthy();
    expect(screen.getByText('Matemáticas')).toBeTruthy();
  });

  it('conserva identificadores, mazos, cartas y su programación', async () => {
    await instalacionAnterior();
    montarConAuth(createFakeAuthService({ storage: AsyncStorage }), '/login');
    await iniciarSesion(USUARIO_A);

    const { biblioteca } = await leerEspacioDe(USUARIO_A.id);
    if (biblioteca.status !== 'ok') throw new Error(`biblioteca ilegible: ${biblioteca.status}`);

    expect(biblioteca.library.decks).toEqual([
      { id: 'mazo-1', name: 'Inglés', updatedAt: '2026-08-25T10:00:00.000Z' },
      { id: 'mazo-2', name: 'Matemáticas', updatedAt: '2026-08-21T09:30:00.000Z' },
    ]);
    expect(biblioteca.library.cards.map((carta) => carta.id)).toEqual([
      'carta-1',
      'carta-2',
      'carta-3',
    ]);
    // La programación FSRS llega intacta: ni se reinicia ni se recalcula.
    expect(biblioteca.library.cards[0]?.scheduling).toEqual({
      state: 'repaso',
      due: Date.parse('2026-09-04T10:00:00.000Z'),
      lastReview: Date.parse('2026-08-25T10:00:00.000Z'),
      stability: 10.5,
      difficulty: 5.25,
      elapsedDays: 3,
      scheduledDays: 10,
      learningSteps: 0,
      reps: 4,
      lapses: 1,
    });
  });

  it('conserva el historial, las calificaciones y las estadísticas que producen', async () => {
    await instalacionAnterior();
    montarConAuth(createFakeAuthService({ storage: AsyncStorage }), '/login');
    await iniciarSesion(USUARIO_A);

    const { biblioteca, historial } = await leerEspacioDe(USUARIO_A.id);
    if (historial.status !== 'ok') throw new Error(`historial ilegible: ${historial.status}`);
    if (biblioteca.status !== 'ok') throw new Error('biblioteca ilegible');

    expect(historial.history.sessions.map((s) => s.id)).toEqual(['sesion-1']);
    expect(historial.history.reviews.map((r) => r.rating)).toEqual(['bien']);
    expect(historial.history.ratedSince).toBe(Date.parse('2026-08-25T10:00:00.000Z'));

    // Y las cifras derivadas son las mismas que producía la instalación anterior.
    const informe = buildStatsReport(
      { library: biblioteca.library, history: historial.history },
      {
        scope: { kind: 'all' },
        period: 'all',
        today: '2026-08-26',
        now: Date.parse('2026-08-26T10:00:00.000Z'),
      },
    );
    expect(informe.empty).toBe(false);
    expect(informe.activity.total).toBe(1);
    expect(informe.answerButtons.total).toBe(1);
    expect(informe.answerButtons.ratedSince).toBe(Date.parse('2026-08-25T10:00:00.000Z'));
  });

  it('no destruye los documentos originales', async () => {
    await instalacionAnterior();
    montarConAuth(createFakeAuthService({ storage: AsyncStorage }), '/login');
    await iniciarSesion(USUARIO_A);

    expect(await AsyncStorage.getItem(LEGACY_LIBRARY_KEY)).toBe(fixture('library-v3.json').trim());
    expect(await AsyncStorage.getItem(clavesPrevias.meta)).not.toBeNull();
  });
});

describe('Nadie más los recibe', () => {
  it('la segunda cuenta entra a un espacio vacío', async () => {
    await instalacionAnterior();
    const service = createFakeAuthService({ storage: AsyncStorage });
    montarConAuth(service, '/login');

    await iniciarSesion(USUARIO_A);
    await screen.findByText('Inglés');
    await pulsar('cerrar-sesion');
    await iniciarSesion(USUARIO_B);

    expect(screen.queryByText('Inglés')).toBeNull();
    expect(screen.queryByText('Matemáticas')).toBeNull();
    expect(screen.getByTestId('decks-empty')).toBeTruthy();

    const { biblioteca, historial } = await leerEspacioDe(USUARIO_B.id);
    expect(biblioteca.status).toBe('empty');
    // El historial de B existe —la aplicación anota cuándo empezó a registrar— pero está
    // vacío: ni una sesión, ni un evento, ni una calificación de A.
    if (historial.status !== 'ok' && historial.status !== 'empty') {
      throw new Error(`historial ilegible: ${historial.status}`);
    }
    if (historial.status === 'ok') {
      expect(historial.history.sessions).toEqual([]);
      expect(historial.history.cardEvents).toEqual([]);
      expect(historial.history.reviews).toEqual([]);
      expect(historial.history.deckSnapshots).toEqual([]);
      expect(historial.history.ratedSince).toBeNull();
    }
  });

  it('y el primero los sigue teniendo cuando vuelve', async () => {
    await instalacionAnterior();
    montarConAuth(createFakeAuthService({ storage: AsyncStorage }), '/login');

    await iniciarSesion(USUARIO_A);
    await screen.findByText('Inglés');
    await pulsar('cerrar-sesion');
    await iniciarSesion(USUARIO_B);
    await pulsar('cerrar-sesion');
    await iniciarSesion(USUARIO_A);

    expect(await screen.findByText('Inglés')).toBeTruthy();
  });
});

describe('Idempotencia', () => {
  it('entrar y salir varias veces no duplica ni altera nada', async () => {
    await instalacionAnterior();
    montarConAuth(createFakeAuthService({ storage: AsyncStorage }), '/login');

    await iniciarSesion(USUARIO_A);
    await screen.findByText('Inglés');
    const primera = await AsyncStorage.getItem(libraryKeyFor(USUARIO_A.id));

    await pulsar('cerrar-sesion');
    await iniciarSesion(USUARIO_A);
    await screen.findByText('Inglés');

    const { biblioteca } = await leerEspacioDe(USUARIO_A.id);
    if (biblioteca.status !== 'ok') throw new Error('biblioteca ilegible');

    expect(biblioteca.library.decks).toHaveLength(2);
    expect(biblioteca.library.cards).toHaveLength(3);
    expect(await AsyncStorage.getItem(libraryKeyFor(USUARIO_A.id))).toBe(primera);
  });
});
