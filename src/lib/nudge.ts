import { BRIEFS_PER_WEEK } from "@/lib/status";
import { sendOnce, slotReached, type SendOnceResult } from "@/lib/notify";
import { getWeekSnapshot, type CreatorProgress, type WeekSnapshot } from "@/lib/week-snapshot";

/**
 * Slack message copy.
 *
 * PROVISIONAL — the plumbing (dedupe, scheduling, data) is final, but this
 * wording is a placeholder until the exact format is supplied. Only these
 * template functions should need to change.
 */

function creatorLine(r: CreatorProgress): string {
  const note =
    r.delivered === 0 && r.uploaded > 0
      ? ` — uploaded ${r.uploaded} video${r.uploaded === 1 ? "" : "s"} but none labelled TOF`
      : "";
  return `• ${r.name} (@${r.handle}) — ${r.delivered}/${BRIEFS_PER_WEEK}${note}`;
}

function completeMessage(snap: WeekSnapshot, r: CreatorProgress): string {
  const remaining = snap.outstanding.length;
  return (
    `✅ ${r.name} (@${r.handle}) has hit ${BRIEFS_PER_WEEK}/${BRIEFS_PER_WEEK} for ${snap.week.isoWeek}.\n` +
    (remaining === 0
      ? `That's everyone — all ${snap.rows.length} creators are complete.`
      : `${remaining} still to go: ${snap.outstanding.map((o) => o.name).join(", ")}.`)
  );
}

function thursdayMessage(snap: WeekSnapshot): string {
  const header = `Thursday update — ${snap.week.isoWeek}`;
  if (snap.outstanding.length === 0) {
    return `${header}\nAll ${snap.rows.length} creators are at ${BRIEFS_PER_WEEK}/${BRIEFS_PER_WEEK}. Nothing outstanding.`;
  }
  return (
    `${header}\n` +
    `${snap.complete.length}/${snap.rows.length} complete · ${snap.outstanding.length} outstanding\n\n` +
    `Still short:\n${snap.outstanding.map(creatorLine).join("\n")}` +
    (snap.complete.length > 0
      ? `\n\nDone: ${snap.complete.map((c) => c.name).join(", ")}`
      : "")
  );
}

function saturdayMessage(snap: WeekSnapshot): string {
  if (snap.outstanding.length === 0) {
    return `Retainer check-in for ${snap.week.isoWeek}: all ${snap.rows.length} creators are at ${BRIEFS_PER_WEEK}/${BRIEFS_PER_WEEK}. Nothing outstanding.`;
  }
  return (
    `Retainer check-in for ${snap.week.isoWeek} — ${snap.outstanding.length} creator${snap.outstanding.length === 1 ? "" : "s"} not yet at ${BRIEFS_PER_WEEK}/${BRIEFS_PER_WEEK}:\n` +
    snap.outstanding.map(creatorLine).join("\n")
  );
}

/* ---------------------------------------------------------------- senders */

export type NudgeOutcome = {
  completions: { handle: string; result: SendOnceResult }[];
  thursday?: SendOnceResult & { skipped?: string };
  saturday?: SendOnceResult & { skipped?: string };
};

/**
 * Fires once, the first time a creator reaches the weekly target.
 *
 * Rides the 15-minute sync, so without the dedupe key this would re-send on
 * every run for the rest of the week.
 */
export async function sendCompletionAlerts(snap: WeekSnapshot) {
  const results: { handle: string; result: SendOnceResult }[] = [];

  for (const r of snap.complete) {
    const result = await sendOnce({
      dedupeKey: `${snap.week.isoWeek}:complete:${r.creatorId}`,
      kind: "creator_complete",
      weekId: snap.week.id,
      creatorId: r.creatorId,
      message: completeMessage(snap, r),
    });
    // Only worth reporting when something actually happened.
    if (result.sent || result.reason === "slack failed") results.push({ handle: r.handle, result });
  }

  return results;
}

/** Mid-week progress digest: Thursday 10:00 Europe/London, once per week. */
export async function maybeSendThursdayDigest(
  snap: WeekSnapshot,
  options: { force?: boolean } = {},
): Promise<SendOnceResult & { skipped?: string }> {
  if (!options.force && !slotReached("Thu", 10)) {
    return { sent: false, reason: "already sent", skipped: "not Thursday 10:00 yet" };
  }
  return sendOnce({
    dedupeKey: `${snap.week.isoWeek}:thursday`,
    kind: "thursday_digest",
    weekId: snap.week.id,
    message: thursdayMessage(snap),
  });
}

/** Pre-deadline chase list: Saturday 10:00 Europe/London, once per week. */
export async function maybeSendSaturdayNudge(
  options: { force?: boolean } = {},
): Promise<SendOnceResult & { skipped?: string }> {
  const snap = await getWeekSnapshot();
  if (!options.force && !slotReached("Sat", 10)) {
    return { sent: false, reason: "already sent", skipped: "not Saturday 10:00 yet" };
  }
  return sendOnce({
    dedupeKey: `${snap.week.isoWeek}:saturday`,
    kind: "saturday_nudge",
    weekId: snap.week.id,
    message: saturdayMessage(snap),
  });
}

/** Everything the 15-minute cron should consider sending, in one pass. */
export async function runNotifications(
  options: { force?: "thursday" | "saturday" } = {},
): Promise<NudgeOutcome> {
  const snap = await getWeekSnapshot();

  return {
    completions: await sendCompletionAlerts(snap),
    thursday: await maybeSendThursdayDigest(snap, {
      force: options.force === "thursday",
    }),
    saturday: await maybeSendSaturdayNudge({ force: options.force === "saturday" }),
  };
}
