import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import type { LegacyMigrationResult } from '../../src/lib/storage/legacyMigration';
import { UserScopedData } from '../../src/lib/UserScopedData';

/**
 * Los tres estados de `UserScopedData`.
 *
 * El de fallo no era alcanzable desde ningún test hasta que la migración se hizo inyectable,
 * así que su aviso nunca se había visto. Aquí se ven los tres.
 */

function montar(migrate: (userId: string) => Promise<LegacyMigrationResult>) {
  return render(
    <UserScopedData migrate={migrate} userId="usuario-a">
      <Text testID="contenido">Mis mazos</Text>
    </UserScopedData>,
  );
}

describe('Preparación de los datos del usuario', () => {
  it('mientras la migración no termina, no se monta nada de la aplicación', async () => {
    // Una migración que no se resuelve: es el instante que hay que poder observar.
    montar(() => new Promise<LegacyMigrationResult>(() => undefined));

    expect(await screen.findByTestId('datos-preparando')).toBeTruthy();
    expect(screen.queryByTestId('contenido')).toBeNull();
  });

  it('cuando termina bien, la aplicación se monta sin ningún aviso', async () => {
    montar(async () => ({ status: 'sin-datos' }));

    expect(await screen.findByTestId('contenido')).toBeTruthy();
    expect(screen.queryByTestId('migracion-legacy-error')).toBeNull();
    expect(screen.queryByTestId('datos-preparando')).toBeNull();
  });

  it('cuando falla, se avisa y la aplicación se monta igualmente', async () => {
    montar(async () => ({ status: 'fallo' }));

    // El aviso importa, pero no puede dejar a nadie sin aplicación: los datos del usuario
    // están intactos y lo único que no ha ocurrido es la recuperación de los anteriores.
    expect(await screen.findByTestId('migracion-legacy-error')).toBeTruthy();
    expect(screen.getByTestId('contenido')).toBeTruthy();
    expect(screen.getByText(/No se ha borrado nada/)).toBeTruthy();
  });

  it('quien ya recibió la migración no ve ningún aviso', async () => {
    montar(async () => ({ status: 'ya-migrado', migratedTo: 'usuario-a' }));

    expect(await screen.findByTestId('contenido')).toBeTruthy();
    expect(screen.queryByTestId('migracion-legacy-error')).toBeNull();
  });
});
