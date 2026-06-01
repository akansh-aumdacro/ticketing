import { Counter } from "../models/Counter.js";

// Ports generate_ticket_number(): TKT-<year>-<0001>, atomic per-year sequence.
export async function nextTicketNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const counter = await Counter.findByIdAndUpdate(
    `ticket-${year}`,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  const seq = String(counter!.seq).padStart(4, "0");
  return `TKT-${year}-${seq}`;
}
