import test from 'node:test';
import assert from 'node:assert/strict';
import { createGoogleAuthService } from './googleAuthService.js';
import { AppError } from '../errors/AppError.js';

/** @type {import('./googleOAuthClient.js').GoogleProfile} */
const verifiedProfile = {
  sub: 'google-sub-1',
  email: 'player@example.com',
  emailVerified: true,
  name: 'Player One',
  picture: 'https://example.com/pic.png',
};

/**
 * @param {Partial<Record<string, unknown>>} user
 */
function localUser(user = {}) {
  return {
    _id: '507f1f77bcf86cd799439011',
    email: 'player@example.com',
    googleId: null,
    authProviders: ['local'],
    isActive: true,
    roles: ['user'],
    ...user,
  };
}

/**
 * @param {Record<string, unknown>} impl
 */
function mockUserRepository(impl) {
  return {
    findByGoogleId: async () => null,
    findByEmail: async () => null,
    findByEmailWithPassword: async () => null,
    linkGoogleAccount: async () => null,
    createUser: async () => null,
    updateLastLogin: async () => undefined,
    findByIdLean: async () => null,
    ...impl,
  };
}

test('resolveGoogleUser rejects unverified email for new accounts', async () => {
  const svc = createGoogleAuthService({
    userRepository: mockUserRepository({}),
  });
  await assert.rejects(
    () =>
      svc.resolveGoogleUser(
        { ...verifiedProfile, emailVerified: false },
        {},
      ),
    (err) => err instanceof AppError && err.code === 'GOOGLE_EMAIL_UNVERIFIED',
  );
});

test('resolveGoogleUser logs in existing googleId match', async () => {
  const existing = localUser({ googleId: 'google-sub-1', authProviders: ['google'] });
  let updated = false;
  const svc = createGoogleAuthService({
    userRepository: mockUserRepository({
      findByGoogleId: async () => existing,
      updateLastLogin: async () => {
        updated = true;
      },
    }),
  });
  const user = await svc.resolveGoogleUser(verifiedProfile, {});
  assert.equal(String(user._id), String(existing._id));
  assert.equal(updated, true);
});

test('resolveGoogleUser auto-links local account when password present', async () => {
  const existing = localUser();
  const events = [];
  const linked = { ...existing, googleId: 'google-sub-1', authProviders: ['local', 'google'] };
  const svc = createGoogleAuthService({
    logger: { info: (obj) => events.push(obj) },
    userRepository: mockUserRepository({
      findByEmail: async () => existing,
      findByEmailWithPassword: async () => ({ ...existing, passwordHash: 'hash' }),
      linkGoogleAccount: async () => linked,
    }),
  });
  const user = await svc.resolveGoogleUser(verifiedProfile, {});
  assert.equal(user.googleId, 'google-sub-1');
  assert.ok(events.some((e) => e.event === 'auto_link_event'));
});

test('resolveGoogleUser rejects googleId conflict on email account', async () => {
  const svc = createGoogleAuthService({
    userRepository: mockUserRepository({
      findByEmail: async () => localUser({ googleId: 'other-google-id' }),
    }),
  });
  await assert.rejects(
    () => svc.resolveGoogleUser(verifiedProfile, {}),
    (err) => err instanceof AppError && err.code === 'GOOGLE_ACCOUNT_CONFLICT',
  );
});

test('resolveGoogleUser creates new google user when no email match', async () => {
  const created = localUser({ googleId: 'google-sub-1', authProviders: ['google'] });
  const svc = createGoogleAuthService({
    userRepository: mockUserRepository({
      findByUsername: async () => null,
      createUser: async () => created,
    }),
  });
  const user = await svc.resolveGoogleUser(verifiedProfile, {});
  assert.equal(user.googleId, 'google-sub-1');
});

test('consumeCompletionTicket rejects unknown ticket', async () => {
  const svc = createGoogleAuthService({
    oauthCompletionTicketRepository: {
      create: async () => undefined,
      consume: async () => null,
    },
  });
  await assert.rejects(
    () => svc.consumeCompletionTicket('missing'),
    (err) => err instanceof AppError && err.code === 'OAUTH_TICKET_INVALID',
  );
});
