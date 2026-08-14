import { eq } from "drizzle-orm";
import { db } from "@/db";
import { creators, deliveries } from "@/db/schema";
import { getOrCreateCurrentWeek } from "@/lib/current-week";
import { BRIEFS_PER_WEEK } from "@/lib/status";

export type CreatorProgress = {
  creatorId: number;
  name: string;
  handle: string;
  /** Briefed (TOF) videos — the number that counts. */
  delivered: number;
  /** Every qualifying video uploaded this week, briefed or not. */
  uploaded: number;
  shortBy: number;
  isComplete: boolean;
  lastUpload: Date | null;
};

export type WeekSnapshot = {
  week: { id: number; isoWeek: string; startsAt: Date; dueAt: Date };
  rows: CreatorProgress[];
  complete: CreatorProgress[];
  outstanding: CreatorProgress[];
  target: number;
};

/**
 * Everything any Slack message might need about the current week, gathered
 * once. Kept deliberately free of wording so the message templates are pure
 * formatting and the numbers can't drift between the dashboard and the alerts.
 */
export async function getWeekSnapshot(): Promise<WeekSnapshot> {
  const week = await getOrCreateCurrentWeek();
  const activeCreators = await db.select().from(creators).where(eq(creators.active, true));
  const weekDeliveries = await db.select().from(deliveries).where(eq(deliveries.weekId, week.id));

  const rows: CreatorProgress[] = activeCreators
    .map((c) => {
      const mine = weekDeliveries.filter((d) => d.creatorId === c.id);
      const briefed = mine.filter((d) => d.isTof);
      const delivered = briefed.length;
      return {
        creatorId: c.id,
        name: c.name,
        handle: c.handle,
        delivered,
        uploaded: mine.length,
        shortBy: Math.max(0, BRIEFS_PER_WEEK - delivered),
        isComplete: delivered >= BRIEFS_PER_WEEK,
        lastUpload: briefed.reduce<Date | null>((latest, d) => {
          if (!d.createdTime) return latest;
          return !latest || d.createdTime > latest ? d.createdTime : latest;
        }, null),
      };
    })
    // Furthest behind first, so any message leads with who needs chasing.
    .sort((a, b) => b.shortBy - a.shortBy || a.name.localeCompare(b.name));

  return {
    week,
    rows,
    complete: rows.filter((r) => r.isComplete),
    outstanding: rows.filter((r) => !r.isComplete),
    target: activeCreators.length * BRIEFS_PER_WEEK,
  };
}
