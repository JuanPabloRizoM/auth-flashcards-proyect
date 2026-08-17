import { fireEvent, render, screen } from '@testing-library/react-native';

import { Button } from '../../src/components/ui';
import { sizes } from '../../src/theme';

describe('Button', () => {
  it('muestra su label y notifica la pulsación', () => {
    const onPress = jest.fn();
    render(<Button label="Guardar" onPress={onPress} testID="boton" />);

    expect(screen.getByText('Guardar')).toBeTruthy();
    fireEvent.press(screen.getByTestId('boton'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('no notifica la pulsación cuando está deshabilitado', () => {
    const onPress = jest.fn();
    render(<Button disabled label="Guardar" onPress={onPress} testID="boton" />);

    fireEvent.press(screen.getByTestId('boton'));

    expect(onPress).not.toHaveBeenCalled();
    expect(screen.getByTestId('boton').props.accessibilityState.disabled).toBe(true);
  });

  it('no notifica la pulsación mientras está cargando', () => {
    const onPress = jest.fn();
    render(<Button label="Guardar" loading onPress={onPress} testID="boton" />);

    fireEvent.press(screen.getByTestId('boton'));

    expect(onPress).not.toHaveBeenCalled();
    expect(screen.getByTestId('boton').props.accessibilityState.busy).toBe(true);
  });

  it('respeta el objetivo táctil mínimo del sistema de diseño', () => {
    render(<Button label="Guardar" testID="boton" />);

    const estilo = screen.getByTestId('boton').props.style;
    const plano = Array.isArray(estilo) ? Object.assign({}, ...estilo.filter(Boolean)) : estilo;

    expect(plano.minHeight).toBe(sizes.touchTarget);
    expect(plano.minWidth).toBe(sizes.touchTarget);
  });

  it('se declara como botón para tecnologías de asistencia', () => {
    render(<Button label="Guardar" testID="boton" />);

    expect(screen.getByRole('button')).toBeTruthy();
  });
});
