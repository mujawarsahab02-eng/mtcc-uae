# MTCC UAE — Maharashtra Tennis Cricket Championship UAE

Production web application for the tournament: public player registration,
admin verification, player segregation, a live points-based auction with
real-time sync, team squads, a Team Owner portal, and a public
TV/projector auction display.

This replaces the earlier Claude Artifact prototype's `window.storage`
persistence and client-side-only role gating with:

- **Database:** Supabase PostgreSQL (Row Level Security on every table)
- **Auth:** Supabase Auth (real per-person accounts, roles assigned by
  Super Admin — nobody selects their own role)
- **File storage:** Supabase Storage (separate public/private buckets;
  Emirates IDs and payment receipts are private and only reachable via
  short-lived signed URLs generated server-side for authorised roles)
- **Realtime:** Supabase Realtime (`postgres_changes`) so the auction
  Control Room, Team Owner dashboards, Admin dashboard and the public
  Display page all update the instant a bid, sale, or status change
  happens — no manual refresh, no per-user local copy of the data.
- **Frontend/hosting:** Next.js (App Router) on Vercel

The UI, workflows and auction rules are ported 1:1 from the artifact
prototype (same screens, same statuses, same DEFER/UNDO/override logic) —
this is not a redesign.

---

## 1. Prerequisites

