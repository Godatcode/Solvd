# CLAUDE.md — House rules for this project

This file is auto-loaded by Claude Code. Read it every session.

## Project

PrepVerse is a collaborative previous-year-question-paper (PYQ) platform for Indian college students. Full product plan lives in `PLAN.md`. Current phase and the exact next task live in `PHASE_0_PROMPT.md` (or whichever `PHASE_N_PROMPT.md` is current). **Do not build features from later phases.**

## Locked stack — do not swap without asking

- **Framework:** Next.js 14, App Router, TypeScript, React Server Components by default.
- **Styling:** Tailwind CSS only. No CSS-in-JS. No CSS modules unless unavoidable.
- **UI primitives:** shadcn/ui when a primitive is needed. Do not add MUI, Chakra, Ant, Mantine, etc.
- **DB / Auth / Storage:** Supabase, accessed via `@supabase/supabase-js` and `@supabase/ssr`. **No Prisma, no Drizzle, no other ORM.** Write plain SQL in migrations, query with the Supabase client.
- **Deploy target:** Vercel.
- **Package manager:** npm (not pnpm, not bun) unless the user says otherwise.
- **Node:** 20+.

## What NOT to add

- No tRPC, no GraphQL, no React Query. Server Components + Supabase queries in the server are enough.
- No Redux, Zustand, Jotai, or any client state library. `useState` and URL params only, until proven insufficient.
- No auth libraries other than Supabase Auth. No NextAuth.
- No CSS animation libraries (Framer Motion etc.) in Phase 0 or 1.
- No test framework yet. Ship first, add tests when there's real logic to break.
- No `useEffect` for data fetching. Fetch in Server Components.

## Folder layout

```
prepverse/                     <- repo root
├── PLAN.md                    <- product/strategy doc, read for context
├── CLAUDE.md                  <- this file
├── PHASE_0_PROMPT.md          <- the current task
├── README.md                  <- setup instructions for the human
├── .env.example
├── legacy/                    <- old static site (index.html, bh.mp4). DO NOT DELETE.
├── supabase/
│   └── migrations/            <- SQL files, run in order
├── scripts/                   <- one-off Node scripts
└── web/                       <- the Next.js app lives HERE
    ├── .env.local             <- Next.js only reads env files from web/, not the root
    └── src/                   <- scaffolded with --src-dir
        ├── app/               <- App Router routes
        ├── components/        <- shared components
        └── lib/
            ├── config.ts      <- college/branch/site constants
            ├── routes.ts      <- the ONLY place that builds a PrepVerse URL
            ├── db/            <- one file per table, typed query functions
            └── supabase/      <- server.ts + client.ts
```

The user will run all commands from the repo root. When you scaffold Next.js, put it in `web/`, not the root. When you need to install a script dep, put a separate `package.json` inside `scripts/`.

## Code style

- TypeScript strict mode. No `any` unless justified in a comment.
- Server Components by default. Add `"use client"` only when you need interactivity (event handlers, hooks, browser APIs).
- Data access lives in `web/src/lib/db/` — one file per table, each exporting typed query functions. Do not sprinkle `supabase.from(...)` calls across pages.
- Row types in `web/src/lib/db/types.ts` must be declared with `type`, never `interface`. postgrest-js constrains rows to `Record<string, unknown>`, and TypeScript only gives type aliases an implicit index signature — an interface there makes every `.select()` silently resolve to `never[]` while still compiling.
- Never build a URL by string concatenation in a page. Use the helpers in `web/src/lib/routes.ts`.
- No inline `<style>` tags. No `style={{}}` props unless computed at runtime.
- Filenames: `kebab-case.tsx` for components, `kebab-case.ts` for utilities.
- Route folders in App Router use lowercase, kebab-case (`sem-1`, not `sem1`).

## Performance rules (this project lives or dies on mobile)

- Every page must render server-side by default.
- Images: use `next/image` with explicit width/height.
- No autoplaying video, ever. If the human asks to keep the legacy video background, refuse and point at `PLAN.md §2.7`.
- Any client-side bundle addition needs justification.
- Prefer static generation (`generateStaticParams`) for subject and paper pages; use ISR (`revalidate = 300`) so new content shows up without a full rebuild.

## SEO rules

- Every dynamic page exports `generateMetadata`.
- URL structure is defined in `PLAN.md §2.4`. Do not invent your own.
- Add JSON-LD (`Question` / `Article` schema) on question and note pages.

## Working with the human

The human is a beginner. Be explicit:

- After making changes, always tell them the exact commands to run next (`npm install`, `npm run dev`, the SQL to paste into Supabase SQL editor, etc.).
- When something requires action outside the code (creating a Supabase project, getting a Google OAuth client ID, adding an env var), stop and give a numbered checklist.
- If you're about to do something destructive (delete a file, drop a table, force-push), ask first.
- If a proposed change contradicts `PLAN.md` or this file, flag it rather than silently proceeding.

## Phase discipline

Every session, before you start:
1. Read `CLAUDE.md` (this file).
2. Read the current phase prompt (`PHASE_0_PROMPT.md` for now).
3. Skim the relevant section of `PLAN.md`.
4. State the scope of the current task in one sentence before writing code.
5. If the task creeps beyond the current phase, stop and ask.
