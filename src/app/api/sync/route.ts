import { NextResponse } from "next/server";
import { runSync } from "@/lib/sync";
import { maybeSendSaturdayNudge } from "@/lib/nudge";

async function handleSync() {
  try {
    const result = await runSync();

    // Rides along on the same 15-minute heartbeat; this only actually
    // posts to Slack once, at Saturday 10:00 Europe/London.
    let nudge: { sent: boolean; reason?: string } = { sent: false };
    try {
      nudge = await maybeSendSaturdayNudge();
    } catch (nudgeErr) {
      // A Slack failure shouldn't mark the whole sync as failed.
      nudge = {
        sent: false,
        reason: nudgeErr instanceof Error ? nudgeErr.message : String(nudgeErr),
      };
    }

    return NextResponse.json({ ...result, nudge });
  } catch (err) {
    // Only reachable if something failed outside the per-creator try/catch
    // in runSync (e.g. the database itself, or refreshing the access token) —
    // a single creator's Drive error is already caught and logged there.
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

// Vercel Cron calls this on a schedule (GET).
export async function GET() {
  return handleSync();
}

// The "Sync now" button on /retainers calls this (POST).
export async function POST() {
  return handleSync();
}