- Node.js 18.18+
- A [Supabase](https://supabase.com) account/project
- A [Vercel](https://vercel.com) account (for hosting)
- The [Supabase CLI](https://supabase.com/docs/guides/cli) (optional but
  recommended for running migrations)

## 2. Create the Supabase project

1. Create a new project at [supabase.com/dashboard](https://supabase.com/dashboard).
2. Note your **Project URL**, **anon public key** and **service role key**
   from Project Settings → API — you'll need these for `.env.local` and
   for Vercel's environment variables.

## 3. Run the database migrations

The schema, seed data, RLS policies and storage buckets are all defined as
SQL migrations in `supabase/migrations/`, applied in order:

```
0001_schema.sql    — tables, enums, views, triggers
0002_seed.sql       — default tournament settings, categories, 8 blank teams
0003_rls.sql        — Row Level Security policies, role helper functions,
                       register_player() / update_team_profile() RPCs
0004_storage.sql    — storage buckets + their access policies
```

**Option A — Supabase CLI (recommended):**

```bash
supabase login
supabase link --project-ref YOUR-PROJECT-REF
supabase db push
```

**Option B — SQL Editor:**

Open each file in `supabase/migrations/` in order and run its contents in
the Supabase Dashboard → SQL Editor.

## 4. Create the first Super Admin

New sign-ups get a `profiles` row with role `Viewer` automatically (via
the `on_auth_user_created` trigger) — nobody can grant themselves a higher
role from the app. To bootstrap your first Super Admin:

1. In Supabase Dashboard → Authentication → Users, click **Add user** and
   create yourself an account (email + password), or sign up once through
   `/admin/login` if you've added a sign-up flow.
2. In the SQL Editor, run:
   ```sql
   update profiles set role = 'Super Admin' where id =
     (select id from auth.users where email = 'you@example.com');
   ```
3. Sign in at `/admin/login`. From `/admin/users` you can now invite every
   other admin, team owner, scorer, etc. and assign their role — that's
   the only place roles are ever set from here on.

## 5. Configure Storage buckets

Migration `0004_storage.sql` already creates all five buckets
(`player-photos`, `team-logos`, `emirates-ids`, `payment-receipts`,
`tournament-documents`) with the right public/private flags and policies.
Nothing further is needed unless you want to adjust file size limits —
see the `file_size_limit` values in that migration.

## 6. Environment variables

Copy `.env.example` to `.env.local` and fill in your project's values:

```bash
cp .env.example .env.local
```

| Variable | Where to find it | Exposed to browser? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → API | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project Settings → API | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API | **No — server only** |
| `SUPABASE_PROJECT_ID` | Your project ref (for `npm run db:types`) | No |
| `NEXT_PUBLIC_SITE_URL` | Your deployed URL (used in invite emails) | Yes |

## 7. Run locally

```bash
npm install
npm run dev
```

- Public site: `http://localhost:3000`
- Registration: `http://localhost:3000/register`
- Admin: `http://localhost:3000/admin/login`
- Auction display: `http://localhost:3000/auction/display`

## 8. Deploy to Vercel

1. Push this repository to GitHub.
2. In Vercel, **Import Project** from that repo.
3. Add the environment variables from step 6 in Vercel → Project Settings
   → Environment Variables (mark `SUPABASE_SERVICE_ROLE_KEY` as a secret,
   not exposed to the client — Vercel does this automatically for
   non-`NEXT_PUBLIC_` variables).
4. Deploy. Vercel builds and hosts the Next.js app; Supabase remains your
   database/auth/storage/realtime backend.
5. **Custom domain:** Vercel → Project Settings → Domains → add your
   domain and follow the DNS instructions. Update
   `NEXT_PUBLIC_SITE_URL` to match once it's live (used for invite email
   redirect links).

## 9. Migrating data from the Claude Artifact prototype

There's no live connection between the artifact (a sandboxed browser
environment) and this codebase, so moving existing registrations/teams
over is a manual export + scripted import — see the detailed comment block
at the top of `scripts/import-legacy-data.ts`. Uploaded files (photos,
Emirates IDs, receipts, logos) were stored as base64 blobs in the artifact
and are **not** migrated automatically; re-upload them via the admin UI
once the corresponding records exist here.

---

## Architecture notes

### Roles & permissions

Seven roles, matching the prototype exactly: **Super Admin, Tournament
Admin, Auction Admin, Finance Admin, Team Owner, Scorer, Viewer.** Unlike
the artifact (which only gated the UI client-side), every role boundary
here is enforced twice:

1. **Row Level Security** on every table (`supabase/migrations/0003_rls.sql`)
   — the actual, unbypassable backstop, checked by Postgres itself.
2. **UI gating** in the React components — for a clean experience, not for
   security.

### Central database / realtime

All admin screens, the Team Owner portal, and the public Display page read
from the same Postgres tables. Player, team and auction-state changes are
pushed live via Supabase Realtime (`postgres_changes` subscriptions) to
every open session — a player being sold in the Control Room updates the
Admin dashboard, the buyer's Team Owner dashboard and the projector
Display within the same second, with no polling and no per-browser local
copy of the data.

### Documents & privacy

- `player-photos` and `team-logos` are **public** buckets (used on the
  projector display and squad cards — nothing sensitive in them).
- `emirates-ids`, `payment-receipts` and `tournament-documents` are
  **private**. The only way to read from them is
  `POST /api/documents/sign`, which re-checks the caller's role
  server-side against `DOCUMENT_ACCESS_ROLES` (Super Admin, Tournament
  Admin, Finance Admin) before minting a 2-minute signed URL. Nothing in
  these buckets is ever included in `player_public` / `team_public` (the
  views the registration-confirmation, Team Owner and Display pages
  query), so there's no path for Emirates ID or payment data to reach an
  unauthorised session even if the UI had a bug.

### Auction logic

`src/lib/auction.ts` ports the artifact's `validateSale()` /
`computeRemainingPoints()` / `computeSquad()` functions verbatim. Auction
actions (`src/app/admin/(dashboard)/auction/actions.ts`) are Server
Actions that re-validate everything server-side before writing — the
client-side check in the Control Room is only there for instant feedback,
never the actual gate.

- **DEFER PLAYER** moves the current player to the end of the remaining
  pool without changing their status — never lost (items 11–12).
- **UNDO LAST PLAYER RESULT** reverses only the last SOLD/UNSOLD outcome,
  not individual bids — named accordingly (item 13).
- The auction auto-transitions to `completed` after the last pool player
  is processed, and the Control Room then shows a completion summary
  (total players, sold/unsold counts, total points spent, per-team squad
  and guest-quota completion).
- Bids and sales beyond a team's purse, squad limit (14) or guest quota
  (3) are blocked unless a **Super Admin** explicitly overrides — checked
  both client-side (for the warning) and server-side (for enforcement).

### What's intentionally out of scope for this pass

Per the brief, this converts the existing Phase 1 + auction workflow
(**Registration → Verification → Segregation → Auction → Final Squad**)
before adding new modules. Sponsor management, the full Finance dashboard,
and Match Centre/Fixtures are not part of this build — the schema and
route structure are laid out so they can be added the same way (a new
migration + a new `/admin/<module>` route) without touching what's here.
