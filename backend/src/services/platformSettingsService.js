import { PlatformSettings } from '../models/PlatformSettings.js';

/** @type {{ maintenanceMode: boolean, maintenanceMessage: string, updatedAt: string | null }} */
let cache = {
  maintenanceMode: false,
  maintenanceMessage: '',
  updatedAt: null,
};

export async function loadPlatformSettingsCache() {
  const doc = await PlatformSettings.findById('platform').lean();
  cache = {
    maintenanceMode: Boolean(doc?.maintenanceMode),
    maintenanceMessage: doc?.maintenanceMessage ?? '',
    updatedAt: doc?.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
  };
  return { ...cache };
}

export function getMaintenanceCached() {
  return { ...cache };
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

  cache = {
    maintenanceMode: Boolean(doc?.maintenanceMode),
    maintenanceMessage: doc?.maintenanceMessage ?? '',
    updatedAt: doc?.updatedAt ? new Date(doc.updatedAt).toISOString() : new Date().toISOString(),
  };

  return { ...cache };
}

export async function getPlatformSettings() {
  await loadPlatformSettingsCache();
  return { ...cache };
}
