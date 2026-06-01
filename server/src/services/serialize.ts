import { Unit } from "../models/Unit.js";
import { Department } from "../models/Department.js";
import { Profile } from "../models/Profile.js";
import { TicketRating } from "../models/TicketRating.js";

type AnyDoc = Record<string, any>;

function idStr(v: any): string | null {
  if (!v) return null;
  return v.toString();
}

/**
 * Attaches the join alias keys the frontend expects to a set of ticket docs:
 *   issue_dept, dept, unit, raiser, assigned_profile, assignee, closed_by_profile
 * Mirrors the embedded selects from the old Supabase queries. Operates in batch.
 */
export async function serializeTickets(ticketDocs: AnyDoc[]): Promise<AnyDoc[]> {
  const tickets = ticketDocs.map((t) => (typeof t.toJSON === "function" ? t.toJSON() : t));

  const unitIds = new Set<string>();
  const deptIds = new Set<string>();
  const userIds = new Set<string>();
  for (const t of tickets) {
    [t.unit_id].forEach((v) => idStr(v) && unitIds.add(idStr(v)!));
    [t.issue_department_id, t.department_id].forEach((v) => idStr(v) && deptIds.add(idStr(v)!));
    [t.raised_by, t.assigned_to, t.closed_by].forEach((v) => idStr(v) && userIds.add(idStr(v)!));
  }

  const ticketIds = tickets.map((t) => t.id ?? t._id?.toString()).filter(Boolean);
  const [units, depts, profiles, ratings] = await Promise.all([
    Unit.find({ _id: { $in: [...unitIds] } }).lean(),
    Department.find({ _id: { $in: [...deptIds] } }).lean(),
    Profile.find({ user_id: { $in: [...userIds] } }).lean(),
    TicketRating.find({ ticket_id: { $in: ticketIds } }).lean(),
  ]);
  const ratingMap = new Map(
    ratings.map((r) => [r.ticket_id.toString(), { rating: r.rating, feedback: r.feedback ?? null }])
  );

  const unitMap = new Map(units.map((u) => [u._id.toString(), { id: u._id.toString(), name: u.name }]));
  const deptMap = new Map(depts.map((d) => [d._id.toString(), { id: d._id.toString(), name: d.name }]));
  const profMap = new Map(
    profiles.map((p) => [
      p.user_id.toString(),
      {
        id: p._id.toString(),
        user_id: p.user_id.toString(),
        name: p.name,
        employee_id: p.employee_id ?? null,
        contact: p.contact ?? null,
        department_id: p.department_id ? p.department_id.toString() : null,
      },
    ])
  );

  return tickets.map((t) => {
    const assigned = idStr(t.assigned_to) ? profMap.get(idStr(t.assigned_to)!) ?? null : null;
    return {
      ...t,
      issue_dept: idStr(t.issue_department_id) ? deptMap.get(idStr(t.issue_department_id)!) ?? null : null,
      dept: idStr(t.department_id) ? deptMap.get(idStr(t.department_id)!) ?? null : null,
      unit: idStr(t.unit_id) ? unitMap.get(idStr(t.unit_id)!) ?? null : null,
      raiser: idStr(t.raised_by) ? profMap.get(idStr(t.raised_by)!) ?? null : null,
      assigned_profile: assigned,
      assignee: assigned,
      closed_by_profile: idStr(t.closed_by) ? profMap.get(idStr(t.closed_by)!) ?? null : null,
      closer: idStr(t.closed_by) ? profMap.get(idStr(t.closed_by)!) ?? null : null,
      rating: ratingMap.get(String(t.id ?? "")) ?? null,
    };
  });
}

export async function serializeTicket(ticketDoc: AnyDoc | null): Promise<AnyDoc | null> {
  if (!ticketDoc) return null;
  const [out] = await serializeTickets([ticketDoc]);
  return out;
}
