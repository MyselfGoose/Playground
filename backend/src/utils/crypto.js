import { createHash, randomUUID } from 'node:crypto';

export function sha256Hex(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function newJti() {
  return randomUUID();
}
