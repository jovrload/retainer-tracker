import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { creators, weeks, deliveries, briefTicks, syncRuns } from "@/db/schema";
import { getOrCreateCurrentWeek } from "@/lib/current-week";
import {
  formatDeadline,
  formatLondonTime,
  formatRelativeTime,
  formatTimeLeft,
  weekProgress,
  NULL_DASH,
} from "@/lib/format";
import {
  BRIEFS_PER_WEEK,
  DEADLINE_CLOSE_HOURS,
  resolveStatus,
  STATUS_EXPLAINER,
  STATUS_RANK,
} from "@/lib/status";
import { Card } from "@/components/ui/Card";
import { Section } from "@/components/ui/Section";
import { Banner } from "@/components/ui/Banner";
import { StatusPill } from "@/components/ui/StatusPill";
import { FreshnessIndicator } from "@/components/ui/FreshnessIndicator";
import { EmptyState } from "@/components/ui/EmptyState";
import { DefinedLabel } from "@/components/ui/DefinedLabel";
import { looksLikePart } from "@/lib/tof";
import { WeekSelect } from "./WeekSelect";
import { BriefDots } from "./BriefDots";
import { SyncButton } from "./SyncButton";
import { CreatorCard } from "./CreatorCard";
import { RowFlags } from "./RowFlags";
import type { CreatorRow } from "./types";

