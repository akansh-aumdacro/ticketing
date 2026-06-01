import type { TicketPriority } from "../models/_base.js";

// Ports compute_sla_hours(): priority -> [response_hours, resolution_hours].
const SLA_HOURS: Record<TicketPriority, { response: number; resolution: number }> = {
  critical: { response: 1, resolution: 8 },
  high: { response: 4, resolution: 24 },
  medium: { response: 12, resolution: 48 },
  low: { response: 24, resolution: 72 },
};

export function computeSla(priority: TicketPriority, createdAt: Date) {
  const { response, resolution } = SLA_HOURS[priority] ?? SLA_HOURS.medium;
  return {
    sla_response_due_at: new Date(createdAt.getTime() + response * 3600_000),
    sla_due_at: new Date(createdAt.getTime() + resolution * 3600_000),
  };
}
