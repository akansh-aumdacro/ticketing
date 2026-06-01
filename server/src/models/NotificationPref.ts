import mongoose, { Schema } from "mongoose";
import { baseOptions } from "./_base.js";

const notificationPrefSchema = new Schema(
  {
    user_id: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    sla_breach: { type: Boolean, default: true },
    sla_at_risk: { type: Boolean, default: true },
    ticket_assigned: { type: Boolean, default: true },
    new_message: { type: Boolean, default: true },
    ticket_resolved: { type: Boolean, default: true },
  },
  baseOptions
);

export const NotificationPref = mongoose.model("NotificationPref", notificationPrefSchema);
