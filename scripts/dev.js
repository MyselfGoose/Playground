#!/usr/bin/env node
/**
 * Optional Node entry that forwards to the bash startup script (same flags).
 * Usage: node scripts/dev.js [--no-install] [--no-seed] [--fresh] [--verbose|--quiet]
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const startup = path.join(root, 'startup');

if (!fs.existsSync(startup)) {
  console.error('startup script not found at', startup);
  process.exit(1);
}

const child = spawn(startup, process.argv.slice(2), {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code, signal) => {
  if (signal) process.exit(1);
  process.exit(code ?? 0);
});
