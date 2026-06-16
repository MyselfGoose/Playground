import test from 'node:test';
import assert from 'node:assert/strict';
import { AppError } from '../errors/AppError.js';
import { createFriendsService } from './friendsService.js';

/** @type {Record<string, { _id: string, username: string, isActive: boolean, avatarUrl?: string }>} */
const users = {
  alice: { _id: 'aaaaaaaaaaaaaaaaaaaaaaaa', username: 'alice', isActive: true },
  bob: { _id: 'bbbbbbbbbbbbbbbbbbbbbbbb', username: 'bob', isActive: true },
  carol: { _id: 'cccccccccccccccccccccccc', username: 'carol', isActive: true },
};

/** @type {Map<string, { id: string, requesterId: string, recipientId: string, status: string, respondedAt: Date | null, createdAt: Date, updatedAt: Date }>} */
const friendships = new Map();
let idCounter = 1;

function reset() {
  friendships.clear();
  idCounter = 1;
}

function mockFriendshipRepo() {
  return {
    async findDirected(requesterId, recipientId) {
      for (const row of friendships.values()) {
        if (row.requesterId === requesterId && row.recipientId === recipientId) return { ...row };
      }
      return null;
    },
    async listAcceptedFriends(userId) {
      return [...friendships.values()]
        .filter((row) => row.status === 'accepted' && (row.requesterId === userId || row.recipientId === userId))
        .map((row) => ({ ...row }));
    },
    async listPendingReceived(userId) {
      return [...friendships.values()]
        .filter((row) => row.status === 'pending' && row.recipientId === userId)
        .map((row) => ({ ...row }));
    },
    async listSentByUser(userId) {
      return [...friendships.values()]
        .filter((row) => row.requesterId === userId && (row.status === 'pending' || row.status === 'declined'))
        .map((row) => ({ ...row }));
    },
    async findById(id) {
      const row = friendships.get(id);
      return row ? { ...row } : null;
    },
    async createPending(requesterId, recipientId) {
      const id = `f${idCounter++}`;
      const row = {
        id,
        requesterId,
        recipientId,
        status: 'pending',
        respondedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      friendships.set(id, row);
      return { ...row };
    },
    async transitionStatus(id, fromStatus, toStatus) {
      const row = friendships.get(id);
      if (!row || row.status !== fromStatus) return null;
      row.status = toStatus;
      row.respondedAt = toStatus === 'pending' ? null : new Date();
      row.updatedAt = new Date();
      return { ...row };
    },
    async deleteAcceptedBetween(userA, userB) {
      for (const [id, row] of friendships.entries()) {
        const match =
          row.status === 'accepted' &&
          ((row.requesterId === userA && row.recipientId === userB) ||
            (row.requesterId === userB && row.recipientId === userA));
        if (match) {
          friendships.delete(id);
          return { deletedCount: 1 };
        }
      }
      return { deletedCount: 0 };
    },
    async listAcceptedFriendUserIds(userId) {
      const rows = await this.listAcceptedFriends(userId);
      return rows.map((row) => (row.requesterId === userId ? row.recipientId : row.requesterId));
    },
  };
}

function mockUserRepo() {
  return {
    findByUsername: async (username) => users[username] ?? null,
    findByIdLean: async (id) => Object.values(users).find((u) => u._id === id) ?? null,
  };
}

function svc() {
  return createFriendsService({
    friendshipRepository: mockFriendshipRepo(),
    userRepository: mockUserRepo(),
  });
}

test('sendRequest rejects self-friend', async () => {
  reset();
  await assert.rejects(
    () => svc().sendRequest(users.alice._id, 'alice'),
    (err) => err instanceof AppError && err.code === 'CANNOT_FRIEND_SELF',
  );
});

test('sendRequest creates pending request', async () => {
  reset();
  const result = await svc().sendRequest(users.alice._id, 'bob');
  assert.equal(result.autoAccepted, false);
  assert.equal(result.friendship.status, 'pending');
  assert.equal(result.friendship.requesterId, users.alice._id);
  assert.equal(result.friendship.recipientId, users.bob._id);
});

test('sendRequest rejects duplicate pending outgoing', async () => {
  reset();
  const service = svc();
  await service.sendRequest(users.alice._id, 'bob');
  await assert.rejects(
    () => service.sendRequest(users.alice._id, 'bob'),
    (err) => err instanceof AppError && err.code === 'FRIEND_REQUEST_ALREADY_SENT',
  );
});

test('sendRequest auto-accepts when recipient already sent pending', async () => {
  reset();
  const service = svc();
  await service.sendRequest(users.bob._id, 'alice');
  const result = await service.sendRequest(users.alice._id, 'bob');
  assert.equal(result.autoAccepted, true);
  assert.equal(result.friendship.status, 'accepted');
});

test('sendRequest resends after decline', async () => {
  reset();
  const service = svc();
  const sent = await service.sendRequest(users.alice._id, 'bob');
  await service.declineRequest(users.bob._id, sent.friendship.id);
  const resent = await service.sendRequest(users.alice._id, 'bob');
  assert.equal(resent.friendship.status, 'pending');
  assert.equal(resent.autoAccepted, false);
});

test('acceptRequest accepts pending received request', async () => {
  reset();
  const service = svc();
  const sent = await service.sendRequest(users.alice._id, 'bob');
  const accepted = await service.acceptRequest(users.bob._id, sent.friendship.id);
  assert.equal(accepted.status, 'accepted');
});

test('declineRequest marks request declined', async () => {
  reset();
  const service = svc();
  const sent = await service.sendRequest(users.alice._id, 'bob');
  const declined = await service.declineRequest(users.bob._id, sent.friendship.id);
  assert.equal(declined.status, 'declined');
  const summary = await service.getSummary(users.alice._id);
  assert.equal(summary.pending.sent.length, 1);
  assert.equal(summary.pending.sent[0].status, 'declined');
});

test('cancelRequest cancels pending sent request', async () => {
  reset();
  const service = svc();
  const sent = await service.sendRequest(users.alice._id, 'bob');
  const cancelled = await service.cancelRequest(users.alice._id, sent.friendship.id);
  assert.equal(cancelled.status, 'cancelled');
  const summary = await service.getSummary(users.bob._id);
  assert.equal(summary.pending.received.length, 0);
});

test('unfriend removes accepted friendship', async () => {
  reset();
  const service = svc();
  const sent = await service.sendRequest(users.alice._id, 'bob');
  await service.acceptRequest(users.bob._id, sent.friendship.id);
  await service.unfriend(users.alice._id, users.bob._id);
  const summary = await service.getSummary(users.alice._id);
  assert.equal(summary.friends.length, 0);
});

test('lookupUsername returns relationship states', async () => {
  reset();
  const service = svc();
  const none = await service.lookupUsername(users.alice._id, 'bob');
  assert.equal(none.relationship, 'none');

  const sent = await service.sendRequest(users.alice._id, 'bob');
  const pendingSent = await service.lookupUsername(users.alice._id, 'bob');
  assert.equal(pendingSent.relationship, 'pending_sent');

  const pendingReceived = await service.lookupUsername(users.bob._id, 'alice');
  assert.equal(pendingReceived.relationship, 'pending_received');

  await service.acceptRequest(users.bob._id, sent.friendship.id);
  const friends = await service.lookupUsername(users.alice._id, 'bob');
  assert.equal(friends.relationship, 'friends');
});
