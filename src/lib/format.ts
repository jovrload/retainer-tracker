/** `—` is the universal null placeholder, distinct from a real zero (Part 1 §11). */
export const NULL_DASH = "—";

export function formatRelativeTime(date: Date | null, now: Date = new Date()): string {
  if (!date) return "not yet";

  const diffMs = now.getTime() - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  const hours = Math.floor(diffMs / 3_600_000);
  const days = Math.floor(diffMs / 86_400_000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return formatLondonTime(date);
}

export function formatLondonTime(date: Date | null): string {
  if (!date) return NULL_DASH;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/** Wall clock only, for the freshness indicator: "14:32". */
export function formatLondonClock(date: Date | null): string {
  if (!date) return NULL_DASH;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

/** Day + time, for naming the deadline: "Sun 16 Aug, 23:59". */
export function formatDeadline(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

/**
 * Time remaining, phrased so the reader never has to do arithmetic.
 * Returns null once the deadline has passed — the caller says so in words.
 */
export function formatTimeLeft(dueAt: Date, now: Date): string | null {
  const ms = dueAt.getTime() - now.getTime();
  if (ms <= 0) return null;

  const totalHours = Math.floor(ms / 3_600_000);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;

  if (days > 0) {
    return hours > 0
      ? `${days} day${days === 1 ? "" : "s"} ${hours} hr${hours === 1 ? "" : "s"}`
      : `${days} day${days === 1 ? "" : "s"}`;
  }
  if (totalHours > 0) return `${totalHours} hour${totalHours === 1 ? "" : "s"}`;

  const minutes = Math.max(1, Math.floor(ms / 60_000));
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

/** How far through the week we are, 0–1. Drives the one sanctioned bar. */
export function weekProgress(startsAt: Date, dueAt: Date, now: Date): number {
  const span = dueAt.getTime() - startsAt.getTime();
  if (span <= 0) return 1;
  const elapsed = now.getTime() - startsAt.getTime();
  return Math.min(1, Math.max(0, elapsed / span));
}

/** Past this, the board may be behind reality and must say so (Part 2 §7). */
export const STALE_AFTER_MINUTES = 45;

export function isStale(lastSyncedAt: Date | null, now: Date): boolean {
  if (!lastSyncedAt) return true;
  return now.getTime() - lastSyncedAt.getTime() > STALE_AFTER_MINUTES * 60_000;
}
