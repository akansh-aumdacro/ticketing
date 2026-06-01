import { Router } from "express";
import { Notification } from "../models/Notification.js";
import { requireAuth, asyncHandler } from "../auth/middleware.js";

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

notificationsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const limit = Number(req.query.limit ?? 10);
    const rows = await Notification.find({ user_id: req.user!.sub })
      .sort({ created_at: -1 })
      .limit(limit);
    res.json(rows.map((r) => r.toJSON()));
  })
);

notificationsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const { user_id, ticket_id, title, message, type } = req.body;
    const row = await Notification.create({
      user_id,
      ticket_id: ticket_id ?? null,
      title,
      message: message ?? null,
      type,
    });
    res.json(row.toJSON());
  })
);

notificationsRouter.patch(
  "/:id/read",
  asyncHandler(async (req, res) => {
    await Notification.findOneAndUpdate(
      { _id: req.params.id, user_id: req.user!.sub },
      { is_read: true }
    );
    res.json({ success: true });
  })
);

notificationsRouter.patch(
  "/read-all",
  asyncHandler(async (req, res) => {
    await Notification.updateMany(
      { user_id: req.user!.sub, is_read: false },
      { is_read: true }
    );
    res.json({ success: true });
  })
);
