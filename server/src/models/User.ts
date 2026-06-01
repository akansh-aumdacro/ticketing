import mongoose, { Schema } from "mongoose";
import { baseOptions } from "./_base.js";

// Auth identity (mirrors Supabase auth.users). Profile + role live in their own
// collections keyed by user_id === this document's _id.
const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password_hash: { type: String, required: true },
    is_active: { type: Boolean, default: true }, // false = banned/deactivated
  },
  baseOptions
);

// Never leak the password hash in JSON output.
userSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform(_doc, ret: Record<string, unknown>) {
    ret.id = ret._id?.toString();
    delete ret._id;
    delete ret.password_hash;
    return ret;
  },
});

export const User = mongoose.model("User", userSchema);
