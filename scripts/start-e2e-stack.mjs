#!/usr/bin/env node
/**
 * Full-stack server for Playwright E2E: in-memory Mongo, API + Socket.IO, Next.js with API proxy.
 * Playwright webServer runs this script and waits for PLAYWRIGHT_BASE_URL to respond.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import http from 'node:http';
import {
  startMongoMemoryServer,
  stopMongoMemoryServer,
  connectMongoose,
} from '../tests/support/mongoTestHarness.js';
import { applyTestEnv } from '../tests/support/testEnv.js';
import { startSocketTestStack } from '../tests/support/socketTestStack.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const frontendPort = Number(process.env.E2E_FRONTEND_PORT) || 3000;
const frontendUrl = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${frontendPort}`;
const skipBuild = process.env.SKIP_E2E_BUILD === '1';

/** @type {import('node:child_process').ChildProcess | null} */
let frontendProc = null;
/** @type {Awaited<ReturnType<typeof startSocketTestStack>> | null} */
let stack = null;

function log(msg) {
  console.log(`[e2e-stack] ${msg}`);
}

/**
 * @param {string} url
 * @param {number} timeoutMs
 */
async function waitForHttpOk(url, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

/**
 * @param {string} cmd
 * @param {string[]} args
 * @param {Record<string, string>} env
 */
function runAndWait(cmd, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: repoRoot,
      stdio: 'inherit',
      env: { ...process.env, ...env },
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve(undefined);
      else reject(new Error(`${cmd} ${args.join(' ')} exited ${code}`));
    });
  });
}

async function shutdown(signal) {
  log(`Shutting down (${signal})…`);
  if (frontendProc && !frontendProc.killed) {
    frontendProc.kill('SIGTERM');
  }
  if (stack) {
    try {
      await stack.stop();
    } catch {
      /* ignore */
    }
    stack = null;
  }
  try {
    await stopMongoMemoryServer();
  } catch {
    /* ignore */
  }
  process.exit(0);
}

async function main() {
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  log('Starting MongoDB Memory Server…');
  const mongoUri = await startMongoMemoryServer();
  await connectMongoose();

  log('Starting API + Socket.IO…');
  const corsOrigin = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${frontendPort}`;
  const envWithCors = applyTestEnv({
    MONGO_URI: mongoUri,
    GEMINI_MOCK_MODE: 'true',
    GEMINI_MOCK_MODE: 'true',
    CORS_ORIGIN: corsOrigin,
  });
  stack = await startSocketTestStack(envWithCors);
  const backendUrl = stack.baseUrl;
  log(`Backend listening at ${backendUrl}`);

  await waitForHttpOk(`${backendUrl}/health/ready`, 30_000);

  /** NEXT_PUBLIC_* are inlined at build time — must match backend URL before `next build`. */
  const frontendEnv = {
    NODE_ENV: 'production',
    API_PROXY_TARGET: backendUrl,
    BACKEND_URL: backendUrl,
    NEXT_PUBLIC_SAME_ORIGIN_API: '1',
    NEXT_PUBLIC_SOCKET_URL: backendUrl,
  };

  if (!skipBuild) {
    log('Building frontend (set SKIP_E2E_BUILD=1 to skip)…');
    await runAndWait('npm', ['run', 'build', '--prefix', 'frontend'], frontendEnv);
  }

  log(`Starting Next.js on ${frontendUrl}…`);
  frontendProc = spawn('npm', ['run', 'start', '--prefix', 'frontend'], {
    cwd: repoRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      ...frontendEnv,
      PORT: String(frontendPort),
    },
  });

  frontendProc.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      log(`Frontend exited with code ${code}`);
      process.exit(code ?? 1);
    }
  });

  await waitForHttpOk(frontendUrl, 180_000);
  log(`Ready — ${frontendUrl} (API proxy → ${backendUrl})`);

  // Keep process alive for Playwright webServer
  await new Promise(() => {});
}

main().catch((err) => {
  console.error('[e2e-stack] FATAL:', err);
  process.exit(1);
});
