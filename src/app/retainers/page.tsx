import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { creators, weeks, deliveries, briefs, syncRuns } from "@/db/schema";
import { getOrCreateCurrentWeek } from "@/lib/current-week";
import { formatRelativeTime, formatLondonTime } from "@/lib/format";
import { syncNow, sendBriefsForWeek } from "./actions";
import { WeekSelect } from "./WeekSelect";

type Status = "error" | "red" | "amber" | "green";

const STATUS_STYLES: Record<Status, string> = {
  error: "bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200",
  red: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  green: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
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

  const activeCreators = await db
    .select()
    .from(creators)
    .where(eq(creators.active, true));

  const weekDeliveries = await db
    .select()
    .from(deliveries)
    .where(eq(deliveries.weekId, selectedWeek.id));

  const weekBriefs = await db
    .select()
    .from(briefs)
    .where(eq(briefs.weekId, selectedWeek.id));

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

    const briefsSent = weekBriefs.filter((b) => b.creatorId === creator.id).length;
    const hasSyncError = erroredCreatorIds.has(creator.id);

    let status: Status;
    if (hasSyncError) status = "error";
    else if (delivered === 0) status = "red";
    else if (delivered < 3) status = "amber";
    else status = "green";

    return {
      creator,
      delivered,
      briefsSent,
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

  const briefsAlreadySentThisWeek = weekBriefs.length > 0;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Retainer delivery tracker</h1>
          <p className="text-sm text-neutral-500">
            Drive uploads only — this shows what&apos;s been filmed, not what&apos;s gone live on TikTok.
          </p>
        </div>
        <WeekSelect
          weeks={allWeeks.map((w) => ({ isoWeek: w.isoWeek, isCurrent: w.isoWeek === currentWeek.isoWeek }))}
          selected={selectedWeek.isoWeek}
        />
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm dark:border-neutral-800 dark:bg-neutral-900">
        <div className="text-neutral-600 dark:text-neutral-400">
          {latestSyncRun ? (
            <>
              Last synced {formatRelativeTime(latestSyncRun.finishedAt)}
              {latestSyncRun.errorCount > 0 && (
                <span className="ml-2 text-red-600 dark:text-red-400">
                  ({latestSyncRun.errorCount} error{latestSyncRun.errorCount === 1 ? "" : "s"} last run)
                </span>
              )}
            </>
          ) : (
            "Never synced yet"
          )}
        </div>
        <div className="flex gap-2">
          {isCurrentWeek && !briefsAlreadySentThisWeek && (
            <form action={sendBriefsForWeek.bind(null, selectedWeek.id)}>
              <button
                type="submit"
                className="rounded border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
              >
                Send briefs for {selectedWeek.isoWeek}
              </button>
            </form>
          )}
          {isCurrentWeek && briefsAlreadySentThisWeek && (
            <span className="px-3 py-1.5 text-sm text-neutral-500">
              Briefs sent for {selectedWeek.isoWeek}
            </span>
          )}
          {isCurrentWeek && (
            <form action={syncNow}>
              <button
                type="submit"
                className="rounded bg-neutral-900 px-3 py-1.5 text-sm text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
              >
                Sync now
              </button>
            </form>
          )}
        </div>
      </div>

      {!isCurrentWeek && (
        <p className="mb-4 text-sm text-neutral-500">
          Viewing {selectedWeek.isoWeek} — a past week, read-only.
        </p>
      )}

      <div className="overflow-x-auto rounded border border-neutral-200 dark:border-neutral-800">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900">
            <tr>
              <th className="px-4 py-3 font-medium">Creator</th>
              <th className="px-4 py-3 font-medium">Briefs sent</th>
              <th className="px-4 py-3 font-medium">Delivered</th>
              <th className="px-4 py-3 font-medium">Last upload</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ creator, delivered, briefsSent, lastUpload, anyLate, hasDuplicate, hasSyncError, status }) => (
              <tr key={creator.id} className="border-b border-neutral-100 last:border-0 dark:border-neutral-900">
                <td className="px-4 py-3">
                  <div className="font-medium">{creator.name}</div>
                  <div className="text-neutral-500">@{creator.handle}</div>
                </td>
                <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                  {briefsSent > 0 ? `${briefsSent}` : "not sent"}
                </td>
                <td className="px-4 py-3">
                  <span className="text-base font-semibold">{delivered}/3</span>
                  {hasDuplicate && (
                    <span
                      className="ml-2 rounded bg-purple-100 px-1.5 py-0.5 text-xs text-purple-800 dark:bg-purple-900/40 dark:text-purple-300"
                      title="Two files this week share an identical size — possible duplicate export"
                    >
                      possible duplicate
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400" title={formatLondonTime(lastUpload)}>
                  {formatRelativeTime(lastUpload)}
                  {anyLate && (
                    <span className="ml-2 rounded bg-orange-100 px-1.5 py-0.5 text-xs text-orange-800 dark:bg-orange-900/40 dark:text-orange-300">
                      late
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded px-2 py-1 text-xs font-medium ${STATUS_STYLES[status]}`}>
                    {hasSyncError ? "Sync error" : status === "red" ? "Outstanding" : status === "amber" ? "In progress" : "Complete"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
