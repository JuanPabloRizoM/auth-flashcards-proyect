import RootLayout from '../../app/_layout';
import ComponentesScreen from '../../app/componentes';
import MisMazosScreen from '../../app/index';
import EstudiarScreen from '../../app/mazo/[id]/estudiar';
import DetalleMazoScreen from '../../app/mazo/[id]/index';

/** Mapa de rutas reales compartido por los tests de integración. */
export const routes = {
  _layout: RootLayout,
  index: MisMazosScreen,
  componentes: ComponentesScreen,
  'mazo/[id]/index': DetalleMazoScreen,
  'mazo/[id]/estudiar': EstudiarScreen,
};
