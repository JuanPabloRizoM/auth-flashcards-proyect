import { render, screen } from '@testing-library/react-native';

import { Button, FlashcardFace } from '../../src/components/ui';
import { typography } from '../../src/theme';

function estiloPlano(elemento: { props: { style?: unknown } }) {
  const estilo = elemento.props.style;
  return Array.isArray(estilo) ? Object.assign({}, ...estilo.filter(Boolean)) : estilo;
}

describe('FlashcardFace', () => {
  it('muestra la etiqueta y el texto de la cara', () => {
    render(<FlashcardFace label="Frente" testID="cara" text="to overlook" />);

    expect(screen.getByText('Frente')).toBeTruthy();
    expect(screen.getByText('to overlook')).toBeTruthy();
  });

  it('usa la serif para el contenido de la carta', () => {
    render(<FlashcardFace label="Frente" text="to overlook" />);

    const contenido = estiloPlano(screen.getByText('to overlook'));
    expect(contenido.fontFamily).toBe(typography.family.serif);
  });

  it('no usa la serif para la etiqueta, que es interfaz', () => {
    render(<FlashcardFace label="Frente" text="to overlook" />);

    const etiqueta = estiloPlano(screen.getByText('Frente'));
    expect(etiqueta.fontFamily).toBeUndefined();
  });

  it('el tamaño prompt es mayor que el compacto', () => {
    const { rerender } = render(<FlashcardFace label="Frente" size="compact" text="palabra" />);
    const compacto = estiloPlano(screen.getByText('palabra')).fontSize;

    rerender(<FlashcardFace label="Frente" size="prompt" text="palabra" />);
    const grande = estiloPlano(screen.getByText('palabra')).fontSize;

    expect(grande).toBeGreaterThan(compacto);
  });
});

describe('separación entre contenido e interfaz', () => {
  it('los controles de la interfaz no usan la serif', () => {
    render(<Button label="Mostrar respuesta" />);

    expect(estiloPlano(screen.getByText('Mostrar respuesta')).fontFamily).toBeUndefined();
  });
});
