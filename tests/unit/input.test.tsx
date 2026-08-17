import { fireEvent, render, screen } from '@testing-library/react-native';

import { Input } from '../../src/components/ui';
import { sizes } from '../../src/theme';

describe('Input', () => {
  it('muestra su label y su valor actual', () => {
    render(
      <Input label="Nombre del mazo" onChangeText={() => {}} testID="campo" value="Biología" />,
    );

    expect(screen.getByText('Nombre del mazo')).toBeTruthy();
    expect(screen.getByTestId('campo').props.value).toBe('Biología');
  });

  it('propaga el texto exacto que escribe la persona usuaria', () => {
    const onChangeText = jest.fn();
    render(<Input label="Campo" onChangeText={onChangeText} testID="campo" value="" />);

    fireEvent.changeText(screen.getByTestId('campo'), 'texto escrito');

    expect(onChangeText).toHaveBeenCalledWith('texto escrito');
  });

  it('muestra el error mediante el componente Message con rol alert', () => {
    render(
      <Input
        error="El nombre es obligatorio."
        label="Campo"
        onChangeText={() => {}}
        testID="campo"
        value=""
      />,
    );

    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('El nombre es obligatorio.')).toBeTruthy();
  });

  it('oculta el texto de ayuda cuando hay error', () => {
    render(
      <Input
        error="Error visible."
        helperText="Ayuda que no debe verse."
        label="Campo"
        onChangeText={() => {}}
        value=""
      />,
    );

    expect(screen.queryByText('Ayuda que no debe verse.')).toBeNull();
    expect(screen.getByText('Error visible.')).toBeTruthy();
  });

  it('mantiene una altura cómoda para pantallas táctiles', () => {
    render(<Input label="Campo" onChangeText={() => {}} testID="campo" value="" />);

    const estilo = screen.getByTestId('campo').props.style;
    const plano = Array.isArray(estilo) ? Object.assign({}, ...estilo.filter(Boolean)) : estilo;

    expect(plano.minHeight).toBeGreaterThanOrEqual(sizes.touchTarget);
  });
});
