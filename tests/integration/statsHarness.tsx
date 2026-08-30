import { Slot } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import ComponentesScreen from '../../app/componentes';
import EstadisticasScreen from '../../app/estadisticas';
import MisMazosScreen from '../../app/index';
import EstudiarScreen from '../../app/mazo/[id]/estudiar';
import ImportarScreen from '../../app/mazo/[id]/importar';
import DetalleMazoScreen from '../../app/mazo/[id]/index';
import { AppShell } from '../../src/components/layout';
import { systemClock, type Clock } from '../../src/lib/clock';
import { LibraryHistoryBridge } from '../../src/lib/LibraryHistoryBridge';
import { LibraryProvider } from '../../src/lib/LibraryProvider';
import { StudyHistoryProvider } from '../../src/lib/StudyHistoryProvider';
import { createMemoryRepository } from '../../src/lib/storage/memoryRepository';
import {
  createMemoryHistoryRepository,
  type StudyHistoryRepository,
} from '../../src/lib/storage/studyHistoryRepository';
import type { LibraryRepository } from '../../src/lib/storage/types';
import type { FilePicker, FileSaver } from '../../src/lib/files/types';

/**
 * Arnés de los tests de integración de estadísticas.
 *
 * Monta la aplicación real con los dos repositorios inyectados. Que sean inyectables es lo
 * que permite desmontar el árbol entero, volver a montarlo sobre el mismo medio y
 * comprobar que el historial se recupera del almacenamiento y no de un estado de React que
 * sobrevivió.
 */

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 1280, height: 900 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

export type MontarOptions = {
  libraryRepository: LibraryRepository;
  historyRepository: StudyHistoryRepository;
  initialUrl?: string;
  /** Selector de archivos inyectado, para los tests de importación. */
  filePicker?: FilePicker;
  /** Guardador inyectado, para los tests del reporte PDF. */
  fileSaver?: FileSaver;
  /**
   * Reloj inyectado.
   *
   * Lo comparten el detalle del mazo, el estudio y las estadísticas: los tres dependen de
   * qué está vencido *ahora*. Con un reloj controlable, un test puede calificar, adelantarlo
   * dos días y comprobar que la tarjeta vuelve a estar disponible.
   */
  clock?: Clock;
};

export function montarApp({
  libraryRepository,
  historyRepository,
  initialUrl = '/',
  filePicker,
  fileSaver,
  clock = systemClock,
}: MontarOptions) {
  function Layout() {
    return (
      <SafeAreaProvider initialMetrics={metrics}>
        <LibraryProvider repository={libraryRepository}>
          {/* El historial usa el mismo reloj que las pantallas: si divergieran, la fecha
              de una calificación no coincidiría con la programación que produjo. */}
          <StudyHistoryProvider now={clock.now} repository={historyRepository}>
            <LibraryHistoryBridge />
            <AppShell>
              <Slot />
            </AppShell>
          </StudyHistoryProvider>
        </LibraryProvider>
      </SafeAreaProvider>
    );
  }

  return renderRouter(
    {
      _layout: Layout,
      index: MisMazosScreen,
      estadisticas: () =>
        fileSaver ? (
          <EstadisticasScreen clock={clock} fileSaver={fileSaver} />
        ) : (
          <EstadisticasScreen clock={clock} />
        ),
      componentes: ComponentesScreen,
      'mazo/[id]/index': () => <DetalleMazoScreen clock={clock} />,
      'mazo/[id]/estudiar': () => <EstudiarScreen clock={clock} />,
      'mazo/[id]/importar': () =>
        filePicker ? <ImportarScreen filePicker={filePicker} /> : <ImportarScreen />,
    },
    { initialUrl },
  );
}

/** Par de repositorios en memoria recién creados. */
export function repositorios() {
  return {
    libraryRepository: createMemoryRepository(),
    historyRepository: createMemoryHistoryRepository(),
  };
}

// ── Acciones sobre la interfaz ────────────────────────────────────────────────

export async function crearMazo(nombre: string) {
  fireEvent.changeText(screen.getByTestId('deck-name-input'), nombre);
  await act(async () => {
    fireEvent.press(screen.getByTestId('create-deck-button'));
  });
}

export async function abrirMazo(id: string) {
  await act(async () => {
    fireEvent.press(screen.getByTestId(`deck-${id}`));
  });
  await screen.findByTestId('add-card-button');
}

export async function anadirCarta(frente: string, reverso: string) {
  fireEvent.changeText(screen.getByTestId('card-front-input'), frente);
  fireEvent.changeText(screen.getByTestId('card-back-input'), reverso);
  await act(async () => {
    fireEvent.press(screen.getByTestId('add-card-button'));
  });
}

export async function irA(testID: string) {
  await act(async () => {
    fireEvent.press(screen.getByTestId(testID));
  });
}

/** Los cuatro botones de calificación, por su testID. */
export const calificaciones = {
  'otra-vez': 'rate-again',
  dificil: 'rate-hard',
  bien: 'rate-good',
  facil: 'rate-easy',
} as const;

export type CalificacionTestId = keyof typeof calificaciones;

/** Revela la respuesta y califica la tarjeta a la vista. */
export async function calificar(rating: CalificacionTestId) {
  await act(async () => {
    fireEvent.press(screen.getByTestId('reveal-button'));
  });
  await act(async () => {
    fireEvent.press(screen.getByTestId(calificaciones[rating]));
  });
}

/**
 * Estudia el mazo abierto de principio a fin.
 *
 * Recorre el ciclo real de la pantalla —mostrar respuesta y calificar— tantas veces como
 * cartas haya, que es lo que produce los eventos que después se miden. Califica Fácil a
 * propósito: es la única calificación que saca una tarjeta nueva de la sesión de una vez, de
 * modo que el recorrido termine en un número conocido de pasos.
 */
export async function estudiarMazo(cartas: number) {
  await act(async () => {
    fireEvent.press(screen.getByTestId('study-button'));
  });
  await screen.findByTestId('study-card');

  for (let index = 0; index < cartas; index += 1) {
    await calificar('facil');
  }

  await screen.findByTestId('study-finished');
}

/** Crea un mazo con `cartas` tarjetas y lo estudia entero. Deja abierta la pantalla de estudio. */
export async function crearEstudiarMazo(nombre: string, deckId: string, cartas: number) {
  await irA('nav-mazos');
  await screen.findByTestId('create-deck-button');
  await crearMazo(nombre);
  await abrirMazo(deckId);
  for (let index = 0; index < cartas; index += 1) {
    await anadirCarta(`${nombre} frente ${index}`, `${nombre} reverso ${index}`);
  }
  await estudiarMazo(cartas);
}

/** Valor de una cifra del panel, leído por su etiqueta accesible. */
export function cifra(testID: string): string {
  const elemento = screen.getByTestId(testID);
  const etiqueta = String(elemento.props.accessibilityLabel ?? '');
  return etiqueta.slice(etiqueta.indexOf(':') + 1).trim();
}
