// expo-sqlite abre una base de datos nativa al importarse, así que cualquier
// test que llegue al store de preferencias reventaría en Node. Lo sustituimos
// por un almacén en memoria con la misma interfaz.
jest.mock('expo-sqlite/kv-store', () => {
  const mem = new Map();
  return {
    __esModule: true,
    default: {
      getItem: async (k) => mem.get(k) ?? null,
      setItem: async (k, v) => void mem.set(k, v),
      removeItem: async (k) => void mem.delete(k),
    },
  };
});
