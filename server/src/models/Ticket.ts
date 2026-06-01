import mongoose, { Schema } from "mongoose";
import { baseOptions, TICKET_PRIORITIES, TICKET_STATUSES } from "./_base.js";

const ticketSchema = new Schema(
  {
    ticket_number: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    description: { type: String, default: null },
    unit_id: { type: Schema.Types.ObjectId, ref: "Unit", default: null },
    department_id: { type: Schema.Types.ObjectId, ref: "Department", default: null },
    issue_department_id: { type: Schema.Types.ObjectId, ref: "Department", default: null, index: true },
    raised_by: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    assigned_to: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    assigned_at: { type: Date, default: null },
    status: { type: String, enum: TICKET_STATUSES, default: "open", index: true },
    priority: { type: String, enum: TICKET_PRIORITIES, default: "medium" },
    target_date: { type: Date, default: null },
    next_target_date: { type: Date, default: null },
    remarks: { type: String, default: null },
    photo_url: { type: String, default: null },
    attachments: { type: Schema.Types.Mixed, default: [] },
    closed_at: { type: Date, default: null },
    closed_by: { type: Schema.Types.ObjectId, ref: "User", default: null },
    closing_remarks: { type: String, default: null },
    reopened_at: { type: Date, default: null },
    reopen_remarks: { type: String, default: null },
    reopen_photo_url: { type: String, default: null },
    // SLA
    sla_due_at: { type: Date, default: null },
    sla_response_due_at: { type: Date, default: null },
    sla_breached: { type: Boolean, default: false },
    sla_response_breached: { type: Boolean, default: false },
    sla_at_risk_notified: { type: Boolean, default: false },
    first_response_at: { type: Date, default: null },
  },
  baseOptions
);

export const Ticket = mongoose.model("Ticket", ticketSchema);
