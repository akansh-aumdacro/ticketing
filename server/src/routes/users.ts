import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { User } from "../models/User.js";
import { Profile } from "../models/Profile.js";
import { UserRole } from "../models/UserRole.js";
import { NotificationPref } from "../models/NotificationPref.js";
import { Ticket } from "../models/Ticket.js";
import { TicketHistory } from "../models/TicketHistory.js";
import { requireAuth, requireRole, asyncHandler } from "../auth/middleware.js";
import { APP_ROLES } from "../models/_base.js";

export const usersRouter = Router();
usersRouter.use(requireAuth, requireRole("super_admin", "admin"));

// Combined user list: profile + email + role (replaces client-side profiles+user_roles join).
usersRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const [profiles, users, roles] = await Promise.all([
      Profile.find().sort({ name: 1 }).lean(),
      User.find().lean(),
      UserRole.find().lean(),
    ]);
    const userMap = new Map(users.map((u) => [u._id.toString(), u]));
    const roleMap = new Map(roles.map((r) => [r.user_id.toString(), r.role]));
    res.json(
      profiles.map((p) => {
        const uid = p.user_id.toString();
        const u = userMap.get(uid);
        return {
          id: p._id.toString(),
          user_id: uid,
          name: p.name,
          username: p.username ?? null,
          employee_id: p.employee_id ?? null,
          department_id: p.department_id ? p.department_id.toString() : null,
          unit_id: p.unit_id ? p.unit_id.toString() : null,
          contact: p.contact ?? null,
          avatar_url: p.avatar_url ?? null,
          email: u?.email ?? null,
          is_active: u?.is_active ?? true,
          role: roleMap.get(uid) ?? "user",
        };
      })
    );
  })
);

const createSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  username: z.string().optional().nullable(),
  employeeId: z.string().optional().nullable(),
  contact: z.string().optional().nullable(),
  role: z.enum(APP_ROLES).optional(),
  departmentId: z.string().optional().nullable(),
  unitId: z.string().min(1),
});

// Ports admin-create-user.
usersRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = createSchema.parse(req.body);
    const role = body.role ?? "user";
    if ((role === "super_admin" || role === "admin") && req.user!.role !== "super_admin") {
      return res.status(403).json({ error: "Only a super admin can create admin-level users" });
    }
    if (!body.unitId || body.unitId === "none") {
      return res.status(400).json({ error: "Unit is required" });
    }
    const email = body.email.toLowerCase().trim();
    if (await User.findOne({ email })) {
      return res.status(400).json({ error: "An account with this email already exists" });
    }
    const user = await User.create({ email, password_hash: await bcrypt.hash(body.password, 10) });
    await Profile.create({
      user_id: user._id,
      name: body.name.trim(),
      username: body.username?.trim() || email.split("@")[0],
      employee_id: body.employeeId?.trim() || null,
      contact: body.contact?.trim() || null,
      unit_id: body.unitId,
      department_id: body.departmentId && body.departmentId !== "none" ? body.departmentId : null,
    });
    await UserRole.create({ user_id: user._id, role });
    await NotificationPref.create({ user_id: user._id });
    res.json({ success: true, userId: user.id });
  })
);

// Admin edit of another user's profile fields.
const ADMIN_PROFILE_FIELDS = ["name", "username", "employee_id", "contact", "department_id", "unit_id"];

usersRouter.patch(
  "/:id/profile",
  asyncHandler(async (req, res) => {
    const updates: Record<string, unknown> = {};
    for (const k of ADMIN_PROFILE_FIELDS) {
      if (k in req.body) {
        const v = req.body[k];
        updates[k] = v === "none" || v === "" ? null : v;
      }
    }
    const profile = await Profile.findOneAndUpdate({ user_id: req.params.id }, updates, { new: true });
    if (!profile) return res.status(404).json({ error: "Profile not found" });
    res.json(profile.toJSON());
  })
);

