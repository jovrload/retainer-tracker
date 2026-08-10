import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { creators, weeks, deliveries, briefTicks, syncRuns } from "@/db/schema";
import { getOrCreateCurrentWeek } from "@/lib/current-week";
import { formatRelativeTime, formatLondonTime } from "@/lib/format";
import { syncNow } from "./actions";
import { WeekSelect } from "./WeekSelect";
import { BriefDots } from "./BriefDots";

type Status = "error" | "red" | "amber" | "green";

const STATUS_STYLES: Record<Status, string> = {
  error: "bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200",
  red: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  green: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
};

const STATUS_LABELS: Record<Status, string> = {
  error: "Sync error",
  red: "Outstanding",
  amber: "In progress",
  green: "Complete",
};

const STATUS_RANK: Record<Status, number> = { error: 0, red: 1, amber: 2, green: 3 };

export default async function RetainersPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const params = await searchParams;

  const currentWeek = await getOrCreateCurrentWeek();
  const allWeeks = await db.select().from(weeks).orderBy(desc(weeks.startsAt));

  const selectedWeek =
    (params.week && allWeeks.find((w) => w.isoWeek === params.week)) || currentWeek;
  const isCurrentWeek = selectedWeek.isoWeek === currentWeek.isoWeek;

  const activeCreators = await db.select().from(creators).where(eq(creators.active, true));
  const weekDeliveries = await db
    .select()
    .from(deliveries)
    .where(eq(deliveries.weekId, selectedWeek.id));
  const weekTicks = await db
    .select()
    .from(briefTicks)
    .where(eq(briefTicks.weekId, selectedWeek.id));

  const [latestSyncRun] = await db
    .select()
    .from(syncRuns)
    .orderBy(desc(syncRuns.startedAt))
    .limit(1);

  const erroredCreatorIds = new Set<number>();
  if (latestSyncRun?.errorDetail) {
    try {
      const errors: { creatorId: number }[] = JSON.parse(latestSyncRun.errorDetail);
      errors.forEach((e) => erroredCreatorIds.add(e.creatorId));
    } catch {
      // errorDetail wasn't parseable JSON — treat as no structured errors known
    }
  }

  const rows = activeCreators.map((creator) => {
    const creatorDeliveries = weekDeliveries.filter((d) => d.creatorId === creator.id);
    const delivered = creatorDeliveries.length;
    const anyLate = creatorDeliveries.some((d) => d.isLate);
    const lastUpload = creatorDeliveries.reduce<Date | null>((latest, d) => {
      if (!d.createdTime) return latest;
      return !latest || d.createdTime > latest ? d.createdTime : latest;
    }, null);

    const sizeCounts = new Map<number, number>();
    creatorDeliveries.forEach((d) => {
      if (d.sizeBytes == null) return;
      sizeCounts.set(d.sizeBytes, (sizeCounts.get(d.sizeBytes) ?? 0) + 1);
    });
    const hasDuplicate = [...sizeCounts.values()].some((count) => count > 1);

    const briefsTicked = weekTicks
      .filter((t) => t.creatorId === creator.id)
      .map((t) => t.briefNo);
    const hasSyncError = erroredCreatorIds.has(creator.id);

    let status: Status;
    if (hasSyncError) status = "error";
    else if (delivered === 0) status = "red";
    else if (delivered < 3) status = "amber";
    else status = "green";

    return {
      creator,
      delivered,
      briefsTicked,
      lastUpload,
      anyLate,
      hasDuplicate,
      hasSyncError,
      status,
    };
  });

  rows.sort((a, b) => {
    const rankDiff = STATUS_RANK[a.status] - STATUS_RANK[b.status];
    if (rankDiff !== 0) return rankDiff;
    return a.creator.name.localeCompare(b.creator.name);
  });

  const completeCount = rows.filter((r) => r.status === "green").length;
  const outstandingCount = rows.filter((r) => r.status === "red").length;
  const inProgressCount = rows.filter((r) => r.status === "amber").length;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Retainer delivery tracker</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Drive uploads only — what&apos;s been filmed, not what&apos;s gone live on TikTok.
          </p>
        </div>
        <WeekSelect
          weeks={allWeeks.map((w) => ({
            isoWeek: w.isoWeek,
            isCurrent: w.isoWeek === currentWeek.isoWeek,
          }))}
          selected={selectedWeek.isoWeek}
        />
      </header>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Creators" value={rows.length} />
        <StatCard label="Complete" value={completeCount} tone="green" />
        <StatCard label="In progress" value={inProgressCount} tone="amber" />
        <StatCard label="Outstanding" value={outstandingCount} tone="red" />
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm dark:border-neutral-800 dark:bg-neutral-900/50">
        <div className="text-neutral-600 dark:text-neutral-400">
          <span className="font-medium text-neutral-900 dark:text-neutral-100">
            {selectedWeek.isoWeek}
          </span>
          <span className="mx-2 text-neutral-300 dark:text-neutral-700">·</span>
          due {formatLondonTime(selectedWeek.dueAt)}
          <span className="mx-2 text-neutral-300 dark:text-neutral-700">·</span>
          {latestSyncRun ? (
            <>
              synced {formatRelativeTime(latestSyncRun.finishedAt)}
              {latestSyncRun.errorCount > 0 && (
                <span className="ml-2 text-red-600 dark:text-red-400">
                  ({latestSyncRun.errorCount} error
                  {latestSyncRun.errorCount === 1 ? "" : "s"})
                </span>
              )}
            </>
          ) : (
            "never synced"
          )}
        </div>
        {isCurrentWeek && (
          <form action={syncNow}>
            <button
              type="submit"
              className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              Sync now
            </button>
          </form>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900/50">
            <tr>
              <th className="px-4 py-3 font-medium">Creator</th>
              <th className="px-4 py-3 font-medium">
                Briefs sent
                <span className="ml-1.5 font-normal normal-case text-neutral-400">
                  · tick by hand
                </span>
              </th>
              <th className="px-4 py-3 font-medium">
                Delivered
                <span className="ml-1.5 font-normal normal-case text-neutral-400">
                  · auto from Drive
                </span>
              </th>
              <th className="px-4 py-3 font-medium">Last upload</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.creator.id}
                className="border-b border-neutral-100 transition-colors last:border-0 hover:bg-neutral-50 dark:border-neutral-900 dark:hover:bg-neutral-900/40"
              >
                <td className="px-4 py-3">
                  <div className="font-medium">{row.creator.name}</div>
                  <div className="text-xs text-neutral-500">@{row.creator.handle}</div>
                </td>
                <td className="px-4 py-3">
                  <BriefDots
                    weekId={selectedWeek.id}
                    creatorId={row.creator.id}
                    initialTicked={row.briefsTicked}
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-semibold tabular-nums">
                      {row.delivered}/3
                    </span>
                    <DeliveredDots delivered={row.delivered} />
                  </div>
                  {row.hasDuplicate && (
                    <span
                      className="mt-1 inline-block rounded bg-purple-100 px-1.5 py-0.5 text-xs text-purple-700 dark:bg-purple-950 dark:text-purple-300"
                      title="Two files this week share an identical byte size — possible duplicate export"
                    >
                      possible duplicate
                    </span>
                  )}
                </td>
                <td
                  className="px-4 py-3 text-neutral-600 dark:text-neutral-400"
                  title={formatLondonTime(row.lastUpload)}
                >
                  {formatRelativeTime(row.lastUpload)}
                  {row.anyLate && (
                    <span className="ml-2 rounded bg-orange-100 px-1.5 py-0.5 text-xs text-orange-700 dark:bg-orange-950 dark:text-orange-300">
                      late
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[row.status]}`}
                  >
                    {STATUS_LABELS[row.status]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 space-y-1 text-xs text-neutral-500">
        <p>
          <span className="font-medium text-neutral-600 dark:text-neutral-400">Briefs sent</span> is
          yours to tick — briefs go out over WhatsApp, which this system can&apos;t see, so nothing
          here is automated and nothing is ever sent to a creator.
        </p>
        <p>
          <span className="font-medium text-neutral-600 dark:text-neutral-400">Delivered</span>{" "}
          updates itself every 15 minutes: it counts video files of at least 5MB that landed in each
          creator&apos;s Drive folder during the selected week.
        </p>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "green" | "amber" | "red";
}) {
  const toneClass =
    tone === "green"
      ? "text-green-600 dark:text-green-400"
      : tone === "amber"
        ? "text-amber-600 dark:text-amber-400"
        : tone === "red"
          ? "text-red-600 dark:text-red-400"
          : "text-neutral-900 dark:text-neutral-100";

  return (
    <div className="rounded-lg border border-neutral-200 px-4 py-3 dark:border-neutral-800">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${toneClass}`}>{value}</div>
    </div>
  );
}

/**
 * Three dots showing progress toward the 3-video target at a glance.
 * Not interactive — this reflects real Drive uploads, so it fills in on
 * its own. Deliberately drawn as solid dots (no ring) to distinguish it
 * from the clickable, hand-ticked brief dots.
 */
function DeliveredDots({ delivered }: { delivered: number }) {
  return (
    <span className="flex gap-1.5" aria-hidden="true">
      {[1, 2, 3].map((n) => (
        <span
          key={n}
          className={`h-4 w-4 rounded-full ${
            delivered >= n
              ? "bg-green-500 dark:bg-green-400"
              : "bg-neutral-200 dark:bg-neutral-800"
          }`}
        />
      ))}
    </span>
  );
}
