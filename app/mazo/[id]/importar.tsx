import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ScreenHeader } from '../../../src/components/layout';
import {
  Button,
  Card,
  FlashcardFace,
  Loading,
  Message,
  Select,
} from '../../../src/components/ui';
import { findDeck, libraryErrorMessage } from '../../../src/features/decks/library';
import {
  buildPreview,
  describePreview,
  detectFields,
  importErrorMessage,
  mappingErrorMessage,
  parsePickedFile,
  validateMapping,
  type FieldMapping,
  type ParsedWorkbook,
} from '../../../src/features/import';
import { pickImportFile } from '../../../src/lib/files';
import type { FilePicker } from '../../../src/lib/files/types';
import { useLibrary } from '../../../src/lib/LibraryProvider';
import { goBackOr } from '../../../src/lib/navigation';
import { colors, spacing, typography } from '../../../src/theme';

/**
 * Importar tarjetas a un mazo desde un archivo .csv, .xlsx o .md.
 *
 * El orden es siempre el mismo y ningún paso se salta: elegir archivo, parsear, elegir hoja
 * si hay más de una, confirmar o corregir qué columna es cada cara, ver la vista previa y
 * solo entonces importar. Elegir el archivo no importa nada por sí solo, ni siquiera cuando
 * la detección reconoce los encabezados: proponer no es autorizar.
 */
export type ImportarScreenProps = {
  /** Inyectable para poder probar el flujo con una fixture en vez del selector del sistema. */
  filePicker?: FilePicker;
};

