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
  return {
    noInstall: args.has('--no-install'),
    noSeed: args.has('--no-seed'),
    fresh: args.has('--fresh'),
    verbose,
    quiet,
    force: args.has('--force'),
    smoke: args.has('--smoke'),
  };
}

function printHelp() {
  process.stdout.write(`Game platform startup\n\nUsage: ./startup [options]\n\nOptions:\n  --no-install   Skip dependency install\n  --no-seed      Skip db seed stage\n  --fresh        Run backend db:reset before seed\n  --smoke        Run npm run test:smoke preflight\n  --force        Continue startup on smoke failure\n  -v --verbose   Print detailed stage output\n  -q --quiet     Minimal stage output\n`);
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

function runCmd({ cmd, args, cwd, env, verbose }) {
  return new Promise((resolve) => {
    let out = '';
    const child = spawn(cmd, args, { cwd, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', (chunk) => {
      const text = String(chunk);
      out += text;
      if (verbose) process.stdout.write(text);
    });
    child.stderr.on('data', (chunk) => {
      const text = String(chunk);
      out += text;
      if (verbose) process.stderr.write(text);
    });
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
      if (opts.noInstall) return { status: 'degraded', reason: 'skipped(--no-install)' };
      const backendInstall = await runCmd({ cmd: 'npm', args: ['ci'], cwd: BACKEND_DIR, verbose: opts.verbose });
      if (backendInstall.code !== 0) throw new Error('backend install failed');
      const frontendInstall = await runCmd({ cmd: 'npm', args: ['ci'], cwd: FRONTEND_DIR, verbose: opts.verbose });
      if (frontendInstall.code !== 0) throw new Error('frontend install failed');
      if (fs.existsSync(path.join(ROOT, 'package.json'))) {
        const rootInstall = await runCmd({ cmd: 'npm', args: ['ci'], cwd: ROOT, verbose: opts.verbose });
        if (rootInstall.code !== 0) throw new Error('root install failed');
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
    await runStage('ai-health-check', async () => {
      const raw = parseEnvValue(path.join(BACKEND_DIR, '.env'), 'GEMINI_API_KEY') || process.env.GEMINI_API_KEY || '';
      const keyCheck = validateGeminiApiKey(raw.trim());
      if (!keyCheck.ok) {
        return { status: 'degraded', reason: `gemini-key-${keyCheck.reason}` };
      }
      let lastProbe = null;
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        const probe = await runCmd({
          cmd: 'node',
          args: ['-e', `import('${pathToFileURL(path.join(BACKEND_DIR, 'src/services/npat/npatGeminiHealth.js')).href}').then(async (m)=>{const r=await m.runGeminiHealthCheck();console.log(JSON.stringify(r));process.exit(r.ok?0:1);}).catch((e)=>{console.error(e?.message||String(e));process.exit(1);});`],
          cwd: BACKEND_DIR,
          verbose: opts.verbose,
        });
        lastProbe = probe;
        if (probe.code === 0) return { status: 'ok' };
        if (attempt < 2) {
          await sleep(1000);
        }
      }
      const parsed = parseProbeResult(lastProbe?.output);
      const reason = String(parsed?.reason ?? 'gemini-probe-failed');
      // Provider-side throttling should not block local startup since NPAT has controlled fallback.
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

  stages.push(
    await runStage('backend-start', async () => {
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
    }),
  );
  if (!opts.quiet) stageLine(stages.at(-1));
  if (stages.at(-1).status === 'fail') {
    summary(stages, performance.now() - startedAt);
    process.exit(1);
  }

  stages.push(
    await runStage('frontend-start', async () => {
      let frontendOutput = '';
      frontendChild = spawn(
        'npm',
        ['run', 'dev', '--', '--webpack', '-p', String(frontendPort)],
        {
          cwd: FRONTEND_DIR,
          env: { ...process.env, NEXT_DISABLE_TURBOPACK: '1' },
          stdio: opts.verbose ? 'inherit' : ['ignore', 'pipe', 'pipe'],
        },
      );
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
    }),
  );
  if (!opts.quiet) stageLine(stages.at(-1));

  summary(stages, performance.now() - startedAt);
  if (!opts.quiet) {
    console.log(`Backend:  http://localhost:${backendPort}`);
    console.log(`Frontend: http://localhost:${frontendPort}`);
  }

  await new Promise((resolve) => {
    const onChildExit = () => {
      cleanup();
      resolve();
    };
    if (backendChild) backendChild.once('exit', onChildExit);
    if (frontendChild) frontendChild.once('exit', onChildExit);
  });
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  releaseLock();
  process.exit(1);
});
