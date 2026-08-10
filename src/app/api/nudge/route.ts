import { NextResponse } from "next/server";
import { maybeSendSaturdayNudge } from "@/lib/nudge";

/**
 * Manual test/trigger endpoint — bypasses the Saturday 10am check so it
 * can be fired on demand. Not on the cron schedule; the real weekly send
 * happens automatically from /api/sync (see src/lib/nudge.ts).
 */
export async function POST() {
  try {
    const result = await maybeSendSaturdayNudge({ force: true });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
