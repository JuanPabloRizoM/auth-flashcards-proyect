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
};

export function montarApp({
  libraryRepository,
  historyRepository,
  initialUrl = '/',
  filePicker,
  fileSaver,
}: MontarOptions) {
  function Layout() {
    return (
      <SafeAreaProvider initialMetrics={metrics}>
        <LibraryProvider repository={libraryRepository}>
          <StudyHistoryProvider repository={historyRepository}>
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
        fileSaver ? <EstadisticasScreen fileSaver={fileSaver} /> : <EstadisticasScreen />,
      componentes: ComponentesScreen,
      'mazo/[id]/index': DetalleMazoScreen,
      'mazo/[id]/estudiar': EstudiarScreen,
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

/**
 * Estudia el mazo abierto de principio a fin.
 *
 * Recorre el ciclo real de la pantalla —mostrar respuesta y siguiente carta— tantas veces
 * como cartas haya, que es lo que produce los eventos que después se miden.
 */
export async function estudiarMazo(cartas: number) {
  await act(async () => {
    fireEvent.press(screen.getByTestId('study-button'));
  });
  await screen.findByTestId('study-card');

  for (let index = 0; index < cartas; index += 1) {
    await act(async () => {
      fireEvent.press(screen.getByTestId('reveal-button'));
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('next-card-button'));
    });
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
