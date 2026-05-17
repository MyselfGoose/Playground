import mongoose from 'mongoose';

/** Single-use handoff after Google OAuth callback (SPA exchanges via proxied /oauth/complete). */
const oauthCompletionTicketSchema = new mongoose.Schema(
  {
    jti: { type: String, required: true, unique: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User', index: true },
    expiresAt: { type: Date, required: true, index: true },
    consumedAt: { type: Date, default: null },
  },
  { timestamps: false },
);

oauthCompletionTicketSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const OAuthCompletionTicket =
  mongoose.models.OAuthCompletionTicket ??
  mongoose.model('OAuthCompletionTicket', oauthCompletionTicketSchema);
