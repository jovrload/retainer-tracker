import { eq } from "drizzle-orm";
import { db } from "@/db";
import { creators, deliveries, syncRuns } from "@/db/schema";
import { getOrCreateCurrentWeek } from "@/lib/current-week";
import { getDriveAccessToken, scanFolderForVideos } from "@/lib/google-drive";
import { looksLikeTof } from "@/lib/tof";

const MIN_VIDEO_BYTES = 5 * 1024 * 1024;

type CreatorSyncError = {
  creatorId: number;
  handle: string;
  message: string;
};

export type SyncResult = {
  isoWeek: string;
  creatorsChecked: number;
  /** Qualifying videos stored, briefed or not. */
  filesFound: number;
  /** Of those, the ones labelled as briefed work. */
  tofFound: number;
  errorCount: number;
  errors: CreatorSyncError[];
  /** Creators whose folder tree hit the traversal cap — never silently dropped. */
  truncatedCreators: string[];
};

/**
 * Runs one full sync pass across every active creator's Drive folder tree.
 *
 * Read-only against Drive; safe to run repeatedly (upserts on
 * `deliveries.driveFileId`, so re-running never changes a count).
 * A single creator's folder erroring never aborts the rest of the run.
 */
export async function runSync(): Promise<SyncResult> {
  const startedAt = new Date();
  const week = await getOrCreateCurrentWeek();
  const activeCreators = await db.select().from(creators).where(eq(creators.active, true));

  const accessToken = await getDriveAccessToken();

  let filesFound = 0;
  let tofFound = 0;
  const errors: CreatorSyncError[] = [];
  const truncatedCreators: string[] = [];

  for (const creator of activeCreators) {
    try {
      const scan = await scanFolderForVideos(accessToken, creator.driveFolderId, week.startsAt);
      if (scan.truncated) truncatedCreators.push(creator.handle);

      for (const file of scan.videos) {
        const sizeBytes = Number(file.size ?? 0);
        if (sizeBytes < MIN_VIDEO_BYTES) continue;

        const createdTime = new Date(file.createdTime);
        const isLate = createdTime > week.dueAt;
        const isTof = looksLikeTof(file.name, file.folderPath);
        const folderPath = file.folderPath.join(" / ") || null;

        const row = {
          weekId: week.id,
          creatorId: creator.id,
          fileName: file.name,
          sizeBytes,
          mimeType: file.mimeType,
          createdTime,
          isLate,
          isTof,
          folderPath,
          syncedAt: new Date(),
        };

        await db
          .insert(deliveries)
          .values({ ...row, driveFileId: file.id })
          .onConflictDoUpdate({ target: deliveries.driveFileId, set: row });

        filesFound++;
        if (isTof) tofFound++;
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
    tofFound,
    errorCount: errors.length,
    errors,
    truncatedCreators,
  };
}
