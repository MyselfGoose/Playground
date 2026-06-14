import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { createTokenService } from '../services/tokenService.js';
import { createNpatRoomRegistry } from '../games/npat/roomManager.js';
import { installNpatSocketServer } from '../games/npat/npatSocket.js';
import { createTypingRaceRegistry } from '../games/typing-race/roomRegistry.js';
import { installTypingRaceSocketServer } from '../games/typing-race/typingRaceSocket.js';
import { attachTabooNamespace } from '../games/taboo/tabooSocket.js';
import { attachCahNamespace } from '../games/cah/cahSocket.js';
import { attachHangmanNamespace } from '../games/hangman/hangmanSocket.js';

/**
 * Wire Redis pub/sub adapter when REDIS_URL is configured (Tier B broadcast sync).
 * Room authority remains in-process until shared room store ships.
 *
 * @param {import('socket.io').Server} io
 * @param {string} redisUrl
 * @param {import('pino').Logger} logger
 */
async function attachRedisAdapterIfConfigured(io, redisUrl, logger) {
  if (!redisUrl) return null;

  const pubClient = createClient({ url: redisUrl });
  const subClient = pubClient.duplicate();

  pubClient.on('error', (err) => {
    logger.warn({ err, event: 'redis_pub_error' }, 'socket_io');
  });
  subClient.on('error', (err) => {
    logger.warn({ err, event: 'redis_sub_error' }, 'socket_io');
  });

  await Promise.all([pubClient.connect(), subClient.connect()]);
  io.adapter(createAdapter(pubClient, subClient));
  logger.info({ event: 'redis_adapter_attached' }, 'socket_io');

  return { pubClient, subClient };
}

/**
 * Attach Socket.IO and register all game namespaces on the HTTP server.
 *
 * @param {{
 *   server: import('node:http').Server,
 *   env: import('../config/env.js').Env,
 *   logger: import('pino').Logger,
 * }} params
 * @returns {Promise<{
 *   io: import('socket.io').Server,
 *   registry: ReturnType<import('../games/npat/roomManager.js').createNpatRoomRegistry>,
 *   typingRaceRegistry: ReturnType<import('../games/typing-race/roomRegistry.js').createTypingRaceRegistry>,
 *   tabooRuntime: { close: () => void },
 *   cahRuntime: { close: () => void },
 *   hangmanRuntime: { close: () => void },
 *   redisClients: { pubClient: import('redis').RedisClientType, subClient: import('redis').RedisClientType } | null,
 * }>}
 */
export async function attachSocketIo({ server, env, logger }) {
  const origins = env.CORS_ORIGIN.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const originOpt = origins.length === 1 ? origins[0] : origins;

  const io = new Server(server, {
    path: '/socket.io',
    cors: { origin: originOpt, credentials: true },
    serveClient: false,
    pingInterval: 15000,
    pingTimeout: 10000,
    connectionStateRecovery: {
      maxDisconnectionDuration: 120_000,
      skipMiddlewares: false,
    },
  });

  const redisClients = await attachRedisAdapterIfConfigured(io, env.REDIS_URL, logger);

  const tokenService = createTokenService(env);
  const npatNs = io.of('/npat');
  const registry = createNpatRoomRegistry({ env, logger, npatNs });
  installNpatSocketServer({ npatNs, registry, env, logger, tokenService });

  const typingRaceNs = io.of('/typing-race');
  const typingRaceRegistry = createTypingRaceRegistry({ typingNs: typingRaceNs, logger });
  installTypingRaceSocketServer({
    typingRaceNs,
    registry: typingRaceRegistry,
    logger,
    tokenService,
  });
  const tabooRuntime = attachTabooNamespace({ io, logger, tokenService });
  const cahRuntime = attachCahNamespace({ io, logger, tokenService, env });
  const hangmanRuntime = attachHangmanNamespace({ io, logger, tokenService });

  logger.info('socket_io_attached');
  return { io, registry, typingRaceRegistry, tabooRuntime, cahRuntime, hangmanRuntime, redisClients };
}
