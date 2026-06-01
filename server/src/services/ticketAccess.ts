import { Profile } from "../models/Profile.js";
import { Role } from "../models/Role.js";
import type { JwtPayload } from "../auth/jwt.js";
import type { FilterQuery } from "mongoose";

/** Whether the role's permissions grant tickets.viewAll (ports user_can_view_all_tickets). */
export async function roleCanViewAll(role: string): Promise<boolean> {
  if (role === "super_admin" || role === "admin") return true;
  const roleDoc = await Role.findOne({ name: role }).lean();
  const perms = roleDoc?.permissions as any;
  return Boolean(perms?.tickets?.viewAll);
}

/**
 * Builds a Mongo filter implementing the ticket SELECT visibility rule (RLS):
 * visible if raised_by/assigned_to is me, OR my department === issue_department_id,
 * OR I'm super_admin/admin, OR my role grants viewAll.
 * Returns {} (no restriction) for full-visibility roles.
 */
export async function ticketVisibilityFilter(user: JwtPayload): Promise<FilterQuery<any>> {
  if (await roleCanViewAll(user.role)) return {};
  const profile = await Profile.findOne({ user_id: user.sub }).lean();
  const or: FilterQuery<any>[] = [{ raised_by: user.sub }, { assigned_to: user.sub }];
  if (profile?.department_id) or.push({ issue_department_id: profile.department_id });
  return { $or: or };
}

/** Whether the user may update the given ticket (assignee/creator/hod/admin/super). */
export function canUpdateTicket(user: JwtPayload, ticket: { raised_by: any; assigned_to: any }): boolean {
  if (["super_admin", "admin", "hod"].includes(user.role)) return true;
  return String(ticket.raised_by) === user.sub || String(ticket.assigned_to ?? "") === user.sub;
}
