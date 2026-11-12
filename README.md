# CASE FILE: CLASS OF 23 — Farewell Keepsake Collector

A playful, mobile-first web application for collecting peer-written farewell memories across a batch of **23 school students**, designed with a **"police station meets school notebook"** detective aesthetic.

Data collected powers four keepsake editions:
1. **23-Card Collectible Character Stat Deck**
2. **NCERT Parody Textbook** (1 biological specimen chapter + board-exam question per student)
3. **CID / Police Confidential Class Dossier**
4. **Photo-Manga / Comic Book** of one chaotic school day

---

## Core Privacy & Identity Design

- **Nobody writes about themselves:** Each contributor selects their name from the 23-student roster and investigates the other **22** classmates. Self-writing and self-voting are blocked in both the UI and Postgres triggers.
- **No ID verification or OCR:** Contributors enter their **scholar number** (3 to 5 digits) and uppercase **First / Middle / Surname** directly in the form. No ID card photos, OCR, scholar-number matching, or verification workflows are used. The scholar number is collected strictly as contributor-provided keepsake metadata for the print editor.
- **EXIF GPS stripping:** Before any portrait, mugshot, or candid photo uploads to Supabase Storage, the browser redraws it on a full-resolution canvas to strip EXIF GPS location data while preserving resolution and orientation.
- **Private Storage & Strict RLS:** Portraits and candids upload to the private `keepsake` bucket under `{folder}/{auth.uid()}/...`. Contributors can read/write only their own rows. Public RPCs (`get_witness_counts`, `get_nickname_suggestions`) return only anonymous aggregate counts.

---

## 10-Step Setup Guide

1. **Clone & install dependencies:**
   ```bash
   npm install
   ```
2. **Create a Supabase project** at [supabase.com](https://supabase.com).
3. **Enable Anonymous Auth:** In Supabase Dashboard → **Authentication → Providers**, enable **Anonymous Sign-Ins**.
4. **Run the SQL schema:** Open Supabase **SQL Editor**, paste the entire contents of `supabase/schema.sql`, and execute it.
5. **Configure environment variables:** Copy `.env.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only key used by `/editor` API routes & seeding)
   - `EDITOR_PASSCODE` (any secret passcode/PIN for the student editor—no editor email needed)
6. **Seed test data (optional, for testing the Editor Dashboard):**
   ```bash
   npm run seed
   ```
   This generates `public/demo-seed.json` and, if `SUPABASE_SERVICE_ROLE_KEY` is set, pushes synthetic test data into Supabase.
7. **Start the dev server:**
   ```bash
   npm run dev
   ```
8. **Test the contributor flow** at `http://localhost:3000` (check mobile view at `390px` width).
9. **Check diagnostics** at `http://localhost:3000/health` (and `/api/health`).

---

## Unlocking the Student Editor Desk (`/editor`) & Auto-Email Archive ZIP

1. Set `EDITOR_PASSCODE` and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` (or Vercel Environment Variables). No editor email or magic link is required—one of the students acts as the editor.
2. To receive an automatic email with the complete archive ZIP (`class-of-23-complete-archive.zip`) as soon as all **23/23** students submit, also set:
   - `ARCHIVE_NOTIFY_EMAIL` (your email address)
   - Either `RESEND_API_KEY` (Option 1 — Resend API; `onboarding@resend.dev` works out of the box to your own Resend account email) **or** `SMTP_USER` + `SMTP_PASS` (Option 2 — Gmail App Password with `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`).
3. Ensure `supabase/schema.sql` has been run (it creates the `archive_dispatches` table used as an idempotency lock so the 23/23 auto-email triggers once even on concurrent final submissions).
4. Visit `/editor`, enter `EDITOR_PASSCODE`, and click **Unlock Editor Desk**.
5. Inside `/editor`, you can export individual CSVs/JSONs, click **Download Complete Master ZIP** (includes every answer to all 25 questions, 23 individual student `.md` dossiers, all 4 keepsake formats, and photos), or click **Send Complete Archive Email Now** to test or re-send anytime.
6. In local development without Supabase configured (`!NEXT_PUBLIC_SUPABASE_URL`), `/editor` automatically loads `public/demo-seed.json` so you can test every table, Pick/Edit control, Master ZIP download, and all exports without credentials.

---

## Deploying to Vercel

1. Push the repository to GitHub/GitLab.
2. Import the project in **Vercel** (Next.js preset auto-detected; `vercel.json` sets security headers).
3. Add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `EDITOR_PASSCODE`, `ARCHIVE_NOTIFY_EMAIL`, and either `RESEND_API_KEY` or `SMTP_USER` + `SMTP_PASS` under **Project Settings → Environment Variables**.
4. Deploy!

---

## Design Decisions & Assumptions

- **Audio synthesis via Howler.js:** Sound effects (stamp thud, typewriter click, paper rustle, shutter, chime, confetti) are synthesized as in-memory PCM WAV data URIs and played via lazy-loaded `howler`, eliminating external audio asset failures while staying 100% muted by default until the user toggles audio.
- **Offline-tolerant sync queue:** Every step saves immediately to Zustand (`localStorage`) and queues idempotent upserts to Supabase, flushing automatically when connectivity resumes.
- **Portrait requirement at Mugshot Station:** At least the Official Portrait + portrait consent checkbox are required to advance to `/desk`, while CID Mugshot and Worst Face are strongly encouraged with dedicated camera/gallery slots so students without a webcam or only one ready photo are never blocked.
- **Awards & Desk unlock:** Awards Podium, Class Archive, Chaos Dump, and Anything Else are highlighted after 5 case files and remain accessible anytime by choice; Final Review unlocks once all 22 classmates are Filed/Skipped and all 14 awards have votes.
