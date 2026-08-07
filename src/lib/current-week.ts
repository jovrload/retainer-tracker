import { eq } from "drizzle-orm";
import { db } from "@/db";
import { weeks } from "@/db/schema";
import { getCurrentWeekBounds } from "@/lib/week";

/** Finds this week's row, creating it on first use of a new week. */
export async function getOrCreateCurrentWeek() {
  const bounds = getCurrentWeekBounds();

  const [existing] = await db.select().from(weeks).where(eq(weeks.isoWeek, bounds.isoWeek));
  if (existing) return existing;

  const [created] = await db
    .insert(weeks)
    .values({ isoWeek: bounds.isoWeek, startsAt: bounds.startsAt, dueAt: bounds.dueAt })
    .onConflictDoNothing({ target: weeks.isoWeek })
    .returning();
  if (created) return created;

  // Lost a race with a concurrent request creating the same week — read it back.
  const [row] = await db.select().from(weeks).where(eq(weeks.isoWeek, bounds.isoWeek));
  return row;
}
