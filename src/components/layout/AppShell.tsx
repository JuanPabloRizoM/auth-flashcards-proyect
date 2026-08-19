import { usePathname, useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLayoutMode } from '../../lib/layout';
import { goToTopLevel } from '../../lib/navigation';
import { colors, sizes, spacing, typography } from '../../theme';

import { NavigationItemButton } from './NavigationItemButton';
import { navigationItems, type NavigationItem } from './navigation';

export type AppShellProps = {
  children: ReactNode;
};

const APP_NAME = 'Flashcards';

/**
 * Layout principal reutilizable.
 *
 * Se aplica una sola vez en el layout raíz: las pantallas nunca reimplementan
 * cabecera ni navegación. En desktop muestra un sidebar y en móvil una barra
 * inferior compacta, según docs/DESIGN.md.
 */
export function AppShell({ children }: AppShellProps) {
  const mode = useLayoutMode();
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();

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
        </View>
        <View style={styles.main}>{content}</View>
      </View>
    );
  }

  return (
    <View style={styles.root} testID="app-shell-compact">
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]} testID="app-header">
        <Text style={styles.brand}>{APP_NAME}</Text>
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
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    justifyContent: 'center',
    minHeight: sizes.headerHeight,
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
    width: sizes.sidebarWidth,
  },
  sidebarItems: {
    gap: spacing.xs,
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
