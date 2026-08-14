import { BRIEFS_PER_WEEK } from "@/lib/status";
import { formatTimeLeft, formatRelativeTime } from "@/lib/format";
import { sendOnce, slotReached, type SendOnceResult } from "@/lib/notify";
import { getWeekSnapshot, type CreatorProgress, type WeekSnapshot } from "@/lib/week-snapshot";

/**
 * Slack message copy.
 *
 * Scannable by design: one emoji per creator so the answer is visible without
 * reading. Green tick = at target, red cross = short, warning = the folder
 * check failed so no claim can be made (an unknown count must never be shown
 * as a zero, which a red cross would imply).
 *
 * Slack mrkdwn uses *single* asterisks for bold, not markdown's double.
 */
const TICK = "✅";
const CROSS = "❌";
const WARN = "⚠️";

function marker(r: CreatorProgress): string {
  if (r.delivered === null) return WARN;
  return r.isComplete ? TICK : CROSS;
}

/** "❌ Luke — 0/3 · 9 uploaded, none labelled TOF" */
function line(r: CreatorProgress): string {
  if (r.delivered === null) {
    return `${WARN} *${r.name}* — couldn't check their folder`;
  }

  const head = `${marker(r)} *${r.name}* — ${r.delivered}/${BRIEFS_PER_WEEK}`;

  // The distinction that matters most: uploads with no TOF label is a
  // labelling problem, not a delivery one. Chasing them for not filming
  // would be wrong.
  if (r.delivered === 0 && r.uploaded > 0) {
    return `${head} · ${r.uploaded} video${r.uploaded === 1 ? "" : "s"} uploaded, none labelled TOF`;
  }
  if (r.uploaded > r.delivered) {
    return `${head} · ${r.uploaded} uploaded in total`;
  }
  return head;
}

/** Instant ping the moment someone reaches the target. Kept short. */
function completeMessage(snap: WeekSnapshot, r: CreatorProgress): string {
  // Guard against listing the completer among those still to go, which would
  // read as a contradiction.
  const others = snap.outstanding.filter((o) => o.creatorId !== r.creatorId);
  const when = r.lastUpload ? ` · last upload ${formatRelativeTime(r.lastUpload)}` : "";

  // A full roll-call gets unwieldy at eight creators; a few names plus a
  // count carries the same information.
  const MAX_NAMES = 4;
  const named = others.slice(0, MAX_NAMES).map((o) => o.name);
  const extra = others.length - named.length;
  const tail = named.join(", ") + (extra > 0 ? ` +${extra} more` : "");

  return [
    `${TICK} *${r.name}* hit ${BRIEFS_PER_WEEK}/${BRIEFS_PER_WEEK} for ${snap.week.isoWeek}`,
    `@${r.handle}${when}`,
    "",
    others.length === 0
      ? `That's everyone — all ${snap.rows.length} creators are done. 🎉`
      : `${others.length} still to go: ${tail}`,
  ].join("\n");
}

/** Mid-week status board. Everyone listed, worst first. */
function thursdayMessage(snap: WeekSnapshot, now: Date): string {
  const left = formatTimeLeft(snap.week.dueAt, now);
  const header = `*Thursday check-in — ${snap.week.isoWeek}*`;
  const summary = `${snap.complete.length} of ${snap.rows.length} at ${BRIEFS_PER_WEEK}/${BRIEFS_PER_WEEK}${
    left ? ` · ${left} left` : " · deadline passed"
  }`;

  return [header, summary, "", ...snap.rows.map(line)].join("\n");
}

/** Pre-deadline chase list. */
function saturdayMessage(snap: WeekSnapshot, now: Date): string {
  const left = formatTimeLeft(snap.week.dueAt, now);

  if (snap.outstanding.length === 0 && snap.unknown.length === 0) {
    return [
      `${TICK} *${snap.week.isoWeek} — all clear*`,
      `All ${snap.rows.length} creators are at ${BRIEFS_PER_WEEK}/${BRIEFS_PER_WEEK}. Nothing to chase.`,
    ].join("\n");
  }

  return [
    `*Saturday chase list — ${snap.week.isoWeek}*`,
    `${snap.outstanding.length} still short${left ? ` · ${left} until the deadline` : ""}`,
    "",
    ...snap.rows.map(line),
  ].join("\n");
}

