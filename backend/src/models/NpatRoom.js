import mongoose from 'mongoose';

const playerSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    username: { type: String, required: true },
    teamId: { type: String, default: '' },
    ready: { type: Boolean, default: false },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const teamSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    color: { type: String, required: true },
  },
  { _id: false },
);

const roundSnapshotSchema = new mongoose.Schema(
  {
    roundIndex: { type: Number, required: true },
    letter: { type: String, required: true },
    submissions: { type: mongoose.Schema.Types.Mixed, default: {} },
    endedAt: { type: Date, default: Date.now },
    evaluationStatus: { type: String, enum: ['pending', 'complete', 'failed'], default: 'pending' },
    evaluationSource: { type: String, enum: ['gemini', 'fallback'], default: undefined },
    evaluationFailureClass: {
      type: String,
      enum: ['timeout', 'rate_limit', 'auth', 'quota', 'parse_error', 'schema_error', 'integrity_error', 'provider_error'],
      default: undefined,
    },
    evaluationAttemptsUsed: { type: Number, default: undefined },
    evaluatedAt: { type: Date, default: undefined },
    evaluationError: { type: String, default: undefined },
    /** Full payload: { round, results } plus deterministic scores */
    evaluation: { type: mongoose.Schema.Types.Mixed, default: undefined },
  },
  { _id: false },
);

/**
 * Live round state persisted on every round transition and on every answer submission.
 * This is what makes mid-round rehydration possible after a restart.
 */
const currentRoundSchema = new mongoose.Schema(
  {
    index: { type: Number, default: -1 },
    letter: { type: String, default: '' },
    phase: { type: String, default: 'none' }, // 'none' | 'collecting' | 'countdown'
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
    /** Map<userId, Record<fieldName, value>> */
    submissions: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false },
);

const npatRoomSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, index: true },
    hostUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    mode: { type: String, enum: ['solo', 'team'], required: true },
    maxPlayers: { type: Number, default: 8 },
    engineState: { type: String, default: 'WAITING' },
    roundPhase: { type: String, default: 'none' },
    usedLetters: { type: [String], default: [] },
    letterPool: { type: [String], default: [] },
    currentRoundIndex: { type: Number, default: -1 },
    currentLetter: { type: String, default: '' },
    /** Who caused the final countdown to start (solo: first to finish all four fields). */
    countdownTriggeredByUserId: { type: String, default: '' },
    currentRound: { type: currentRoundSchema, default: () => ({}) },
    players: { type: [playerSchema], default: [] },
    teams: { type: [teamSchema], default: [] },
    roundsHistory: { type: [roundSnapshotSchema], default: [] },
    /** Active early-finish vote: { proposedBy, votes: { [userId]: 'yes'|'no' }, proposedAt } */
    earlyFinishProposal: { type: mongoose.Schema.Types.Mixed, default: null },
    /** Last serialized public snapshot for debugging / future cold resume */
    lastPublicSnapshot: { type: mongoose.Schema.Types.Mixed, default: null },
    /** Monotonic version for optimistic concurrency. */
    version: { type: Number, default: 0 },
    finishedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

npatRoomSchema.index({ 'players.userId': 1, finishedAt: 1 });
npatRoomSchema.index({ finishedAt: 1, engineState: 1 });

export const NpatRoom = mongoose.models.NpatRoom ?? mongoose.model('NpatRoom', npatRoomSchema);
