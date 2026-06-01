import { Router } from "express";
import { TicketRating } from "../models/TicketRating.js";
import { requireAuth, asyncHandler } from "../auth/middleware.js";

export const ratingsRouter = Router();
ratingsRouter.use(requireAuth);

// Flat list of all ratings, used by the dashboard/analytics aggregations.
// The frontend intersects these with the ticket ids it can see.
ratingsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const ratings = await TicketRating.find().lean();
    res.json(
      ratings.map((r) => ({
        id: r._id.toString(),
        ticket_id: r.ticket_id.toString(),
        rated_by: r.rated_by.toString(),
        rating: r.rating,
        feedback: r.feedback ?? null,
        created_at: r.created_at,
      }))
    );
  })
);
