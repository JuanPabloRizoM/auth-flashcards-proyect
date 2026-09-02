import { usePathname, useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLayoutMode } from '../../lib/layout';
import { goToTopLevel } from '../../lib/navigation';
import { colors, radius, sizes, spacing, typography } from '../../theme';

import { NavigationItemButton } from './NavigationItemButton';
import { navigationItems, type NavigationItem } from './navigation';

/**
 * La cuenta que está usando la aplicación.
 *
 * Llega como propiedad y no de un contexto para que el layout siga siendo utilizable sin
 * sesión —el catálogo de componentes y los arneses de prueba lo montan tal cual— y para que
 * `AppShell` no dependa del proveedor de autenticación.
 */
export type AppShellAccount = {
  email: string | null;
  onSignOut: () => void | Promise<void>;
};

export type AppShellProps = {
  children: ReactNode;
  account?: AppShellAccount;
};

const APP_NAME = 'Flashcards';

/**
 * Layout principal reutilizable.
 *
 * Se aplica una sola vez en el layout raíz: las pantallas nunca reimplementan
 * cabecera ni navegación. En desktop muestra un sidebar y en móvil una barra
 * inferior compacta, según docs/DESIGN.md.
 */
export function AppShell({ children, account }: AppShellProps) {
  const mode = useLayoutMode();
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [signingOut, setSigningOut] = useState(false);

  const signOut = () => {
    // Un segundo toque mientras la sesión se está cerrando no debe encadenar dos cierres.
    if (signingOut) return;
    setSigningOut(true);
    void Promise.resolve(account?.onSignOut()).finally(() => setSigningOut(false));
  };

  /**
   * Identidad y salida.
   *
   * En desktop cierra el sidebar, que es donde vive el resto de la navegación. En móvil va
   * en la cabecera: la barra inferior está reservada a los destinos de primer nivel, y
   * añadir ahí un cuarto elemento que no es un destino confundiría lo que esa barra
   * significa. En las dos disposiciones queda alcanzable.
   */
  const accountBlock =
    account === undefined ? null : (
      <View style={mode === 'expanded' ? styles.accountSidebar : styles.accountHeader}>
        {account.email === null ? null : (
          <Text numberOfLines={1} style={styles.accountEmail} testID="cuenta-email">
            {account.email}
          </Text>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: signingOut, busy: signingOut }}
          disabled={signingOut}
          onPress={signOut}
          style={styles.signOut}
          testID="cerrar-sesion"
        >
          <Text style={styles.signOutLabel}>Cerrar sesión</Text>
        </Pressable>
      </View>
    );

  const goTo = (href: NavigationItem['href']) => {
    // Destinos de primer nivel: se vacía el apilado y se sustituye la raíz, de modo que la
    // profundidad no crece por muchas idas y vueltas que haya. Ver src/lib/navigation.ts.
    goToTopLevel(router, () => router.replace(href));
  };

  const isActive = (href: NavigationItem['href']) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  const content = (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      style={styles.scroll}
      testID="app-scroll"
    >
      <View style={styles.contentWidth}>{children}</View>
    </ScrollView>
  );

  if (mode === 'expanded') {
    return (
      <View style={[styles.root, styles.rootExpanded]} testID="app-shell-expanded">
        <View style={[styles.sidebar, { paddingTop: insets.top + spacing.xl }]} testID="app-sidebar">
          <Text style={styles.brand}>{APP_NAME}</Text>
          <View style={styles.sidebarItems}>
            {navigationItems.map((item) => (
              <NavigationItemButton
                active={isActive(item.href)}
                item={item}
                key={item.href}
                onPress={goTo}
                orientation="sidebar"
              />
            ))}
          </View>
          {accountBlock}
        </View>
        <View style={styles.main}>{content}</View>
      </View>
    );
  }

  return (
    <View style={styles.root} testID="app-shell-compact">
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]} testID="app-header">
        <Text style={styles.brand}>{APP_NAME}</Text>
        {accountBlock}
      </View>
      <View style={styles.main}>{content}</View>
      <View
        style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}
        testID="app-tabbar"
      >
        {navigationItems.map((item) => (
          <NavigationItemButton
            active={isActive(item.href)}
            item={item}
            key={item.href}
            onPress={goTo}
            orientation="bar"
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  accountEmail: {
    color: colors.textMuted,
    flexShrink: 1,
    fontSize: typography.size.xs,
  },
  accountHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 1,
    gap: spacing.sm,
    justifyContent: 'flex-end',
  },
  accountSidebar: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: spacing.xs,
    marginTop: 'auto',
    paddingTop: spacing.lg,
  },
  brand: {
    color: colors.text,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
  },
  contentWidth: {
    gap: spacing.xl,
    maxWidth: sizes.contentMaxWidth,
    width: '100%',
  },
  header: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
    minHeight: sizes.headerHeight,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  main: {
    flex: 1,
    minWidth: 0,
  },
  root: {
    backgroundColor: colors.background,
    flex: 1,
  },
  rootExpanded: {
    flexDirection: 'row',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  sidebar: {
    backgroundColor: colors.surface,
    borderRightColor: colors.border,
    borderRightWidth: 1,
    gap: spacing.xl,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
    // Ancho fijo, sin `flex`. El contenedor es una fila y `main` ya crece: darle `flex` al
    // sidebar pondría su base a 0 y los dos se repartirían la pantalla. Estirarse a lo alto
    // lo hace solo, por el `alignItems: stretch` de la fila, que es lo que necesita el
    // `marginTop: 'auto'` del bloque de cuenta.
    width: sizes.sidebarWidth,
  },
  sidebarItems: {
    gap: spacing.xs,
  },
  signOut: {
    alignItems: 'flex-start',
    borderRadius: radius.md,
    justifyContent: 'center',
    minHeight: sizes.touchTarget,
    paddingHorizontal: spacing.sm,
  },
  signOutLabel: {
    color: colors.primary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
  tabBar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: sizes.tabBarHeight,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
  },
});
