# Retainer Delivery Tracker — Handover

One screen that shows which retained creators have filmed this week's videos and which haven't —
updating itself from Google Drive every 15 minutes, with a Saturday morning nudge listing anyone
still short.

| | |
|---|---|
| **Status** | Live & in use |
| **Owner** | Jenson Wood |
| **Creators tracked** | 8 on retainer |
| **Last updated** | 10 Aug 2026 |

**Dashboard:** https://retainer-tracker-8epw.vercel.app/retainers
**Source:** https://github.com/jovrload/retainer-tracker

---

## What it is

Eight creators are on retainer. Each week they're sent three scripted top-of-funnel briefs, film
them, and upload the videos into their own folder in our Google Shared Drive by Sunday 23:59.

Before this existed there was no way to see who had delivered and who hadn't. The record of "I sent
the briefs" lived only in WhatsApp, deliveries were scattered across folders, and shortfalls
surfaced too late to chase. This app puts both halves on one screen.

> **The one thing to understand before reading further**
>
> **Uploaded is not the same as posted.** A video in Drive means the creator filmed it. It says
> nothing about whether it went live on TikTok. Nothing in this tool reports on TikTok performance —
> that data lives elsewhere and is deliberately out of scope.

---

## How it works

The app tracks two separate flows, and they work in completely different ways. This is the single
most common point of confusion, so it's worth thirty seconds:

```
BRIEFS GOING OUT — manual              VIDEOS COMING BACK — automatic
┌────────────────────────────┐         ┌────────────────────────────┐
│ You send briefs on WhatsApp│         │ Creators film and upload   │
└────────────┬───────────────┘         └────────────┬───────────────┘
             ↓                                      ↓
┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐         ┌────────────────────────────┐
  Creators receive them                │ Their Google Drive folder  │
  (the app cannot see this)            └────────────┬───────────────┘
└ ─ ─ ─ ─ ─ ─ ┬ ─ ─ ─ ─ ─ ─ ┘                      ↓
             ↓                          ┌────────────────────────────┐
┌────────────────────────────┐         │ App reads the folder,      │
│ You tick three dots by hand│         │ every 15 minutes           │
└────────────┬───────────────┘         └────────────┬───────────────┘
             ↓                                      ↓
┌────────────────────────────┐         ┌────────────────────────────┐
│ Shown as "Briefs sent"     │         │ Shown as "Delivered", plus │
└────────────────────────────┘         │ Saturday Slack nudge       │
                                        └────────────────────────────┘
```

**Left:** nothing is automated, because briefs go out over WhatsApp and no system can read that.
**Right:** fully automated, because Google Drive can be read directly.

---

## Reading the screen

One row per active creator. Creators who owe something sort to the top; completed ones sink to the
bottom.

| Column | What it means |
|---|---|
| **Creator** | Name and TikTok handle. Several creators run more than one account; the handle shown is their primary. |
| **Briefs sent** | Three clickable dots, ticked by hand as briefs go out. Click to turn green, click again to undo. |
| **Delivered** | Counted automatically from Drive, e.g. `2/3`. Not clickable — it fills in on its own. |
| **Last upload** | Relative time of the most recent qualifying video, or "not yet". |
| **Status** | Traffic light, driven by the Drive count — see below. |

### Status values

| Status | Means |
|---|---|
| 🔴 **Outstanding** | Nothing delivered yet this week. |
| 🟠 **In progress** | One or two of the three videos are in. |
| 🟢 **Complete** | Three or more delivered. |
| ⚪ **Sync error** | The last check of that creator's folder failed. Deliberately distinct from "nothing delivered" — a permissions failure must never masquerade as 0/3. |

### Two flags you'll see

- **Late** — the upload landed after Sunday 23:59. It still counts toward the total; there is no
  grace period.
- **Possible duplicate** — two videos in the same week have an identical file size, which usually
  means the same video was exported twice. Worth a glance, since three copies of one video would
  otherwise read as a complete week.

---

## Manual vs automatic, precisely

| Behaviour | Automatic? | Detail |
|---|---|---|
| Counting delivered videos | ✅ Yes | Reads all 8 Drive folders every 15 minutes. |
| Traffic-light status | ✅ Yes | Derived from the Drive count only. |
| Saturday nudge | ✅ Yes | Slack DM at 10:00 UK time listing anyone below 3/3. |
| Marking briefs as sent | ❌ No | Ticked by hand. WhatsApp is not readable by any system. |
| Sending anything to creators | ⚪ Never | The app has no outbound channel to creators at all. |

> **A deliberate design decision**
>
> The traffic light and the Saturday nudge run off the **Drive count, not the manual ticks**. That
> means the status can't drift from reality just because someone forgot to tick a box — the
> dashboard reports what actually happened, not what it was told.

---

## Weekly routine

1. **Monday** — send the briefs as usual over WhatsApp, then tick the dots on the dashboard.
2. **Tuesday to Friday** — nothing to do. Open the page any time to see live delivery status.
3. **Saturday 10:00** — a Slack DM arrives listing anyone still below 3/3, in time to chase before
   the deadline.
