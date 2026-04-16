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
    players: { type: [playerSchema], default: [] },
    teams: { type: [teamSchema], default: [] },
    roundsHistory: { type: [roundSnapshotSchema], default: [] },
    /** Last serialized public snapshot for debugging / future cold resume */
    lastPublicSnapshot: { type: mongoose.Schema.Types.Mixed, default: null },
    finishedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export const NpatRoom = mongoose.models.NpatRoom ?? mongoose.model('NpatRoom', npatRoomSchema);
