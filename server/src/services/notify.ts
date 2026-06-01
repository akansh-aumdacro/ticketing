import { Notification } from "../models/Notification.js";
import { NotificationPref } from "../models/NotificationPref.js";

// Maps a notification type to the NotificationPref column that gates it.
const TYPE_TO_PREF: Record<string, keyof PrefFlags> = {
  sla_breach: "sla_breach",
  sla_escalation: "sla_breach",
  sla_at_risk: "sla_at_risk",
  ticket_assigned: "ticket_assigned",
  ticket_message: "new_message",
  ticket_resolved: "ticket_resolved",
};

interface PrefFlags {
  sla_breach: boolean;
  sla_at_risk: boolean;
  ticket_assigned: boolean;
  new_message: boolean;
  ticket_resolved: boolean;
}

/**
 * Ports notify_user(): respect the user's notification preferences (defaulting
 * to enabled when no preference row exists), then insert a notification.
 * Never throws — notification failures must not block the triggering action.
 */
export async function notifyUser(opts: {
  user_id: string;
  type: string;
  title: string;
  message?: string | null;
  ticket_id?: string | null;
}): Promise<void> {
  try {
    const prefKey = TYPE_TO_PREF[opts.type];
    if (prefKey) {
      const pref = await NotificationPref.findOne({ user_id: opts.user_id }).lean();
      if (pref && pref[prefKey] === false) return; // user opted out
    }
    await Notification.create({
      user_id: opts.user_id,
      type: opts.type,
      title: opts.title,
      message: opts.message ?? null,
      ticket_id: opts.ticket_id ?? null,
    });
  } catch (err) {
    console.error("[notify] failed:", err);
  }
}
