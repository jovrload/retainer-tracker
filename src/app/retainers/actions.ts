"use server";

import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { briefTicks } from "@/db/schema";
import { runSync } from "@/lib/sync";

export async function syncNow() {
  await runSync();
  revalidatePath("/retainers");
}

/** Manual tick/untick of one brief (1-3) for one creator in one week. */
export async function toggleBriefTick(
  weekId: number,
  creatorId: number,
  briefNo: number,
  ticked: boolean,
) {
  if (briefNo < 1 || briefNo > 3) {
    throw new Error(`briefNo must be 1, 2 or 3 — got ${briefNo}`);
  }

  if (ticked) {
    await db
      .insert(briefTicks)
      .values({ weekId, creatorId, briefNo })
      .onConflictDoNothing({
        target: [briefTicks.weekId, briefTicks.creatorId, briefTicks.briefNo],
      });
  } else {
    await db
      .delete(briefTicks)
      .where(
        and(
          eq(briefTicks.weekId, weekId),
          eq(briefTicks.creatorId, creatorId),
          eq(briefTicks.briefNo, briefNo),
        ),
      );
  }

  revalidatePath("/retainers");
}
