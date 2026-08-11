import { render, screen } from '@testing-library/react-native';

import IndexScreen from '../../app/index';

describe('IndexScreen', () => {
  it('muestra el título de la aplicación y el estado del entorno', () => {
    render(<IndexScreen />);

    expect(screen.getByRole('header').props.children).toBe('Flashcards');
    expect(screen.getByText('Entorno base preparado.')).toBeTruthy();
  });
});