// Ports admin-update-user-credentials.
usersRouter.patch(
  "/:id/credentials",
  asyncHandler(async (req, res) => {
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ error: "User not found" });
    if (req.user!.role !== "super_admin" && req.params.id !== req.user!.sub) {
      const targetRole = await UserRole.findOne({ user_id: req.params.id });
      if (targetRole?.get("role") === "super_admin") {
        return res.status(403).json({ error: "Only a super admin can modify another super admin's credentials" });
      }
    }
    const { email, password } = req.body as { email?: string; password?: string };
    let applied = false;
    if (typeof email === "string" && email.trim()) {
      target.set("email", email.toLowerCase().trim());
      applied = true;
    }
    if (typeof password === "string" && password.length >= 6) {
      target.set("password_hash", await bcrypt.hash(password, 10));
      applied = true;
    }
    if (!applied) return res.json({ success: true, skipped: true });
    await target.save();
    res.json({ success: true });
  })
);

// Update a user's role.
usersRouter.patch(
  "/:id/role",
  asyncHandler(async (req, res) => {
    const role = req.body.role;
    if (!APP_ROLES.includes(role)) return res.status(400).json({ error: "Invalid role" });
    if ((role === "super_admin" || role === "admin") && req.user!.role !== "super_admin") {
      return res.status(403).json({ error: "Only a super admin can grant admin-level roles" });
    }
    await UserRole.findOneAndUpdate(
      { user_id: req.params.id },
      { role },
      { upsert: true, new: true }
    );
    res.json({ success: true });
  })
);

// Ports admin-delete-user (soft-delete if the user has activity, else hard-delete).
usersRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    if (id === req.user!.sub) return res.status(400).json({ error: "You cannot delete your own account" });
    const targetRole = await UserRole.findOne({ user_id: id });
    if (req.user!.role !== "super_admin" && targetRole?.get("role") === "super_admin") {
      return res.status(403).json({ error: "Only a super admin can delete a super admin" });
    }

    const [ticketsRaised, historyCount] = await Promise.all([
      Ticket.countDocuments({ raised_by: id }),
      TicketHistory.countDocuments({ performed_by: id }),
    ]);

    if (ticketsRaised > 0 || historyCount > 0) {
      // Soft-delete: deactivate + strip role, preserve activity history.
      await UserRole.deleteOne({ user_id: id });
      await User.findByIdAndUpdate(id, { is_active: false });
      return res.json({
        success: true,
        mode: "deactivated",
        message: "User had activity history and was deactivated instead of deleted.",
      });
    }

    await Promise.all([
      UserRole.deleteOne({ user_id: id }),
      Profile.deleteOne({ user_id: id }),
      NotificationPref.deleteOne({ user_id: id }),
      User.findByIdAndDelete(id),
    ]);
    res.json({ success: true, mode: "deleted" });
  })
);

// Bulk import users (CSV-driven). Skips rows whose email/employee_id already exist.
const bulkRowSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  employeeId: z.string().optional().nullable(),
  contact: z.string().optional().nullable(),
  role: z.enum(APP_ROLES).optional(),
  departmentId: z.string().optional().nullable(),
  unitId: z.string().optional().nullable(),
});

usersRouter.post(
  "/bulk-import",
  asyncHandler(async (req, res) => {
    const rows = z.array(bulkRowSchema).parse(req.body.users ?? []);
    const results: { email: string; status: string; error?: string }[] = [];
    for (const row of rows) {
      const email = row.email.toLowerCase().trim();
      try {
        const role = row.role ?? "user";
        if ((role === "super_admin" || role === "admin") && req.user!.role !== "super_admin") {
          results.push({ email, status: "skipped", error: "Cannot create admin-level user" });
          continue;
        }
        if (await User.findOne({ email })) {
          results.push({ email, status: "skipped", error: "Email already exists" });
          continue;
        }
        const user = await User.create({ email, password_hash: await bcrypt.hash(row.password, 10) });
        await Profile.create({
          user_id: user._id,
          name: row.name.trim(),
          username: email.split("@")[0],
          employee_id: row.employeeId?.trim() || null,
          contact: row.contact?.trim() || null,
          unit_id: row.unitId && row.unitId !== "none" ? row.unitId : null,
          department_id: row.departmentId && row.departmentId !== "none" ? row.departmentId : null,
        });
        await UserRole.create({ user_id: user._id, role });
        await NotificationPref.create({ user_id: user._id });
        results.push({ email, status: "created" });
      } catch (err) {
        results.push({ email, status: "error", error: (err as Error).message });
      }
    }
    res.json({ results });
  })
);
