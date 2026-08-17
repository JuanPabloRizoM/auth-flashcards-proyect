import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { Card } from '../../src/components/ui';
import { radius, spacing } from '../../src/theme';

describe('Card', () => {
  it('renderiza título, descripción, contenido y pie', () => {
    render(
      <Card
        description="Descripción de la tarjeta"
        footer={<Text>Pie</Text>}
        title="Título de la tarjeta"
      >
        <Text>Contenido</Text>
      </Card>,
    );

    expect(screen.getByText('Título de la tarjeta')).toBeTruthy();
    expect(screen.getByText('Descripción de la tarjeta')).toBeTruthy();
    expect(screen.getByText('Contenido')).toBeTruthy();
    expect(screen.getByText('Pie')).toBeTruthy();
  });

  it('omite las secciones opcionales que no se le pasan', () => {
    render(
      <Card testID="tarjeta">
        <Text>Solo contenido</Text>
      </Card>,
    );

    expect(screen.getByText('Solo contenido')).toBeTruthy();
    expect(screen.queryByText('Título de la tarjeta')).toBeNull();
  });

  it('aplica los tokens de radio y espaciado del sistema de diseño', () => {
    render(
      <Card testID="tarjeta">
        <Text>Contenido</Text>
      </Card>,
    );

    const estilo = screen.getByTestId('tarjeta').props.style;
    const plano = Array.isArray(estilo) ? Object.assign({}, ...estilo.filter(Boolean)) : estilo;

    expect(plano.borderRadius).toBe(radius.lg);
    expect(plano.padding).toBe(spacing.xl);
  });
});