/* ---------------------------------------------------------------- senders */

export type NudgeOutcome = {
  completions: { handle: string; result: SendOnceResult }[];
  thursday?: SendOnceResult & { skipped?: string };
  saturday?: SendOnceResult & { skipped?: string };
};

/**
 * Fires the moment a creator reaches the target — this rides the 15-minute
 * sync, so it lands within a quarter hour of the video appearing. The dedupe
 * key is what stops it re-sending on every subsequent run.
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
    if (result.sent || result.reason === "slack failed") results.push({ handle: r.handle, result });
  }

  return results;
}

/** Weekly check-in: Thursday 10:00 Europe/London, once per week. */
export async function maybeSendThursdayDigest(
  snap: WeekSnapshot,
  options: { force?: boolean; now?: Date } = {},
): Promise<SendOnceResult & { skipped?: string }> {
  const now = options.now ?? new Date();
  if (!options.force && !slotReached("Thu", 10, now)) {
    return { sent: false, reason: "already sent", skipped: "not Thursday 10:00 yet" };
  }
  return sendOnce({
    dedupeKey: `${snap.week.isoWeek}:thursday`,
    kind: "thursday_digest",
    weekId: snap.week.id,
    message: thursdayMessage(snap, now),
  });
}

/** Pre-deadline chase list: Saturday 10:00 Europe/London, once per week. */
export async function maybeSendSaturdayNudge(
  options: { force?: boolean; now?: Date } = {},
): Promise<SendOnceResult & { skipped?: string }> {
  const now = options.now ?? new Date();
  const snap = await getWeekSnapshot();
  if (!options.force && !slotReached("Sat", 10, now)) {
    return { sent: false, reason: "already sent", skipped: "not Saturday 10:00 yet" };
  }
  return sendOnce({
    dedupeKey: `${snap.week.isoWeek}:saturday`,
    kind: "saturday_nudge",
    weekId: snap.week.id,
    message: saturdayMessage(snap, now),
  });
}

/** Everything the 15-minute cron should consider sending, in one pass. */
export async function runNotifications(
  options: { force?: "thursday" | "saturday" } = {},
): Promise<NudgeOutcome> {
  const now = new Date();
  const snap = await getWeekSnapshot();

  return {
    completions: await sendCompletionAlerts(snap),
    thursday: await maybeSendThursdayDigest(snap, {
      force: options.force === "thursday",
      now,
    }),
    saturday: await maybeSendSaturdayNudge({ force: options.force === "saturday", now }),
  };
}

/**
 * Renders the messages without sending, so the format can be reviewed.
 *
 * For the completion example it promotes the furthest-along creator into a
 * consistent snapshot — otherwise the preview would show them as complete and
 * still-to-go at once, which the real sender can never do.
 */
export async function previewMessages(): Promise<Record<string, string>> {
  const now = new Date();
  const snap = await getWeekSnapshot();

  const candidate =
    snap.complete[0] ?? [...snap.rows].reverse().find((r) => r.delivered !== null);

  let completion = "(no creators to preview)";
  if (candidate) {
    const promoted: CreatorProgress = {
      ...candidate,
      delivered: BRIEFS_PER_WEEK,
      isComplete: true,
    };
    const consistent: WeekSnapshot = {
      ...snap,
      rows: snap.rows.map((r) => (r.creatorId === promoted.creatorId ? promoted : r)),
      complete: [promoted, ...snap.complete.filter((c) => c.creatorId !== promoted.creatorId)],
      outstanding: snap.outstanding.filter((o) => o.creatorId !== promoted.creatorId),
    };
    completion = completeMessage(consistent, promoted);
  }

  return {
    completion,
    thursday: thursdayMessage(snap, now),
    saturday: saturdayMessage(snap, now),
  };
}
