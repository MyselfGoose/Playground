#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import net from 'node:net';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const BACKEND_DIR = path.join(ROOT, 'backend');
const FRONTEND_DIR = path.join(ROOT, 'frontend');
const LOCK_DIR = path.join(ROOT, '.startup.lock');
const PID_FILE = path.join(ROOT, '.startup.pid');

/** Max bytes retained from piped child stdout+stderr (tail) to bound orchestrator memory */
const RUN_CMD_CAPTURE_MAX = 65536;

/** Fewer concurrent network ops and less npm console work during ci (lighter on RAM/IO) */
const NPM_CI_ENV = {
  NPM_CONFIG_MAXSOCKETS: '1',
  NPM_CONFIG_PROGRESS: 'false',
  NPM_CONFIG_AUDIT: 'false',
  NPM_CONFIG_FUND: 'false',
};

/** @typedef {'ok'|'degraded'|'fail'} StageStatus */
/** @typedef {{ name: string, status: StageStatus, durationMs: number, reason?: string, details?: string }} StageResult */

function parseArgs(argv) {
  const args = new Set(argv);
  if (args.has('--help') || args.has('-h')) {
    printHelp();
    process.exit(0);
  }
  const verbose = args.has('--verbose') || args.has('-v');
  const quiet = args.has('--quiet') || args.has('-q');
  if (verbose && quiet) {
    throw new Error('Cannot combine --verbose and --quiet');
  }
  const wantsInstall = args.has('--install');
  const noInstall = args.has('--no-install');
  if (wantsInstall && noInstall) {
    throw new Error('Cannot combine --install and --no-install');
  }
  if (args.has('--install-root') && !wantsInstall) {
    throw new Error('--install-root requires --install');
  }
  if (args.has('--parallel-install') && !wantsInstall) {
    throw new Error('--parallel-install requires --install');
  }
  return {
    runDepsInstall: wantsInstall && !noInstall,
    noSeed: args.has('--no-seed'),
    fresh: args.has('--fresh'),
    verbose,
    quiet,
    force: args.has('--force'),
    smoke: args.has('--smoke'),
    probeGemini: args.has('--probe-gemini'),
    parallelInstall: args.has('--parallel-install'),
    parallelDev: args.has('--parallel-dev'),
    installRoot: args.has('--install-root'),
    backendOnly: args.has('--backend-only'),
    frontendOnly: args.has('--frontend-only'),
  };
}

function printHelp() {
  process.stdout.write(
    `Game platform startup\n\n` +
      `Entry: ./startup or ./startup.sh (repo root) — same script.\n\n` +
      `Usage: ./startup [options]\n\n` +
      `Options:\n` +
      `  --install          Run npm ci in backend + frontend (heavy RAM/disk). Off by default to avoid OOM.\n` +
      `  --install-root     With --install, also npm ci at repo root (use with --smoke or root test scripts)\n` +
      `  --no-install       Same as default (no npm ci). Cannot combine with --install.\n` +
      `  --no-seed          Skip db seed stage\n` +
      `  --fresh            Run backend db:reset before seed\n` +
      `  --smoke            Run npm run test:smoke (needs root node_modules → use --install --install-root first)\n` +
      `  --force            Continue startup on smoke failure\n` +
      `  --probe-gemini     After key check, run a live Gemini API probe (slow; not implied by stage name)\n` +
      `  --parallel-install With --install: run workspace npm ci jobs concurrently (very heavy)\n` +
      `  --parallel-dev     Start backend and frontend dev servers concurrently (default: serial)\n` +
      `  --backend-only     Start only the API dev server (skip Next)\n` +
      `  --frontend-only    Start only the Next dev server (skip API)\n` +
      `  -v --verbose       Print detailed stage output\n` +
      `  -q --quiet         Minimal stage output\n\n` +
      `First time: ./startup --install [--install-root if needed]\n` +
      `Daily dev:  ./startup   (starts servers only; avoids npm ci)\n` +
      `Frontend dev uses Webpack by default (frontend/package.json "dev") to reduce RAM vs Turbopack; use npm run dev:turbo in frontend/ for Turbopack.\n` +
      `Plain startup does not run npm ci, DB migrations, or the full test suite (use --install, and optionally --smoke for smoke tests).\n` +
      `If RAM is still tight during dev: add --backend-only or --frontend-only.\n\n` +
      `Gemini: stage "gemini-key-check" only validates GEMINI_API_KEY format unless --probe-gemini.\n` +
      `The API also runs a full health probe in the background after listen (see backend logs).\n`,
  );
}

