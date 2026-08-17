import { fireEvent, render, screen } from '@testing-library/react-native';

import { Button, EmptyState, Loading, Message } from '../../src/components/ui';

describe('Loading', () => {
  it('se anuncia como indicador de progreso con su mensaje', () => {
    render(<Loading message="Cargando mazos…" testID="carga" />);

    const indicador = screen.getByTestId('carga');
    expect(indicador.props.accessibilityRole).toBe('progressbar');
    expect(indicador.props.accessibilityLabel).toBe('Cargando mazos…');
    expect(screen.getByText('Cargando mazos…')).toBeTruthy();
  });

  it('usa un mensaje por defecto cuando no se le pasa ninguno', () => {
    render(<Loading testID="carga" />);

    expect(screen.getByText('Cargando…')).toBeTruthy();
  });
});

describe('EmptyState', () => {
  it('muestra título y descripción', () => {
    render(<EmptyState description="Todavía no hay nada aquí." title="Sin contenido" />);

    expect(screen.getByText('Sin contenido')).toBeTruthy();
    expect(screen.getByText('Todavía no hay nada aquí.')).toBeTruthy();
  });

  it('renderiza la acción solo cuando se le proporciona', () => {
    const onPress = jest.fn();
    const { rerender } = render(<EmptyState title="Sin contenido" />);

    expect(screen.queryByText('Crear')).toBeNull();

    rerender(
      <EmptyState
        action={<Button label="Crear" onPress={onPress} testID="accion" />}
        title="Sin contenido"
      />,
    );

    fireEvent.press(screen.getByTestId('accion'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('Message', () => {
  it('anuncia la variante de error como alert', () => {
    render(
      <Message testID="mensaje" variant="error">
        Algo ha fallado.
      </Message>,
    );

    expect(screen.getByTestId('mensaje').props.accessibilityRole).toBe('alert');
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('no usa el rol alert para información ni confirmación', () => {
    const { rerender } = render(
      <Message testID="mensaje" variant="info">
        Solo información.
      </Message>,
    );
    expect(screen.getByTestId('mensaje').props.accessibilityRole).toBeUndefined();

    rerender(
      <Message testID="mensaje" variant="success">
        Todo correcto.
      </Message>,
    );
    expect(screen.getByTestId('mensaje').props.accessibilityRole).toBeUndefined();
  });

  it('muestra el título opcional junto al cuerpo', () => {
    render(
      <Message title="Aviso" variant="info">
        Cuerpo del mensaje.
      </Message>,
    );

    expect(screen.getByText('Aviso')).toBeTruthy();
    expect(screen.getByText('Cuerpo del mensaje.')).toBeTruthy();
  });
});
