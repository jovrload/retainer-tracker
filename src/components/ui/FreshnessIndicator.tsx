import { formatLondonClock, formatRelativeTime, isStale } from "@/lib/format";

/**
 * Freshness is part of the interface (Part 1 §8), and here it does a specific
 * defensive job (Part 2 §7): if the Vercel trial lapses, cron silently drops
 * from every 15 minutes to once a day. Stale is therefore a first-class state
 * with its own visual and its own words — not a timestamp the reader has to do
 * arithmetic on. The day the schedule breaks, the board says so.
 *
 * Sourced from the real `sync_runs` timestamp, never from page load.
 */
export function FreshnessIndicator({
  lastSyncedAt,
  now,
}: {
  lastSyncedAt: Date | null;
  now: Date;
}) {
  if (!lastSyncedAt) {
    return (
      <span className="inline-flex items-center gap-2 text-[13px] text-ink-2">
        <span className="h-2 w-2 shrink-0 rounded-full bg-ink-3" aria-hidden="true" />
        Never synced
      </span>
    );
  }

  const stale = isStale(lastSyncedAt, now);

  if (!stale) {
    return (
      <span className="inline-flex items-center gap-2 text-[13px] text-ink-2">
        <span className="h-2 w-2 shrink-0 rounded-full bg-green-mid" aria-hidden="true" />
        Synced {formatLondonClock(lastSyncedAt)}
      </span>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px]">
      <span className="inline-flex items-center gap-2 font-medium text-amber">
        <span className="h-2 w-2 shrink-0 rounded-full bg-amber" aria-hidden="true" />
        Last synced {formatRelativeTime(lastSyncedAt, now)}
      </span>
      <span className="text-ink-2">— the dashboard may be behind reality</span>
    </span>
  );
}
