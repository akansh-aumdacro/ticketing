import { User } from "../models/User.js";
import { Profile } from "../models/Profile.js";
import { UserRole } from "../models/UserRole.js";
import type { AppRole } from "../models/_base.js";

export interface SessionPayload {
  user: { id: string; email: string };
  profile: Record<string, unknown> | null;
  role: AppRole | null;
}

/** Builds the { user, profile, role } payload the frontend AuthContext expects. */
export async function buildSession(userId: string): Promise<SessionPayload | null> {
  const user = await User.findById(userId);
  if (!user) return null;
  const [profile, userRole] = await Promise.all([
    Profile.findOne({ user_id: userId }),
    UserRole.findOne({ user_id: userId }),
  ]);
  return {
    user: { id: user.id, email: user.get("email") },
    profile: profile ? profile.toJSON() : null,
    role: (userRole?.get("role") as AppRole) ?? null,
  };
}
