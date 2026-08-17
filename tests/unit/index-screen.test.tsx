import { fireEvent, render, screen } from '@testing-library/react-native';

import IndexScreen from '../../app/index';

describe('IndexScreen', () => {
  it('muestra el título de la aplicación', () => {
    render(<IndexScreen />);

    expect(screen.getByRole('header').props.children).toBe('Flashcards');
  });

  it('demuestra los componentes compartidos en lugar de recrearlos', () => {
    render(<IndexScreen />);

    expect(screen.getByTestId('demo-card')).toBeTruthy();
    expect(screen.getByTestId('demo-input')).toBeTruthy();
    expect(screen.getByTestId('demo-primary')).toBeTruthy();
    expect(screen.getByTestId('demo-secondary')).toBeTruthy();
    expect(screen.getByTestId('demo-loading')).toBeTruthy();
    expect(screen.getByTestId('demo-empty')).toBeTruthy();
  });

  it('el campo de demostración refleja lo que se escribe', () => {
    render(<IndexScreen />);

    const campo = screen.getByTestId('demo-input');
    expect(campo.props.value).toBe('');

    fireEvent.changeText(campo, 'hola');

    expect(screen.getByTestId('demo-input').props.value).toBe('hola');
  });

  it('no simula funcionalidades de producto todavía no decididas', () => {
    render(<IndexScreen />);

    ['Iniciar sesión', 'Mis mazos', 'Estudiar', 'Estadísticas'].forEach((texto) => {
      expect(screen.queryByText(texto)).toBeNull();
    });
  });
});
