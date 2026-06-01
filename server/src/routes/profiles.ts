import { Router } from "express";
import { Profile } from "../models/Profile.js";
import { UserRole } from "../models/UserRole.js";
import { requireAuth, asyncHandler } from "../auth/middleware.js";

export const profilesRouter = Router();
profilesRouter.use(requireAuth);

// List profiles (optionally scoped to a department and/or role for member pickers).
// Each profile is annotated with its `role` so HODs can build assignee lists
// without needing the admin-only /users endpoint.
profilesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const filter: Record<string, unknown> = {};
    if (typeof req.query.department_id === "string") filter.department_id = req.query.department_id;
    const profiles = await Profile.find(filter).sort({ name: 1 }).lean();
    const roles = await UserRole.find({
      user_id: { $in: profiles.map((p) => p.user_id) },
    }).lean();
    const roleMap = new Map(roles.map((r) => [r.user_id.toString(), r.role]));

    let out = profiles.map((p) => ({
      ...p,
      id: p._id.toString(),
      _id: undefined,
      user_id: p.user_id.toString(),
      department_id: p.department_id ? p.department_id.toString() : null,
      unit_id: p.unit_id ? p.unit_id.toString() : null,
      role: roleMap.get(p.user_id.toString()) ?? "user",
    }));
    if (typeof req.query.role === "string") out = out.filter((p) => p.role === req.query.role);
    res.json(out);
  })
);

profilesRouter.get(
  "/me",
  asyncHandler(async (req, res) => {
    const profile = await Profile.findOne({ user_id: req.user!.sub });
    res.json(profile ? profile.toJSON() : null);
  })
);

// Update own profile (name, contact, avatar, etc.).
const SELF_UPDATABLE = ["name", "username", "employee_id", "contact", "avatar_url", "department_id", "unit_id"];

profilesRouter.patch(
  "/me",
  asyncHandler(async (req, res) => {
    const updates: Record<string, unknown> = {};
    for (const k of SELF_UPDATABLE) if (k in req.body) updates[k] = req.body[k];
    const profile = await Profile.findOneAndUpdate({ user_id: req.user!.sub }, updates, { new: true });
    res.json(profile ? profile.toJSON() : null);
  })
);
