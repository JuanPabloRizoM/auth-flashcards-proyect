import { Platform } from 'react-native';

import type { FileSaver, SaveFileResult } from './types';

/**
 * Implementación real del puerto de guardado de archivos.
 *
 * Es el único archivo que conoce cómo entrega un archivo cada plataforma, igual que
 * `documentPicker.ts` es el único que sabe cómo se elige uno.
 *
 * **Web.** Se construye un `Blob` y se dispara una descarga con un enlace temporal. Es lo
 * que hace que el PDF acabe en la carpeta de descargas de la persona usuaria.
 *
 * **iOS y Android.** No hay carpeta de descargas a la que escribir directamente: el archivo
 * se guarda en el directorio de caché de la aplicación y se ofrece con la hoja de compartir
 * del sistema, que es donde se elige guardarlo en Archivos, mandarlo o abrirlo con otra
 * aplicación.
 *
 * **Limitación conocida.** La rama nativa no se ha ejecutado nunca en dispositivo ni en
 * simulador: el gate E2E de este proyecto es solo web, igual que ya ocurre con la lectura
 * de archivos de TASK-005. Está tipada y aislada, pero no probada.
 */
export const savePdfFile: FileSaver = async (name, bytes): Promise<SaveFileResult> => {
  if (Platform.OS === 'web') {
    return saveOnWeb(name, bytes);
  }
  return saveOnNative(name, bytes);
};

function saveOnWeb(name: string, bytes: Uint8Array): SaveFileResult {
  if (typeof document === 'undefined' || typeof URL?.createObjectURL !== 'function') {
    return { status: 'error', message: 'Este navegador no permite descargar el archivo.' };
  }

  try {
    // `slice()` produce un ArrayBuffer propio: el buffer del Uint8Array puede ser mayor.
    const blob = new Blob([bytes.slice().buffer], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Liberar de inmediato cancelaría la descarga en algunos navegadores.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return { status: 'ok', where: 'descarga' };
  } catch {
    return { status: 'error', message: 'No se ha podido descargar el archivo.' };
  }
}

async function saveOnNative(name: string, bytes: Uint8Array): Promise<SaveFileResult> {
  try {
    // Imports perezosos: en web estos módulos son stubs y no hay motivo para cargarlos.
    const { Directory, File, Paths } = await import('expo-file-system');
    const target = new File(new Directory(Paths.cache), name);
    if (target.exists) target.delete();
    target.create();
    target.write(bytes);

    const Sharing = await import('expo-sharing');
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(target.uri, {
        mimeType: 'application/pdf',
        UTI: 'com.adobe.pdf',
        dialogTitle: 'Guardar o compartir el reporte',
      });
      return { status: 'ok', where: 'compartido' };
    }

    return { status: 'ok', where: 'archivo', uri: target.uri };
  } catch {
    return { status: 'error', message: 'No se ha podido guardar el archivo en este dispositivo.' };
  }
}
