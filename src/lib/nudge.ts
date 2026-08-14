import { eq } from "drizzle-orm";
import { db } from "@/db";
import { creators, deliveries } from "@/db/schema";
import { getOrCreateCurrentWeek } from "@/lib/current-week";
import { postToSlack } from "@/lib/slack";

/** Current day/time as seen on a London wall clock. */
function getLondonNow(now: Date = new Date()) {
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

async function buildNudgeMessage(): Promise<string> {
  const week = await getOrCreateCurrentWeek();
  const activeCreators = await db.select().from(creators).where(eq(creators.active, true));
  const weekDeliveries = await db.select().from(deliveries).where(eq(deliveries.weekId, week.id));

  // Only briefed ("TOF") videos count, matching the dashboard. Unlabelled
  // uploads are called out separately so the nudge never reads as "delivered
  // nothing" when the real problem is a missing label.
  const rows = activeCreators.map((c) => {
    const mine = weekDeliveries.filter((d) => d.creatorId === c.id);
    return {
      creator: c,
      delivered: mine.filter((d) => d.isTof).length,
      uploaded: mine.length,
    };
  });

  const outstanding = rows.filter((r) => r.delivered < 3);

  if (outstanding.length === 0) {
    return `Retainer check-in for ${week.isoWeek}: all ${activeCreators.length} creators are at 3/3. Nothing outstanding.`;
  }

  const lines = outstanding
    .map((r) => {
      // Flagging total uploads matters most when it's high and TOF is zero:
      // that's a labelling problem, not a delivery one, and chasing them for
      // not filming would be wrong.
      const note =
        r.uploaded > r.delivered
          ? ` — uploaded ${r.uploaded} video${r.uploaded === 1 ? "" : "s"} this week${r.delivered === 0 ? ", none labelled TOF" : ""}`
          : "";
      return `• ${r.creator.name} (@${r.creator.handle}) — ${r.delivered}/3 TOF${note}`;
    })
    .join("\n");

  return `Retainer check-in for ${week.isoWeek} — ${outstanding.length} creator${outstanding.length === 1 ? "" : "s"} not yet at 3/3:\n${lines}`;
}

/**
 * Sends the outstanding-creators list to Slack, but only at Saturday
 * 10:00 Europe/London (checked on a real wall clock, so BST/GMT are
 * handled correctly without a hardcoded UTC offset).
 * Pass `force: true` to bypass the day/time check for manual testing.
 */
export async function maybeSendSaturdayNudge(
  options: { force?: boolean } = {},
): Promise<{ sent: boolean; reason?: string }> {
  if (!options.force) {
    const { weekday, hour, minute } = getLondonNow();
    const isScheduledMoment = weekday === "Sat" && hour === 10 && minute === 0;
    if (!isScheduledMoment) {
      return { sent: false, reason: "not the scheduled time" };
    }
  }

  const message = await buildNudgeMessage();
  await postToSlack(message);
  return { sent: true };
}
