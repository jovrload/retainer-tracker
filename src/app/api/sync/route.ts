import { NextResponse } from "next/server";
import { runSync } from "@/lib/sync";
import { runNotifications, type NudgeOutcome } from "@/lib/nudge";

async function handleSync() {
  try {
    const result = await runSync();

    // Rides the same 15-minute heartbeat. Each message is guarded by a
    // dedupe key, so this is safe to evaluate on every run.
    let notifications: NudgeOutcome | { error: string };
    try {
      notifications = await runNotifications();
    } catch (err) {
      // A Slack or notification failure must not mark the sync itself failed.
      notifications = { error: err instanceof Error ? err.message : String(err) };
    }

    return NextResponse.json({ ...result, notifications });
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
