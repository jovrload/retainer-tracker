import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { creators, deliveries, syncRuns } from "@/db/schema";
import { getOrCreateCurrentWeek } from "@/lib/current-week";
import { BRIEFS_PER_WEEK } from "@/lib/status";

export type CreatorProgress = {
  creatorId: number;
  name: string;
  handle: string;
  /**
   * Briefed (TOF) videos — the number that counts. null when the folder check
   * failed: an unknown count must never be reported as zero.
   */
  delivered: number | null;
  /** Every qualifying video uploaded this week, briefed or not. */
  uploaded: number;
  isComplete: boolean;
  lastUpload: Date | null;
  /** Why the count is unknown, when it is. */
  errorMessage?: string;
};

export type WeekSnapshot = {
  week: { id: number; isoWeek: string; startsAt: Date; dueAt: Date };
  rows: CreatorProgress[];
  complete: CreatorProgress[];
  /** Short of target and known to be short. */
  outstanding: CreatorProgress[];
  /** Folder check failed, so no claim can be made either way. */
  unknown: CreatorProgress[];
  target: number;
};

/**
 * Everything any Slack message might need about the current week, gathered
 * once. Deliberately free of wording so the templates are pure formatting and
 * the numbers can't drift between the dashboard and the alerts.
 */
export async function getWeekSnapshot(): Promise<WeekSnapshot> {
  const week = await getOrCreateCurrentWeek();
  const activeCreators = await db.select().from(creators).where(eq(creators.active, true));
  const weekDeliveries = await db.select().from(deliveries).where(eq(deliveries.weekId, week.id));

  const [latestRun] = await db
    .select()
    .from(syncRuns)
    .orderBy(desc(syncRuns.startedAt))
    .limit(1);

  const syncErrors = new Map<number, string>();
  if (latestRun?.errorDetail) {
    try {
      const parsed: { creatorId: number; message?: string }[] = JSON.parse(latestRun.errorDetail);
      parsed.forEach((e) => syncErrors.set(e.creatorId, e.message ?? "The folder check failed."));
    } catch {
      // Unparseable detail — we know the run erred but not for whom.
    }
  }
  const everyFolderFailed =
    !!latestRun && latestRun.creatorsChecked > 0 && latestRun.errorCount >= latestRun.creatorsChecked;

  const rows: CreatorProgress[] = activeCreators
    .map((c) => {
      const mine = weekDeliveries.filter((d) => d.creatorId === c.id);
      const briefed = mine.filter((d) => d.isTof);
      const isUnknown = everyFolderFailed || syncErrors.has(c.id);
      const delivered = isUnknown ? null : briefed.length;

      return {
        creatorId: c.id,
        name: c.name,
        handle: c.handle,
        delivered,
        uploaded: isUnknown ? 0 : mine.length,
        isComplete: delivered !== null && delivered >= BRIEFS_PER_WEEK,
        lastUpload: isUnknown
          ? null
          : briefed.reduce<Date | null>((latest, d) => {
              if (!d.createdTime) return latest;
              return !latest || d.createdTime > latest ? d.createdTime : latest;
            }, null),
        errorMessage: isUnknown
          ? everyFolderFailed
            ? "The whole sync failed on its last run."
            : syncErrors.get(c.id)
          : undefined,
      };
    })
    // Least delivered first, so any message leads with who needs chasing.
    .sort((a, b) => (a.delivered ?? 0) - (b.delivered ?? 0) || a.name.localeCompare(b.name));

  return {
    week,
    rows,
    complete: rows.filter((r) => r.isComplete),
    outstanding: rows.filter((r) => r.delivered !== null && !r.isComplete),
    unknown: rows.filter((r) => r.delivered === null),
    target: activeCreators.length * BRIEFS_PER_WEEK,
  };
}
