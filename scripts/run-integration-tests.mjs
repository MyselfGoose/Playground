#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');

/** @param {string} dir */
async function collectTestFiles(dir) {
  /** @type {string[]} */
  const out = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const ent of entries) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) {
      out.push(...(await collectTestFiles(p)));
    } else if (ent.isFile() && ent.name.endsWith('.test.js')) {
      out.push(p);
    }
  }
  return out.sort();
}

const integrationRoot = join(root, 'tests', 'integration');
const files = await collectTestFiles(integrationRoot);
if (files.length === 0) {
  console.error('No integration tests found under', integrationRoot);
  process.exit(1);
}

const child = spawn(process.execPath, ['--test', ...files], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code, signal) => {
  if (signal) process.exit(1);
  process.exit(code ?? 1);
});
