/** @type {readonly ['name', 'place', 'animal', 'thing']} */
export const NPAT_FIELDS = /** @type {const} */ (['name', 'place', 'animal', 'thing']);

/** @typedef {(typeof NPAT_FIELDS)[number]} NpatField */

export const DEFAULT_TEAMS = [
  { id: 'A', name: 'Team A', color: '#7c3aed' },
  { id: 'B', name: 'Team B', color: '#0ea5e9' },
];
