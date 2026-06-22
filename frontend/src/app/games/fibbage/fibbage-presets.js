/** @type {Record<string, { id: string, label: string, description: string, roundCount: number, writingSeconds: number, votingSeconds: number }>} */
export const FIBBAGE_PRESETS = {
  classic: {
    id: "classic",
    label: "Classic",
    description: "Balanced pace for most groups",
    roundCount: 5,
    writingSeconds: 90,
    votingSeconds: 45,
  },
  blitz: {
    id: "blitz",
    label: "Blitz",
    description: "Fast lies, quick votes — ~10 min games",
    roundCount: 3,
    writingSeconds: 45,
    votingSeconds: 30,
  },
  marathon: {
    id: "marathon",
    label: "Marathon",
    description: "More rounds, more time to craft lies",
    roundCount: 8,
    writingSeconds: 120,
    votingSeconds: 60,
  },
};

export const PRESET_ORDER = ["classic", "blitz", "marathon"];

/**
 * @param {string | undefined} presetId
 */
export function presetLabel(presetId) {
  if (presetId && FIBBAGE_PRESETS[presetId]) {
    return FIBBAGE_PRESETS[presetId].label;
  }
  if (presetId === "custom") return "Custom";
  return "Classic";
}
