const imported = require('@react-native-async-storage/async-storage');
// El mock oficial exporta el objeto directamente; el paquete real lo hace bajo `default`.
const AsyncStorage = imported.default ?? imported;

// El mock guarda en un objeto de módulo, así que sin esto los mazos creados en un test
// seguirían existiendo en el siguiente. Cada test arranca en limpio.
beforeEach(async () => {
  await AsyncStorage.clear();
});
