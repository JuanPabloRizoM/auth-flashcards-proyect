import { expect, test, type Page } from '@playwright/test';
import { conSesion } from './support/auth';

// Estas pruebas no van de acceso, pero desde TASK-008 la aplicación lo exige: se parte
// de una sesión ya iniciada. El acceso tiene sus propias suites.
test.beforeEach(async ({ page }) => {
  await conSesion(page);
});

async function crearMazo(page: Page, nombre: string) {
  await page.getByTestId('deck-name-input').fill(nombre);
  await page.getByTestId('create-deck-button').click();
}

async function anadirCarta(page: Page, frente: string, reverso: string) {
  await page.getByTestId('card-front-input').fill(frente);
  await page.getByTestId('card-back-input').fill(reverso);
  await page.getByTestId('add-card-button').click();
}

test.describe('Persistencia local', () => {
  test('los mazos y sus cartas sobreviven a una recarga', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('decks-empty')).toBeVisible();

    await crearMazo(page, 'Inglés');
    await page.getByTestId('deck-mazo-1').click();
    await anadirCarta(page, 'to overlook', 'pasar por alto');
    await expect(page.getByText('to overlook')).toBeVisible();

    // Recarga real del navegador: se pierde todo el estado de React.
    await page.reload();

    await expect(page.getByTestId('cards-list')).toBeVisible();
    await expect(page.getByText('to overlook')).toBeVisible();
    await expect(page.getByText('pasar por alto')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Inglés' })).toBeVisible();

    // Y desde la raíz el mazo sigue listado con su recuento.
    await page.getByTestId('nav-mazos').click();
    await expect(page.getByTestId('deck-mazo-1')).toContainText('Inglés');
    await expect(page.getByTestId('deck-mazo-1')).toContainText('1 carta');
  });

  test('varios mazos se restauran de forma independiente', async ({ page }) => {
    await page.goto('/');
    await crearMazo(page, 'Inglés');
    await crearMazo(page, 'Alemán');

    await page.reload();

    await expect(page.getByTestId('decks-list')).toBeVisible();
    await expect(page.getByTestId('deck-mazo-1')).toContainText('Inglés');
    await expect(page.getByTestId('deck-mazo-2')).toContainText('Alemán');
    await expect(page.getByTestId('decks-empty')).toHaveCount(0);
  });

  test('la restauración no duplica los datos tras varias recargas', async ({ page }) => {
    await page.goto('/');
    await crearMazo(page, 'Inglés');

    await page.reload();
    await expect(page.getByTestId('decks-list')).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('decks-list')).toBeVisible();

    await expect(page.getByTestId('deck-mazo-1')).toHaveCount(1);
    await expect(page.getByText('1 mazo')).toBeVisible();
  });

  test('un almacenamiento vacío muestra el estado vacío, no un error', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByTestId('decks-empty')).toBeVisible();
    await expect(page.getByTestId('storage-error')).toHaveCount(0);
  });

  test('no se muestra un estado vacío falso mientras se recuperan los datos', async ({ page }) => {
    await page.goto('/');
    await crearMazo(page, 'Inglés');
    await expect(page.getByTestId('decks-list')).toBeVisible();

    await page.reload();

    // En ningún momento del arranque aparece "no tienes mazos" teniendo uno guardado.
    await expect(page.getByTestId('decks-list')).toBeVisible();
    await expect(page.getByTestId('decks-empty')).toHaveCount(0);
  });
});

test.describe('Unicidad de mazos', () => {
  test('no deja crear un nombre repetido ignorando mayúsculas y espacios', async ({ page }) => {
    await page.goto('/');
    await crearMazo(page, 'Inglés');
    await expect(page.getByTestId('decks-list')).toBeVisible();

    await crearMazo(page, '  INGLÉS  ');

    await expect(page.getByRole('alert')).toContainText('Ya tienes un mazo con ese nombre');
    await expect(page.getByTestId('deck-mazo-1')).toHaveCount(1);
  });

  test('el rechazo del duplicado sobrevive a la recarga', async ({ page }) => {
    await page.goto('/');
    await crearMazo(page, ' Inglés ');
    await expect(page.getByTestId('decks-list')).toBeVisible();

    await page.reload();
    await expect(page.getByTestId('decks-list')).toBeVisible();

    await crearMazo(page, 'inglés');

    await expect(page.getByRole('alert')).toContainText('Ya tienes un mazo con ese nombre');
  });
});

test.describe('Estabilidad del stack de navegación', () => {
  // Regresión del crecimiento que QA midió tras TASK-003: 15 ciclos dejaban 16 instancias
  // montadas de Mis mazos, la mayoría invisibles. Se cuentan TODAS las instancias del DOM,
  // visibles o no: mirar solo la visible daría verde con el bug presente.
  test('15 ciclos detalle -> destino de primer nivel no acumulan instancias', async ({ page }) => {
    await page.goto('/');
    await crearMazo(page, 'Inglés');
    await expect(page.getByTestId('decks-list')).toBeVisible();

    for (let ciclo = 0; ciclo < 15; ciclo += 1) {
      await page.getByTestId('deck-mazo-1').click();
      await expect(page.getByTestId('add-card-button')).toBeVisible();

      await page.getByTestId('nav-mazos').click();
      await expect(page.getByTestId('decks-list')).toBeVisible();
    }

    // Una sola instancia de la pantalla de destino, no dieciséis.
    expect(await page.getByTestId('create-deck-button').count()).toBe(1);
    expect(await page.getByTestId('add-card-button').count()).toBe(0);

    // Y el recorrido sigue funcionando después de todas las vueltas.
    await page.getByTestId('deck-mazo-1').click();
    await expect(page.getByTestId('add-card-button')).toBeVisible();
    await page.getByTestId('back-to-decks').click();
    await expect(page.getByTestId('decks-list')).toBeVisible();
  });

  test('alternar entre destinos de primer nivel tampoco acumula', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('create-deck-button')).toBeVisible();

    for (let ciclo = 0; ciclo < 10; ciclo += 1) {
      await page.getByTestId('nav-componentes').click();
      await expect(page.getByTestId('catalogo-button-primary')).toBeVisible();
      await page.getByTestId('nav-mazos').click();
      await expect(page.getByTestId('create-deck-button')).toBeVisible();
    }

    expect(await page.getByTestId('create-deck-button').count()).toBe(1);
    expect(await page.getByTestId('catalogo-button-primary').count()).toBe(0);
  });

  test('ninguna pantalla invisible conserva datos escritos antes', async ({ page }) => {
    await page.goto('/');
    await crearMazo(page, 'Inglés');
    await page.getByTestId('deck-mazo-1').click();

    // Se escribe algo sin confirmar y se sale por el destino de primer nivel.
    await page.getByTestId('card-front-input').fill('borrador sin guardar');
    await page.getByTestId('nav-mazos').click();
    await expect(page.getByTestId('decks-list')).toBeVisible();

    // La pantalla anterior no debe seguir montada guardando ese borrador.
    expect(await page.getByTestId('card-front-input').count()).toBe(0);

    await page.getByTestId('deck-mazo-1').click();
    await expect(page.getByTestId('card-front-input')).toHaveValue('');
  });
});
