import { Server } from 'socket.io';
import { createTokenService } from '../services/tokenService.js';
import { createNpatRoomRegistry } from '../games/npat/roomManager.js';
import { installNpatSocketServer } from '../games/npat/npatSocket.js';
import { createTypingRaceRegistry } from '../games/typing-race/roomRegistry.js';
import { installTypingRaceSocketServer } from '../games/typing-race/typingRaceSocket.js';
import { attachTabooNamespace } from '../games/taboo/tabooSocket.js';
import { attachCahNamespace } from '../games/cah/cahSocket.js';
import { attachHangmanNamespace } from '../games/hangman/hangmanSocket.js';

/**
 * Attach Socket.IO and register all game namespaces on the HTTP server.
 *
 * @param {{
 *   server: import('node:http').Server,
 *   env: import('../config/env.js').Env,
 *   logger: import('pino').Logger,
 * }} params
 * @returns {{
 *   io: import('socket.io').Server,
 *   registry: ReturnType<import('../games/npat/roomManager.js').createNpatRoomRegistry>,
 *   typingRaceRegistry: ReturnType<import('../games/typing-race/roomRegistry.js').createTypingRaceRegistry>,
 *   tabooRuntime: { close: () => void },
 *   cahRuntime: { close: () => void },
 *   hangmanRuntime: { close: () => void },
 * }}
 */
export function attachSocketIo({ server, env, logger }) {
  const origins = env.CORS_ORIGIN.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const originOpt = origins.length === 1 ? origins[0] : origins;

  const io = new Server(server, {
    path: '/socket.io',
    cors: { origin: originOpt, credentials: true },
    serveClient: false,
  });

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
  return { io, registry, typingRaceRegistry, tabooRuntime, cahRuntime, hangmanRuntime };
}
