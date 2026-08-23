import { expect, test, type Page } from '@playwright/test';

/**
 * Editar y eliminar mazos y cartas en el navegador real, comprobando que el resultado
 * sobrevive a `page.reload()`: no basta con que la pantalla cambie, tiene que estar guardado.
 */

async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

async function crearMazo(page: Page, nombre: string) {
  await page.getByTestId('deck-name-input').fill(nombre);
  await page.getByTestId('create-deck-button').click();
}

async function anadirCarta(page: Page, frente: string, reverso: string) {
  await page.getByTestId('card-front-input').fill(frente);
  await page.getByTestId('card-back-input').fill(reverso);
  await page.getByTestId('add-card-button').click();
}

async function abrirMazo(page: Page, id: string) {
  await page.getByTestId(`deck-${id}`).click();
  await expect(page.getByTestId('add-card-button')).toBeVisible();
}

test.describe('Renombrar un mazo', () => {
  test('el nombre nuevo sobrevive a la recarga y las cartas siguen siendo suyas', async ({ page }) => {
    await page.goto('/');
    await crearMazo(page, 'Ingles');
    await abrirMazo(page, 'mazo-1');
    await anadirCarta(page, 'to overlook', 'pasar por alto');

    await page.getByTestId('rename-deck-button').click();
    await page.getByTestId('rename-deck-input').fill('Inglés');
    await page.getByTestId('rename-deck-save').click();

    await expect(page.getByRole('heading', { name: 'Inglés' })).toBeVisible();

    await page.reload();

    await expect(page.getByRole('heading', { name: 'Inglés' })).toBeVisible();
    await expect(page.getByText('to overlook')).toBeVisible();
    await expect(page.getByText('1 carta')).toBeVisible();
  });

  test('cancelar deja el nombre como estaba', async ({ page }) => {
    await page.goto('/');
    await crearMazo(page, 'Inglés');
    await abrirMazo(page, 'mazo-1');

    await page.getByTestId('rename-deck-button').click();
    await page.getByTestId('rename-deck-input').fill('Otro nombre');
    await page.getByTestId('rename-deck-cancel').click();

    await expect(page.getByTestId('rename-deck-input')).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Inglés' })).toBeVisible();
  });

  test('el rechazo de un nombre duplicado es visible y sobrevive a la recarga', async ({ page }) => {
    await page.goto('/');
    await crearMazo(page, 'Inglés');
    await crearMazo(page, 'Alemán');
    await abrirMazo(page, 'mazo-2');

    await page.getByTestId('rename-deck-button').click();
    await page.getByTestId('rename-deck-input').fill('  inglés  ');
    await page.getByTestId('rename-deck-save').click();

    await expect(page.getByText('Ya tienes un mazo con ese nombre. Elige otro.')).toBeVisible();

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Alemán' })).toBeVisible();
  });
});

test.describe('Eliminar un mazo', () => {
  /**
   * El escenario del enunciado:
   *
   * ```text
   * Mazo A ── Carta 1, Carta 2      Mazo B ── Carta 3
   * ```
   */
  async function escenarioAB(page: Page) {
    await page.goto('/');
    await crearMazo(page, 'Mazo A');
    await abrirMazo(page, 'mazo-1');
    await anadirCarta(page, 'Carta 1', 'Uno');
    await anadirCarta(page, 'Carta 2', 'Dos');
    await page.getByTestId('back-to-decks').click();
    await expect(page.getByTestId('decks-list')).toBeVisible();

    await crearMazo(page, 'Mazo B');
    await abrirMazo(page, 'mazo-4');
    await anadirCarta(page, 'Carta 3', 'Tres');
    await page.getByTestId('back-to-decks').click();
    await expect(page.getByTestId('decks-list')).toBeVisible();
  }

  test('la confirmación avisa de que también se borran las cartas', async ({ page }) => {
    await escenarioAB(page);
    await abrirMazo(page, 'mazo-1');

    await page.getByTestId('delete-deck-button').click();

    const dialogo = page.getByTestId('delete-confirm');
    await expect(dialogo).toBeVisible();
    await expect(dialogo).toContainText('Mazo A');
    await expect(dialogo).toContainText('las 2 cartas que contiene');
  });

  test('cancelar la confirmación no borra nada', async ({ page }) => {
    await escenarioAB(page);
    await abrirMazo(page, 'mazo-1');

    await page.getByTestId('delete-deck-button').click();
    await page.getByTestId('delete-confirm-cancel').click();
    await expect(page.getByTestId('delete-confirm')).toBeHidden();

    await page.reload();
    await expect(page.getByText('Carta 1')).toBeVisible();
    await expect(page.getByText('Carta 2')).toBeVisible();
  });

  test('borra el mazo y sus cartas, y deja intacto el otro mazo, también tras recargar', async ({
    page,
  }) => {
    await escenarioAB(page);
    await abrirMazo(page, 'mazo-1');

    await page.getByTestId('delete-deck-button').click();
    await page.getByTestId('delete-confirm-confirm').click();

    // Al desaparecer el mazo se vuelve a la biblioteca.
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId('deck-mazo-1')).toHaveCount(0);

    await page.reload();
    await expect(page.getByTestId('deck-mazo-1')).toHaveCount(0);
    await expect(page.getByTestId('deck-mazo-4')).toContainText('Mazo B');

    // Mazo B conserva su carta: la cascada no se llevó nada de más.
    await abrirMazo(page, 'mazo-4');
    await expect(page.getByText('Carta 3')).toBeVisible();
    await expect(page.getByText('Carta 1')).toHaveCount(0);
    await expect(page.getByText('Carta 2')).toHaveCount(0);
  });
});

