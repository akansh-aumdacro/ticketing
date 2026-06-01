import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { User } from "../models/User.js";
import { Profile } from "../models/Profile.js";
import { UserRole } from "../models/UserRole.js";
import { NotificationPref } from "../models/NotificationPref.js";
import { signToken } from "../auth/jwt.js";
import { requireAuth, asyncHandler } from "../auth/middleware.js";
import { buildSession } from "../services/session.js";

export const authRouter = Router();

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  employee_id: z.string().optional().nullable(),
  contact: z.string().optional().nullable(),
});

// Ports handle_new_user(): create User + Profile + default role + notif prefs.
authRouter.post(
  "/signup",
  asyncHandler(async (req, res) => {
    const body = signupSchema.parse(req.body);
    const email = body.email.toLowerCase().trim();
    if (await User.findOne({ email })) {
      return res.status(400).json({ error: "An account with this email already exists" });
    }
    const password_hash = await bcrypt.hash(body.password, 10);
    const user = await User.create({ email, password_hash });
    await Profile.create({
      user_id: user._id,
      name: body.name.trim() || email,
      username: email.split("@")[0],
      employee_id: body.employee_id?.trim() || null,
      contact: body.contact?.trim() || null,
    });
    await UserRole.create({ user_id: user._id, role: "user" });
    await NotificationPref.create({ user_id: user._id });

    const token = signToken({ sub: user.id, email, role: "user" });
    const session = await buildSession(user.id);
    res.json({ token, ...session });
  })
);

const loginSchema = z.object({ email: z.string().email(), password: z.string() });

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const body = loginSchema.parse(req.body);
    const email = body.email.toLowerCase().trim();
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(body.password, user.get("password_hash")))) {
      return res.status(400).json({ error: "Invalid email or password" });
    }
    if (!user.get("is_active")) {
      return res.status(403).json({ error: "This account has been deactivated" });
    }
    const userRole = await UserRole.findOne({ user_id: user._id });
    const role = (userRole?.get("role") as any) ?? "user";
    const token = signToken({ sub: user.id, email, role });
    const session = await buildSession(user.id);
    res.json({ token, ...session });
  })
);

// Returns the current session for a stored token.
authRouter.get(
  "/session",
  requireAuth,
  asyncHandler(async (req, res) => {
    const session = await buildSession(req.user!.sub);
    if (!session) return res.status(404).json({ error: "User not found" });
    res.json(session);
  })
);

const passwordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(6),
});

// Re-authenticate then change password (ports MyProfileTab flow).
authRouter.patch(
  "/password",
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = passwordSchema.parse(req.body);
    const user = await User.findById(req.user!.sub);
    if (!user || !(await bcrypt.compare(body.currentPassword, user.get("password_hash")))) {
      return res.status(400).json({ error: "Current password is incorrect" });
    }
    user.set("password_hash", await bcrypt.hash(body.newPassword, 10));
    await user.save();
    res.json({ success: true });
  })
);
