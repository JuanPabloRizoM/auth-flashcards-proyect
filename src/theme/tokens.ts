/**
 * Tokens del sistema de diseño.
 *
 * Única fuente de verdad para color, tipografía, espaciado, radios y tamaños.
 * Ningún componente debe declarar literales de color o de espaciado por su cuenta
 * (docs/DESIGN.md: "No crear variantes visuales nuevas sin necesidad").
 */

export const colors = {
  background: '#F6F7F9',
  surface: '#FFFFFF',
  surfaceMuted: '#EEF1F6',
  border: '#DCE1E9',
  borderStrong: '#C3CBD7',
  text: '#141A22',
  textMuted: '#5B6673',
  textInverse: '#FFFFFF',
  primary: '#3B5BDB',
  primaryHover: '#2F49B2',
  primarySurface: '#E8ECFB',
  danger: '#C92A2A',
  dangerSurface: '#FCEBEB',
  success: '#2B8A3E',
  successSurface: '#E9F5EC',
  info: '#1971C2',
  infoSurface: '#E7F1FB',
  disabled: '#B7BFCA',
  disabledSurface: '#E9ECF1',
} as const;

export const typography = {
  size: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 20,
    xl: 26,
    xxl: 32,
  },
  weight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  lineHeight: {
    xs: 16,
    sm: 20,
    md: 24,
    lg: 28,
    xl: 34,
    xxl: 40,
  },
} as const;

/** Escala de espaciado. Estrictamente creciente: el test lo verifica. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  pill: 999,
} as const;

export const sizes = {
  /**
   * Mínimo táctil. 44pt es el mínimo de las guías de accesibilidad de iOS
   * y equivale al mínimo recomendado en Android (48dp con densidad 1 ~ 44pt útiles).
   */
  touchTarget: 44,
  controlHeight: 48,
  sidebarWidth: 240,
  tabBarHeight: 64,
  headerHeight: 56,
  contentMaxWidth: 960,
} as const;

/**
 * Punto de corte entre la navegación compacta (móvil) y la expandida (desktop).
 * Se compara contra el ancho de ventana en tiempo de ejecución, no con media queries CSS,
 * para que la misma lógica funcione en web, Android e iOS.
 */
export const breakpoints = {
  md: 768,
} as const;

export const theme = {
  colors,
  typography,
  spacing,
  radius,
  sizes,
  breakpoints,
} as const;

export type Theme = typeof theme;
