/**
 * Destinos de primer nivel.
 *
 * Sustituyen la ruta actual, no se apilan. Las pantallas de detalle (un mazo, el estudio)
 * no viven aquí: se apilan sobre el destino activo y ofrecen una vuelta explícita.
 */
export type NavigationItem = {
  href: '/' | '/componentes';
  label: string;
  testID: string;
};

export const navigationItems: readonly NavigationItem[] = [
  { href: '/', label: 'Mis mazos', testID: 'nav-mazos' },
  { href: '/componentes', label: 'Componentes', testID: 'nav-componentes' },
] as const;
