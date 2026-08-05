# PrepVerse

A collaborative previous-year-question-paper platform, built by students for students.

Full product plan lives in [`PLAN.md`](./PLAN.md). Rules for Claude Code live in [`CLAUDE.md`](./CLAUDE.md). The exact prompt for your first Claude Code session lives in [`PHASE_0_PROMPT.md`](./PHASE_0_PROMPT.md).

---

## What's in this repo (right now)

```
prepverse/
├── PLAN.md                    <- full HLD + growth plan
├── CLAUDE.md                  <- house rules Claude Code auto-reads
├── PHASE_0_PROMPT.md          <- paste this into Claude Code
├── README.md                  <- you are here
├── .env.example               <- copy to web/.env.local, fill in
├── .gitignore
├── legacy/
│   ├── index.html             <- your original static site
│   └── bh.mp4                 <- old video background (unused going forward)
├── supabase/
│   └── migrations/
│       └── 0001_init.sql      <- run this in your Supabase project
├── scripts/
│   ├── extract_questions.mjs  <- parses legacy/index.html → seed.json
│   ├── seed.mjs               <- pushes seed.json into Supabase
│   └── package.json
└── web/                       <- the Next.js 14 app
    ├── .env.local             <- YOUR KEYS GO HERE (gitignored)
    └── src/
        ├── app/               <- the 3 routes
        ├── components/
        └── lib/               <- config, routes, db/, supabase/
```

---

## Setup — do these in order, once

### 1. Move your legacy files into `legacy/`

If you unzipped this starter into your existing `PrepVerse/` folder, do:

```bash
mv index.html legacy/
mv bh.mp4     legacy/
```

Everything from the old site is preserved but out of the way. Do NOT delete `legacy/` — the extractor reads from it.

### 2. Install Node.js (if you don't have it)

You need Node 20 or newer.

```bash
node --version   # should print v20.x.x or higher
```

