/**
 * Tokens del sistema de diseño.
 *
 * Única fuente de verdad para color, tipografía, espaciado, radios y tamaños.
 * Ningún componente debe declarar literales de color o de espaciado por su cuenta
 * (docs/DESIGN.md: "No crear variantes visuales nuevas sin necesidad").
 *
 * Dirección visual confirmada: aplicación de estudio limpia, académica, tranquila y
 * profesional. Sin gradientes, sin sombras de color y sin brillos.
 */

import { Platform } from 'react-native';

export const colors = {
  background: '#F7F5F0',
  surface: '#FFFFFF',
  surfaceMuted: '#EFEDE7',
  border: '#DDDAD3',
  borderStrong: '#C6C2B8',
  text: '#20242A',
  textMuted: '#6B7280',
  textInverse: '#FFFFFF',
  primary: '#315B7D',
  primaryHover: '#274964',
  primarySurface: '#E7EEF4',
  danger: '#A84A4A',
  dangerSurface: '#F6EAEA',
  success: '#52705A',
  successSurface: '#EAF0EB',
  warning: '#A86F32',
  warningSurface: '#F5EDE3',
  info: '#315B7D',
  infoSurface: '#E7EEF4',
  disabled: '#A9A69E',
  disabledSurface: '#EFEDE7',
} as const;

export const typography = {
  /**
   * Sans para toda la interfaz; serif reservada al contenido de las flashcards
   * (docs/DESIGN.md). En nativo hay que nombrar una fuente real, no una pila CSS.
   */
  family: {
    serif: Platform.select({
      web: 'Iowan Old Style, Palatino, Georgia, serif',
      ios: 'Georgia',
      android: 'serif',
      default: 'serif',
    }),
  },
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
  letterSpacing: {
    /** Etiquetas en mayúsculas: sin abrir un poco el interletraje se leen apretadas. */
    label: 0.6,
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
  /** Alto mínimo de la carta en la pantalla de estudio, para que no salte al revelar. */
  studyCardMinHeight: 220,
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
