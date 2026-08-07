import { eq } from "drizzle-orm";
import { db } from "@/db";
import { creators, weeks, deliveries, syncRuns } from "@/db/schema";
import { getCurrentWeekBounds } from "@/lib/week";
import { getDriveAccessToken, listVideosInFolder } from "@/lib/google-drive";

const MIN_VIDEO_BYTES = 5 * 1024 * 1024;

type CreatorSyncError = {
  creatorId: number;
  handle: string;
  message: string;
};

export type SyncResult = {
  isoWeek: string;
  creatorsChecked: number;
  filesFound: number;
  errorCount: number;
  errors: CreatorSyncError[];
};

/** Finds this week's row, creating it on first sync of a new week. */
async function getOrCreateCurrentWeek() {
  const bounds = getCurrentWeekBounds();

  const [existing] = await db
    .select()
    .from(weeks)
    .where(eq(weeks.isoWeek, bounds.isoWeek));
  if (existing) return existing;

  const [created] = await db
    .insert(weeks)
    .values({ isoWeek: bounds.isoWeek, startsAt: bounds.startsAt, dueAt: bounds.dueAt })
    .onConflictDoNothing({ target: weeks.isoWeek })
    .returning();
  if (created) return created;

  // Lost a race with another concurrent sync creating the same week — just read it back.
  const [row] = await db.select().from(weeks).where(eq(weeks.isoWeek, bounds.isoWeek));
  return row;
}

/**
 * Runs one full sync pass across every active creator's Drive folder.
 * Read-only against Drive; safe to run repeatedly (upserts on
 * `deliveries.driveFileId`, so re-running never changes the count).
 * A single creator's folder erroring never aborts the rest of the run.
 */
export async function runSync(): Promise<SyncResult> {
  const startedAt = new Date();
  const week = await getOrCreateCurrentWeek();
  const activeCreators = await db.select().from(creators).where(eq(creators.active, true));

  const accessToken = await getDriveAccessToken();

  let filesFound = 0;
  const errors: CreatorSyncError[] = [];

  for (const creator of activeCreators) {
    try {
      const files = await listVideosInFolder(accessToken, creator.driveFolderId, week.startsAt);

      for (const file of files) {
        const sizeBytes = Number(file.size ?? 0);
        if (sizeBytes < MIN_VIDEO_BYTES) continue;

        const createdTime = new Date(file.createdTime);
        const isLate = createdTime > week.dueAt;

        await db
          .insert(deliveries)
          .values({
            weekId: week.id,
            creatorId: creator.id,
            driveFileId: file.id,
            fileName: file.name,
            sizeBytes,
            mimeType: file.mimeType,
            createdTime,
            isLate,
            syncedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: deliveries.driveFileId,
            set: {
              weekId: week.id,
              creatorId: creator.id,
              fileName: file.name,
              sizeBytes,
              mimeType: file.mimeType,
              createdTime,
              isLate,
              syncedAt: new Date(),
            },
          });

        filesFound++;
      }
    } catch (err) {
      errors.push({
        creatorId: creator.id,
        handle: creator.handle,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  await db.insert(syncRuns).values({
    startedAt,
    finishedAt: new Date(),
    creatorsChecked: activeCreators.length,
    filesFound,
    errorCount: errors.length,
    errorDetail: errors.length > 0 ? JSON.stringify(errors) : null,
  });

  return {
    isoWeek: week.isoWeek,
    creatorsChecked: activeCreators.length,
    filesFound,
    errorCount: errors.length,
    errors,
  };
}
