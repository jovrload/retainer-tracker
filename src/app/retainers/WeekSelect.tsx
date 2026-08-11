"use client";

import { useRouter } from "next/navigation";
import { buttonSecondary } from "@/components/ui/Button";

export function WeekSelect({
  weeks,
  selected,
}: {
  weeks: { isoWeek: string; isCurrent: boolean }[];
  selected: string;
}) {
  const router = useRouter();
  const index = weeks.findIndex((w) => w.isoWeek === selected);

  // `weeks` is newest-first, so "older" is a higher index.
  const olderWeek = weeks[index + 1]?.isoWeek;
  const newerWeek = weeks[index - 1]?.isoWeek;
  const currentWeek = weeks.find((w) => w.isCurrent)?.isoWeek;

  function go(isoWeek?: string) {
    if (!isoWeek) return;
    router.push(`/retainers?week=${isoWeek}`);
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => go(olderWeek)}
        disabled={!olderWeek}
        aria-label="Previous week"
        className={`${buttonSecondary} w-9 px-0 md:w-8`}
      >
        <span aria-hidden="true">←</span>
      </button>

      <select
        value={selected}
        onChange={(e) => go(e.currentTarget.value)}
        aria-label="Week"
        className="min-h-9 rounded-xl border border-line bg-surface px-3 text-sm font-medium text-ink outline-none transition-colors duration-150 hover:border-line-hover focus-visible:ring-2 focus-visible:ring-ink/25 md:min-h-8"
      >
        {weeks.map((w) => (
          <option key={w.isoWeek} value={w.isoWeek}>
            {w.isoWeek}
            {w.isCurrent ? " (current)" : ""}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={() => go(newerWeek)}
        disabled={!newerWeek}
        aria-label="Next week"
        className={`${buttonSecondary} w-9 px-0 md:w-8`}
      >
        <span aria-hidden="true">→</span>
      </button>

      {/* Always reachable while viewing history (Part 2 §10). */}
      {currentWeek && selected !== currentWeek && (
        <button type="button" onClick={() => go(currentWeek)} className={buttonSecondary}>
          This week
        </button>
      )}
    </div>
  );
}
