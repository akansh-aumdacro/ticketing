import mongoose, { Schema } from "mongoose";
import { APP_ROLES, baseOptionsNoTimestamps } from "./_base.js";

// Mirrors Supabase user_roles (one role per user, unique on user_id).
const userRoleSchema = new Schema(
  {
    user_id: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    role: { type: String, enum: APP_ROLES, required: true },
  },
  baseOptionsNoTimestamps
);

export const UserRole = mongoose.model("UserRole", userRoleSchema);
