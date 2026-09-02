import {
  decideRoute,
  homeRoute,
  isPublicRoute,
  loginRoute,
  publicRoutes,
  type AuthStatus,
} from '../../src/features/auth/guard';

/**
 * La decisión de acceso a una ruta.
 *
 * La tabla completa, y la propiedad que de verdad importa: aplicar la decisión al destino que
 * ella misma produce ya no lleva a ningún otro sitio. Sin eso, un guard puede quedarse
 * rebotando entre dos rutas para siempre.
 */

const rutasPrivadas = [
  '/',
  '/estadisticas',
  '/componentes',
  '/mazo/mazo-1',
  '/mazo/mazo-1/estudiar',
  '/mazo/mazo-1/importar',
];

describe('Qué rutas son públicas', () => {
  it('solo lo son las tres del acceso', () => {
    expect([...publicRoutes]).toEqual(['/login', '/registro', '/auth/callback']);
    for (const ruta of publicRoutes) {
      expect(isPublicRoute(ruta)).toBe(true);
    }
  });

  it('todas las rutas de la aplicación son privadas', () => {
    for (const ruta of rutasPrivadas) {
      expect(isPublicRoute(ruta)).toBe(false);
    }
  });

  it('una ruta que solo empieza igual que una pública no es pública', () => {
    // Sin el corte por segmento, "/loginfalso" pasaría por pública.
    expect(isPublicRoute('/loginfalso')).toBe(false);
    expect(isPublicRoute('/registro-de-mazos')).toBe(false);
    // Un subcamino real de una ruta pública sí lo es: el callback lleva parámetros.
    expect(isPublicRoute('/auth/callback/extra')).toBe(true);
  });
});

describe('Decisión del guard', () => {
  it('mientras se resuelve la sesión no se muestra ni se redirige', () => {
    for (const ruta of [...rutasPrivadas, ...publicRoutes]) {
      expect(decideRoute('loading', ruta)).toEqual({ action: 'esperar' });
    }
  });

  it('sin sesión, cada ruta privada acaba en el acceso', () => {
    for (const ruta of rutasPrivadas) {
      expect(decideRoute('unauthenticated', ruta)).toEqual({
        action: 'redirigir',
        to: loginRoute,
      });
    }
  });

  it('sin sesión, las rutas públicas se muestran', () => {
    for (const ruta of publicRoutes) {
      expect(decideRoute('unauthenticated', ruta)).toEqual({ action: 'mostrar' });
    }
  });

  it('con sesión, las rutas privadas se muestran', () => {
    for (const ruta of rutasPrivadas) {
      expect(decideRoute('authenticated', ruta)).toEqual({ action: 'mostrar' });
    }
  });

  it('con sesión, quedarse en el acceso no tiene sentido: se entra a la aplicación', () => {
    for (const ruta of publicRoutes) {
      expect(decideRoute('authenticated', ruta)).toEqual({ action: 'redirigir', to: homeRoute });
    }
  });
});

describe('No hay bucle de redirecciones', () => {
  const estados: AuthStatus[] = ['loading', 'authenticated', 'unauthenticated'];

  it('el destino de una redirección ya no redirige a ningún otro sitio', () => {
    for (const estado of estados) {
      for (const ruta of [...rutasPrivadas, ...publicRoutes]) {
        const primera = decideRoute(estado, ruta);
        if (primera.action !== 'redirigir') continue;

        const segunda = decideRoute(estado, primera.to);
        expect(segunda.action).toBe('mostrar');
      }
    }
  });
});
