"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { creators, briefs } from "@/db/schema";
import { runSync } from "@/lib/sync";

export async function syncNow() {
  await runSync();
  revalidatePath("/retainers");
}

/**
 * Creates the 3 scripted briefs for every active creator for the given
 * week and stamps sentAt — this is the record of "I sent the briefs" that
 * previously only existed in WhatsApp.
 */
export async function sendBriefsForWeek(weekId: number) {
  const activeCreators = await db.select().from(creators).where(eq(creators.active, true));
  const sentAt = new Date();

  for (const creator of activeCreators) {
    for (let briefNo = 1; briefNo <= 3; briefNo++) {
      await db.insert(briefs).values({
        weekId,
        creatorId: creator.id,
        briefNo,
        title: `Brief ${briefNo}`,
        sentAt,
      });
    }
  }

  revalidatePath("/retainers");
}
