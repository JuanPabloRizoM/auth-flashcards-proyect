import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Card, EmptyState, Input, Loading, Message } from '../src/components/ui';
import { colors, spacing, typography } from '../src/theme';

/**
 * Pantalla inicial temporal.
 *
 * Su única función es demostrar el layout y los componentes compartidos.
 * No implementa mazos, login, estudio ni estadísticas: esas decisiones no están tomadas.
 */
export default function IndexScreen() {
  const [nota, setNota] = useState('');

  return (
    <View style={styles.container}>
      <View style={styles.intro}>
        <Text accessibilityRole="header" style={styles.title}>
          Flashcards
        </Text>
        <Text style={styles.subtitle}>
          Base visual lista. Esta pantalla existe para comprobar el sistema de diseño y la
          navegación; todavía no hay funcionalidades del producto.
        </Text>
      </View>

      <Message title="Estado del proyecto" variant="info">
        El entorno y la base visual están preparados. Las siguientes tareas reutilizarán estos
        componentes en lugar de crear estilos nuevos.
      </Message>

      <Card
        description="Los mismos componentes se reutilizan en cualquier pantalla."
        footer={
          <>
            <Button label="Acción principal" testID="demo-primary" />
            <Button label="Acción secundaria" testID="demo-secondary" variant="secondary" />
          </>
        }
        testID="demo-card"
        title="Componentes compartidos"
      >
        <Input
          helperText="Campo de demostración: no guarda nada."
          label="Campo de ejemplo"
          onChangeText={setNota}
          placeholder="Escribe para probar el campo"
          testID="demo-input"
          value={nota}
        />
      </Card>

      <Card title="Estados de la interfaz">
        <Loading message="Cargando contenido…" testID="demo-loading" />
        <EmptyState
          description="Así se verá una sección sin contenido todavía."
          testID="demo-empty"
          title="Sin contenido"
        />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xl,
    width: '100%',
  },
  intro: {
    gap: spacing.sm,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: typography.size.md,
    lineHeight: typography.lineHeight.md,
  },
  title: {
    color: colors.text,
    fontSize: typography.size.xxl,
    fontWeight: typography.weight.bold,
    lineHeight: typography.lineHeight.xxl,
  },
});
