import { breakpoints, colors, radius, sizes, spacing, typography } from '../../src/theme';

describe('Sistema de diseño', () => {
  it('expone las familias de tokens exigidas por la tarea', () => {
    expect(Object.keys(colors).length).toBeGreaterThan(0);
    expect(Object.keys(typography.size).length).toBeGreaterThan(0);
    expect(Object.keys(spacing).length).toBeGreaterThan(0);
    expect(Object.keys(radius).length).toBeGreaterThan(0);
    expect(Object.keys(sizes).length).toBeGreaterThan(0);
  });

  it('define una escala de espaciado estrictamente creciente', () => {
    const escala = [
      spacing.xs,
      spacing.sm,
      spacing.md,
      spacing.lg,
      spacing.xl,
      spacing.xxl,
      spacing.xxxl,
    ];

    expect(escala).toEqual([4, 8, 12, 16, 24, 32, 48]);
    escala.forEach((valor, indice) => {
      if (indice > 0) {
        expect(valor).toBeGreaterThan(escala[indice - 1] as number);
      }
    });
  });

  it('define una escala tipográfica estrictamente creciente', () => {
    const escala = [
      typography.size.xs,
      typography.size.sm,
      typography.size.md,
      typography.size.lg,
      typography.size.xl,
      typography.size.xxl,
    ];

    escala.forEach((valor, indice) => {
      if (indice > 0) {
        expect(valor).toBeGreaterThan(escala[indice - 1] as number);
      }
    });
  });

  it('garantiza un objetivo táctil de al menos 44 puntos', () => {
    expect(sizes.touchTarget).toBeGreaterThanOrEqual(44);
    expect(sizes.controlHeight).toBeGreaterThanOrEqual(sizes.touchTarget);
  });

  it('usa colores en formato hexadecimal de 6 dígitos', () => {
    Object.values(colors).forEach((valor) => {
      expect(valor).toMatch(/^#[0-9A-F]{6}$/i);
    });
  });

  it('aplica exactamente la paleta confirmada', () => {
    expect(colors.background).toBe('#F7F5F0');
    expect(colors.surface).toBe('#FFFFFF');
    expect(colors.text).toBe('#20242A');
    expect(colors.textMuted).toBe('#6B7280');
    expect(colors.primary).toBe('#315B7D');
    expect(colors.primarySurface).toBe('#E7EEF4');
    expect(colors.success).toBe('#52705A');
    expect(colors.border).toBe('#DDDAD3');
    expect(colors.warning).toBe('#A86F32');
    expect(colors.danger).toBe('#A84A4A');
  });

  it('define una familia serif para el contenido de las flashcards', () => {
    expect(typeof typography.family.serif).toBe('string');
    expect(typography.family.serif).toMatch(/serif|Georgia|Palatino/i);
  });

  it('define un breakpoint móvil/desktop utilizable', () => {
    expect(breakpoints.md).toBe(768);
  });
});
