import { Router } from "express";
import { Unit } from "../models/Unit.js";
import { requireAuth, requireRole, asyncHandler } from "../auth/middleware.js";

export const unitsRouter = Router();
unitsRouter.use(requireAuth);

unitsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const units = await Unit.find().sort({ name: 1 });
    res.json(units.map((u) => u.toJSON()));
  })
);

unitsRouter.post(
  "/",
  requireRole("super_admin", "admin"),
  asyncHandler(async (req, res) => {
    const unit = await Unit.create({ name: req.body.name });
    res.json(unit.toJSON());
  })
);

unitsRouter.patch(
  "/:id",
  requireRole("super_admin", "admin"),
  asyncHandler(async (req, res) => {
    const unit = await Unit.findByIdAndUpdate(req.params.id, { name: req.body.name }, { new: true });
    res.json(unit?.toJSON() ?? null);
  })
);

unitsRouter.delete(
  "/:id",
  requireRole("super_admin", "admin"),
  asyncHandler(async (req, res) => {
    await Unit.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  })
);
