import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Loading, Message } from '../components/ui';
import { spacing } from '../theme';

import { LibraryHistoryBridge } from './LibraryHistoryBridge';
import { LibraryProvider } from './LibraryProvider';
import { StudyHistoryProvider } from './StudyHistoryProvider';
import { createAsyncStorageRepository } from './storage/asyncStorageRepository';
import { historyPrefixFor, libraryKeyFor } from './storage/keys';
import { migrateLegacyData, type LegacyMigrationResult } from './storage/legacyMigration';
import { createStudyHistoryRepository } from './storage/studyHistoryRepository';

/**
 * Los datos locales del usuario que ha iniciado sesión.
 *
 * Hace tres cosas, y las tres son la misma idea vista desde ángulos distintos: los datos de
 * producto pertenecen a una cuenta.
 *
 * 1. **Construye los repositorios con el espacio de nombres del usuario.** Biblioteca e
 *    historial cambian de clave *a la vez*, derivadas del mismo `user.id`: no puede ocurrir
 *    que la biblioteca sea de una cuenta y el historial de otra.
 * 2. **Entrega una sola vez los datos anteriores a las cuentas** al primer usuario que
 *    inicia sesión (`src/lib/storage/legacyMigration.ts`), antes de montar nada que pueda
 *    escribir encima.
 * 3. **Se desmonta al cambiar de cuenta.** Quien lo usa le pasa `key={user.id}`, de modo que
 *    React destruye el subárbol entero y lo vuelve a crear. Sin eso, una escritura del
 *    usuario anterior encontraría el proveedor todavía vivo y acabaría en el espacio del
 *    nuevo.
 */

export type UserScopedDataProps = {
  userId: string;
  children: ReactNode;
  /**
   * Inyectable para poder ejercitar el camino de fallo.
   *
   * La migración habla con el almacenamiento real, así que sin esto su rama de error no
   * sería alcanzable desde un test y el aviso que la acompaña no se habría visto nunca.
   */
  migrate?: (userId: string) => Promise<LegacyMigrationResult>;
};

type MigrationPhase = 'pendiente' | 'lista' | 'fallida';

export function UserScopedData({
  userId,
  children,
  migrate = migrateLegacyData,
}: UserScopedDataProps) {
  const repositories = useMemo(
    () => ({
      library: createAsyncStorageRepository(libraryKeyFor(userId)),
      history: createStudyHistoryRepository(historyPrefixFor(userId)),
    }),
    [userId],
  );

  const [phase, setPhase] = useState<MigrationPhase>('pendiente');

  useEffect(() => {
    let cancelled = false;
    void migrate(userId).then((result) => {
      if (cancelled) return;
      setPhase(result.status === 'fallo' ? 'fallida' : 'lista');
    });
    return () => {
      cancelled = true;
    };
  }, [migrate, userId]);

  if (phase === 'pendiente') {
    // Montar los proveedores antes de terminar dejaría la aplicación leyendo un espacio que
    // todavía está a medio llenar, y una escritura temprana podría fijar una biblioteca
    // vacía encima de la que se está copiando.
    return (
      <View style={styles.centered} testID="datos-preparando">
        <Loading message="Preparando tus datos…" />
      </View>
    );
  }

  return (
    <LibraryProvider repository={repositories.library}>
      <StudyHistoryProvider repository={repositories.history}>
        <LibraryHistoryBridge />
        {phase === 'fallida' ? (
          // El aviso va por encima de la aplicación, y la aplicación conserva el resto del
          // alto: sin el envoltorio, el mensaje empujaría el marco fuera de la pantalla.
          <View style={styles.conAviso}>
            <View style={styles.aviso}>
              <Message testID="migracion-legacy-error" variant="error">
                No hemos podido recuperar los datos que había en este dispositivo antes de que
                existieran las cuentas. No se ha borrado nada; volveremos a intentarlo la
                próxima vez que inicies sesión.
              </Message>
            </View>
            <View style={styles.cuerpo}>{children}</View>
          </View>
        ) : (
          children
        )}
      </StudyHistoryProvider>
    </LibraryProvider>
  );
}

const styles = StyleSheet.create({
  aviso: {
    padding: spacing.lg,
  },
  conAviso: {
    flex: 1,
  },
  cuerpo: {
    flex: 1,
  },
  centered: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
});
