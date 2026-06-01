import mongoose, { Schema } from "mongoose";
import { baseOptions } from "./_base.js";

const ticketRatingSchema = new Schema(
  {
    ticket_id: { type: Schema.Types.ObjectId, ref: "Ticket", required: true, unique: true, index: true },
    rated_by: { type: Schema.Types.ObjectId, ref: "User", required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    feedback: { type: String, default: null },
  },
  baseOptions
);

export const TicketRating = mongoose.model("TicketRating", ticketRatingSchema);
