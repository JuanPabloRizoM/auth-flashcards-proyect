import { render, screen } from '@testing-library/react-native';

import { ConfirmDialog } from '../../src/components/ui';

const props = {
  title: '¿Eliminar el mazo?',
  description: 'Se eliminará el mazo y también sus cartas.',
  confirmLabel: 'Eliminar mazo y cartas',
  onConfirm: () => {},
  onCancel: () => {},
  testID: 'delete-confirm',
};

describe('ConfirmDialog', () => {
  it('no muestra nada mientras está cerrado', () => {
    render(<ConfirmDialog {...props} visible={false} />);

    expect(screen.queryByTestId('delete-confirm')).toBeNull();
  });

  it('muestra el título, la explicación y las dos acciones', () => {
    render(<ConfirmDialog {...props} visible />);

    expect(screen.getByText('¿Eliminar el mazo?')).toBeTruthy();
    expect(screen.getByText('Se eliminará el mazo y también sus cartas.')).toBeTruthy();
    expect(screen.getByTestId('delete-confirm-confirm')).toBeTruthy();
    expect(screen.getByTestId('delete-confirm-cancel')).toBeTruthy();
  });

  it('se anuncia como alerta, para que un lector de pantalla lo lea al aparecer', () => {
    render(<ConfirmDialog {...props} visible />);

    expect(screen.getByTestId('delete-confirm').props.accessibilityRole).toBe('alert');
  });

  /**
   * Regresión del finding 2 de la revisión. El fondo se puede pulsar para cancelar, pero no
   * debe anunciarse: había dos controles llamados "Cancelar" y el que ocupa toda la pantalla
   * iba por delante del diálogo.
   */
  it('el fondo pulsable no se expone a los lectores de pantalla', () => {
    render(<ConfirmDialog {...props} visible />);

    // Las consultas por defecto solo ven lo que ve un lector de pantalla: si el fondo
    // apareciera aquí, es que se estaría anunciando.
    expect(screen.queryByTestId('delete-confirm-backdrop')).toBeNull();

    const backdrop = screen.getByTestId('delete-confirm-backdrop', {
      includeHiddenElements: true,
    });
    expect(backdrop.props.accessibilityElementsHidden).toBe(true);
    expect(backdrop.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(backdrop.props.accessibilityRole).toBeUndefined();
  });

  it('solo hay un control anunciado como "Cancelar"', () => {
    render(<ConfirmDialog {...props} visible />);

    expect(screen.getAllByRole('button', { name: 'Cancelar' })).toHaveLength(1);
  });
});
