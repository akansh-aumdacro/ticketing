import { Router } from "express";
import { z } from "zod";
import { Ticket } from "../models/Ticket.js";
import { TicketHistory } from "../models/TicketHistory.js";
import { TicketMessage } from "../models/TicketMessage.js";
import { TicketRating } from "../models/TicketRating.js";
import { TicketAttachment } from "../models/TicketAttachment.js";
import { Notification } from "../models/Notification.js";
import { Profile } from "../models/Profile.js";
import { requireAuth, requireRole, asyncHandler } from "../auth/middleware.js";
import { nextTicketNumber } from "../services/ticketNumber.js";
import { computeSla } from "../services/sla.js";
import { emitTicketChangeMessages, getUserName } from "../services/ticketEvents.js";
import { notifyUser } from "../services/notify.js";
import { serializeTickets, serializeTicket } from "../services/serialize.js";
import { ticketVisibilityFilter, canUpdateTicket } from "../services/ticketAccess.js";
import type { FilterQuery } from "mongoose";

export const ticketsRouter = Router();
ticketsRouter.use(requireAuth);

// ---- List (scoped) -------------------------------------------------------
ticketsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = req.query;
    const filters: FilterQuery<any>[] = [await ticketVisibilityFilter(req.user!)];

    if (q.mine === "true") filters.push({ raised_by: req.user!.sub });
    if (q.assigned === "true") filters.push({ assigned_to: req.user!.sub });
    if (q.has_assignee === "true") filters.push({ assigned_to: { $ne: null } });
    if (typeof q.department === "string") filters.push({ issue_department_id: q.department });
    if (typeof q.status === "string") filters.push({ status: { $in: q.status.split(",") } });
    if (typeof q.not_status === "string") filters.push({ status: { $nin: q.not_status.split(",") } });
    if (q.overdue === "true") {
      filters.push({ target_date: { $lt: new Date() }, status: { $nin: ["resolved", "closed"] } });
    }

    const docs = await Ticket.find({ $and: filters }).sort({ created_at: -1 });
    res.json(await serializeTickets(docs));
  })
);

// ---- Get one -------------------------------------------------------------
ticketsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ error: "Ticket not found" });
    res.json(await serializeTicket(ticket));
  })
);

// ---- Create --------------------------------------------------------------
const createSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  unit_id: z.string().optional().nullable(),
  department_id: z.string().optional().nullable(),
  issue_department_id: z.string().optional().nullable(),
  priority: z.enum(["low", "medium", "high", "critical"]).optional(),
  attachments: z.array(z.any()).optional(),
  photo_url: z.string().optional().nullable(),
});

ticketsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = createSchema.parse(req.body);
    const now = new Date();
    const priority = body.priority ?? "medium";
    const sla = computeSla(priority, now);
    const ticket = await Ticket.create({
      ...body,
      priority,
      raised_by: req.user!.sub,
      ticket_number: await nextTicketNumber(),
      ...sla,
    });
    res.json(await serializeTicket(ticket));
  })
);

// ---- Update (assignment / status / dates) --------------------------------
const UPDATABLE = [
  "assigned_to", "status", "target_date", "next_target_date", "remarks",
  "closing_remarks", "closed_at", "closed_by", "reopened_at", "reopen_remarks",
  "reopen_photo_url", "priority", "issue_department_id", "attachments", "photo_url",
] as const;

ticketsRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ error: "Ticket not found" });
    if (!canUpdateTicket(req.user!, ticket as any)) {
      return res.status(403).json({ error: "You cannot modify this ticket" });
    }

    const prevStatus = ticket.get("status");
    const prevAssignedTo = ticket.get("assigned_to") ? String(ticket.get("assigned_to")) : null;

    const updates: Record<string, unknown> = {};
    for (const key of UPDATABLE) {
      if (key in req.body) updates[key] = req.body[key];
    }

    // assigned_at set on first assignment
    if ("assigned_to" in updates && updates.assigned_to && !prevAssignedTo) {
      updates.assigned_at = new Date();
    }
    // recompute SLA on priority change
    if ("priority" in updates && updates.priority !== ticket.get("priority")) {
      Object.assign(updates, computeSla(updates.priority as any, ticket.get("created_at")));
    }

    ticket.set(updates);
    await ticket.save();

    const nextStatus = ticket.get("status");
    const nextAssignedTo = ticket.get("assigned_to") ? String(ticket.get("assigned_to")) : null;
    const actorName = await getUserName(req.user!.sub);
    await emitTicketChangeMessages({
      ticketId: ticket.id,
      prevAssignedTo,
      nextAssignedTo,
      prevStatus,
      nextStatus,
      actorName,
    });

    res.json(await serializeTicket(ticket));
  })
);

