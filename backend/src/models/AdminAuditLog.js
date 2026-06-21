import mongoose from 'mongoose';

const ADMIN_ACTIONS = [
  'user_activate',
  'user_deactivate',
  'user_roles_update',
  'user_username_force',
  'user_avatar_remove',
  'user_moderation_update',
  'user_stats_patch',
  'maintenance_toggle',
  'leaderboard_recompute',
];

const adminAuditLogSchema = new mongoose.Schema(
  {
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    action: { type: String, required: true, enum: ADMIN_ACTIONS },
    reason: { type: String, default: '', maxlength: 2000 },
    metadata: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

adminAuditLogSchema.index({ targetUserId: 1, createdAt: -1 });
adminAuditLogSchema.index({ createdAt: -1 });

export const ADMIN_AUDIT_ACTIONS = ADMIN_ACTIONS;

export const AdminAuditLog =
  mongoose.models.AdminAuditLog ?? mongoose.model('AdminAuditLog', adminAuditLogSchema);