4. **Sunday 23:59** — the week closes. Anything later still counts but is flagged late.

Past weeks stay available via the arrows and dropdown in the top right, so the record is permanent
rather than a rolling snapshot.

---

## Where it lives

| Piece | Service | Notes |
|---|---|---|
| App & hosting | Vercel | Next.js 16 (App Router, TypeScript), Tailwind CSS. Deploys on push to `main`. |
| Source | GitHub | `jovrload/retainer-tracker`, private. |
| Database | Neon Postgres | eu-west-2, accessed via Drizzle ORM. |
| Video source | Google Drive API v3 | Read-only scope. Cannot write, move, rename or delete anything. |
| Scheduling | Vercel Cron | `*/15 * * * *` calling `/api/sync`. |
| Alerts | Slack incoming webhook | DMs Jenson only. Easily extended to a channel later. |

### Data stored

| Table | Holds |
|---|---|
| `creators` | The 8 retained creators, their handles and Drive folder IDs. |
| `weeks` | Each retainer week with its start and due timestamps. |
| `brief_ticks` | The manual "brief N sent" ticks, one row per ticked dot. |
| `deliveries` | Every qualifying video found, keyed uniquely by its Drive file ID. |
| `sync_runs` | An audit row for every sync, including failures, so problems are visible without digging through logs. |

---

## Rules & definitions

| Rule | Definition |
|---|---|
| The week | Monday 00:00 to Sunday 23:59, Europe/London. Boundaries are computed on a real London clock and converted to UTC, so the switch between GMT and BST can't shift them. |
| Completion | Count-based: three qualifying videos in the folder during the week. Individual files are deliberately *not* matched to individual briefs. |
| A qualifying video | File type is video, not in the trash, and at least 5 MB. Smaller files are screenshots, stray clips or accidental exports. |
| Upload time | Taken from Drive's creation time, never last-modified — renaming or copying a file changes modified time and would corrupt the timeline. |
| Timestamps | Stored in UTC, displayed in London time. |
| Re-running the sync | Safe and idempotent. Deliveries are keyed on the unique Drive file ID, so running a sync twice never changes a count. Verified by test. |
| One creator's folder failing | Logged as an error against that creator and the run continues for everyone else. |

---

## Watch list

Live issues and things a future maintainer should know, most consequential first.

### 1. Google access is tied to one personal login — **HIGHEST**

Normally this would use a service account — a robot identity independent of any person. Our Google
Cloud organisation blocks service account key creation (`iam.disableServiceAccountKeyCreation`), and
that block applies to admins too, so the app authenticates with **Jenson's own Google account**
instead. If that password changes, access is revoked, or Jenson leaves, **the sync stops**. The
proper fix is for an organisation policy admin to allow a service account for this project.

### 2. Vercel trial expiry will slow the sync — **HIGHEST**

The 15-minute schedule requires a Vercel Pro plan. The account is on a Pro trial (roughly 11 days
remaining as of writing). If it lapses to the free tier, **cron silently drops to once per day** and
the dashboard stops being live. Adding a payment method avoids this.

### 3. Two creator folders are shared "anyone with the link can edit" — **MEDIUM**

Six folders sit inside our Shared Drive. Two — Steven Beejer's and Nick Guest's — are
individually-owned folders shared with us, currently set so anyone holding the link can edit them.
This is **pre-existing, not created by this project**, but it's worth tightening.

### 4. Eight creators, not twelve — **MEDIUM**

The original scope assumed twelve. Only **eight are confirmed on retainer**. Holly Elizabeth, Ash
Eggy and Isaac Lie are marked unconfirmed in Notion and are excluded. Adding one later is a single
row in a CSV plus a re-run of the seed script.

### 5. The sync and nudge endpoints are unauthenticated — **MEDIUM**

`/api/sync` and `/api/nudge` can be triggered by anyone who knows the URLs. The blast radius is
small — the worst case is a redundant read-only Drive check or an unscheduled Slack DM to Jenson,
and no data can be corrupted — but they should be secured with a shared secret before the app is
shared more widely.

### 6. Duplicate detection is a heuristic — **LOW**

Duplicates are flagged when two files in the same week share an identical byte size. That reliably
catches the same export uploaded twice, but it is not a content comparison — treat it as a prompt to
look, not a verdict.

### 7. One unused table left in the schema — **LOW**

An earlier `briefs` table was superseded by `brief_ticks` when briefs moved to manual ticking. It is
empty, unreferenced by any code, and safe to drop at the next tidy-up.

---

## Deliberately not built

- **TikTok performance.** No views, GMV or post status. Drive tells us a video was filmed, nothing
  more.
- **Matching files to specific briefs.** Counting is intentionally count-based; filenames are too
  inconsistent to trust.
- **Any outbound contact with creators.** The only message this app sends goes to Jenson on Slack.
- **Writing to Drive.** Access is read-only by design and cannot modify, move or delete a creator's
  files.
- **Login on the dashboard.** Anyone with the URL can view and tick. Fine while the link is held
  internally; needs revisiting before wider sharing.

---

Questions on anything above, or to pick up the two highest items on the watch list, speak to Jenson.
