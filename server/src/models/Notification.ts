import mongoose, { Schema } from "mongoose";
import { baseOptions } from "./_base.js";

const notificationSchema = new Schema(
  {
    user_id: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
    message: { type: String, default: null },
    ticket_id: { type: Schema.Types.ObjectId, ref: "Ticket", default: null },
    is_read: { type: Boolean, default: false },
  },
  baseOptions
);

export const Notification = mongoose.model("Notification", notificationSchema);
