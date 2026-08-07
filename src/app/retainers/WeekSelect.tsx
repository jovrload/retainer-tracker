"use client";

export function WeekSelect({
  weeks,
  selected,
}: {
  weeks: { isoWeek: string; isCurrent: boolean }[];
  selected: string;
}) {
  return (
    <form method="get">
      <select
        name="week"
        defaultValue={selected}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
      >
        {weeks.map((w) => (
          <option key={w.isoWeek} value={w.isoWeek}>
            {w.isoWeek}
            {w.isCurrent ? " (current)" : ""}
          </option>
        ))}
      </select>
    </form>
  );
}
