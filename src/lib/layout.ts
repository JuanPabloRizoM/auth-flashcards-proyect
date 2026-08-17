import { useWindowDimensions } from 'react-native';

import { breakpoints } from '../theme';

/**
 * Modo de disposición de la interfaz.
 * - `compact`: móvil. Navegación inferior.
 * - `expanded`: desktop/tablet ancha. Navegación lateral.
 */
export type LayoutMode = 'compact' | 'expanded';

/**
 * Función pura para poder probar el comportamiento responsive sin montar la UI.
 * Un ancho exactamente igual al breakpoint ya se considera expandido.
 */
export function resolveLayoutMode(width: number): LayoutMode {
  return width < breakpoints.md ? 'compact' : 'expanded';
}

/** Modo de disposición actual según el ancho real de la ventana. */
export function useLayoutMode(): LayoutMode {
  const { width } = useWindowDimensions();
  return resolveLayoutMode(width);
}
