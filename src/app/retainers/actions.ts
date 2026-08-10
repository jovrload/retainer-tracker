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

/** Manual tick/untick of "briefs sent" for one creator in one week. */
export async function toggleBriefTick(weekId: number, creatorId: number, ticked: boolean) {
  if (ticked) {
    await db
      .insert(briefTicks)
      .values({ weekId, creatorId })
      .onConflictDoNothing({ target: [briefTicks.weekId, briefTicks.creatorId] });
  } else {
    await db
      .delete(briefTicks)
      .where(and(eq(briefTicks.weekId, weekId), eq(briefTicks.creatorId, creatorId)));
  }

  revalidatePath("/retainers");
}