If not, install from [nodejs.org](https://nodejs.org) (LTS).

### 3. Create a Supabase project (free)

1. Go to [supabase.com](https://supabase.com), sign up with GitHub.
2. Create a new project. Pick a region close to you (Mumbai / Singapore for India).
3. Wait ~2 minutes for it to spin up.
4. Go to **Project Settings → API**. Copy three things:
   - Project URL (looks like `https://xxxxx.supabase.co`)
   - `anon` public key
   - `service_role` secret key ⚠ keep private

### 4. Run the schema migration

1. In the Supabase dashboard, click **SQL Editor** → **New query**.
2. Open [`supabase/migrations/0001_init.sql`](./supabase/migrations/0001_init.sql), copy everything.
3. Paste into the editor and click **Run**.
4. Verify: **Table Editor** in the sidebar should now show `profiles`, `subjects`, `papers`, `questions`, `solutions`, `votes`, `notes`, `reports`.

### 5. Set up environment variables

```bash
cp .env.example web/.env.local
```

Then open `web/.env.local` in an editor and paste in the three Supabase values from step 3.

> **It must be `web/.env.local`, not `.env.local` at the root.** Next.js only
> auto-loads env files from its own project folder, which is `web/`. At the root
> the app will start up and then fail with "Missing environment variable".
> The seed script reads `web/.env.local` too, so one file covers both.

### 6. Extract questions from your legacy HTML

```bash
cd scripts
node extract_questions.mjs
```

You should see something like:

```
✅ Extracted:
   3 subjects
   6 papers
     - discrete-maths mid 2024: 5 questions
     - discrete-maths end 2024: 9 questions
     ...
Wrote scripts/seed.json
```

This creates `scripts/seed.json`. Claude Code will pick it up from here.

### 7. Open Claude Code in this folder

```bash
cd ..                # back to repo root
claude               # or however you launch Claude Code
```

### 8. Paste the Phase 0 prompt

Open [`PHASE_0_PROMPT.md`](./PHASE_0_PROMPT.md), copy everything below the `---`, paste as your first message to Claude Code.

Claude Code will:
- confirm it read `CLAUDE.md` and `PLAN.md`
- scaffold Next.js in `web/`
- wire up Supabase
- write the seed script
- build 3 pages (home, subject, paper)

After it says done, follow the commands it gives you (typically `cd web && npm install && npm run dev`) and open `http://localhost:3000`.

---

## Running the app

Phase 0 is built. Run every command below **from the repo root.**

### First time only

```bash
# 1. Install the Next.js app's dependencies
npm install --prefix web

# 2. Install the seed script's dependencies (separate package.json)
npm install --prefix scripts
```

You must also have done setup steps 3–5 above: created the Supabase project, run
`supabase/migrations/0001_init.sql` in the SQL editor, and filled in
`web/.env.local`.

### Put the legacy content into the database

```bash
# Parse legacy/index.html -> scripts/seed.json
npm run extract --prefix scripts

# Push seed.json into Supabase (needs SUPABASE_SERVICE_ROLE_KEY)
npm run seed --prefix scripts
```

Expected output from `extract`: 3 subjects, 6 papers, 37 questions, 3 notes.
Expected output from `seed`: the same counts, confirmed inserted.

**Both scripts are safe to re-run.** `extract` overwrites `seed.json`; `seed`
updates existing rows instead of creating duplicates.

### Start the dev server

```bash
npm run dev --prefix web
```

Then open **http://localhost:3000**.

Pages you can visit:

| URL | What it shows |
|---|---|
| `/` | All subjects, grouped by semester |
| `/sst/cse/sem-1/discrete-maths` | Papers by year + notes for one subject |
| `/sst/cse/sem-1/discrete-maths/mid-2024` | The questions, each with a "Show answer" toggle |

Other subject slugs are `icp` and `webdev`; other paper slugs are `mid-2024`
and `end-2024`.

### Check it before you deploy

```bash
npm run build --prefix web
```

This is the real test — it prerenders every subject and paper page, so a broken
query or a bad type shows up here rather than in production. It also type-checks
and lints.

### Changing the college in the URLs

The college slug `sst` appears in every URL. It lives in two places that must
agree:

1. `scripts/extract_questions.mjs` — the `COLLEGE` constant (what gets stored in
   the database)
2. `web/src/lib/config.ts` — `DEFAULT_COLLEGE` and `COLLEGE_NAME` (the display
   name in page titles)

Change both, then re-run `extract` and `seed`.

---

## Working with Claude Code — the golden rules

1. **One phase per session.** When Phase 0 is deployed and working, ask me for `PHASE_1_PROMPT.md`. Do not skip ahead.
2. **If Claude Code suggests a new library, push back.** The locked stack is in `CLAUDE.md`.
3. **If it wants to delete `legacy/` or rewrite `PLAN.md`, say no.**
4. **After every session, commit to git.** `git add . && git commit -m "phase 0: scaffold + read-only site"`. Rolling back is cheap when you commit.

---

## Deploy to Vercel (once Phase 0 works locally)

1. Push your repo to GitHub.
2. Go to [vercel.com](https://vercel.com), sign in with GitHub.
3. Import the repo. Set **Root Directory** = `web`.
4. Add these env vars in the Vercel dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_SITE_URL` — your real URL, e.g. `https://prepverse.in`. Without
     it, canonical tags and JSON-LD point at `localhost`, which wrecks the SEO
     plan in `PLAN.md` §2.4.

   Do **not** add `SUPABASE_SERVICE_ROLE_KEY` — the app never uses it, only the
   local seed script does.
5. Deploy. You get a `*.vercel.app` URL immediately.
6. Buy a domain when you're ready (Namecheap: `prepverse.in` ≈ ₹700/yr) and point it at Vercel.

---

## Questions / stuck?

Re-read the relevant section of `PLAN.md` first, then ask Claude Code. If Claude Code is confused, remind it to re-read `CLAUDE.md`.