export default async function RetainersPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const params = await searchParams;
  const now = new Date();

  const currentWeek = await getOrCreateCurrentWeek();
  const allWeeks = await db.select().from(weeks).orderBy(desc(weeks.startsAt));

  const selectedWeek =
    (params.week && allWeeks.find((w) => w.isoWeek === params.week)) || currentWeek;
  const isCurrentWeek = selectedWeek.isoWeek === currentWeek.isoWeek;

  const activeCreators = await db.select().from(creators).where(eq(creators.active, true));
  const weekDeliveries = await db
    .select()
    .from(deliveries)
    .where(eq(deliveries.weekId, selectedWeek.id));
  const weekTicks = await db
    .select()
    .from(briefTicks)
    .where(eq(briefTicks.weekId, selectedWeek.id));

  const [latestSyncRun] = await db
    .select()
    .from(syncRuns)
    .orderBy(desc(syncRuns.startedAt))
    .limit(1);

  // Per-creator failures from the last run. A folder that errored has an
  // *unknown* count, which is categorically not zero (Law 2).
  const syncErrors = new Map<number, string>();
  if (latestSyncRun?.errorDetail) {
    try {
      const parsed: { creatorId: number; message?: string }[] = JSON.parse(
        latestSyncRun.errorDetail,
      );
      parsed.forEach((e) =>
        syncErrors.set(e.creatorId, e.message ?? "The folder check failed."),
      );
    } catch {
      // Unparseable errorDetail — we know the run had errors but not whose.
    }
  }

  // The one state that earns red-strong: every folder failed, so the Google
  // login has broken and nothing on screen can be trusted (Part 2 §6).
  const everyFolderFailed =
    !!latestSyncRun &&
    latestSyncRun.creatorsChecked > 0 &&
    latestSyncRun.errorCount >= latestSyncRun.creatorsChecked;

  // Historic weeks aren't re-read by the sync, so a current-run failure says
  // nothing about them — don't retro-fit "Can't tell" onto closed weeks.
  const applyErrors = isCurrentWeek;

  const rows: CreatorRow[] = activeCreators.map((creator) => {
    const mine = weekDeliveries.filter((d) => d.creatorId === creator.id);
    // Only briefed videos count. The rest of a folder is b-roll and the
    // creator's own content, which would otherwise swamp the target.
    const briefed = mine.filter((d) => d.isTof);

    const isUnknown = applyErrors && (everyFolderFailed || syncErrors.has(creator.id));
    const delivered = isUnknown ? null : briefed.length;

    const lastUpload = briefed.reduce<Date | null>((latest, d) => {
      if (!d.createdTime) return latest;
      return !latest || d.createdTime > latest ? d.createdTime : latest;
    }, null);

    const sizeCounts = new Map<number, number>();
    briefed.forEach((d) => {
      if (d.sizeBytes == null) return;
      sizeCounts.set(d.sizeBytes, (sizeCounts.get(d.sizeBytes) ?? 0) + 1);
    });

    return {
      creatorId: creator.id,
      name: creator.name,
      handle: creator.handle,
      delivered,
      videosUploaded: isUnknown ? 0 : mine.length,
      briefsTicked: weekTicks.filter((t) => t.creatorId === creator.id).map((t) => t.briefNo),
      lastUpload: isUnknown ? null : lastUpload,
      anyLate: !isUnknown && briefed.some((d) => d.isLate),
      hasDuplicate: !isUnknown && [...sizeCounts.values()].some((c) => c > 1),
      hasSplitParts:
        !isUnknown && briefed.some((d) => d.fileName && looksLikePart(d.fileName)),
      status: resolveStatus({
        delivered: delivered ?? 0,
        dueAt: selectedWeek.dueAt,
        now,
        isUnknown,
      }),
      errorMessage: isUnknown
        ? everyFolderFailed
          ? "The whole sync failed on its last run, so no count can be trusted."
          : syncErrors.get(creator.id)
        : undefined,
    };
  });

  rows.sort((a, b) => {
    const rank = STATUS_RANK[a.status] - STATUS_RANK[b.status];
    return rank !== 0 ? rank : a.name.localeCompare(b.name);
  });

  const unknownCount = rows.filter((r) => r.status === "unknown").length;
  const shortCount = rows.filter((r) => r.status !== "complete" && r.status !== "unknown").length;
  const completeCount = rows.filter((r) => r.status === "complete").length;

  // When nothing can be checked, a summary of "0 need chasing" would read as
  // "all good" — an unknown rendered as a reassuring zero, which is exactly
  // what Law 2 forbids. Show an em-dash instead and let the banner explain.
  const allUnknown = rows.length > 0 && unknownCount === rows.length;
  const countsAreComplete = unknownCount === 0;

  const briefTarget = rows.length * BRIEFS_PER_WEEK;
  const briefsSent = rows.reduce((sum, r) => sum + r.briefsTicked.length, 0);
  // Capped per creator so over-uploads don't inflate progress against the target.
  const briefsFilmed = rows.reduce(
    (sum, r) => sum + Math.min(r.delivered ?? 0, BRIEFS_PER_WEEK),
    0,
  );

  const timeLeft = formatTimeLeft(selectedWeek.dueAt, now);
  const progress = weekProgress(selectedWeek.startsAt, selectedWeek.dueAt, now);
  const lastSyncedAt = latestSyncRun?.finishedAt ?? null;

  const bandAccent: "red" | "amber" | "green" | "neutral" =
    unknownCount > 0
      ? "neutral"
      : shortCount === 0
        ? "green"
        : rows.some((r) => r.status === "outstanding")
          ? "red"
          : rows.some((r) => r.status === "behind")
            ? "amber"
            : "neutral";

  return (
    <main className="mx-auto flex w-full max-w-page flex-col gap-6 px-4 py-8 md:px-6 md:py-10">
      {/* ---------- header ---------- */}
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-3">
              Ovrload · {selectedWeek.isoWeek}
            </p>
            <h1 className="text-2xl font-bold tracking-[-0.02em] text-ink md:text-[32px] md:leading-[1.1]">
              Retainer delivery tracker
            </h1>
            <p className="text-sm text-ink-2">Who needs chasing this week, and how urgently.</p>
          </div>
          <WeekSelect
            weeks={allWeeks.map((w) => ({
              isoWeek: w.isoWeek,
              isCurrent: w.isoWeek === currentWeek.isoWeek,
            }))}
            selected={selectedWeek.isoWeek}
          />
        </div>

        {/* The single highest-value piece of copy on the page. The dashboard has
            no login, so readers who never saw the handover land here too. */}
        <Banner>
          <strong className="font-semibold">TOF delivered</strong> counts briefed videos found in
          Drive. It does not mean they are live on TikTok.
        </Banner>
      </header>

      {everyFolderFailed && isCurrentWeek && (
        <Banner
          tone="critical"
          title="Every folder check failed on the last sync"
          action={<SyncButton />}
        >
          Nothing on this page can be trusted right now — the Google connection has most likely
          broken. Every creator shows &ldquo;Can&rsquo;t tell&rdquo; rather than a count.
        </Banner>
      )}

      {!isCurrentWeek && (
        <Banner tone="neutral" title={`Viewing ${selectedWeek.isoWeek} — a closed week`}>
          This week ended {formatDeadline(selectedWeek.dueAt)}. Figures are final and will not
          change.
        </Banner>
      )}

      {/* ---------- summary band: the answer, before the evidence ---------- */}
      <Card accent={bandAccent} hero className="animate-card-in">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between md:gap-8">
          <div className="flex items-start gap-6 md:gap-8">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">
                Need chasing
              </p>
              <p className="mt-1.5 flex items-baseline gap-1.5">
                <span
                  className={`hero-num text-5xl ${
                    allUnknown
                      ? "text-ink-3"
                      : shortCount === 0 && countsAreComplete
                        ? "text-green-strong"
                        : "text-ink"
                  }`}
                >
                  {allUnknown ? NULL_DASH : shortCount}
                </span>
                {!allUnknown && (
                  <span className="text-sm font-medium text-ink-2">of {rows.length}</span>
                )}
              </p>
            </div>

            <div className="border-l border-line-subtle pl-6 md:pl-8">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">
                Complete
              </p>
              <p className="mt-1.5 flex items-baseline gap-1.5">
                <span className={`hero-num text-5xl ${allUnknown ? "text-ink-3" : "text-ink"}`}>
                  {allUnknown ? NULL_DASH : completeCount}
                </span>
                {!allUnknown && (
                  <span className="text-sm font-medium text-ink-2">of {rows.length}</span>
                )}
              </p>
            </div>
          </div>

          {/* Time is the dimension the board was missing: 2/3 means something
              different on Monday than on Saturday. */}
          <div className="flex w-full flex-col gap-2 md:max-w-xs">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">
                {timeLeft ? "Time left" : "Deadline"}
              </span>
              <span className="tnum text-sm font-semibold text-ink">
                {timeLeft ?? "Week closed"}
              </span>
            </div>
            <div
              className="h-2 w-full overflow-hidden rounded-full bg-surface-2"
              role="img"
              aria-label={`Week ${Math.round(progress * 100)} percent elapsed`}
            >
              <div
                className={`animate-bar-fill h-full rounded-full ${
                  progress >= 1
                    ? "bg-ink-3"
                    : "bg-gradient-to-r from-ink/70 to-ink"
                }`}
                style={{ width: `${Math.max(2, progress * 100)}%` }}
              />
            </div>
            <p className="text-[12px] text-ink-2">Due {formatDeadline(selectedWeek.dueAt)}</p>
          </div>
        </div>

        {/* A partial view must say so, or the totals read as the whole truth. */}
        {unknownCount > 0 && !allUnknown && (
          <p className="mt-4 border-t border-line-subtle pt-3 text-[12px] text-amber">
            {unknownCount} creator{unknownCount === 1 ? "" : "s"} could not be checked, so these
            totals are incomplete.
          </p>
        )}
      </Card>

      {/* ---------- brief counters ---------- */}
      <div className="grid grid-cols-2 gap-3">
        <Card interactive className="animate-card-in" style={{ animationDelay: "60ms" }}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">
            <DefinedLabel definition="Briefs you have marked as sent by hand. Nothing here is automated — this does not affect any creator's status.">
              Briefs sent
            </DefinedLabel>
          </p>
          <p className="mt-1.5 flex items-baseline gap-1.5">
            <span className="hero-num text-2xl text-ink">{briefsSent}</span>
            <span className="text-sm font-medium text-ink-2">of {briefTarget}</span>
          </p>
        </Card>
        <Card interactive className="animate-card-in" style={{ animationDelay: "100ms" }}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">
            <DefinedLabel definition="Videos labelled TOF found in Drive, counted automatically and capped at three per creator so extra uploads don't inflate progress.">
              TOF filmed
            </DefinedLabel>
          </p>
          <p className="mt-1.5 flex items-baseline gap-1.5">
            <span
              className={`hero-num text-2xl ${allUnknown ? "text-ink-3" : "text-green-strong"}`}
            >
              {allUnknown ? NULL_DASH : briefsFilmed}
            </span>
            {!allUnknown && (
              <span className="text-sm font-medium text-ink-2">of {briefTarget}</span>
            )}
          </p>
        </Card>
      </div>

      {/* ---------- the table ---------- */}
      <Section
        title="Creators"
        description={
          shortCount === 0 && unknownCount === 0 && rows.length > 0
            ? `All ${rows.length} complete.`
            : "Whoever needs chasing is at the top."
        }
        action={
          <div className="flex flex-wrap items-center gap-3">
            <FreshnessIndicator lastSyncedAt={lastSyncedAt} now={now} />
            {isCurrentWeek && !everyFolderFailed && <SyncButton />}
          </div>
        }
      >
        {rows.length === 0 ? (
          <EmptyState title="No creators yet">
            Add them to <code>seed-data/creators.csv</code> and run the seed script.
          </EmptyState>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto rounded-2xl border border-line bg-surface md:block">
              <table className="w-full min-w-[820px] border-collapse text-left text-sm">
                <thead>
                  {/* Grouped header states ownership: the two columns are
                      categorically different kinds of truth (Part 2 §2). */}
                  <tr className="bg-surface-2 text-[11px] font-semibold uppercase tracking-wide text-ink-3">
                    <th className="px-4 pt-3 pb-1 font-semibold" />
                    <th className="border-l border-line px-4 pt-3 pb-1 font-semibold">
                      You track
                    </th>
                    <th className="border-l border-line px-4 pt-3 pb-1 font-semibold" colSpan={5}>
                      Drive reports
                    </th>
                  </tr>
                  <tr className="border-b border-line bg-surface-2 text-[11px] font-semibold uppercase tracking-wide text-ink-3">
                    <th className="whitespace-nowrap px-4 pt-1 pb-3 font-semibold">Creator</th>
                    <th className="whitespace-nowrap border-l border-line px-4 pt-1 pb-3 font-semibold">
                      Briefs sent
                    </th>
                    <th className="whitespace-nowrap border-l border-line px-4 pt-1 pb-3 text-right font-semibold">
                      <DefinedLabel definition="Every video this creator uploaded during the selected week, anywhere in their folder tree — briefed work, b-roll and their own content together.">
                        Videos uploaded
                      </DefinedLabel>
                    </th>
                    <th className="whitespace-nowrap px-4 pt-1 pb-3 text-right font-semibold">
                      <DefinedLabel definition="Of those uploads, the ones labelled TOF — the briefed videos that count toward the weekly target. An em-dash means the folder check failed, so the count is unknown.">
                        TOF delivered
                      </DefinedLabel>
                    </th>
                    <th className="whitespace-nowrap px-4 pt-1 pb-3 font-semibold">Last upload</th>
                    <th className="whitespace-nowrap px-4 pt-1 pb-3 font-semibold">Flags</th>
                    <th className="whitespace-nowrap px-4 pt-1 pb-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => {
                    // Unknown rows sit above outstanding in their own visual
                    // break — a broken pipe isn't a creator who's behind.
                    const isLastUnknown =
                      row.status === "unknown" && rows[i + 1]?.status !== "unknown";

                    return (
                      <tr
                        key={row.creatorId}
                        style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}
                        className={`animate-row-in transition-colors duration-150 hover:bg-surface-2/50 ${
                          isLastUnknown
                            ? "border-b-2 border-line-hover"
                            : "border-b border-line-subtle last:border-b-0"
                        }`}
                      >
                        <td className="row-marker-cell whitespace-nowrap px-4 py-3.5">
                          <div className="font-semibold text-ink">{row.name}</div>
                          <div className="text-[13px] text-ink-2">@{row.handle}</div>
                        </td>

                        <td className="whitespace-nowrap border-l border-line-subtle px-4 py-3.5">
                          <BriefDots
                            weekId={selectedWeek.id}
                            creatorId={row.creatorId}
                            initialTicked={row.briefsTicked}
                            isClosedWeek={!isCurrentWeek}
                          />
                        </td>

                        {/* Value and flags live in separate cells, so a
                            variable-width tag can't push the number around. */}
                        {/* Total uploads: the quieter number, giving the TOF
                            count its context. Kept in its own cell so a
                            variable-width flag can't shove either around. */}
                        <td className="tnum whitespace-nowrap border-l border-line-subtle px-4 py-3.5 text-right text-ink-2">
                          {row.delivered === null ? (
                            <span className="text-ink-3">{NULL_DASH}</span>
                          ) : row.videosUploaded > 0 ? (
                            <span
                              className="font-medium"
                              title={`${row.videosUploaded} video${row.videosUploaded === 1 ? "" : "s"} uploaded this week, of which ${row.delivered} ${row.delivered === 1 ? "is" : "are"} labelled TOF.`}
                            >
                              {row.videosUploaded}
                            </span>
                          ) : (
                            <span className="text-ink-3">0</span>
                          )}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3.5">
                          <div className="flex items-center justify-end gap-2.5">
                            {row.delivered !== null && <DeliveredMeter value={row.delivered} />}
                            {row.delivered === null ? (
                              <span
                                className="tnum text-lg font-semibold text-ink-3"
                                title={row.errorMessage}
                              >
                                {NULL_DASH}
                              </span>
                            ) : (
                              <span className="tnum text-lg font-bold text-ink">
                                {row.delivered}
                                <span className="text-sm font-medium text-ink-3">
                                  /{BRIEFS_PER_WEEK}
                                </span>
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="whitespace-nowrap px-4 py-3.5 text-ink-2">
                          <span title={formatLondonTime(row.lastUpload)}>
                            {row.delivered === null
                              ? NULL_DASH
                              : formatRelativeTime(row.lastUpload, now)}
                          </span>
                        </td>

                        <td className="whitespace-nowrap px-4 py-3.5">
                          <RowFlags row={row} />
                        </td>

                        <td className="whitespace-nowrap px-4 py-3.5">
                          <StatusPill
                            status={row.status}
                            qualified={row.status === "complete" && row.hasDuplicate}
                            title={row.errorMessage ?? STATUS_EXPLAINER[row.status]}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="flex flex-col gap-3 md:hidden">
              {rows.map((row, i) => (
                <CreatorCard
                  key={row.creatorId}
                  row={row}
                  weekId={selectedWeek.id}
                  isClosedWeek={!isCurrentWeek}
                  now={now}
                  index={i}
                />
              ))}
            </div>
          </>
        )}
      </Section>

      {/* ---------- methodology ---------- */}
      <footer className="flex flex-col gap-2 border-t border-line pt-5 text-[13px] leading-snug text-ink-2">
        <p>
          <span className="font-semibold text-ink">Ticking a brief does not change a status.</span>{" "}
          Statuses and the Saturday nudge run only on what Drive reports, so the board cannot drift
          from reality when a tick gets missed.
        </p>
        <p>
          <strong className="font-medium">Videos uploaded</strong> counts everything at least 5MB
          that landed anywhere in the creator&rsquo;s folder tree inside the week.{" "}
          <strong className="font-medium">TOF delivered</strong> is the subset labelled{" "}
          <strong className="font-medium">TOF</strong> — either in the filename or by sitting in a
          TOF folder — and only those count toward the target. Showing both means a forgotten label
          never looks like a missed delivery.
        </p>
        <p>
          <strong className="font-medium">Outstanding</strong> and{" "}
          <strong className="font-medium">Behind</strong> appear within {DEADLINE_CLOSE_HOURS} hours
          of the deadline; before that a shortfall reads{" "}
          <strong className="font-medium">On track</strong>.
        </p>
      </footer>
    </main>
  );
}

/**
 * Three thin bars filling toward the target. Drawn as bars, not dots, so it
 * can never be mistaken for the square hand-ticked brief controls beside it
 * (Part 2 §2: different shape, not just different colour). Not interactive.
 */
function DeliveredMeter({ value }: { value: number }) {
  return (
    <span className="hidden items-center gap-[3px] lg:inline-flex" aria-hidden="true">
      {[1, 2, 3].map((n) => (
        <span
          key={n}
          className={`h-4 w-[3px] rounded-full transition-colors duration-150 ${
            value >= n ? "bg-green-strong" : "bg-surface-2"
          }`}
        />
      ))}
    </span>
  );
}
