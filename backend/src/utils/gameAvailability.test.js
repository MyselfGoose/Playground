import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  isGameEnabled,
  canCreateRoom,
  roomCreationBlockReason,
} from './gameAvailability.js';
import { setPlatformSettingsCacheForTests } from '../services/platformSettingsService.js';

describe('gameAvailability', () => {
  beforeEach(() => {
    setPlatformSettingsCacheForTests({
      maintenanceMode: false,
      maintenanceMessage: '',
      googleOAuthEnabled: true,
      blockNewRooms: false,
      disabledGames: [],
      updatedAt: null,
    });
  });

  it('allows all games by default', () => {
    assert.equal(isGameEnabled('npat'), true);
    assert.equal(canCreateRoom('npat'), true);
  });

  it('blocks disabled games', () => {
    setPlatformSettingsCacheForTests({ disabledGames: ['hangman'] });
    assert.equal(isGameEnabled('hangman'), false);
    assert.equal(roomCreationBlockReason('hangman'), 'This game is temporarily unavailable');
  });

  it('allows admin to create when blockNewRooms is on', () => {
    setPlatformSettingsCacheForTests({ blockNewRooms: true });
    assert.equal(canCreateRoom('npat'), false);
    assert.equal(canCreateRoom('npat', { isAdmin: true }), true);
  });
});
