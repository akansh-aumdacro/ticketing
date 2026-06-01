import { Router } from "express";
import { Role } from "../models/Role.js";
import { requireAuth, requireRole, asyncHandler } from "../auth/middleware.js";

export const rolesRouter = Router();
rolesRouter.use(requireAuth);

// Supports ?name=<role> to fetch a single role's permissions (PermissionsContext).
rolesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    if (typeof req.query.name === "string") {
      const role = await Role.findOne({ name: req.query.name });
      return res.json(role ? role.toJSON() : null);
    }
    const roles = await Role.find().sort({ created_at: 1 });
    res.json(roles.map((r) => r.toJSON()));
  })
);

rolesRouter.post(
  "/",
  requireRole("super_admin"),
  asyncHandler(async (req, res) => {
    const role = await Role.create({
      name: req.body.name,
      description: req.body.description ?? null,
      permissions: req.body.permissions ?? {},
    });
    res.json(role.toJSON());
  })
);

rolesRouter.patch(
  "/:id",
  requireRole("super_admin"),
  asyncHandler(async (req, res) => {
    const updates: Record<string, unknown> = {};
    for (const k of ["name", "description", "permissions"]) if (k in req.body) updates[k] = req.body[k];
    const role = await Role.findByIdAndUpdate(req.params.id, updates, { new: true });
    res.json(role?.toJSON() ?? null);
  })
);

rolesRouter.delete(
  "/:id",
  requireRole("super_admin"),
  asyncHandler(async (req, res) => {
    await Role.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  })
);
