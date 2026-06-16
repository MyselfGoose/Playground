import { AppError } from '../errors/AppError.js';
import {
  buildJoinPathForSlug,
  GAME_INVITE_HISTORY_TTL_MS,
  GAME_INVITE_TTL_MS,
  getGameSlugMeta,
  isValidRoomCodeForSlug,
  normalizeRoomCodeForSlug,
} from '../constants/gameSlugs.js';
import { gameInviteRepository } from '../repositories/gameInviteRepository.js';
import { friendshipRepository } from '../repositories/friendshipRepository.js';
import { userRepository } from '../repositories/userRepository.js';
import { getRoomInviteContext } from '../realtime/roomInviteRegistry.js';
import { getSocialHub } from '../realtime/socialHub.js';
import { avatarUrlForUsername } from '../utils/avatarUrl.js';

/**
 * @param {{ _id?: unknown, id?: unknown, username?: string, avatarUrl?: string }} user
 */
function toUserStub(user) {
  const id = user?._id != null ? String(user._id) : user?.id != null ? String(user.id) : '';
  const username = typeof user.username === 'string' ? user.username : '';
  return {
    userId: id,
    username,
    avatarUrl: user.avatarUrl || avatarUrlForUsername(username),
  };
}

/**
 * @param {ReturnType<typeof gameInviteRepository['findById']> extends Promise<infer T> ? T : never} row
 * @param {{ userId: string, username: string, avatarUrl: string }} inviter
 */
function mapInvitePayload(row, inviter, meta) {
  return {
    id: row.id,
    gameSlug: row.gameSlug,
    roomCode: row.roomCode,
    status: row.status,
    readAt: row.readAt,
    expiresAt: row.expiresAt,
    respondedAt: row.respondedAt,
    createdAt: row.createdAt,
    gameTitle: meta?.title ?? row.gameSlug,
    gameEmoji: meta?.emoji ?? '🎮',
    inviter,
    joinPath: buildJoinPathForSlug(row.gameSlug, row.roomCode),
  };
}

