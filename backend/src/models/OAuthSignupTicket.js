import mongoose from 'mongoose';

/** Pending Google registration until user picks a username. */
const oauthSignupTicketSchema = new mongoose.Schema(
  {
    jti: { type: String, required: true, unique: true, index: true },
    googleId: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 128 },
    picture: { type: String, trim: true, maxlength: 2048, default: null },
    expiresAt: { type: Date, required: true, index: true },
    consumedAt: { type: Date, default: null },
  },
  { timestamps: false },
);

oauthSignupTicketSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const OAuthSignupTicket =
  mongoose.models.OAuthSignupTicket ??
  mongoose.model('OAuthSignupTicket', oauthSignupTicketSchema);
