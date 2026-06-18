import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateAvatarEmoji } from './avatarImageProcessing.js';
import { resolveUserAvatar } from '../utils/resolveUserAvatar.js';

describe('validateAvatarEmoji', () => {
  it('accepts a single emoji', () => {
    const result = validateAvatarEmoji('🎮');
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.emoji, '🎮');
  });

  it('rejects multiple characters', () => {
    const result = validateAvatarEmoji('🎮🔥');
    assert.equal(result.ok, false);
  });

  it('rejects plain text', () => {
    const result = validateAvatarEmoji('abc');
    assert.equal(result.ok, false);
  });
});

describe('resolveUserAvatar', () => {
  it('prefers explicit fields', () => {
    const result = resolveUserAvatar({
      avatarUrl: 'https://example.com/a.webp',
      avatarEmoji: '🎯',
    });
    assert.equal(result.avatarUrl, 'https://example.com/a.webp');
    assert.equal(result.avatarEmoji, '🎯');
  });

  it('returns null for empty strings', () => {
    const result = resolveUserAvatar({ avatarUrl: '  ', avatarEmoji: '' });
    assert.equal(result.avatarUrl, null);
    assert.equal(result.avatarEmoji, null);
  });
});
