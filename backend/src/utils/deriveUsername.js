import { userRepository } from '../repositories/userRepository.js';
import { newJti } from './crypto.js';

/**
 * @param {string} raw
 */
function sanitizeUsernameBase(raw) {
  const base = String(raw || 'player')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  if (base.length >= 3) return base.slice(0, 28);
  return 'player';
}

/**
 * @param {string} displayName
 * @param {Pick<typeof userRepository, 'findByUsername'>} [users]
 */
export async function deriveUniqueUsername(displayName, users = userRepository) {
  const base = sanitizeUsernameBase(displayName);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const suffix = attempt === 0 ? '' : `_${newJti().slice(0, 6)}`;
    const candidate = `${base}${suffix}`.slice(0, 32);
    if (candidate.length < 3) continue;
    const taken = await users.findByUsername(candidate);
    if (!taken) return candidate;
  }
  return `player_${newJti().slice(0, 8)}`;
}
