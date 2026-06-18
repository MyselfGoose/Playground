import { AppError } from '../errors/AppError.js';
import { friendshipRepository } from '../repositories/friendshipRepository.js';
import { userRepository } from '../repositories/userRepository.js';
import { getSocialHub } from '../realtime/socialHub.js';
import { avatarUrlForUsername } from '../utils/avatarUrl.js';
import { resolveUserAvatar } from '../utils/resolveUserAvatar.js';

/**
 * @param {{ _id?: unknown, id?: unknown, username?: string, avatarUrl?: string, avatarEmoji?: string, isActive?: boolean }} user
 */
function toUserStub(user) {
  const id = user._id != null ? String(user._id) : user.id != null ? String(user.id) : '';
  const username = typeof user.username === 'string' ? user.username : '';
  const { avatarUrl, avatarEmoji } = resolveUserAvatar(user);
  return {
    userId: id,
    id,
    username,
    avatarUrl,
    avatarEmoji,
  };
}

/**
 * @param {string} viewerId
 * @param {{ requesterId: string, recipientId: string, status: string } | null} directed
 * @param {{ requesterId: string, recipientId: string, status: string } | null} reverse
 */
function resolveRelationship(viewerId, directed, reverse) {
  if (directed?.status === 'accepted' || reverse?.status === 'accepted') return 'friends';
  if (reverse?.status === 'pending') return 'pending_received';
  if (directed?.status === 'pending') return 'pending_sent';
  if (directed?.status === 'declined') return 'declined_sent';
  if (reverse?.status === 'declined') return 'declined_received';
  return 'none';
}

/**
 * @param {{ id: string, requesterId: string, recipientId: string, status: string, createdAt?: Date, respondedAt?: Date | null }} row
 * @param {Record<string, { userId: string, username: string, avatarUrl: string }>} userMap
 * @param {'sent'|'received'} direction
 */
function mapPendingRow(row, userMap, direction) {
  const otherId = direction === 'sent' ? row.recipientId : row.requesterId;
  const other = userMap[otherId];
  if (direction === 'received') {
    return {
      id: row.id,
      from: other ?? { userId: otherId, id: otherId, username: 'Unknown', avatarUrl: avatarUrlForUsername('player') },
      createdAt: row.createdAt,
    };
  }
  return {
    id: row.id,
    to: other ?? { userId: otherId, id: otherId, username: 'Unknown', avatarUrl: avatarUrlForUsername('player') },
    status: row.status === 'declined' ? 'declined' : 'pending',
    createdAt: row.createdAt,
    respondedAt: row.respondedAt ?? null,
  };
}

