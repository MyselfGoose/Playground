import mongoose from 'mongoose';

const platformSettingsSchema = new mongoose.Schema(
  {
    _id: { type: String, default: 'platform' },
    maintenanceMode: { type: Boolean, default: false },
    maintenanceMessage: { type: String, default: '', maxlength: 500 },
    googleOAuthEnabled: { type: Boolean, default: true },
    blockNewRooms: { type: Boolean, default: false },
    disabledGames: {
      type: [String],
      default: [],
      validate: {
        validator: (/** @type {string[]} */ v) =>
          Array.isArray(v) && v.every((g) => typeof g === 'string'),
        message: 'disabledGames must be an array of strings',
      },
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, _id: false },
);

export const PlatformSettings =
  mongoose.models.PlatformSettings ?? mongoose.model('PlatformSettings', platformSettingsSchema);
