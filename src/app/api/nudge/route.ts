import { NextRequest, NextResponse } from "next/server";
import { runNotifications } from "@/lib/nudge";

/**
 * Manual test/trigger endpoint. Pass `?force=thursday` or `?force=saturday`
 * to bypass that message's day/time gate.
 *
 * Note the dedupe key still applies: forcing a digest that has already gone
 * out this week returns `already sent` rather than posting twice. That is
 * deliberate — use a fresh week, or clear the row, to re-test.
 */
export async function POST(request: NextRequest) {
  const force = request.nextUrl.searchParams.get("force");
  const validForce = force === "thursday" || force === "saturday" ? force : undefined;

  try {
    const result = await runNotifications({ force: validForce });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