test.describe('Editar y eliminar cartas', () => {
  test('cambiar el reverso queda guardado tras recargar', async ({ page }) => {
    await page.goto('/');
    await crearMazo(page, 'Geografía');
    await abrirMazo(page, 'mazo-1');
    await anadirCarta(page, 'Capital de Francia', 'Londres');

    await page.getByTestId('edit-card-carta-2').click();
    await page.getByTestId('edit-card-back-carta-2').fill('París');
    await page.getByTestId('save-card-carta-2').click();

    await expect(page.getByText('París')).toBeVisible();

    await page.reload();
    await expect(page.getByText('Capital de Francia')).toBeVisible();
    await expect(page.getByText('París')).toBeVisible();
    await expect(page.getByText('Londres')).toHaveCount(0);
  });

  test('cancelar la edición no cambia la carta', async ({ page }) => {
    await page.goto('/');
    await crearMazo(page, 'Geografía');
    await abrirMazo(page, 'mazo-1');
    await anadirCarta(page, 'Capital de Francia', 'Londres');

    await page.getByTestId('edit-card-carta-2').click();
    await page.getByTestId('edit-card-back-carta-2').fill('París');
    await page.getByTestId('cancel-card-carta-2').click();

    await page.reload();
    await expect(page.getByText('Londres')).toBeVisible();
    await expect(page.getByText('París')).toHaveCount(0);
  });

  test('una cara vacía se rechaza con un mensaje visible', async ({ page }) => {
    await page.goto('/');
    await crearMazo(page, 'Geografía');
    await abrirMazo(page, 'mazo-1');
    await anadirCarta(page, 'Capital de Francia', 'Londres');

    await page.getByTestId('edit-card-carta-2').click();
    await page.getByTestId('edit-card-back-carta-2').fill('   ');
    await page.getByTestId('save-card-carta-2').click();

    await expect(page.getByTestId('edit-card-error-carta-2')).toBeVisible();
  });

  test('eliminar una carta deja el mazo y las demás cartas', async ({ page }) => {
    await page.goto('/');
    await crearMazo(page, 'Inglés');
    await abrirMazo(page, 'mazo-1');
    await anadirCarta(page, 'one', 'uno');
    await anadirCarta(page, 'two', 'dos');

    // Se localiza por testID y no por texto: "one" también aparece dentro de "Componentes".
    await page.getByTestId('delete-card-carta-2').click();
    await expect(page.getByTestId('delete-confirm')).toBeVisible();
    await page.getByTestId('delete-confirm-cancel').click();
    await expect(page.getByTestId('card-carta-2')).toBeVisible();

    await page.getByTestId('delete-card-carta-2').click();
    await page.getByTestId('delete-confirm-confirm').click();

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Inglés' })).toBeVisible();
    await expect(page.getByTestId('card-carta-3')).toContainText('two');
    await expect(page.getByTestId('card-carta-2')).toHaveCount(0);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });
});

test.describe('Mis mazos como biblioteca', () => {
  async function tresMazos(page: Page) {
    await page.goto('/');
    await crearMazo(page, 'Inglés');
    await crearMazo(page, 'anatomía');
    await crearMazo(page, 'Química');
    await expect(page.getByTestId('decks-list')).toBeVisible();
  }

  test('la búsqueda filtra sin distinguir mayúsculas y se limpia', async ({ page }) => {
    await tresMazos(page);

    await page.getByTestId('deck-search-input').fill('ANATOMÍA');
    await expect(page.getByTestId('deck-mazo-2')).toBeVisible();
    await expect(page.getByTestId('deck-mazo-1')).toHaveCount(0);

    await page.getByTestId('deck-search-clear').click();
    await expect(page.getByTestId('deck-mazo-1')).toBeVisible();
    await expect(page.getByTestId('deck-mazo-3')).toBeVisible();
  });

  test('una búsqueda sin resultados muestra su propio estado vacío', async ({ page }) => {
    await tresMazos(page);

    await page.getByTestId('deck-search-input').fill('alemán');

    await expect(page.getByTestId('decks-search-empty')).toBeVisible();
    await expect(page.getByTestId('decks-empty')).toHaveCount(0);

    await page.getByTestId('decks-search-empty-clear').click();
    await expect(page.getByTestId('decks-list')).toBeVisible();
  });

  test('el orden elegido cambia la lista', async ({ page }) => {
    await tresMazos(page);

    const nombres = async () =>
      page.locator('[data-testid^="deck-mazo-"]').evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute('aria-label')?.replace('Abrir el mazo ', '') ?? ''),
      );

    expect(await nombres()).toEqual(['anatomía', 'Inglés', 'Química']);

    await page.getByTestId('deck-sort-nombre-desc').click();
    expect(await nombres()).toEqual(['Química', 'Inglés', 'anatomía']);

    await page.getByTestId('deck-sort-reciente').click();
    expect(await nombres()).toEqual(['Química', 'anatomía', 'Inglés']);

    await page.getByTestId('deck-sort-antiguo').click();
    expect(await nombres()).toEqual(['Inglés', 'anatomía', 'Química']);
  });

  test('cada mazo muestra su recuento de cartas y su fecha, sin overflow', async ({ page }) => {
    await page.goto('/');
    await crearMazo(page, 'Inglés');
    await abrirMazo(page, 'mazo-1');
    await anadirCarta(page, 'one', 'uno');
    await page.getByTestId('back-to-decks').click();

    await expect(page.getByTestId('deck-mazo-1')).toContainText('1 carta');
    await expect(page.getByTestId('deck-mazo-1')).toContainText('Modificado el');
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });
});