export function createGameInviteService(deps = {}) {
  const inviteRepo = deps.gameInviteRepository ?? gameInviteRepository;
  const friendshipRepo = deps.friendshipRepository ?? friendshipRepository;
  const userRepo = deps.userRepository ?? userRepository;

  /**
   * @param {string} recipientId
   */
  async function expireStaleForRecipient(recipientId) {
    await inviteRepo.expireStalePending(recipientId);
  }

  /**
   * @param {string} inviterId
   * @param {string} gameSlug
   * @param {string} roomCode
   */
  async function validateRoomForInvite(inviterId, gameSlug, roomCode) {
    const meta = getGameSlugMeta(gameSlug);
    if (!meta) {
      throw new AppError(400, 'Unknown game', { code: 'VALIDATION_ERROR', expose: true });
    }
    const normalized = normalizeRoomCodeForSlug(gameSlug, roomCode);
    if (!isValidRoomCodeForSlug(gameSlug, normalized)) {
      throw new AppError(400, 'Invalid room code', { code: 'VALIDATION_ERROR', expose: true });
    }

    const ctx = getRoomInviteContext(gameSlug, normalized);
    if (!ctx?.exists) {
      throw new AppError(404, 'Room not found', { code: 'ROOM_NOT_FOUND', expose: true });
    }
    if (String(ctx.hostId) !== String(inviterId)) {
      throw new AppError(403, 'Only the host can invite friends', { code: 'NOT_HOST', expose: true });
    }
    if (!ctx.joinable) {
      throw new AppError(409, 'Game already started', { code: 'ROOM_LOCKED', expose: true });
    }
    return { normalized, meta, ctx };
  }

  /**
   * @param {string} userId
   */
  async function getSummary(userId) {
    await expireStaleForRecipient(userId);
    const since = new Date(Date.now() - GAME_INVITE_HISTORY_TTL_MS);
    const rows = await inviteRepo.listForRecipient(userId, since);
    const unread = await inviteRepo.countUnread(userId);

    const inviterIds = [...new Set(rows.map((r) => r.inviterId))];
    /** @type {Record<string, { userId: string, username: string, avatarUrl: string }>} */
    const inviterMap = {};
    await Promise.all(
      inviterIds.map(async (id) => {
        const user = await userRepo.findByIdLean(id);
        if (user) inviterMap[id] = toUserStub(user);
      }),
    );

    const invites = rows.map((row) => {
      const meta = getGameSlugMeta(row.gameSlug);
      const inviter =
        inviterMap[row.inviterId] ??
        toUserStub({ id: row.inviterId, username: 'Player' });
      return mapInvitePayload(row, inviter, meta);
    });

    return {
      invites,
      counts: { unread },
    };
  }

  /**
   * @param {string} inviterId
   * @param {{ recipientId: string, gameSlug: string, roomCode: string }} input
   */
  async function sendInvite(inviterId, input) {
    const recipientId = String(input.recipientId);
    if (recipientId === inviterId) {
      throw new AppError(400, 'Cannot invite yourself', { code: 'VALIDATION_ERROR', expose: true });
    }

    const friends = await friendshipRepo.areFriends(inviterId, recipientId);
    if (!friends) {
      throw new AppError(403, 'Can only invite friends', { code: 'NOT_FRIENDS', expose: true });
    }

    const { normalized, meta, ctx } = await validateRoomForInvite(
      inviterId,
      input.gameSlug,
      input.roomCode,
    );

    if (ctx.playerUserIds.includes(recipientId)) {
      throw new AppError(409, 'Friend is already in the room', { code: 'ALREADY_IN_ROOM', expose: true });
    }

    const inviterUser = await userRepo.findByIdLean(inviterId);
    if (!inviterUser) {
      throw new AppError(404, 'User not found', { code: 'USER_NOT_FOUND', expose: true });
    }
    const inviter = toUserStub(inviterUser);

    const now = Date.now();
    let row;
    try {
      row = await inviteRepo.create({
        inviterId,
        recipientId,
        gameSlug: input.gameSlug,
        roomCode: normalized,
        status: 'pending',
        readAt: null,
        expiresAt: new Date(now + GAME_INVITE_TTL_MS),
      });
    } catch (err) {
      if (err && typeof err === 'object' && 'code' in err && err.code === 11000) {
        throw new AppError(409, 'Invite already sent', { code: 'INVITE_EXISTS', expose: true });
      }
      throw err;
    }

    const invite = mapInvitePayload(row, inviter, meta);
    const hub = getSocialHub();
    hub?.notifyGameInviteReceived(recipientId, { invite });

    return { invite };
  }

  /**
   * @param {string} recipientId
   * @param {string} inviteId
   */
  async function acceptInvite(recipientId, inviteId) {
    await expireStaleForRecipient(recipientId);
    const existing = await inviteRepo.findById(inviteId);
    if (!existing || existing.recipientId !== recipientId) {
      throw new AppError(404, 'Invite not found', { code: 'INVITE_NOT_FOUND', expose: true });
    }
    if (existing.status !== 'pending') {
      throw new AppError(409, 'Invite is no longer available', { code: 'INVITE_CLOSED', expose: true });
    }
    if (new Date(existing.expiresAt).getTime() <= Date.now()) {
      throw new AppError(409, 'Invite expired', { code: 'INVITE_EXPIRED', expose: true });
    }

    const ctx = getRoomInviteContext(existing.gameSlug, existing.roomCode);
    if (!ctx?.exists || !ctx.joinable) {
      const now = new Date();
      await inviteRepo.transitionStatus(inviteId, 'pending', {
        status: 'expired',
        respondedAt: now,
        expiresAt: new Date(now.getTime() + GAME_INVITE_HISTORY_TTL_MS),
      });
      throw new AppError(409, 'Room is no longer joinable', { code: 'ROOM_LOCKED', expose: true });
    }
    if (ctx.playerUserIds.includes(recipientId)) {
      const now = new Date();
      await inviteRepo.transitionStatus(inviteId, 'pending', {
        status: 'accepted',
        respondedAt: now,
        expiresAt: new Date(now.getTime() + GAME_INVITE_HISTORY_TTL_MS),
      });
      return {
        gameSlug: existing.gameSlug,
        roomCode: existing.roomCode,
        joinPath: buildJoinPathForSlug(existing.gameSlug, existing.roomCode),
        alreadyInRoom: true,
      };
    }

    const now = new Date();
    const row = await inviteRepo.transitionStatus(inviteId, 'pending', {
      status: 'accepted',
      respondedAt: now,
      readAt: existing.readAt ?? now,
      expiresAt: new Date(now.getTime() + GAME_INVITE_HISTORY_TTL_MS),
    });
    if (!row) {
      throw new AppError(409, 'Invite is no longer available', { code: 'INVITE_CLOSED', expose: true });
    }

    const hub = getSocialHub();
    hub?.notifyGameInviteResolved(existing.inviterId, {
      inviteId: row.id,
      status: 'accepted',
    });

    return {
      gameSlug: row.gameSlug,
      roomCode: row.roomCode,
      joinPath: buildJoinPathForSlug(row.gameSlug, row.roomCode),
      alreadyInRoom: false,
    };
  }

  /**
   * @param {string} recipientId
   * @param {string} inviteId
   */
  async function declineInvite(recipientId, inviteId) {
    await expireStaleForRecipient(recipientId);
    const existing = await inviteRepo.findById(inviteId);
    if (!existing || existing.recipientId !== recipientId) {
      throw new AppError(404, 'Invite not found', { code: 'INVITE_NOT_FOUND', expose: true });
    }
    if (existing.status !== 'pending') {
      throw new AppError(409, 'Invite is no longer available', { code: 'INVITE_CLOSED', expose: true });
    }

    const now = new Date();
    const row = await inviteRepo.transitionStatus(inviteId, 'pending', {
      status: 'declined',
      respondedAt: now,
      readAt: existing.readAt ?? now,
      expiresAt: new Date(now.getTime() + GAME_INVITE_HISTORY_TTL_MS),
    });
    if (!row) {
      throw new AppError(409, 'Invite is no longer available', { code: 'INVITE_CLOSED', expose: true });
    }

    const hub = getSocialHub();
    hub?.notifyGameInviteResolved(existing.inviterId, {
      inviteId: row.id,
      status: 'declined',
    });

    return { invite: row };
  }

  /**
   * @param {string} inviterId
   * @param {string} inviteId
   */
  async function cancelInvite(inviterId, inviteId) {
    const existing = await inviteRepo.findById(inviteId);
    if (!existing || existing.inviterId !== inviterId) {
      throw new AppError(404, 'Invite not found', { code: 'INVITE_NOT_FOUND', expose: true });
    }
    if (existing.status !== 'pending') {
      throw new AppError(409, 'Invite is no longer available', { code: 'INVITE_CLOSED', expose: true });
    }

    const now = new Date();
    const row = await inviteRepo.transitionStatus(inviteId, 'pending', {
      status: 'cancelled',
      respondedAt: now,
      expiresAt: new Date(now.getTime() + GAME_INVITE_HISTORY_TTL_MS),
    });
    if (!row) {
      throw new AppError(409, 'Invite is no longer available', { code: 'INVITE_CLOSED', expose: true });
    }

    const hub = getSocialHub();
    hub?.notifyGameInviteCancelled(existing.recipientId, { inviteId: row.id });

    return { invite: row };
  }

  /**
   * @param {string} recipientId
   * @param {string[]} [inviteIds]
   */
  async function markRead(recipientId, inviteIds) {
    const modified = await inviteRepo.markRead(recipientId, inviteIds);
    const unread = await inviteRepo.countUnread(recipientId);
    return { modified, counts: { unread } };
  }

  /**
   * @param {string} gameSlug
   * @param {string} roomCode
   * @param {'cancelled' | 'expired'} [terminalStatus]
   */
  async function cancelInvitesForRoom(gameSlug, roomCode, terminalStatus = 'cancelled') {
    const normalized = normalizeRoomCodeForSlug(gameSlug, roomCode);
    const pending = await inviteRepo.listPendingForRoom(gameSlug, normalized);
    if (!pending.length) return { cancelled: 0 };

    await inviteRepo.cancelPendingForRoom(gameSlug, normalized, terminalStatus);
    const hub = getSocialHub();
    for (const invite of pending) {
      if (terminalStatus === 'cancelled') {
        hub?.notifyGameInviteCancelled(invite.recipientId, { inviteId: invite.id });
      } else {
        hub?.notifyGameInviteCancelled(invite.recipientId, { inviteId: invite.id, reason: 'expired' });
      }
    }
    return { cancelled: pending.length };
  }

  return {
    getSummary,
    sendInvite,
    acceptInvite,
    declineInvite,
    cancelInvite,
    markRead,
    cancelInvitesForRoom,
    validateRoomForInvite,
  };
}

export const gameInviteService = createGameInviteService();
