# Phase 0 Prompt — Paste this into your first Claude Code session

Copy everything below the line into Claude Code as your first message. Do not paste `PLAN.md` — Claude Code will read it from disk when it needs to.

---

Read `CLAUDE.md` and `PLAN.md` in full before you start. Confirm you've read them.

We are on **Phase 0**. The scope is fixed:

**Goal:** Ship a read-only, DB-backed version of PrepVerse with real per-subject URLs. No auth, no uploads, no voting yet.

**Deliverables for this session, in order:**

1. **Scaffold Next.js in `web/`**
   - `npx create-next-app@latest web --typescript --tailwind --app --eslint --src-dir --import-alias "@/*"`
   - Do not use Turbopack in prod config; leave the defaults otherwise.
   - Add `@supabase/supabase-js` and `@supabase/ssr`.
   - Add shadcn/ui (`npx shadcn@latest init`) with slate as the base color.

2. **Wire up Supabase**
   - Create `web/lib/supabase/server.ts` and `web/lib/supabase/client.ts` following the current `@supabase/ssr` docs.
   - Read env vars from `.env.local` (I'll fill it based on `.env.example` — make sure the variable names match).

3. **Data layer**
   - Create `web/lib/db/` with one file per table we'll actually read in Phase 0: `subjects.ts`, `papers.ts`, `questions.ts`.
   - Each file exports typed query functions (e.g. `listSubjects()`, `getSubjectBySlug(slug)`, `listPapersForSubject(subjectId)`, `listQuestionsForPaper(paperId)`).
   - Generate the TypeScript types from the schema in `supabase/migrations/0001_init.sql` — do not `any`-type anything.

4. **Seed script**
   - Look at `scripts/extract_questions.mjs`. It reads `legacy/index.html` and outputs `scripts/seed.json`. Run it and confirm the output is sensible.
   - Then write `scripts/seed.mjs` which reads `seed.json` and inserts into Supabase using the service-role key from `.env.local` (`SUPABASE_SERVICE_ROLE_KEY`). Idempotent: use `upsert` on natural keys (subject `code`, paper `(subject_id, term, year)`, question `(paper_id, q_number)`).

5. **Pages** — build exactly these three routes and stop:

   - **`/`** — homepage. Lists all subjects grouped by semester. Each subject is a link. Use a clean, mobile-first Tailwind design with a subtle gradient background (**do not** port the video background from `legacy/`).
   - **`/[college]/[branch]/sem-[n]/[subject]`** — subject page. Lists all papers grouped by year, plus notes if any. Each paper links to the paper page.
   - **`/[college]/[branch]/sem-[n]/[subject]/[term]-[year]`** — paper page. Shows the list of questions. Each question has its title, body, and an "Show answer" disclosure that reveals the pre-existing answer from the legacy site (stored as a placeholder solution seeded alongside the question).

   Use `generateStaticParams` on the two dynamic routes. Set `export const revalidate = 300` (5 min ISR).

6. **Metadata**
   - Every page exports `generateMetadata` with a real `<title>` and `<meta description>`. Title format: `[Subject] — [Term] [Year] PYQs | PrepVerse`.

7. **README update**
   - Append a "Running the app" section to `README.md` with the exact commands.

**What NOT to do in this session:**

- No login, no signup, no Google OAuth. If you're tempted, re-read `CLAUDE.md`.
- No file upload UI.
- No voting, no comments, no leaderboard.
- No search yet.
- No custom fonts, no dark-mode toggle, no animations, no confetti.
- Do not delete `legacy/`. Keep it as a reference.

**Before you write code**, do this:

1. Confirm out loud (in the chat) that you've read `CLAUDE.md` and `PLAN.md`.
2. List the files you're about to create, in the order you'll create them.
3. Ask me to confirm before you start.

**When you're done**, tell me:
- What URL to visit locally (`http://localhost:3000` presumably).
- The exact SQL to run in the Supabase SQL editor (should just be the contents of `supabase/migrations/0001_init.sql`).
- The exact commands I need to run: `npm install`, seed script, `npm run dev`.
- Any env vars I still need to fill in `.env.local`.

If anything in this brief conflicts with something you find in `CLAUDE.md` or `PLAN.md`, stop and ask me. Otherwise, begin.
