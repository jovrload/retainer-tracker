import {
  pgTable,
  serial,
  text,
  boolean,
  integer,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Creators on retainer. Each creator uploads their filmed videos into their
 * own folder in the shared Google Drive (identified by driveFolderId).
 */
export const creators = pgTable("creators", {
  id: serial("id").primaryKey(),
  handle: text("handle").notNull().unique(),
  name: text("name").notNull(),
  driveFolderId: text("drive_folder_id").notNull(),
  reacherHandle: text("reacher_handle").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

/**
 * A single retainer week, Monday briefs -> Sunday 23:59 due date.
 * isoWeek is a human-readable label like "2026-W32".
 */
export const weeks = pgTable("weeks", {
  id: serial("id").primaryKey(),
  isoWeek: text("iso_week").notNull().unique(),
  startsAt: timestamp("starts_at", { withTimezone: true, mode: "date" }).notNull(),
  dueAt: timestamp("due_at", { withTimezone: true, mode: "date" }).notNull(),
});

/**
 * The 3 scripted video briefs sent to each creator every Monday.
 */
export const briefs = pgTable("briefs", {
  id: serial("id").primaryKey(),
  weekId: integer("week_id")
    .notNull()
    .references(() => weeks.id),
  creatorId: integer("creator_id")
    .notNull()
    .references(() => creators.id),
  briefNo: integer("brief_no").notNull(), // 1 | 2 | 3
  title: text("title").notNull(),
  briefUrl: text("brief_url"),
  sentAt: timestamp("sent_at", { withTimezone: true, mode: "date" }),
});

/**
 * A video file found in a creator's Drive folder, matched back to a week.
 * driveFileId is UNIQUE so a future sync job can safely upsert
 * (ON CONFLICT DO UPDATE) on every re-run without creating duplicates.
 */
export const deliveries = pgTable(
  "deliveries",
  {
    id: serial("id").primaryKey(),
    weekId: integer("week_id")
      .notNull()
      .references(() => weeks.id),
    creatorId: integer("creator_id")
      .notNull()
      .references(() => creators.id),
    driveFileId: text("drive_file_id").notNull(),
    fileName: text("file_name"),
    sizeBytes: integer("size_bytes"),
    mimeType: text("mime_type"),
    createdTime: timestamp("created_time", { withTimezone: true, mode: "date" }),
    isLate: boolean("is_late").notNull().default(false),
    syncedAt: timestamp("synced_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("deliveries_drive_file_id_unique").on(table.driveFileId)],
);

/**
 * Audit log of each Drive-sync run (built in a later stage) so failures and
 * timing are visible without digging through logs.
 */
export const syncRuns = pgTable("sync_runs", {
  id: serial("id").primaryKey(),
  startedAt: timestamp("started_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true, mode: "date" }),
  creatorsChecked: integer("creators_checked").notNull().default(0),
  filesFound: integer("files_found").notNull().default(0),
  errorCount: integer("error_count").notNull().default(0),
  errorDetail: text("error_detail"),
});
