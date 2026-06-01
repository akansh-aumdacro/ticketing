import { Types } from "mongoose";
import { Profile } from "../models/Profile.js";
import { TicketMessage } from "../models/TicketMessage.js";

export async function getUserName(userId: Types.ObjectId | string | null | undefined): Promise<string> {
  if (!userId) return "Someone";
  const profile = await Profile.findOne({ user_id: userId }).lean();
  return profile?.name ?? "Someone";
}

export async function addSystemMessage(ticketId: string | Types.ObjectId, text: string) {
  await TicketMessage.create({
    ticket_id: ticketId,
    sender_id: ticketId, // placeholder sender for system rows; not user-facing
    sender_name: "System",
    sender_role: "system",
    message: text,
    is_system_message: true,
  });
}

/**
 * Ports notify_ticket_change(): emits system chat messages when a ticket's
 * assignment or status changes. `actorName` is the user performing the change.
 */
export async function emitTicketChangeMessages(opts: {
  ticketId: string | Types.ObjectId;
  prevAssignedTo: string | null;
  nextAssignedTo: string | null;
  prevStatus: string;
  nextStatus: string;
  actorName: string;
}) {
  const { ticketId } = opts;

  if (String(opts.prevAssignedTo ?? "") !== String(opts.nextAssignedTo ?? "") && opts.nextAssignedTo) {
    const name = await getUserName(opts.nextAssignedTo);
    await addSystemMessage(ticketId, `Ticket assigned to ${name}`);
  }

  if (opts.prevStatus !== opts.nextStatus) {
    if (opts.nextStatus === "resolved" || opts.nextStatus === "closed") {
      await addSystemMessage(
        ticketId,
        `Ticket ${opts.nextStatus} by ${opts.actorName}. Thread is now read-only.`
      );
    } else {
      await addSystemMessage(ticketId, `Status changed to ${opts.nextStatus}`);
    }
  }
}
