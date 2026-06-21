import mongoose from 'mongoose';

const platformSettingsSchema = new mongoose.Schema(
  {
    _id: { type: String, default: 'platform' },
    maintenanceMode: { type: Boolean, default: false },
    maintenanceMessage: { type: String, default: '', maxlength: 500 },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, _id: false },
);

export const PlatformSettings =
  mongoose.models.PlatformSettings ?? mongoose.model('PlatformSettings', platformSettingsSchema);
