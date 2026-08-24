import type { PickedFile } from '../../features/import/types';

/**
 * Puerto de selección de archivos.
 *
 * La pantalla de importación no sabe si detrás hay un `input` del navegador o el selector de
 * iOS: pide un archivo y recibe bytes. Eso permite que un test inyecte una fixture sin tocar
 * el sistema de archivos, y que la parte que sí depende de la plataforma quepa en un archivo.
 */
export type FilePicker = () => Promise<PickFileResult>;

export type PickFileResult =
  | { status: 'ok'; file: PickedFile }
  /** La persona usuaria cerró el selector sin elegir nada. No es un error. */
  | { status: 'canceled' }
  | { status: 'error'; message: string };

/**
 * Puerto de guardado de archivos.
 *
 * La pantalla de estadísticas no sabe si detrás hay una descarga del navegador o la hoja de
 * compartir de iOS: entrega un nombre y unos bytes. Eso permite que un test inyecte un
 * guardador falso y compruebe qué se habría escrito, sin tocar el sistema de archivos.
 */
export type FileSaver = (name: string, bytes: Uint8Array) => Promise<SaveFileResult> | SaveFileResult;

export type SaveFileResult =
  | {
      status: 'ok';
      /** Cómo acabó llegando el archivo, para poder decírselo a la persona usuaria. */
      where: 'descarga' | 'compartido' | 'archivo';
      /** Ruta en el dispositivo, solo cuando no hubo hoja de compartir disponible. */
      uri?: string;
    }
  | { status: 'error'; message: string };
