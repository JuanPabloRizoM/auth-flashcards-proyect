import { Slot } from 'expo-router';
import { renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { AppShell } from '../../src/components/layout';
import { resolveLayoutMode, useLayoutMode } from '../../src/lib/layout';
import { breakpoints } from '../../src/theme';

jest.mock('../../src/lib/layout', () => {
  const actual = jest.requireActual('../../src/lib/layout');
  return { ...actual, useLayoutMode: jest.fn() };
});

const useLayoutModeMock = useLayoutMode as jest.MockedFunction<typeof useLayoutMode>;

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

function Layout() {
  return (
    <SafeAreaProvider initialMetrics={metrics}>
      <AppShell>
        <Slot />
      </AppShell>
    </SafeAreaProvider>
  );
}

function renderShell() {
  renderRouter(
    {
      _layout: Layout,
      index: () => <Text>Contenido de inicio</Text>,
      componentes: () => <Text>Catálogo</Text>,
    },
    { initialUrl: '/' },
  );
}

describe('resolveLayoutMode', () => {
  it('devuelve navegación compacta por debajo del breakpoint', () => {
    expect(resolveLayoutMode(320)).toBe('compact');
    expect(resolveLayoutMode(375)).toBe('compact');
    expect(resolveLayoutMode(breakpoints.md - 1)).toBe('compact');
  });

  it('devuelve navegación expandida a partir del breakpoint', () => {
    expect(resolveLayoutMode(breakpoints.md)).toBe('expanded');
    expect(resolveLayoutMode(1024)).toBe('expanded');
    expect(resolveLayoutMode(1440)).toBe('expanded');
  });
});

describe('AppShell responsive', () => {
  afterEach(() => {
    useLayoutModeMock.mockReset();
  });

  it('en móvil muestra la navegación compacta y oculta el sidebar', async () => {
    useLayoutModeMock.mockReturnValue('compact');
    renderShell();

    expect(await screen.findByTestId('app-tabbar')).toBeTruthy();
    expect(screen.getByTestId('app-header')).toBeTruthy();
    expect(screen.queryByTestId('app-sidebar')).toBeNull();
  });

  it('en desktop muestra el sidebar y oculta la navegación compacta', async () => {
    useLayoutModeMock.mockReturnValue('expanded');
    renderShell();

    expect(await screen.findByTestId('app-sidebar')).toBeTruthy();
    expect(screen.queryByTestId('app-tabbar')).toBeNull();
    expect(screen.queryByTestId('app-header')).toBeNull();
  });

  it('ofrece los mismos destinos de navegación en ambas disposiciones', async () => {
    useLayoutModeMock.mockReturnValue('compact');
    renderShell();
    expect(await screen.findByTestId('nav-inicio')).toBeTruthy();
    expect(screen.getByTestId('nav-componentes')).toBeTruthy();

    screen.unmount();

    useLayoutModeMock.mockReturnValue('expanded');
    renderShell();
    expect(await screen.findByTestId('nav-inicio')).toBeTruthy();
    expect(screen.getByTestId('nav-componentes')).toBeTruthy();
  });

  it('renderiza el contenido de la ruta dentro del layout en ambas disposiciones', async () => {
    useLayoutModeMock.mockReturnValue('compact');
    renderShell();
    expect(await screen.findByText('Contenido de inicio')).toBeTruthy();

    screen.unmount();

    useLayoutModeMock.mockReturnValue('expanded');
    renderShell();
    expect(await screen.findByText('Contenido de inicio')).toBeTruthy();
  });
});
