// AsyncStorage necesita su módulo nativo, que no existe bajo Jest. El paquete publica un
// mock oficial en memoria; se registra aquí para que los tests puedan montar el proveedor
// real sin depender de la plataforma.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
