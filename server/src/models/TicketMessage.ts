import mongoose, { Schema } from "mongoose";
import { baseOptions } from "./_base.js";

const ticketMessageSchema = new Schema(
  {
    ticket_id: { type: Schema.Types.ObjectId, ref: "Ticket", required: true, index: true },
    sender_id: { type: Schema.Types.ObjectId, ref: "User", required: true },
    sender_name: { type: String, required: true },
    sender_role: { type: String, required: true },
    message: { type: String, default: null },
    attachments: { type: Schema.Types.Mixed, default: [] },
    is_system_message: { type: Boolean, default: false },
  },
  baseOptions
);

ticketMessageSchema.index({ ticket_id: 1, created_at: 1 });

export const TicketMessage = mongoose.model("TicketMessage", ticketMessageSchema);
