/**
 * Rutas de la navegación base.
 *
 * Son andamiaje del propio sistema visual: no representan features de producto.
 * Ampliar esta lista es el punto de extensión cuando una tarea futura añada secciones reales.
 */
export type NavigationItem = {
  href: '/' | '/componentes';
  label: string;
  testID: string;
};

export const navigationItems: readonly NavigationItem[] = [
  { href: '/', label: 'Inicio', testID: 'nav-inicio' },
  { href: '/componentes', label: 'Componentes', testID: 'nav-componentes' },
] as const;
