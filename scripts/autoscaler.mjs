import Redis from 'ioredis';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const MIN_WORKERS = parseInt(process.env.MIN_WORKERS || '1', 10);
const MAX_WORKERS = parseInt(process.env.MAX_WORKERS || '8', 10);
const JOBS_PER_WORKER = parseInt(process.env.JOBS_PER_WORKER || '1', 10);
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '2000', 10);
const COOLDOWN_MS = parseInt(process.env.COOLDOWN_MS || '10000', 10);

const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);

// Find docker-compose file
function findComposeFile() {
  const candidates = [
    path.resolve(__dirname, '../docker-compose.e2e.yml'),
    path.resolve(__dirname, '../../workflow-orchestration-engine/docker-compose.e2e.yml'),
    path.resolve(process.cwd(), 'docker-compose.e2e.yml'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return path.resolve(__dirname, '../docker-compose.e2e.yml');
}

const COMPOSE_FILE = findComposeFile();

const redis = new Redis({
  host: REDIS_HOST,
  port: REDIS_PORT,
  maxRetriesPerRequest: 3,
});

let currentScale = 1;
let isScaling = false;
let cooldownStart = null;
let running = true;

async function getRunningWorkerCount() {
  try {
    const { stdout } = await execAsync('docker ps --filter "name=dtp-worker" --filter "status=running" --format "{{.Names}}"');
    const lines = stdout.trim().split(/\r?\n/).filter(Boolean);
    return lines.length > 0 ? lines.length : MIN_WORKERS;
  } catch (err) {
    return currentScale;
  }
}

async function scaleWorkers(targetWorkers, reason) {
  if (isScaling) return;
  isScaling = true;

  const target = Math.min(MAX_WORKERS, Math.max(MIN_WORKERS, targetWorkers));
  console.log(`\n[AUTOSCALER] [${new Date().toISOString()}] Scaling ${target > currentScale ? 'UP' : 'DOWN'} from ${currentScale} -> ${target} workers`);
  console.log(`[AUTOSCALER] Reason: ${reason}`);

  try {
    const cmd = `docker compose -f "${COMPOSE_FILE}" up -d --no-build --scale dtp-worker=${target}`;
    await execAsync(cmd);
    currentScale = target;
    cooldownStart = null;
    console.log(`[AUTOSCALER] Successfully adjusted worker fleet to ${currentScale} (limit: max ${MAX_WORKERS})`);
  } catch (err) {
    console.error(`[AUTOSCALER] Failed to scale workers:`, err.message);
  } finally {
    isScaling = false;
  }
}

async function checkLoadAndAutoscale() {
  if (!running || isScaling) return;

  try {
    const [critical, high, medium, low, main, processing] = await Promise.all([
      redis.llen('queue:critical'),
      redis.llen('queue:high'),
      redis.llen('queue:medium'),
      redis.llen('queue:low'),
      redis.llen('main-queue'),
      redis.llen('processing-queue'),
    ]);

    const pending = critical + high + medium + low + main;
    const totalLoad = pending + processing;

    let targetWorkers = MIN_WORKERS;
    if (totalLoad > 0) {
      targetWorkers = Math.min(MAX_WORKERS, Math.max(MIN_WORKERS, Math.ceil(totalLoad / JOBS_PER_WORKER)));
    }

    // Publish autoscaler telemetry into Redis for dashboards/observers
    await redis.set(
      'autoscaler:telemetry',
      JSON.stringify({
        currentWorkers: currentScale,
        targetWorkers,
        totalLoad,
        pending,
        processing,
        maxWorkers: MAX_WORKERS,
        minWorkers: MIN_WORKERS,
        updatedAt: new Date().toISOString(),
      }),
      'EX',
      10
    );

    // Scale Up: Immediate reaction
    if (targetWorkers > currentScale) {
      cooldownStart = null;
      await scaleWorkers(targetWorkers, `Pending queue load=${pending}, In-flight=${processing}, Total=${totalLoad}`);
    }
    // Scale Down: Graceful cooldown to prevent flapping
    else if (targetWorkers < currentScale) {
      const now = Date.now();
      if (!cooldownStart) {
        cooldownStart = now;
        console.log(`[AUTOSCALER] [${new Date().toISOString()}] Load decreased (total=${totalLoad}, target=${targetWorkers}). Starting cooldown (${COOLDOWN_MS / 1000}s)...`);
      } else if (now - cooldownStart >= COOLDOWN_MS) {
        await scaleWorkers(targetWorkers, `Load stayed normalized for ${COOLDOWN_MS / 1000}s (total=${totalLoad})`);
      }
    } else {
      cooldownStart = null;
    }
  } catch (err) {
    console.error(`[AUTOSCALER] Error in monitor loop:`, err.message);
  }
}

async function start() {
  console.log('='.repeat(65));
  console.log('  DTP DYNAMIC WORKER AUTOSCALER');
  console.log('='.repeat(65));
  console.log(`* Redis:           ${REDIS_HOST}:${REDIS_PORT}`);
  console.log(`* Compose File:    ${COMPOSE_FILE}`);
  console.log(`* Scale Limits:    Min: ${MIN_WORKERS} | Max: ${MAX_WORKERS}`);
  console.log(`* Jobs/Worker:     ${JOBS_PER_WORKER}`);
  console.log(`* Check Interval:  ${POLL_INTERVAL_MS}ms`);
  console.log(`* Cooldown Period: ${COOLDOWN_MS}ms`);
  console.log('='.repeat(65));

  currentScale = await getRunningWorkerCount();
  console.log(`[AUTOSCALER] Current active workers detected: ${currentScale}`);

  setInterval(checkLoadAndAutoscale, POLL_INTERVAL_MS);
}

function handleShutdown() {
  console.log('\n[AUTOSCALER] Stopping autoscaler...');
  running = false;
  redis.quit();
  process.exit(0);
}

process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);

start();

