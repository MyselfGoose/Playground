/** @type {Array<() => { game: string, rooms: number, players: number }>} */
const snapshotProviders = [];

/**
 * @param {() => { game: string, rooms: number, players: number }} provider
 */
export function registerLiveActivityProvider(provider) {
  snapshotProviders.push(provider);
}

export function getLiveActivitySnapshot() {
  return snapshotProviders.map((fn) => {
    try {
      return fn();
    } catch {
      return { game: 'unknown', rooms: 0, players: 0 };
    }
  });
}

export function clearLiveActivityProviders() {
  snapshotProviders.length = 0;
}
