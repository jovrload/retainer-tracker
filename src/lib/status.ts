/**
 * Time-aware delivery status — UI handover Part 2 §4.
 *
 * The counting logic is unchanged; only the colour is. A pure state machine
 * (0 = red) painted all eight rows red every Monday, which taught the reader
 * to ignore red by the time Saturday — the one moment the board matters —
 * came round. Here red only appears once it means "do something today".
 */

export type StatusKind = "unknown" | "outstanding" | "behind" | "ontrack" | "complete";

/** How close the deadline has to be before a shortfall stops being routine. */
export const DEADLINE_CLOSE_HOURS = 48;

export const BRIEFS_PER_WEEK = 3;

export function resolveStatus(opts: {
  delivered: number;
  dueAt: Date;
  now: Date;
  /** This creator's folder check failed, or the whole sync is down. */
  isUnknown: boolean;
}): StatusKind {
  const { delivered, dueAt, now, isUnknown } = opts;

  // Unknown outranks everything: we can't make a claim about this creator.
  if (isUnknown) return "unknown";
  if (delivered >= BRIEFS_PER_WEEK) return "complete";

  const hoursLeft = (dueAt.getTime() - now.getTime()) / 3_600_000;
  const deadlineClose = hoursLeft <= DEADLINE_CLOSE_HOURS;

  // Most of the week lives here. Grey is honest: short, but not yet late.
  if (!deadlineClose) return "ontrack";

  // Ambiguous once the deadline is near — might still land, might not.
  return delivered === 0 ? "outstanding" : "behind";
}

/** Unknown sorts above outstanding: a broken pipe isn't a creator who's behind. */
export const STATUS_RANK: Record<StatusKind, number> = {
  unknown: 0,
  outstanding: 1,
  behind: 2,
  ontrack: 3,
  complete: 4,
};

/** Every pill carries its word, never colour alone (Part 2 §12). */
export const STATUS_LABEL: Record<StatusKind, string> = {
  unknown: "Can't tell",
  outstanding: "Outstanding",
  behind: "Behind",
  ontrack: "On track",
  complete: "Complete",
};

export const STATUS_EXPLAINER: Record<StatusKind, string> = {
  unknown: "The last check of this creator's Drive folder failed, so the count is unknown.",
  outstanding: "Nothing delivered and the deadline is close. Needs chasing today.",
  behind: "Short of three with the deadline close. May still land.",
  ontrack: "Short of three, but the deadline is still comfortably away.",
  complete: "Three or more qualifying videos delivered this week.",
};