function renderBanner() {
  console.log('╭──────────────────────────────────────╮');
  console.log('│         GAME PLATFORM BOOT          │');
  console.log('╰──────────────────────────────────────╯');
}

function icon(status) {
  if (status === 'ok') return '✔';
  if (status === 'degraded') return '⚠';
  return '✖';
}

function stageLine(result) {
  const suffix = result.reason ? ` (${result.reason})` : '';
  console.log(`${icon(result.status)} ${result.name} - ${result.durationMs.toFixed(0)}ms${suffix}`);
}

function summary(results, elapsedMs) {
  const failed = results.some((r) => r.status === 'fail');
  const degraded = !failed && results.some((r) => r.status === 'degraded');
  const status = failed ? 'FAILED ❌' : degraded ? 'DEGRADED ⚠️' : 'READY ✅';
  console.log('──────────────────────────────────────');
  console.log(`STATUS: ${status}`);
  console.log(`TIME: ${(elapsedMs / 1000).toFixed(1)}s`);
}

function runCmd({ cmd, args, cwd, env, verbose, discardOutput = false, maxCaptureBytes = RUN_CMD_CAPTURE_MAX }) {
  return new Promise((resolve) => {
    let out = '';
    const append = (chunk) => {
      out += String(chunk);
      if (out.length > maxCaptureBytes) out = out.slice(-maxCaptureBytes);
    };
    const stdio =
      verbose ? 'inherit' : discardOutput ? ['ignore', 'ignore', 'ignore'] : ['ignore', 'pipe', 'pipe'];
    const child = spawn(cmd, args, { cwd, env: { ...process.env, ...(env ?? {}) }, stdio });
    if (!verbose && !discardOutput) {
      child.stdout.on('data', append);
      child.stderr.on('data', append);
    }
    child.on('close', (code) => resolve({ code: code ?? 1, output: out.trim() }));
  });
}

function acquireLock() {
  try {
    fs.mkdirSync(LOCK_DIR);
    fs.writeFileSync(PID_FILE, String(process.pid));
  } catch {
    let existing = '';
    try {
      existing = fs.readFileSync(PID_FILE, 'utf8').trim();
    } catch {}
    if (existing) throw new Error(`startup already running (pid ${existing})`);
    throw new Error('startup lock acquisition failed');
  }
}

function releaseLock() {
  try {
    fs.unlinkSync(PID_FILE);
  } catch {}
  try {
    fs.rmdirSync(LOCK_DIR);
  } catch {}
}

function parseEnvValue(file, key) {
  if (!fs.existsSync(file)) return '';
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i];
    if (!line.startsWith(`${key}=`)) continue;
    return line.slice(key.length + 1).trim().replace(/^['"]|['"]$/g, '');
  }
  return '';
}

function checkPortOpen(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(500);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => resolve(false));
    socket.connect(port, host);
  });
}

async function waitForPort(port, timeoutMs = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await checkPortOpen(port)) return true;
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

function waitForChildExit(child, timeoutMs) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (payload) => {
      if (done) return;
      done = true;
      resolve(payload);
    };
    const timer = setTimeout(() => finish({ exited: false, code: null, signal: null }), timeoutMs);
    child.once('exit', (code, signal) => {
      clearTimeout(timer);
      finish({ exited: true, code: code ?? null, signal: signal ?? null });
    });
  });
}

async function runStage(name, fn) {
  const t0 = performance.now();
  try {
    const partial = await fn();
    return {
      name,
      status: partial?.status ?? 'ok',
      reason: partial?.reason,
      details: partial?.details,
      durationMs: performance.now() - t0,
    };
  } catch (err) {
    return {
      name,
      status: 'fail',
      reason: err instanceof Error ? err.message : String(err),
      durationMs: performance.now() - t0,
    };
  }
}

