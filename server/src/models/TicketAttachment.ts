import mongoose, { Schema } from "mongoose";
import { baseOptions } from "./_base.js";

const ticketAttachmentSchema = new Schema(
  {
    ticket_id: { type: Schema.Types.ObjectId, ref: "Ticket", required: true, index: true },
    image_url: { type: String, required: true },
    attachment_type: { type: String, default: "ticket" },
    uploaded_by: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  baseOptions
);

export const TicketAttachment = mongoose.model("TicketAttachment", ticketAttachmentSchema);
