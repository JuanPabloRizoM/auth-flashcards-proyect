import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '../../theme';

export type StatsTableColumn = {
  key: string;
  header: string;
  align?: 'left' | 'right';
  /** Peso de la columna al repartir el ancho. */
  flex?: number;
};

export type StatsTableRow = {
  key: string;
  cells: readonly string[];
  /** Lo que anuncia un lector de pantalla para la fila entera. */
  accessibilityLabel: string;
  /** Marca la fila como referida a algo que ya no existe. */
  muted?: boolean;
};

export type StatsTableProps = {
  columns: readonly StatsTableColumn[];
  rows: readonly StatsTableRow[];
  emptyMessage: string;
  testID?: string;
};

/**
 * Tabla de comparación.
 *
 * Cada fila lleva su etiqueta accesible completa, con el nombre de cada columna y su valor:
 * leída en voz alta, una fila se entiende sin haber visto el encabezado.
 */
export function StatsTable({ columns, rows, emptyMessage, testID }: StatsTableProps) {
  if (rows.length === 0) {
    return (
      <View style={styles.empty} testID={testID ? `${testID}-empty` : undefined}>
        <Text style={styles.emptyText}>{emptyMessage}</Text>
      </View>
    );
  }

  return (
    <View style={styles.table} testID={testID}>
      <View style={[styles.row, styles.headerRow]}>
        {columns.map((column) => (
          <Text
            key={column.key}
            numberOfLines={2}
            style={[
              styles.header,
              { flex: column.flex ?? 1 },
              column.align === 'right' ? styles.right : null,
            ]}
          >
            {column.header}
          </Text>
        ))}
      </View>

      {rows.map((row) => (
        <View
          accessibilityLabel={row.accessibilityLabel}
          key={row.key}
          style={styles.row}
          testID={testID ? `${testID}-fila-${row.key}` : undefined}
        >
          {row.cells.map((cell, index) => {
            const column = columns[index];
            return (
              <Text
                key={column?.key ?? String(index)}
                numberOfLines={2}
                style={[
                  styles.cell,
                  { flex: column?.flex ?? 1 },
                  column?.align === 'right' ? styles.right : null,
                  row.muted ? styles.cellMuted : null,
                ]}
              >
                {cell}
              </Text>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  cell: {
    color: colors.text,
    fontSize: typography.size.sm,
    minWidth: 0,
  },
  cellMuted: {
    color: colors.textMuted,
  },
  empty: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: spacing.lg,
    width: '100%',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
  },
  header: {
    color: colors.textMuted,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    letterSpacing: typography.letterSpacing.label,
    minWidth: 0,
    textTransform: 'uppercase',
  },
  headerRow: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
  },
  right: {
    textAlign: 'right',
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    width: '100%',
  },
  table: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    width: '100%',
  },
});
