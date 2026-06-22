export const FIBBAGE_DATASET_VERSION = 'fibbage-v1';
export const FIBBAGE_ROOM_CODE_LENGTH = 4;
export const FIBBAGE_MIN_PLAYERS = 3;
export const FIBBAGE_MAX_PLAYERS = 8;

export const FIBBAGE_DEFAULT_ROUND_COUNT = 5;
export const FIBBAGE_MIN_ROUND_COUNT = 3;
export const FIBBAGE_MAX_ROUND_COUNT = 10;

export const FIBBAGE_DEFAULT_WRITING_SECONDS = 90;
export const FIBBAGE_MIN_WRITING_SECONDS = 45;
export const FIBBAGE_MAX_WRITING_SECONDS = 120;

export const FIBBAGE_DEFAULT_VOTING_SECONDS = 45;
export const FIBBAGE_MIN_VOTING_SECONDS = 30;
export const FIBBAGE_MAX_VOTING_SECONDS = 90;

/** Game mode presets — selecting one sets roundCount, writingSeconds, votingSeconds atomically */
export const FIBBAGE_PRESETS = {
  classic: {
    id: 'classic',
    label: 'Classic',
    description: 'Balanced pace for most groups',
    roundCount: 5,
    writingSeconds: 90,
    votingSeconds: 45,
  },
  blitz: {
    id: 'blitz',
    label: 'Blitz',
    description: 'Fast lies, quick votes — ~10 min games',
    roundCount: 3,
    writingSeconds: 45,
    votingSeconds: 30,
  },
  marathon: {
    id: 'marathon',
    label: 'Marathon',
    description: 'More rounds, more time to craft lies',
    roundCount: 8,
    writingSeconds: 120,
    votingSeconds: 60,
  },
};

export const FIBBAGE_LIE_MIN_LENGTH = 3;
export const FIBBAGE_LIE_MAX_LENGTH = 120;

/** Phase durations in milliseconds */
export const FIBBAGE_STARTING_MS = 3000;
export const FIBBAGE_PROMPT_REVEAL_MS = 4000;
export const FIBBAGE_SCORING_MS = 6000;
export const FIBBAGE_BETWEEN_ROUNDS_MS = 3000;
export const FIBBAGE_PROMPT_FETCH_RETRY_MS = 2000;
export const FIBBAGE_PROMPT_FETCH_MAX_RETRIES = 3;

/** Reveal sub-phase durations */
export const FIBBAGE_REVEAL_VOTES_SUMMARY_MS = 4000;
export const FIBBAGE_REVEAL_PER_LIE_MS = 3000;
export const FIBBAGE_REVEAL_TRUTH_MS = 4000;
export const FIBBAGE_REVEAL_COMPLETE_MS = 2000;

/** Scoring */
export const FIBBAGE_POINTS_FOOL = 750;
export const FIBBAGE_POINTS_TRUTH = 500;
export const FIBBAGE_POINTS_SOLO_TRUTH = 250;
export const FIBBAGE_FINAL_ROUND_MULTIPLIER = 2;

/** Tick interval for phase advancement */
export const FIBBAGE_TICK_INTERVAL_MS = 500;

/** Leaderboard */
export const FIBBAGE_LEADERBOARD_MIN_GAMES = 4;
