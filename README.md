# REPS

A gym tracker built for the thirty seconds between sets: log a set in two taps, know what to lift next, and never lose the data.

**Live:** https://gym-tracker-sigma-orpin.vercel.app

Next.js 16 · React 19 · TypeScript · Tailwind v4 · Supabase · deployed on Vercel

---

## Why it exists

Most gym apps are built for browsing. This one is built for the gym floor, where you have one hand free, patchy signal, and no interest in navigating a menu tree. Three constraints drove every decision:

1. **Logging has to be faster than remembering.** Weight and reps pre-fill from the last time you did that exercise, so a normal set is two taps.
2. **It has to work with no signal.** Every write lands in local storage first. The network is an optimisation, never a dependency.
3. **It should tell you what to do, not just record what you did.** The plan lives in the app, and progression is suggested rather than left to memory.

## Features

**Training as a cycle, not a calendar**
Your plan is an ordered rotation (push → pull → legs → …). The home screen shows what's next based on what you last finished, so missing a Tuesday shifts nothing. Sessions record their own position in the cycle, which keeps things correct when a session type appears more than once in a lap.

**Paced progressive overload**
Double progression with a brake on it. Clearing every set at the target rep count *twice in a row at the same weight* suggests a load increase; a single good session is treated as noise. Increments scale with the working weight.

**Plan-aware sessions**
Each day template carries per-exercise sets × reps, optional coaching cues, and optional ramp-up gates (an exercise that only enters the plan from week N, useful when returning from a layoff). Session types are user-created and editable, and can be strength (sets × reps) or cardio (minutes + level).

**Rest timer**
Ticking a set starts a countdown sized to the exercise: roughly 2:30 on compounds, 1:30 on isolation, overridable per exercise and remembered. The timer is timestamp-based, so backgrounding the app doesn't drift it.

**Templates that learn**
Finish a session that didn't match its template and the app offers to save what you actually did as the new default. It asks rather than assuming, so a one-off improvisation doesn't quietly rewrite the plan.

**Progress**
Per-exercise top-set charts, session counts and time, and weekly hard sets per muscle against a 10–20 set band. Periods of a week, four weeks, three months, or all time; multi-week periods report per-week averages so the band stays a meaningful yardstick.

## Architecture

### Offline-first, sync second

Local storage is the source of truth on each device. Supabase sits on top for sync and backup, and signing in is optional; a workout is never gated behind auth or a network.

```
write → localStorage (immediate) → debounced push (2.5s) → Supabase
                ↑                                              │
                └───────── pull on focus / reconnect ──────────┘
```

Sync stores the whole app state as a single JSON blob, one row per user, protected by row-level security tied to `auth.uid()`. For one person on two or three devices, whole-blob last-write-wins is the right trade: no schema duplication between client and server, no partial-sync edge cases, and the entire feature is about 150 lines. Normalised tables would earn their keep with multi-user or collaborative editing, neither of which is a goal here.

Conflicts resolve by timestamp, with one rule that overrides it: **a device holding real sessions is never overwritten by an emptier cloud.** That makes first sign-in safe by construction, which matters when the alternative is silently eating a workout. Any state displaced by a remote pull is stashed under a rescue key rather than discarded.

### Schema migrations

Stored data is versioned and migrated forward on load (`lib/plan.ts`). v1 held three fixed templates with no per-exercise targets; v2 added targets and a weekday schedule; v3 flattened that schedule into an ordered cycle. Migrations preserve logged sessions, custom exercises, and renames, and older session records are remapped onto current day types so progression keeps working across the change.

### Layout

The app is a phone app that happens to run in a browser. Set rows use fluid columns with fixed-width steppers rather than fixed widths, after fixed columns overflowed a 412px viewport. Anything touched mid-set is at least 40px. Safe-area insets are respected top and bottom.

```
app/          routes: train, history, progress
components/   UI, one concern per file
lib/
  types.ts    data model
  plan.ts     starter plan + schema migrations
  logic.ts    pure functions: progression, cycle, stats
  store.ts    localStorage + subscriptions
  sync.ts     Supabase reconcile / push / pull
```

`lib/logic.ts` is deliberately free of React and storage concerns, so the progression and cycle rules can be exercised directly.

## Running it locally

```bash
npm install
npm run dev
```

That's enough for a fully working app: without Supabase credentials it runs entirely on local storage and the sync UI hides itself.

To enable sync, create a Supabase project, run `supabase-setup.sql` in the SQL editor, then:

```bash
cp .env.example .env.local
```

```
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable key>
```

Both values are safe in the client. Row-level security is what protects the data, not key secrecy.

## Notes

The starter plan in `lib/plan.ts` is a generic six-session push/pull/legs rotation. It only seeds a fresh install; everything is editable in the app, and your edits are what persist.

## License

MIT
