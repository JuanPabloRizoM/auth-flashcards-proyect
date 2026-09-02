import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '../../theme';

/**
 * Envoltorio de las pantallas de acceso.
 *
 * Las pantallas de acceso no viven dentro de `AppShell`: sin sesión no hay navegación a
 * "Mis mazos" ni a "Estadísticas" que ofrecer, y una barra con destinos que redirigen a esta
 * misma pantalla sería ruido. Aquí solo están el nombre de la aplicación y el formulario.
 *
 * La identidad visual es la de siempre (docs/DESIGN.md): fondo crema, superficie blanca,
 * azul tinta para la acción principal y sans-serif para toda la interfaz. Nada nuevo.
 *
 * La columna tiene ancho máximo y el contenido va dentro de un `ScrollView`, que es lo que
 * hace que a 320 px de ancho y con el teclado abierto siga siendo alcanzable todo el
 * formulario sin desbordar en horizontal.
 */

const APP_NAME = 'Flashcards';

export type AuthScreenProps = {
  title: string;
  children: ReactNode;
  testID?: string;
};

export function AuthScreen({ title, children, testID }: AuthScreenProps) {
  return (
    <ScrollView
      contentContainerStyle={styles.content}
      style={styles.root}
      testID={testID}
    >
      <View style={styles.column}>
        <Text style={styles.brand}>{APP_NAME}</Text>
        <View style={styles.card}>
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
          {children}
        </View>
      </View>
    </ScrollView>
  );
}

/** Separador "o" entre el acceso por correo y el acceso con Google. */
export function AuthSeparator() {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.separator}>
      <View style={styles.rule} />
      <Text style={styles.separatorLabel}>o</Text>
      <View style={styles.rule} />
    </View>
  );
}

/** Pie con la pregunta y el enlace a la otra pantalla de acceso. */
export function AuthFooter({ children }: { children: ReactNode }) {
  return <View style={styles.footer}>{children}</View>;
}

export function AuthQuestion({ children }: { children: ReactNode }) {
  return <Text style={styles.question}>{children}</Text>;
}

const styles = StyleSheet.create({
  brand: {
    color: colors.text,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.lg,
    padding: spacing.xl,
    width: '100%',
  },
  column: {
    gap: spacing.xl,
    maxWidth: 420,
    width: '100%',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100%',
    padding: spacing.lg,
  },
  footer: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  question: {
    color: colors.textMuted,
    fontSize: typography.size.sm,
    textAlign: 'center',
  },
  root: {
    backgroundColor: colors.background,
    flex: 1,
  },
  rule: {
    backgroundColor: colors.border,
    flex: 1,
    height: 1,
  },
  separator: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  separatorLabel: {
    color: colors.textMuted,
    fontSize: typography.size.sm,
  },
  title: {
    color: colors.text,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    lineHeight: typography.lineHeight.xl,
  },
});
