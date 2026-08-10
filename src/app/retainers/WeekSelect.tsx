"use client";

import { useRouter } from "next/navigation";

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
        className="rounded border border-neutral-300 px-2.5 py-1.5 text-sm leading-none transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-700 dark:hover:bg-neutral-800"
      >
        ←
      </button>

      <select
        value={selected}
        onChange={(e) => go(e.currentTarget.value)}
        className="rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
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
        className="rounded border border-neutral-300 px-2.5 py-1.5 text-sm leading-none transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-700 dark:hover:bg-neutral-800"
      >
        →
      </button>

      {currentWeek && selected !== currentWeek && (
        <button
          type="button"
          onClick={() => go(currentWeek)}
          className="ml-1 rounded border border-neutral-300 px-2.5 py-1.5 text-sm transition hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          This week
        </button>
      )}
    </div>
  );
}