// ---- Delete (super-admin only, cascade) ----------------------------------
ticketsRouter.delete(
  "/:id",
  requireRole("super_admin"),
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    await Promise.all([
      TicketHistory.deleteMany({ ticket_id: id }),
      TicketMessage.deleteMany({ ticket_id: id }),
      TicketRating.deleteMany({ ticket_id: id }),
      TicketAttachment.deleteMany({ ticket_id: id }),
      Notification.deleteMany({ ticket_id: id }),
    ]);
    await Ticket.findByIdAndDelete(id);
    res.json({ success: true });
  })
);

// ======================= Sub-resources ====================================

// ---- History -------------------------------------------------------------
ticketsRouter.get(
  "/:id/history",
  asyncHandler(async (req, res) => {
    const rows = await TicketHistory.find({ ticket_id: req.params.id }).sort({ created_at: 1 }).lean();
    const performerIds = [...new Set(rows.map((r) => r.performed_by?.toString()).filter(Boolean))];
    const profiles = await Profile.find({ user_id: { $in: performerIds } }).lean();
    const nameMap = new Map(profiles.map((p) => [p.user_id.toString(), { name: p.name }]));
    res.json(
      rows.map((r) => ({
        ...r,
        id: r._id.toString(),
        _id: undefined,
        performer: r.performed_by ? nameMap.get(r.performed_by.toString()) ?? null : null,
      }))
    );
  })
);

ticketsRouter.post(
  "/:id/history",
  asyncHandler(async (req, res) => {
    const { action, old_status, new_status, remarks } = req.body;
    const row = await TicketHistory.create({
      ticket_id: req.params.id,
      action,
      performed_by: req.user!.sub,
      old_status: old_status ?? null,
      new_status: new_status ?? null,
      remarks: remarks ?? null,
    });
    res.json(row.toJSON());
  })
);

// ---- Messages ------------------------------------------------------------
ticketsRouter.get(
  "/:id/messages",
  asyncHandler(async (req, res) => {
    const rows = await TicketMessage.find({ ticket_id: req.params.id }).sort({ created_at: 1 });
    res.json(rows.map((r) => r.toJSON()));
  })
);

const messageSchema = z.object({
  message: z.string().optional().nullable(),
  attachments: z.array(z.any()).optional(),
});

ticketsRouter.post(
  "/:id/messages",
  asyncHandler(async (req, res) => {
    const body = messageSchema.parse(req.body);
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ error: "Ticket not found" });
    if (!["open", "in_progress", "reopened"].includes(ticket.get("status"))) {
      return res.status(400).json({ error: "This thread is read-only" });
    }

    const profile = await Profile.findOne({ user_id: req.user!.sub }).lean();
    const message = await TicketMessage.create({
      ticket_id: ticket.id,
      sender_id: req.user!.sub,
      sender_name: profile?.name ?? "User",
      sender_role: req.user!.role,
      message: body.message ?? null,
      attachments: body.attachments ?? [],
      is_system_message: false,
    });

    // Port trg_ticket_messages_notify: first-response stamp + notify the other party.
    const raisedBy = String(ticket.get("raised_by"));
    const assignedTo = ticket.get("assigned_to") ? String(ticket.get("assigned_to")) : null;
    if (assignedTo === req.user!.sub && !ticket.get("first_response_at")) {
      ticket.set("first_response_at", new Date());
      await ticket.save();
    }
    const recipient = req.user!.sub === raisedBy ? assignedTo : raisedBy;
    if (recipient && recipient !== req.user!.sub) {
      await notifyUser({
        user_id: recipient,
        type: "ticket_message",
        title: "New Message",
        message: `New message on ticket ${ticket.get("ticket_number")}`,
        ticket_id: ticket.id,
      });
    }

    res.json(message.toJSON());
  })
);

// ---- Rating --------------------------------------------------------------
ticketsRouter.get(
  "/:id/rating",
  asyncHandler(async (req, res) => {
    const rating = await TicketRating.findOne({ ticket_id: req.params.id });
    res.json(rating ? rating.toJSON() : null);
  })
);

ticketsRouter.post(
  "/:id/rating",
  asyncHandler(async (req, res) => {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ error: "Ticket not found" });
    if (ticket.get("status") !== "closed") {
      return res.status(400).json({ error: "Only closed tickets can be rated" });
    }
    if (String(ticket.get("raised_by")) !== req.user!.sub) {
      return res.status(403).json({ error: "Only the ticket raiser can rate it" });
    }
    if (await TicketRating.findOne({ ticket_id: ticket.id })) {
      return res.status(400).json({ error: "This ticket has already been rated" });
    }
    const rating = await TicketRating.create({
      ticket_id: ticket.id,
      rated_by: req.user!.sub,
      rating: req.body.rating,
      feedback: req.body.feedback ?? null,
    });
    res.json(rating.toJSON());
  })
);
