/**
 * Seeds the `creators` table from seed-data/creators.csv.
 *
 * Safe to re-run: rows are upserted on `handle`, so running this multiple
 * times (e.g. after editing the CSV) will only insert new creators and
 * update existing ones — never duplicate them.
 *
 * Usage:
 *   npm run seed
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql as sqlOp } from "drizzle-orm";
import { creators } from "../src/db/schema";

type CreatorRow = {
  handle: string;
  name: string;
  driveFolderId: string;
  reacherHandle: string;
  active: boolean;
};

const CSV_PATH = resolve(process.cwd(), "seed-data/creators.csv");
const EXPECTED_HEADER = ["handle", "name", "drive_folder_id", "reacher_handle", "active"];

/** Minimal RFC4180-style CSV parser: handles quoted fields and escaped quotes. */
function parseCsv(raw: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < raw.length; i++) {
    const char = raw[i];
    const next = raw[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && next === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  // Final field/row (file may or may not end with a newline)
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

function parseActive(value: string, rowNumber: number): boolean {
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  throw new Error(
    `Row ${rowNumber}: "active" must be the string "true" or "false", got "${value}"`,
  );
}

function loadCreators(): CreatorRow[] {
  const raw = readFileSync(CSV_PATH, "utf-8");
  const rows = parseCsv(raw);

  if (rows.length === 0) {
    throw new Error(`${CSV_PATH} is empty — expected at least a header row.`);
  }

  const [header, ...dataRows] = rows;
  const normalizedHeader = header.map((h) => h.trim());
  const headerMatches = EXPECTED_HEADER.every((col, i) => normalizedHeader[i] === col);
  if (!headerMatches) {
    throw new Error(
      `Unexpected CSV header. Expected "${EXPECTED_HEADER.join(",")}", got "${normalizedHeader.join(",")}"`,
    );
  }

  return dataRows.map((cells, idx) => {
    const rowNumber = idx + 2; // +1 for header, +1 for 1-indexing
    const [handle, name, driveFolderId, reacherHandle, active] = cells;
    if (!handle || !name || !driveFolderId || !reacherHandle || active === undefined) {
      throw new Error(`Row ${rowNumber}: missing one or more required fields.`);
    }
    return {
      handle: handle.trim(),
      name: name.trim(),
      driveFolderId: driveFolderId.trim(),
      reacherHandle: reacherHandle.trim(),
      active: parseActive(active, rowNumber),
    };
  });
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is not set. Add it to your .env file before running the seed script.",
    );
  }

  const rows = loadCreators();

  if (rows.length === 0) {
    console.log(
      `No creator rows found in ${CSV_PATH} (header only). Nothing to seed yet — fill in the 12 creators and re-run "npm run seed".`,
    );
    return;
  }

  const client = neon(process.env.DATABASE_URL);
  const db = drizzle(client);

  const summary: { handle: string; name: string; active: boolean; result: "inserted" | "updated" }[] = [];

  for (const row of rows) {
    const existing = await db
      .select({ id: creators.id })
      .from(creators)
      .where(sqlOp`${creators.handle} = ${row.handle}`);

    await db
      .insert(creators)
      .values({
        handle: row.handle,
        name: row.name,
        driveFolderId: row.driveFolderId,
        reacherHandle: row.reacherHandle,
        active: row.active,
      })
      .onConflictDoUpdate({
        target: creators.handle,
        set: {
          name: row.name,
          driveFolderId: row.driveFolderId,
          reacherHandle: row.reacherHandle,
          active: row.active,
        },
      });

    summary.push({
      handle: row.handle,
      name: row.name,
      active: row.active,
      result: existing.length > 0 ? "updated" : "inserted",
    });
  }

  console.log(`\nSeeded ${summary.length} creator(s) from ${CSV_PATH}:\n`);
  console.table(summary);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
