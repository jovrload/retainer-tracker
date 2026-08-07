const LONDON_TZ = "Europe/London";

/**
 * Offset (in minutes) of Europe/London from UTC at the given instant.
 * Uses real IANA tz data via Intl, so BST/GMT transitions are handled
 * correctly without hardcoding an offset.
 */
function getLondonOffsetMinutes(instant: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: LONDON_TZ,
    timeZoneName: "shortOffset",
  }).formatToParts(instant);
  const tzName = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const match = tzName.match(/GMT([+-]\d+)?/);
  const hours = match?.[1] ? parseInt(match[1], 10) : 0;
  return hours * 60;
}

/** Converts a London wall-clock date/time into the correct UTC instant. */
function londonWallClockToUtc(
  year: number,
  month: number, // 1-indexed
  day: number,
  hour: number,
  minute: number,
  second: number,
  millisecond: number,
): Date {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  const offsetMinutes = getLondonOffsetMinutes(new Date(utcGuess));
  return new Date(utcGuess - offsetMinutes * 60_000);
}

/** Today's calendar date (Y/M/D) as seen on a London wall clock. */
function getLondonDateParts(instant: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: LONDON_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return { year: Number(map.year), month: Number(map.month), day: Number(map.day) };
}

/** ISO 8601 week label (e.g. "2026-W32") for a given Y/M/D. */
function isoWeekLabel(year: number, month: number, day: number): string {
  const date = new Date(Date.UTC(year, month - 1, day));
  const dayNum = date.getUTCDay() || 7; // Monday=1 .. Sunday=7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum); // move to this week's Thursday
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

export type WeekBounds = {
  isoWeek: string;
  startsAt: Date;
  dueAt: Date;
};

/**
 * The current retainer week: Monday 00:00:00.000 to Sunday 23:59:59.999,
 * both on a London wall clock, returned as the equivalent UTC instants.
 */
export function getCurrentWeekBounds(now: Date = new Date()): WeekBounds {
  const today = getLondonDateParts(now);
  const todayUtcProxy = new Date(Date.UTC(today.year, today.month - 1, today.day));
  const dayOfWeek = todayUtcProxy.getUTCDay(); // Sunday=0 .. Saturday=6
  const daysSinceMonday = (dayOfWeek + 6) % 7;

  const monday = new Date(todayUtcProxy);
  monday.setUTCDate(monday.getUTCDate() - daysSinceMonday);
  const sunday = new Date(monday);
  sunday.setUTCDate(sunday.getUTCDate() + 6);

  const startsAt = londonWallClockToUtc(
    monday.getUTCFullYear(),
    monday.getUTCMonth() + 1,
    monday.getUTCDate(),
    0,
    0,
    0,
    0,
  );
  const dueAt = londonWallClockToUtc(
    sunday.getUTCFullYear(),
    sunday.getUTCMonth() + 1,
    sunday.getUTCDate(),
    23,
    59,
    59,
    999,
  );

  return {
    isoWeek: isoWeekLabel(monday.getUTCFullYear(), monday.getUTCMonth() + 1, monday.getUTCDate()),
    startsAt,
    dueAt,
  };
}
