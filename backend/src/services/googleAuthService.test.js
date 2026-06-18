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
    updateProfile: async (_id, patch) => ({ ...localUser(), ...patch }),
    findByIdLean: async () => null,
    findByUsername: async () => null,
    ...impl,
  };
}

test('resolveGoogleCallback rejects unverified email', async () => {
  const svc = createGoogleAuthService({ userRepository: mockUserRepository({}) });
  await assert.rejects(
    () =>
      svc.resolveGoogleCallback({ ...verifiedProfile, emailVerified: false }),
    (err) => err instanceof AppError && err.code === 'GOOGLE_EMAIL_UNVERIFIED',
  );
});

test('resolveGoogleCallback returns session for existing googleId', async () => {
  const existing = localUser({ googleId: 'google-sub-1', authProviders: ['google'] });
  const svc = createGoogleAuthService({
    userRepository: mockUserRepository({
      findByGoogleId: async () => existing,
    }),
  });
  const outcome = await svc.resolveGoogleCallback(verifiedProfile);
  assert.equal(outcome.kind, 'session');
  assert.equal(String(outcome.user._id), String(existing._id));
});

test('resolveGoogleCallback syncs Google picture when user has no avatar', async () => {
  const existing = localUser({
    googleId: 'google-sub-1',
    authProviders: ['google'],
    avatarUrl: null,
  });
  let patched = null;
  const svc = createGoogleAuthService({
    userRepository: mockUserRepository({
      findByGoogleId: async () => existing,
      updateProfile: async (_id, patch) => {
        patched = patch;
        return { ...existing, ...patch };
      },
    }),
  });
  const outcome = await svc.resolveGoogleCallback(verifiedProfile);
  assert.equal(outcome.kind, 'session');
  assert.equal(patched?.avatarUrl, verifiedProfile.picture);
  assert.equal(outcome.user.avatarUrl, verifiedProfile.picture);
});

test('resolveGoogleCallback returns signup for new email', async () => {
  const svc = createGoogleAuthService({ userRepository: mockUserRepository({}) });
  const outcome = await svc.resolveGoogleCallback(verifiedProfile);
  assert.equal(outcome.kind, 'signup');
  assert.equal(outcome.profile.email, verifiedProfile.email);
});

test('resolveGoogleCallback auto-links local account when password present', async () => {
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
  const outcome = await svc.resolveGoogleCallback(verifiedProfile);
  assert.equal(outcome.kind, 'session');
  assert.ok(events.some((e) => e.event === 'auto_link_event'));
});

test('consumeSignupTicket rejects unknown ticket', async () => {
  const svc = createGoogleAuthService({
    oauthSignupTicketRepository: {
      create: async () => undefined,
      peek: async () => null,
      consume: async () => null,
    },
  });
  await assert.rejects(
    () => svc.consumeSignupTicket('missing'),
    (err) => err instanceof AppError && err.code === 'OAUTH_SIGNUP_TICKET_INVALID',
  );
});

test('registerGoogleUser rejects taken username', async () => {
  const svc = createGoogleAuthService({
    userRepository: mockUserRepository({
      findByUsername: async () => localUser({ username: 'taken' }),
    }),
  });
  await assert.rejects(
    () =>
      svc.registerGoogleUser(
        {
          googleId: 'g1',
          email: 'new@example.com',
          name: 'New',
          picture: null,
        },
        'taken',
      ),
    (err) => err instanceof AppError && err.code === 'USERNAME_TAKEN',
  );
});
