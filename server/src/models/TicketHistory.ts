import mongoose, { Schema } from "mongoose";
import { baseOptions, TICKET_STATUSES } from "./_base.js";

const ticketHistorySchema = new Schema(
  {
    ticket_id: { type: Schema.Types.ObjectId, ref: "Ticket", required: true, index: true },
    action: { type: String, required: true },
    performed_by: { type: Schema.Types.ObjectId, ref: "User", required: true },
    old_status: { type: String, enum: [...TICKET_STATUSES, null], default: null },
    new_status: { type: String, enum: [...TICKET_STATUSES, null], default: null },
    remarks: { type: String, default: null },
  },
  baseOptions
);

export const TicketHistory = mongoose.model("TicketHistory", ticketHistorySchema);
