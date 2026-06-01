import { SchemaOptions } from "mongoose";

/**
 * Shared schema options: expose `id` (string form of `_id`), drop `_id`/`__v`
 * from JSON output so API responses mirror the shape the frontend expects.
 */
export const baseOptions: SchemaOptions = {
  timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  toJSON: {
    virtuals: true,
    versionKey: false,
    transform(_doc, ret: Record<string, unknown>) {
      ret.id = ret._id?.toString();
      delete ret._id;
      return ret;
    },
  },
  toObject: { virtuals: true, versionKey: false },
};

/** Same as baseOptions but without auto timestamps (for join/lookup-only docs). */
export const baseOptionsNoTimestamps: SchemaOptions = {
  toJSON: {
    virtuals: true,
    versionKey: false,
    transform(_doc, ret: Record<string, unknown>) {
      ret.id = ret._id?.toString();
      delete ret._id;
      return ret;
    },
  },
  toObject: { virtuals: true, versionKey: false },
};

export const APP_ROLES = ["super_admin", "admin", "hod", "user", "assigned_person"] as const;
export type AppRole = (typeof APP_ROLES)[number];

export const TICKET_STATUSES = ["open", "in_progress", "resolved", "closed", "reopened"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_PRIORITIES = ["low", "medium", "high", "critical"] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];
