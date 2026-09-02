/**
 * Decisión de acceso a una ruta.
 *
 * Es una función pura y no un efecto dentro de un componente para poder demostrar dos cosas
 * que un `useEffect` esconde: que cada combinación de estado y ruta produce un destino
 * concreto, y que **no hay bucle de redirecciones**, porque aplicar la decisión al destino
 * que ella misma produce ya no redirige a ningún otro sitio.
 */

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

/** Rutas accesibles sin sesión. Todo lo demás es privado. */
export const publicRoutes = ['/login', '/registro', '/auth/callback'] as const;

export const homeRoute = '/' as const;
export const loginRoute = '/login' as const;

export type RedirectTarget = typeof homeRoute | typeof loginRoute;

export function isPublicRoute(pathname: string): boolean {
  return publicRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export type RouteDecision =
  /** La sesión todavía se está resolviendo: no se pinta nada privado ni público. */
  | { action: 'esperar' }
  | { action: 'redirigir'; to: RedirectTarget }
  | { action: 'mostrar' };

export function decideRoute(status: AuthStatus, pathname: string): RouteDecision {
  if (status === 'loading') {
    return { action: 'esperar' };
  }

  const publica = isPublicRoute(pathname);

  if (status === 'authenticated') {
    // Con sesión, las pantallas de acceso no tienen sentido: se entra a la aplicación.
    return publica ? { action: 'redirigir', to: homeRoute } : { action: 'mostrar' };
  }

  return publica ? { action: 'mostrar' } : { action: 'redirigir', to: loginRoute };
}
