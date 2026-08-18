/**
 * Vuelta atrás para las pantallas de detalle, que sí se apilan.
 *
 * Usar `replace` para volver dejaría montada la instancia anterior de la pantalla destino
 * y duplicaría su contenido. Se sale del apilado con `back`, y solo se recurre a `replace`
 * cuando no hay historial: por ejemplo al abrir un enlace directo a la pantalla de estudio.
 */
export type BackCapableRouter = {
  canGoBack: () => boolean;
  back: () => void;
};

export function goBackOr(router: BackCapableRouter, fallback: () => void): void {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  fallback();
}
