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
