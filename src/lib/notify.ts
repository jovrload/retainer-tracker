import { eq } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { postToSlack } from "@/lib/slack";

/** Current weekday/time on a real London wall clock, so BST/GMT need no offset. */
export function londonNow(now: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/London",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return { weekday: map.weekday, hour: Number(map.hour), minute: Number(map.minute) };
}

export type SendOnceResult =
  | { sent: true }
  | { sent: false; reason: "already sent" | "slack failed"; error?: string };

/**
 * Posts to Slack at most once for a given key, ever.
 *
 * The claim is staked in Postgres *before* the message goes out, and the
 * unique index on `dedupeKey` is what enforces it — so two syncs running
 * concurrently can't both win the race and double-post. If Slack then fails,
 * the claim is released so the next run can retry rather than the message
 * being lost for good.
 */
export async function sendOnce(opts: {
  dedupeKey: string;
  kind: string;
  weekId: number;
  creatorId?: number;
  message: string;
}): Promise<SendOnceResult> {
  const claimed = await db
    .insert(notifications)
    .values({
      dedupeKey: opts.dedupeKey,
      kind: opts.kind,
      weekId: opts.weekId,
      creatorId: opts.creatorId ?? null,
    })
    .onConflictDoNothing({ target: notifications.dedupeKey })
    .returning({ id: notifications.id });

  if (claimed.length === 0) return { sent: false, reason: "already sent" };

  try {
    await postToSlack(opts.message);
    return { sent: true };
  } catch (err) {
    // Roll the claim back so a transient Slack outage doesn't permanently
    // swallow the message.
    await db.delete(notifications).where(eq(notifications.id, claimed[0].id));
    return {
      sent: false,
      reason: "slack failed",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * True once a weekly slot has arrived, rather than only at its exact minute.
 *
 * Vercel cron drifts, so an exact `minute === 0` check would silently skip a
 * whole week whenever a run landed a minute late. Pairing "at or after the
 * hour" with a dedupe key gives one send, reliably, on the first run past the
 * slot.
 */
export function slotReached(
  weekday: string,
  hour: number,
  now: Date = new Date(),
): boolean {
  const t = londonNow(now);
  return t.weekday === weekday && t.hour >= hour;
}