function validateGeminiApiKey(key) {
  if (!key) return { ok: false, reason: 'missing' };
  if (key.length < 20) return { ok: false, reason: 'too_short' };
  return { ok: true };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseProbeResult(output) {
  const text = String(output ?? '').trim();
  if (!text) return null;
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    try {
      return JSON.parse(lines[i]);
    } catch {
      // continue scanning upward for the last JSON line
    }
  }
  return null;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.backendOnly && opts.frontendOnly) {
    throw new Error('Cannot combine --backend-only and --frontend-only');
  }
  acquireLock();
  const startedAt = performance.now();
  const stages = [];
  let backendChild = null;
  let frontendChild = null;

  const cleanup = () => {
    if (backendChild && !backendChild.killed) backendChild.kill('SIGTERM');
    if (frontendChild && !frontendChild.killed) frontendChild.kill('SIGTERM');
    releaseLock();
  };
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('exit', releaseLock);

  if (!opts.quiet) renderBanner();

  stages.push(
    await runStage('system-check', async () => {
      if (!fs.existsSync(BACKEND_DIR) || !fs.existsSync(FRONTEND_DIR)) {
        throw new Error('backend/frontend directories missing');
      }
      return { status: 'ok' };
    }),
  );
  if (!opts.quiet) stageLine(stages.at(-1));

  stages.push(
    await runStage('dependency-check', async () => {
      if (!opts.runDepsInstall) {
        if (!opts.quiet) {
          console.log('');
          console.log('Skipping npm ci (default). After clone or when lockfiles change: ./startup --install');
          console.log('(Add --install-root if you use --smoke or root-level scripts.)');
          console.log('');
        }
        return { status: 'degraded', reason: 'skipped(no npm ci; use --install)' };
      }
      const rootPkg = path.join(ROOT, 'package.json');
      const installRootDeps = fs.existsSync(rootPkg) && (opts.installRoot || opts.smoke);
      const ciBase = {
        cmd: 'npm',
        args: ['ci'],
        verbose: opts.verbose,
        discardOutput: !opts.verbose,
        env: NPM_CI_ENV,
      };
      if (opts.parallelInstall) {
        const jobs = [runCmd({ ...ciBase, cwd: BACKEND_DIR }), runCmd({ ...ciBase, cwd: FRONTEND_DIR })];
        if (installRootDeps) jobs.push(runCmd({ ...ciBase, cwd: ROOT }));
        const results = await Promise.all(jobs);
        if (results[0].code !== 0) throw new Error('backend install failed');
        if (results[1].code !== 0) throw new Error('frontend install failed');
        if (results[2] && results[2].code !== 0) throw new Error('root install failed');
      } else {
        const backendInstall = await runCmd({ ...ciBase, cwd: BACKEND_DIR });
        if (backendInstall.code !== 0) throw new Error('backend install failed');
        const frontendInstall = await runCmd({ ...ciBase, cwd: FRONTEND_DIR });
        if (frontendInstall.code !== 0) throw new Error('frontend install failed');
        if (installRootDeps) {
          const rootInstall = await runCmd({ ...ciBase, cwd: ROOT });
          if (rootInstall.code !== 0) throw new Error('root install failed');
        }
      }
      return { status: 'ok' };
    }),
  );
  if (!opts.quiet) stageLine(stages.at(-1));
  if (stages.at(-1).status === 'fail') return summary(stages, performance.now() - startedAt);

  stages.push(
    await runStage('env-check', async () => {
      const envPath = path.join(BACKEND_DIR, '.env');
      if (!fs.existsSync(envPath) && fs.existsSync(path.join(BACKEND_DIR, '.env.example'))) {
        fs.copyFileSync(path.join(BACKEND_DIR, '.env.example'), envPath);
      }
      const fePath = path.join(FRONTEND_DIR, '.env.local');
      if (!fs.existsSync(fePath) && fs.existsSync(path.join(FRONTEND_DIR, '.env.example'))) {
        fs.copyFileSync(path.join(FRONTEND_DIR, '.env.example'), fePath);
      }
      return { status: 'ok' };
    }),
  );
  if (!opts.quiet) stageLine(stages.at(-1));

  stages.push(
    await runStage('db-check', async () => {
      const check = await runCmd({ cmd: 'node', args: ['scripts/checkMongo.js'], cwd: BACKEND_DIR, verbose: opts.verbose });
      if (check.code !== 0) return { status: 'degraded', reason: 'mongo-unreachable', details: check.output };
      return { status: 'ok' };
    }),
  );
  if (!opts.quiet) stageLine(stages.at(-1));

  stages.push(
    await runStage('seed-check', async () => {
      if (opts.fresh) {
        const reset = await runCmd({
          cmd: 'npm',
          args: ['run', 'db:reset'],
          cwd: BACKEND_DIR,
          env: { ALLOW_DB_RESET: 'true', NODE_ENV: 'development' },
          verbose: opts.verbose,
        });
        if (reset.code !== 0) return { status: 'degraded', reason: 'db-reset-failed' };
      }
      if (opts.noSeed) return { status: 'degraded', reason: 'skipped(--no-seed)' };
      const seed = await runCmd({ cmd: 'npm', args: ['run', 'db:seed'], cwd: BACKEND_DIR, verbose: opts.verbose });
      if (seed.code !== 0) return { status: 'degraded', reason: 'seed-failed' };
      return { status: 'ok' };
    }),
  );
  if (!opts.quiet) stageLine(stages.at(-1));

  stages.push(
    await runStage('gemini-key-check', async () => {
      const raw = parseEnvValue(path.join(BACKEND_DIR, '.env'), 'GEMINI_API_KEY') || process.env.GEMINI_API_KEY || '';
      const keyCheck = validateGeminiApiKey(raw.trim());
      if (!keyCheck.ok) {
        return { status: 'degraded', reason: `gemini-key-${keyCheck.reason}` };
      }
      if (!opts.probeGemini) {
        return { status: 'ok' };
      }
      let lastProbe = null;
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        const probe = await runCmd({
          cmd: 'node',
          args: [
            '-e',
            `import('${pathToFileURL(path.join(BACKEND_DIR, 'src/services/npat/npatGeminiHealth.js')).href}').then(async (m)=>{const r=await m.runGeminiHealthCheck();console.log(JSON.stringify(r));process.exit(r.ok?0:1);}).catch((e)=>{console.error(e?.message||String(e));process.exit(1);});`,
          ],
          cwd: BACKEND_DIR,
          verbose: opts.verbose,
          maxCaptureBytes: 262144,
        });
        lastProbe = probe;
        if (probe.code === 0) return { status: 'ok' };
        if (attempt < 2) {
          await sleep(1000);
        }
      }
      const parsed = parseProbeResult(lastProbe?.output);
      const reason = String(parsed?.reason ?? 'gemini-probe-failed');
      if (reason.includes('rate_limit') || reason.includes('quota') || reason.includes('timeout')) {
        return { status: 'ok', reason: `${reason}-fallback-enabled` };
      }
      return { status: 'degraded', reason, details: lastProbe?.output };
    }),
  );
  if (!opts.quiet) stageLine(stages.at(-1));

  if (opts.smoke) {
    stages.push(
      await runStage('smoke-tests', async () => {
        const smoke = await runCmd({ cmd: 'npm', args: ['run', 'test:smoke'], cwd: ROOT, verbose: opts.verbose });
        if (smoke.code !== 0) {
          if (opts.force) return { status: 'degraded', reason: 'smoke-failed-forced' };
          return { status: 'fail', reason: 'smoke-failed' };
        }
        return { status: 'ok' };
      }),
    );
    if (!opts.quiet) stageLine(stages.at(-1));
    if (stages.at(-1).status === 'fail') {
      summary(stages, performance.now() - startedAt);
      process.exit(1);
    }
  }

  const backendPort = Number(parseEnvValue(path.join(BACKEND_DIR, '.env'), 'PORT') || 4000);
  const frontendPort = Number(parseEnvValue(path.join(FRONTEND_DIR, '.env.local'), 'PORT') || 3000);

  const backendWanted = !opts.frontendOnly;
  const frontendWanted = !opts.backendOnly;

  const startBackendStage = async () => {
    if (!backendWanted) return { status: 'ok', reason: 'skipped(--frontend-only)' };
    let backendOutput = '';
    backendChild = spawn('npm', ['run', 'dev'], {
      cwd: BACKEND_DIR,
      stdio: opts.verbose ? 'inherit' : ['ignore', 'pipe', 'pipe'],
    });
    if (!opts.verbose) {
      backendChild.stdout?.on('data', (chunk) => {
        backendOutput += String(chunk);
        if (backendOutput.length > 8000) backendOutput = backendOutput.slice(-8000);
      });
      backendChild.stderr?.on('data', (chunk) => {
        backendOutput += String(chunk);
        if (backendOutput.length > 8000) backendOutput = backendOutput.slice(-8000);
      });
    }
    const [ready, exitedEarly] = await Promise.all([
      waitForPort(backendPort, 45000),
      waitForChildExit(backendChild, 45000),
    ]);
    if (!ready) {
      if (exitedEarly.exited) {
        return {
          status: 'fail',
          reason: `backend-exited-${exitedEarly.code ?? exitedEarly.signal ?? 'unknown'}`,
          details: backendOutput.trim().slice(-600),
        };
      }
      return {
        status: 'fail',
        reason: `port-${backendPort}-not-ready`,
        details: backendOutput.trim().slice(-600),
      };
    }
    return { status: 'ok' };
  };

  const startFrontendStage = async () => {
    if (!frontendWanted) return { status: 'ok', reason: 'skipped(--backend-only)' };
    let frontendOutput = '';
    frontendChild = spawn('npm', ['run', 'dev', '--', '-p', String(frontendPort)], {
      cwd: FRONTEND_DIR,
      stdio: opts.verbose ? 'inherit' : ['ignore', 'pipe', 'pipe'],
    });
    if (!opts.verbose) {
      frontendChild.stdout?.on('data', (chunk) => {
        frontendOutput += String(chunk);
        if (frontendOutput.length > 8000) frontendOutput = frontendOutput.slice(-8000);
      });
      frontendChild.stderr?.on('data', (chunk) => {
        frontendOutput += String(chunk);
        if (frontendOutput.length > 8000) frontendOutput = frontendOutput.slice(-8000);
      });
    }
    const [ready, exitedEarly] = await Promise.all([
      waitForPort(frontendPort, 45000),
      waitForChildExit(frontendChild, 45000),
    ]);
    if (!ready) {
      if (exitedEarly.exited) {
        return {
          status: 'fail',
          reason: `frontend-exited-${exitedEarly.code ?? exitedEarly.signal ?? 'unknown'}`,
          details: frontendOutput.trim().slice(-600),
        };
      }
      return {
        status: 'fail',
        reason: `port-${frontendPort}-not-ready`,
        details: frontendOutput.trim().slice(-600),
      };
    }
    return { status: 'ok' };
  };

  let serverStages;
  if (opts.parallelDev && backendWanted && frontendWanted) {
    serverStages = await Promise.all([
      runStage('backend-start', startBackendStage),
      runStage('frontend-start', startFrontendStage),
    ]);
  } else {
    serverStages = [];
    if (backendWanted) serverStages.push(await runStage('backend-start', startBackendStage));
    if (frontendWanted) serverStages.push(await runStage('frontend-start', startFrontendStage));
  }
  for (const s of serverStages) {
    stages.push(s);
    if (!opts.quiet) stageLine(s);
  }
  if (serverStages.some((s) => s.status === 'fail')) {
    summary(stages, performance.now() - startedAt);
    process.exit(1);
  }

  summary(stages, performance.now() - startedAt);
  if (!opts.quiet) {
    if (backendWanted && backendChild) console.log(`Backend:  http://localhost:${backendPort}`);
    if (frontendWanted && frontendChild) console.log(`Frontend: http://localhost:${frontendPort}`);
  }

  await new Promise((resolve) => {
    let settled = false;
    const onChildExit = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };
    const children = [backendChild, frontendChild].filter(Boolean);
    if (children.length === 0) {
      resolve();
      return;
    }
    for (const c of children) c.once('exit', onChildExit);
  });
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  releaseLock();
  process.exit(1);
});