type Stage =
  | { kind: 'idle' }
  | { kind: 'reading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; fileName: string; workbook: ParsedWorkbook }
  | { kind: 'done'; imported: number; discarded: number };

export default function ImportarScreen({ filePicker = pickImportFile }: ImportarScreenProps) {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { library, status, importCards } = useLibrary();

  const [stage, setStage] = useState<Stage>({ kind: 'idle' });
  const [sheetIndex, setSheetIndex] = useState(0);
  const [mapping, setMapping] = useState<FieldMapping>({ front: null, back: null });
  const [importing, setImporting] = useState(false);

  const deckId = id ?? '';
  const deck = findDeck(library, deckId);
  const goToDeck = () => goBackOr(router, () => router.replace(`/mazo/${deckId}`));

  const sheet = stage.kind === 'ready' ? stage.workbook.sheets[sheetIndex] : undefined;
  const table = sheet?.table;

  const validation = useMemo(
    () => (table ? validateMapping(table, mapping) : undefined),
    [mapping, table],
  );

  const preview = useMemo(
    () => (table && validation?.ok ? buildPreview(table, mapping) : undefined),
    [mapping, table, validation],
  );

  if (status === 'loading') {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Importar" />
        <Loading message="Recuperando el mazo…" testID="import-loading" />
      </View>
    );
  }

  if (!deck) {
    return (
      <View style={styles.container}>
        <ScreenHeader
          back={{ label: 'Mis mazos', onPress: () => router.replace('/'), testID: 'back-to-decks' }}
          title="Mazo no encontrado"
        />
        <Message title="Ese mazo ya no existe" variant="error">
          Vuelve a Mis mazos y elige uno de la lista.
        </Message>
      </View>
    );
  }

  /** Elige un archivo y lo parsea. No escribe nada: solo deja el flujo listo para revisar. */
  const onPickFile = async () => {
    setStage({ kind: 'reading' });

    const picked = await filePicker();
    if (picked.status === 'canceled') {
      setStage({ kind: 'idle' });
      return;
    }
    if (picked.status === 'error') {
      setStage({ kind: 'error', message: picked.message });
      return;
    }

    const parsed = parsePickedFile(picked.file);
    if (!parsed.ok) {
      setStage({ kind: 'error', message: importErrorMessage(parsed.error) });
      return;
    }

    // Con una sola hoja no hay nada que preguntar. Con varias se elige la primera y la
    // persona usuaria puede cambiarla antes de seguir.
    const first = parsed.workbook.sheets[0]!;
    setSheetIndex(0);
    setMapping(detectFields(first.table));
    setStage({ kind: 'ready', fileName: picked.file.name, workbook: parsed.workbook });
  };

  const onChangeSheet = (index: number) => {
    if (stage.kind !== 'ready') {
      return;
    }
    const next = stage.workbook.sheets[index];
    if (next === undefined) {
      return;
    }
    setSheetIndex(index);
    // Otra hoja son otras columnas: el mapeo anterior no significa nada aquí.
    setMapping(detectFields(next.table));
  };

  const onImport = async () => {
    if (preview === undefined || preview.rows.length === 0) {
      return;
    }
    setImporting(true);
    const result = await importCards(deckId, preview.rows);
    setImporting(false);

    if (!result.ok) {
      setStage({
        kind: 'error',
        message:
          result.error === 'escritura-fallida'
            ? 'No se han podido guardar las tarjetas. No se ha importado ninguna y tu mazo sigue como estaba.'
            : libraryErrorMessage(result.error),
      });
      return;
    }

    setStage({ kind: 'done', imported: result.imported, discarded: preview.rejected.length });
  };

  const columnOptions =
    table?.columns.map((column, index) => ({
      value: index,
      label: column.trim().length > 0 ? column : `Columna ${index + 1}`,
    })) ?? [];

  return (
    <View style={styles.container}>
      <ScreenHeader
        back={{ label: deck.name, onPress: goToDeck, testID: 'back-to-deck' }}
        subtitle={`Las tarjetas se añadirán a "${deck.name}"`}
        title="Importar tarjetas"
      />

      {stage.kind === 'done' ? (
        <>
          <Message testID="import-result" title="Importación terminada" variant="success">
            {resultMessage(stage.imported, stage.discarded)}
          </Message>
          <View style={styles.actions}>
            <Button label="Volver al mazo" onPress={goToDeck} testID="import-done-back" />
            <Button
              label="Importar otro archivo"
              onPress={() => {
                setStage({ kind: 'idle' });
                setMapping({ front: null, back: null });
              }}
              testID="import-again"
              variant="secondary"
            />
          </View>
        </>
      ) : (
        <>
          <Card
            description="Se aceptan archivos .csv, .xlsx y .md. El archivo no se modifica: solo se lee."
            title="1. Elegir archivo"
          >
            <Button
              label={stage.kind === 'ready' ? 'Elegir otro archivo' : 'Elegir archivo'}
              loading={stage.kind === 'reading'}
              onPress={onPickFile}
              testID="pick-file-button"
            />
            {stage.kind === 'ready' ? (
              <Text style={styles.fileName} testID="import-file-name">
                {stage.fileName}
              </Text>
            ) : null}
          </Card>

          {stage.kind === 'error' ? (
            <Message testID="import-error" title="No se ha podido importar" variant="error">
              {stage.message}
            </Message>
          ) : null}

          {stage.kind === 'ready' && table ? (
            <>
              {stage.workbook.sheets.length > 1 ? (
                <Card
                  description="Este archivo tiene varias hojas con datos. Elige de cuál quieres importar."
                  title="2. Elegir hoja"
                >
                  <Select
                    label="Hoja"
                    onChange={onChangeSheet}
                    options={stage.workbook.sheets.map((entry, index) => ({
                      value: index,
                      label: entry.name,
                    }))}
                    testID="sheet-select"
                    value={sheetIndex}
                  />
                </Card>
              ) : null}

              <Card
                description="Comprueba que cada columna está donde debe. Puedes cambiarlo aunque se haya reconocido solo."
                title={`${stage.workbook.sheets.length > 1 ? '3' : '2'}. Frente y reverso`}
              >
                <Select
                  label="Frente"
                  onChange={(index) => setMapping((current) => ({ ...current, front: index }))}
                  options={columnOptions}
                  placeholder="No se ha reconocido: elige la columna del frente."
                  testID="front-select"
                  value={mapping.front}
                />
                <Select
                  label="Reverso"
                  onChange={(index) => setMapping((current) => ({ ...current, back: index }))}
                  options={columnOptions}
                  placeholder="No se ha reconocido: elige la columna del reverso."
                  testID="back-select"
                  value={mapping.back}
                />
                {validation && !validation.ok ? (
                  <Message testID="mapping-error" variant="error">
                    {mappingErrorMessage(validation.error)}
                  </Message>
                ) : null}
              </Card>

              {preview ? (
                <Card
                  description={describePreview(preview)}
                  title={`${stage.workbook.sheets.length > 1 ? '4' : '3'}. Vista previa`}
                >
                  {preview.rows.length === 0 ? (
                    <Message testID="preview-empty" variant="error">
                      {mappingErrorMessage('sin-filas-validas')}
                    </Message>
                  ) : (
                    <>
                      <View style={styles.sample} testID="import-preview">
                        {preview.sample.map((row, index) => (
                          <View key={`${row.front}-${index}`} style={styles.sampleRow}>
                            <FlashcardFace label="Frente" text={row.front} />
                            <FlashcardFace label="Reverso" text={row.back} tone="back" />
                          </View>
                        ))}
                      </View>
                      {preview.rows.length > preview.sample.length ? (
                        <Text style={styles.more} testID="import-preview-more">
                          Y {preview.rows.length - preview.sample.length} tarjetas más.
                        </Text>
                      ) : null}
                      {preview.rejected.length > 0 ? (
                        <Message testID="import-issues" variant="info">
                          {issuesMessage(preview.rejected.map((entry) => entry.line))}
                        </Message>
                      ) : null}
                      <Button
                        label={`Importar ${preview.rows.length} ${
                          preview.rows.length === 1 ? 'tarjeta' : 'tarjetas'
                        }`}
                        loading={importing}
                        onPress={onImport}
                        testID="confirm-import-button"
                      />
                    </>
                  )}
                </Card>
              ) : null}
            </>
          ) : null}
        </>
      )}
    </View>
  );
}

function resultMessage(imported: number, discarded: number): string {
  const cards = imported === 1 ? 'Se ha importado 1 tarjeta' : `Se han importado ${imported} tarjetas`;
  if (discarded === 0) {
    return `${cards}.`;
  }
  const rows =
    discarded === 1 ? '1 fila se ha descartado' : `${discarded} filas se han descartado`;
  return `${cards}. ${rows} por tener el frente o el reverso vacío.`;
}

/** Se enumeran las filas descartadas para que se puedan corregir en el archivo original. */
function issuesMessage(lines: readonly number[]): string {
  const shown = lines.slice(0, 10).join(', ');
  const rest = lines.length > 10 ? ` y ${lines.length - 10} más` : '';
  const prefix = lines.length === 1 ? 'Se descartará la fila' : 'Se descartarán las filas';
  return `${prefix} ${shown}${rest} del archivo: les falta el frente o el reverso.`;
}

const styles = StyleSheet.create({
  actions: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  container: {
    gap: spacing.xl,
    width: '100%',
  },
  fileName: {
    color: colors.textMuted,
    fontSize: typography.size.sm,
  },
  more: {
    color: colors.textMuted,
    fontSize: typography.size.sm,
  },
  sample: {
    gap: spacing.md,
    width: '100%',
  },
  sampleRow: {
    borderColor: colors.border,
    borderRadius: spacing.sm,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
});
