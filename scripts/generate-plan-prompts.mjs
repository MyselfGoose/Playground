#!/usr/bin/env node
/**
 * Regenerates plan/phases/**/NNN-*.md from embedded catalog.
 * Run from repo root: node scripts/generate-plan-prompts.mjs
 *
 * Prefer not to re-run after manual prompt edits unless intentional.
 */
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const py = path.join(dir, 'generate-plan-prompts.py');

try {
  execSync(`python3 "${py}"`, { stdio: 'inherit', cwd: path.join(dir, '..') });
} catch {
  console.error('Run: python3 scripts/generate-plan-prompts.py');
  process.exit(1);
}
