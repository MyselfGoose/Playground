import { createSocketAuthMiddleware } from '../middleware/socketAuthMiddleware.js';
import { friendshipRepository } from '../repositories/friendshipRepository.js';
import { userRepository } from '../repositories/userRepository.js';
import { createPresenceRegistry } from './presenceRegistry.js';
import { setSocialHub, clearSocialHub } from './socialHub.js';
import { avatarUrlForUsername } from '../utils/avatarUrl.js';

/**
 * @typedef {ReturnType<typeof createSocialHub>} SocialHub
 */

/**
 * @param {{
 *   socialNs: import('socket.io').Namespace,
 *   presence: ReturnType<typeof createPresenceRegistry>,
 *   logger: import('pino').Logger,
 * }} params
 */
function createSocialHub({ socialNs, presence, logger }) {
  /**
   * @param {string} userId
   */
  async function emitToUser(userId, event, payload) {
    const sockets = await socialNs.in(`user:${userId}`).fetchSockets();
    for (const remote of sockets) {
      remote.emit(event, payload);
    }
  }

  /**
   * @param {string} userId
   * @param {string} event
   * @param {unknown} payload
   */
  async function notifyFriends(userId, event, payload) {
    try {
      const friendIds = await friendshipRepository.listAcceptedFriendUserIds(userId);
      await Promise.all(friendIds.map((fid) => emitToUser(fid, event, payload)));
    } catch (err) {
      logger.warn({ err, userId, event }, 'social_notify_friends_failed');
    }
  }

  return {
    presence,
    socialNs,

    /**
     * @param {string} userId
     */
    async getOnlineFriendIds(userId) {
      const friendIds = await friendshipRepository.listAcceptedFriendUserIds(userId);
      return presence.filterOnline(friendIds);
    },

    /**
     * @param {string} recipientId
     * @param {unknown} request
     */
    notifyFriendRequestReceived(recipientId, request) {
      void emitToUser(recipientId, 'friend_request_received', { request });
    },

    /**
     * @param {string} userId
     * @param {{ friend: object, requestId: string }} payload
     */
    notifyFriendRequestAccepted(userId, payload) {
      void emitToUser(userId, 'friend_request_accepted', payload);
    },

    /**
     * @param {string} requesterId
     * @param {{ requestId: string }} payload
     */
    notifyFriendRequestDeclined(requesterId, payload) {
      void emitToUser(requesterId, 'friend_request_declined', payload);
    },

    /**
     * @param {string} recipientId
     * @param {{ requestId: string }} payload
     */
    notifyFriendRequestCancelled(recipientId, payload) {
      void emitToUser(recipientId, 'friend_request_cancelled', payload);
    },

    /**
     * @param {string} userId
     * @param {{ userId: string }} payload
     */
    notifyFriendRemoved(userId, payload) {
      void emitToUser(userId, 'friend_removed', payload);
    },

    /**
     * @param {string} userId
     * @param {string} username
     */
    async broadcastOnline(userId, username) {
      await notifyFriends(userId, 'friend_online', { userId, username });
    },

    /**
     * @param {string} userId
     * @param {string} lastSeenAt
     */
    async broadcastOffline(userId, lastSeenAt) {
      await notifyFriends(userId, 'friend_offline', { userId, lastSeenAt });
    },
  };
}

/**
 * @param {{
 *   io: import('socket.io').Server,
 *   logger: import('pino').Logger,
 *   tokenService: ReturnType<import('../services/tokenService.js').createTokenService>,
 * }} params
 */
export function attachSocialNamespace({ io, logger, tokenService }) {
  const socialNs = io.of('/social');
  const presence = createPresenceRegistry();
  const hub = createSocialHub({ socialNs, presence, logger });
  setSocialHub(hub);

  socialNs.use(createSocketAuthMiddleware({ tokenService, logger, nsTag: 'social' }));

  socialNs.on('connection', async (socket) => {
    const userId = String(socket.data.userId);
    const username = String(socket.data.username ?? '');
    socket.join(`user:${userId}`);

    logger.info({ userId, socketId: socket.id, ns: 'social' }, 'social socket connected');

    const cameOnline = presence.addSocket(userId, socket.id);
    const onlineFriendIds = await hub.getOnlineFriendIds(userId);
    socket.emit('presence_snapshot', { onlineFriendIds });

    if (cameOnline) {
      await hub.broadcastOnline(userId, username);
    }

    socket.on('disconnect', (reason) => {
      logger.info({ userId, socketId: socket.id, reason, ns: 'social' }, 'social socket disconnected');
      const result = presence.removeSocket(socket.id);
      if (result?.wentOffline) {
        void hub.broadcastOffline(result.userId, result.lastSeenAt);
      }
    });
  });

  return {
    hub,
    presence,
    close: () => {
      clearSocialHub();
    },
  };
}

export { createSocialHub };
