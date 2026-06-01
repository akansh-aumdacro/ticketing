import { Router } from "express";
import { Department } from "../models/Department.js";
import { requireAuth, requireRole, asyncHandler } from "../auth/middleware.js";

export const departmentsRouter = Router();
departmentsRouter.use(requireAuth);

departmentsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const filter: Record<string, unknown> = {};
    if (req.query.active === "true") filter.is_active = true;
    const depts = await Department.find(filter).sort({ name: 1 });
    res.json(depts.map((d) => d.toJSON()));
  })
);

departmentsRouter.post(
  "/",
  requireRole("super_admin", "admin"),
  asyncHandler(async (req, res) => {
    const dept = await Department.create({
      name: req.body.name,
      unit_id: req.body.unit_id ?? null,
    });
    res.json(dept.toJSON());
  })
);

departmentsRouter.patch(
  "/:id",
  requireRole("super_admin", "admin"),
  asyncHandler(async (req, res) => {
    const updates: Record<string, unknown> = {};
    for (const k of ["name", "unit_id", "is_active"]) if (k in req.body) updates[k] = req.body[k];
    const dept = await Department.findByIdAndUpdate(req.params.id, updates, { new: true });
    res.json(dept?.toJSON() ?? null);
  })
);

departmentsRouter.delete(
  "/:id",
  requireRole("super_admin", "admin"),
  asyncHandler(async (req, res) => {
    await Department.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  })
);
