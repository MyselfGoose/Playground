import { PlatformSettings } from '../models/PlatformSettings.js';

/** @type {{
 *   maintenanceMode: boolean,
 *   maintenanceMessage: string,
 *   googleOAuthEnabled: boolean,
 *   blockNewRooms: boolean,
 *   disabledGames: string[],
 *   updatedAt: string | null,
 * }} */
let cache = {
  maintenanceMode: false,
  maintenanceMessage: '',
  googleOAuthEnabled: true,
  blockNewRooms: false,
  disabledGames: [],
  updatedAt: null,
};

/**
 * @param {Record<string, unknown> | null | undefined} doc
 */
function docToCache(doc) {
  return {
    maintenanceMode: Boolean(doc?.maintenanceMode),
    maintenanceMessage: typeof doc?.maintenanceMessage === 'string' ? doc.maintenanceMessage : '',
    googleOAuthEnabled: doc?.googleOAuthEnabled !== false,
    blockNewRooms: Boolean(doc?.blockNewRooms),
    disabledGames: Array.isArray(doc?.disabledGames)
      ? doc.disabledGames.map((g) => String(g))
      : [],
    updatedAt: doc?.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
  };
}

/**
 * @param {boolean} envDefault
 */
export async function loadPlatformSettingsCache(envDefault = true) {
  let doc = await PlatformSettings.findById('platform').lean();
  if (!doc) {
    doc = await PlatformSettings.findByIdAndUpdate(
      'platform',
      {
        $setOnInsert: {
          maintenanceMode: false,
          maintenanceMessage: '',
          googleOAuthEnabled: envDefault,
          blockNewRooms: false,
          disabledGames: [],
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();
  }
  cache = docToCache(doc);
  return { ...cache };
}

export function getMaintenanceCached() {
  return {
    maintenanceMode: cache.maintenanceMode,
    maintenanceMessage: cache.maintenanceMessage,
    updatedAt: cache.updatedAt,
  };
}

export function getPlatformSettingsCached() {
  return { ...cache };
}

/**
 * @param {Partial<typeof cache>} overrides
 */
export function setPlatformSettingsCacheForTests(overrides) {
  cache = { ...cache, ...overrides };
}

/**
 * @param {{ maintenanceMode: boolean, maintenanceMessage?: string, updatedBy: string }} params
 */
export async function setMaintenanceMode({ maintenanceMode, maintenanceMessage = '', updatedBy }) {
  const doc = await PlatformSettings.findByIdAndUpdate(
    'platform',
    {
      $set: {
        maintenanceMode: Boolean(maintenanceMode),
        maintenanceMessage: maintenanceMessage.slice(0, 500),
        updatedBy,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();

  cache = docToCache(doc);
  return getMaintenanceCached();
}

/**
 * @param {{ googleOAuthEnabled: boolean, updatedBy: string }} params
 */
export async function setGoogleOAuthEnabled({ googleOAuthEnabled, updatedBy }) {
  const doc = await PlatformSettings.findByIdAndUpdate(
    'platform',
    { $set: { googleOAuthEnabled: Boolean(googleOAuthEnabled), updatedBy } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();
  cache = docToCache(doc);
  return { googleOAuthEnabled: cache.googleOAuthEnabled, updatedAt: cache.updatedAt };
}

/**
 * @param {{ blockNewRooms: boolean, updatedBy: string }} params
 */
export async function setBlockNewRooms({ blockNewRooms, updatedBy }) {
  const doc = await PlatformSettings.findByIdAndUpdate(
    'platform',
    { $set: { blockNewRooms: Boolean(blockNewRooms), updatedBy } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();
  cache = docToCache(doc);
  return { blockNewRooms: cache.blockNewRooms, updatedAt: cache.updatedAt };
}

/**
 * @param {{ disabledGames: string[], updatedBy: string }} params
 */
export async function setDisabledGames({ disabledGames, updatedBy }) {
  const normalized = [...new Set(disabledGames.map((g) => String(g).trim()).filter(Boolean))];
  const doc = await PlatformSettings.findByIdAndUpdate(
    'platform',
    { $set: { disabledGames: normalized, updatedBy } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();
  cache = docToCache(doc);
  return { disabledGames: cache.disabledGames, updatedAt: cache.updatedAt };
}

export async function getPlatformSettings() {
  return { ...cache };
}
