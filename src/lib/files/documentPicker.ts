import * as DocumentPicker from 'expo-document-picker';
import { Platform } from 'react-native';

import { SUPPORTED_MIME_TYPES } from '../../features/import/parsers';

import type { FilePicker, PickFileResult } from './types';

/**
 * Implementación real del puerto de selección de archivos.
 *
 * Es el único archivo del proyecto que conoce expo-document-picker y expo-file-system, igual
 * que `asyncStorageRepository.ts` es el único que conoce AsyncStorage.
 *
 * En web el selector devuelve el `File` del navegador y se lee con `arrayBuffer()`. En iOS y
 * Android devuelve un `uri` y hay que leerlo con expo-file-system, cuya implementación web es
 * un stub: por eso las dos ramas y no una sola.
 */
export const pickImportFile: FilePicker = async (): Promise<PickFileResult> => {
  let result: DocumentPicker.DocumentPickerResult;
  try {
    result = await DocumentPicker.getDocumentAsync({
      type: [...SUPPORTED_MIME_TYPES],
      copyToCacheDirectory: true,
      multiple: false,
    });
  } catch {
    return { status: 'error', message: 'No se ha podido abrir el selector de archivos.' };
  }

  if (result.canceled) {
    return { status: 'canceled' };
  }

  const asset = result.assets[0];
  if (asset === undefined) {
    return { status: 'canceled' };
  }

  try {
    const bytes = await readAsset(asset);
    return { status: 'ok', file: { name: asset.name, bytes } };
  } catch {
    return { status: 'error', message: 'No se ha podido leer el archivo elegido.' };
  }
};

async function readAsset(asset: DocumentPicker.DocumentPickerAsset): Promise<Uint8Array> {
  if (Platform.OS === 'web') {
    // `file` es el File del navegador. Si por lo que sea no viene, queda el uri de blob.
    const blob: Blob =
      asset.file ?? (await fetch(asset.uri).then((response) => response.blob()));
    return new Uint8Array(await blob.arrayBuffer());
  }

  // Import perezoso: en web este módulo solo emite avisos y no hay motivo para cargarlo.
  const { File } = await import('expo-file-system');
  return new File(asset.uri).bytes();
}
