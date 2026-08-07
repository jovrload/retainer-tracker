import { NextResponse } from "next/server";
import { runSync } from "@/lib/sync";

async function handleSync() {
  try {
    const result = await runSync();
    return NextResponse.json(result);
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