export function createFriendsService(deps = {}) {
  const friendshipRepo = deps.friendshipRepository ?? friendshipRepository;
  const userRepo = deps.userRepository ?? userRepository;
  /**
   * @param {string} username
   */
  async function resolveActiveUserByUsername(username) {
    const user = await userRepo.findByUsername(username);
    if (!user || user.isActive === false) {
      throw new AppError(404, 'User not found', { code: 'USER_NOT_FOUND', expose: true });
    }
    return user;
  }

  /**
   * @param {string[]} userIds
   */
  async function loadUserMap(userIds) {
    /** @type {Record<string, { userId: string, username: string, avatarUrl: string }>} */
    const map = {};
    const unique = [...new Set(userIds.filter(Boolean))];
    await Promise.all(
      unique.map(async (id) => {
        const user = await userRepo.findByIdLean(id);
        if (user) map[id] = toUserStub(user);
      }),
    );
    return map;
  }

  /**
   * @param {string} userId
   * @param {import('../realtime/presenceRegistry.js').ReturnType<import('../realtime/presenceRegistry.js').createPresenceRegistry>} [presence]
   */
  async function getSummary(userId, presence) {
    const [accepted, pendingReceived, pendingSent] = await Promise.all([
      friendshipRepo.listAcceptedFriends(userId),
      friendshipRepo.listPendingReceived(userId),
      friendshipRepo.listSentByUser(userId),
    ]);

    const friendIds = accepted.map((f) =>
      f.requesterId === userId ? f.recipientId : f.requesterId,
    );
    const relatedIds = [
      ...friendIds,
      ...pendingReceived.map((r) => r.requesterId),
      ...pendingSent.map((s) => s.recipientId),
    ];
    const userMap = await loadUserMap(relatedIds);

    const onlineIds = presence ? presence.filterOnline(friendIds) : [];
    const onlineSet = new Set(onlineIds);

    const friends = friendIds.map((fid) => {
      const stub = userMap[fid];
      return {
        userId: fid,
        username: stub?.username ?? 'Unknown',
        avatarUrl: stub?.avatarUrl ?? avatarUrlForUsername('player'),
        online: onlineSet.has(fid),
        lastSeenAt: presence && !onlineSet.has(fid) ? presence.getLastSeenAt(fid) : null,
      };
    });

    friends.sort((a, b) => {
      if (a.online !== b.online) return a.online ? -1 : 1;
      return a.username.localeCompare(b.username);
    });

    return {
      friends,
      pending: {
        received: pendingReceived.map((r) => mapPendingRow(r, userMap, 'received')),
        sent: pendingSent.map((s) => mapPendingRow(s, userMap, 'sent')),
      },
      counts: {
        online: onlineIds.length,
        pendingReceived: pendingReceived.length,
      },
    };
  }

  /**
   * @param {string} requesterId
   * @param {string} username
   */
  async function sendRequest(requesterId, username) {
    const target = await resolveActiveUserByUsername(username);
    const targetId = String(target._id);

    if (targetId === requesterId) {
      throw new AppError(400, 'Cannot friend yourself', {
        code: 'CANNOT_FRIEND_SELF',
        expose: true,
      });
    }

    const [outgoing, incoming] = await Promise.all([
      friendshipRepo.findDirected(requesterId, targetId),
      friendshipRepo.findDirected(targetId, requesterId),
    ]);

    if (outgoing?.status === 'accepted' || incoming?.status === 'accepted') {
      throw new AppError(409, 'Already friends', { code: 'ALREADY_FRIENDS', expose: true });
    }

    if (incoming?.status === 'pending') {
      const accepted = await friendshipRepo.transitionStatus(incoming.id, 'pending', 'accepted');
      if (!accepted) {
        throw new AppError(404, 'Friend request not found', {
          code: 'FRIEND_REQUEST_NOT_FOUND',
          expose: true,
        });
      }
      const requester = await userRepo.findByIdLean(requesterId);
      const hub = getSocialHub();
      if (hub && requester) {
        hub.notifyFriendRequestAccepted(targetId, {
          friend: toUserStub(requester),
          requestId: accepted.id,
        });
        hub.notifyFriendRequestAccepted(requesterId, {
          friend: toUserStub(target),
          requestId: accepted.id,
        });
      }
      return { friendship: accepted, autoAccepted: true };
    }

    if (outgoing?.status === 'pending') {
      throw new AppError(409, 'Friend request already sent', {
        code: 'FRIEND_REQUEST_ALREADY_SENT',
        expose: true,
      });
    }

    let friendship;
    if (outgoing?.status === 'declined' || outgoing?.status === 'cancelled') {
      friendship = await friendshipRepo.transitionStatus(outgoing.id, outgoing.status, 'pending');
      if (!friendship) {
        friendship = await friendshipRepo.createPending(requesterId, targetId);
      }
    } else if (!outgoing) {
      friendship = await friendshipRepo.createPending(requesterId, targetId);
    } else {
      throw new AppError(409, 'Friend request already sent', {
        code: 'FRIEND_REQUEST_ALREADY_SENT',
        expose: true,
      });
    }

    const requester = await userRepo.findByIdLean(requesterId);
    const hub = getSocialHub();
    if (hub && requester) {
      hub.notifyFriendRequestReceived(targetId, {
        id: friendship.id,
        from: toUserStub(requester),
        createdAt: friendship.createdAt,
      });
    }

    return { friendship, autoAccepted: false };
  }

  /**
   * @param {string} userId
   * @param {string} requestId
   */
  async function acceptRequest(userId, requestId) {
    const row = await friendshipRepo.findById(requestId);
    if (!row || row.status !== 'pending' || row.recipientId !== userId) {
      throw new AppError(404, 'Friend request not found', {
        code: 'FRIEND_REQUEST_NOT_FOUND',
        expose: true,
      });
    }

    const accepted = await friendshipRepo.transitionStatus(requestId, 'pending', 'accepted');
    if (!accepted) {
      throw new AppError(404, 'Friend request not found', {
        code: 'FRIEND_REQUEST_NOT_FOUND',
        expose: true,
      });
    }

    const [requester, recipient] = await Promise.all([
      userRepo.findByIdLean(row.requesterId),
      userRepo.findByIdLean(row.recipientId),
    ]);

    const hub = getSocialHub();
    if (hub && requester && recipient) {
      hub.notifyFriendRequestAccepted(row.requesterId, {
        friend: toUserStub(recipient),
        requestId: accepted.id,
      });
      hub.notifyFriendRequestAccepted(row.recipientId, {
        friend: toUserStub(requester),
        requestId: accepted.id,
      });
    }

    return accepted;
  }

  /**
   * @param {string} userId
   * @param {string} requestId
   */
  async function declineRequest(userId, requestId) {
    const row = await friendshipRepo.findById(requestId);
    if (!row || row.status !== 'pending' || row.recipientId !== userId) {
      throw new AppError(404, 'Friend request not found', {
        code: 'FRIEND_REQUEST_NOT_FOUND',
        expose: true,
      });
    }

    const declined = await friendshipRepo.transitionStatus(requestId, 'pending', 'declined');
    if (!declined) {
      throw new AppError(404, 'Friend request not found', {
        code: 'FRIEND_REQUEST_NOT_FOUND',
        expose: true,
      });
    }

    const hub = getSocialHub();
    hub?.notifyFriendRequestDeclined(row.requesterId, { requestId: declined.id });

    return declined;
  }

  /**
   * @param {string} userId
   * @param {string} requestId
   */
  async function cancelRequest(userId, requestId) {
    const row = await friendshipRepo.findById(requestId);
    if (!row || row.status !== 'pending' || row.requesterId !== userId) {
      throw new AppError(404, 'Friend request not found', {
        code: 'FRIEND_REQUEST_NOT_FOUND',
        expose: true,
      });
    }

    const cancelled = await friendshipRepo.transitionStatus(requestId, 'pending', 'cancelled');
    if (!cancelled) {
      throw new AppError(404, 'Friend request not found', {
        code: 'FRIEND_REQUEST_NOT_FOUND',
        expose: true,
      });
    }

    const hub = getSocialHub();
    hub?.notifyFriendRequestCancelled(row.recipientId, { requestId: cancelled.id });

    return cancelled;
  }

  /**
   * @param {string} userId
   * @param {string} friendUserId
   */
  async function unfriend(userId, friendUserId) {
    if (userId === friendUserId) {
      throw new AppError(400, 'Cannot friend yourself', {
        code: 'CANNOT_FRIEND_SELF',
        expose: true,
      });
    }

    const result = await friendshipRepo.deleteAcceptedBetween(userId, friendUserId);
    if (result.deletedCount === 0) {
      throw new AppError(404, 'Friendship not found', {
        code: 'FRIEND_REQUEST_NOT_FOUND',
        expose: true,
      });
    }

    const hub = getSocialHub();
    hub?.notifyFriendRemoved(friendUserId, { userId });
    hub?.notifyFriendRemoved(userId, { userId: friendUserId });

    return { ok: true };
  }

  /**
   * @param {string} viewerId
   * @param {string} username
   */
  async function lookupUsername(viewerId, username) {
    const user = await resolveActiveUserByUsername(username);
    const targetId = String(user._id);
    const [outgoing, incoming] = await Promise.all([
      friendshipRepo.findDirected(viewerId, targetId),
      friendshipRepo.findDirected(targetId, viewerId),
    ]);
    return {
      ...toUserStub(user),
      relationship: resolveRelationship(viewerId, outgoing, incoming),
    };
  }

  return {
    getSummary,
    sendRequest,
    acceptRequest,
    declineRequest,
    cancelRequest,
    unfriend,
    lookupUsername,
    toUserStub,
  };
}

export const friendsService = createFriendsService();
