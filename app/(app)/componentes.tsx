import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  Button,
  Card,
  EmptyState,
  FlashcardFace,
  Input,
  Loading,
  Message,
} from '../../src/components/ui';
import { colors, spacing, typography } from '../../src/theme';

/**
 * Catálogo del sistema visual.
 *
 * Segunda ruta de la navegación base. Muestra las variantes de cada componente
 * compartido para poder revisarlas de un vistazo. No contiene lógica de producto.
 */
export default function ComponentesScreen() {
  const [conError, setConError] = useState('valor no válido');

  return (
    <View style={styles.container}>
      <View style={styles.intro}>
        <Text accessibilityRole="header" style={styles.title}>
          Componentes
        </Text>
        <Text style={styles.subtitle}>
          Catálogo de los componentes compartidos y sus variantes.
        </Text>
      </View>

      <Card title="Button">
        <View style={styles.row}>
          <Button label="Primario" testID="catalogo-button-primary" />
          <Button label="Secundario" variant="secondary" />
          <Button label="Ghost" variant="ghost" />
          <Button disabled label="Deshabilitado" testID="catalogo-button-disabled" />
          <Button label="Cargando" loading testID="catalogo-button-loading" />
        </View>
      </Card>

      <Card title="Input">
        <Input
          helperText="Texto de ayuda opcional."
          label="Campo normal"
          onChangeText={() => {}}
          placeholder="Placeholder"
          value=""
        />
        <Input
          error="Este campo tiene un error de ejemplo."
          label="Campo con error"
          onChangeText={setConError}
          testID="catalogo-input-error"
          value={conError}
        />
      </Card>

      <Card title="Message">
        <Message title="Información" variant="info">
          Mensaje informativo.
        </Message>
        <Message title="Correcto" variant="success">
          Mensaje de confirmación.
        </Message>
        <Message title="Error" variant="error">
          Mensaje de error.
        </Message>
      </Card>

      <Card title="FlashcardFace">
        <FlashcardFace label="Frente" text="to overlook" />
        <FlashcardFace label="Reverso" text="pasar por alto" tone="back" />
      </Card>

      <Card title="Loading y EmptyState">
        <Loading />
        <EmptyState
          action={<Button label="Acción opcional" variant="secondary" />}
          description="Con descripción y acción opcional."
          title="Sin elementos"
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
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
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
