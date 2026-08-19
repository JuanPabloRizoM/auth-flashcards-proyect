/**
 * Reglas de navegación del proyecto.
 *
 * Hay dos clases de destino y cada una necesita un gesto distinto:
 *
 * - **Destinos de primer nivel** (Mis mazos, Componentes): no se apilan, se sustituyen.
 * - **Pantallas de detalle** (un mazo, el estudio): sí se apilan y vuelven al nivel anterior.
 */

export type BackCapableRouter = {
  canGoBack: () => boolean;
  back: () => void;
};

/**
 * Vuelta atrás desde una pantalla de detalle.
 *
 * Usar `replace` para volver dejaría montada la instancia anterior de la pantalla destino y
 * duplicaría su contenido. Se sale del apilado con `back`, y solo se recurre al fallback
 * cuando no hay historial: por ejemplo al abrir un enlace directo a la pantalla de estudio.
 */
export function goBackOr(router: BackCapableRouter, fallback: () => void): void {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  fallback();
}

/**
 * Ir a un destino de primer nivel desde cualquier punto.
 *
 * `replace` a secas sustituye solo la pantalla de arriba y deja intactas las de debajo, así
 * que ir a un mazo y volver al destino con `replace` dejaba el apilado en `/`, `/`. Repetido,
 * el apilado y las instancias montadas crecían sin límite (QA lo midió en TASK-003: 16
 * instancias tras 15 ciclos).
 *
 * `dismissAll` vacía el apilado hasta su raíz antes de sustituirla, de modo que la
 * profundidad se mantiene en 1 por muchas vueltas que se den.
 */
export function goToTopLevel(
  router: { canDismiss: () => boolean; dismissAll: () => void },
  replace: () => void,
): void {
  if (router.canDismiss()) {
    router.dismissAll();
  }
  replace();
}
