# Solvd — High-Level Design & Growth Plan

*A collaborative PYQ + notes platform, built by students for students.*

---

## 0. Honest snapshot of where you are today

| Thing | Status |
|---|---|
| Frontend | Single 1,394-line `index.html` |
| Backend | None |
| Database | None (content hardcoded in HTML) |
| Auth | None |
| Contributions | Only you can edit the file |
| Search | None |
| Mobile performance | Poor — a fixed 10 MB video background |
| SEO | Zero — single page, no per-subject URLs, no metadata |

That's fine as a v0. But everything below assumes you're rebuilding, because bolting collaboration onto a static HTML file will hurt more than starting clean.

---

## 1. Product vision (in one paragraph)

Solvd is a **college-scoped, community-owned question bank**. Students upload past-year papers (PDFs), tag them by subject/term/year, and the community adds solutions, notes, and mnemonics. Reputation points and a weekly leaderboard turn "helping juniors" into a low-key sport. The site is fast, mobile-first, and works even on 3G, because it will be opened 20 minutes before an exam.

**Three personas:**
- **Seekers** (90% of traffic) — juniors browsing right before exams. Never sign up. You optimize *purely* for them: fast page, no login walls, one-tap PDF preview.
- **Contributors** (~8%) — sophomores/final-years who upload papers, write solutions. Sign up. Chase points.
- **Moderators** (~2%) — you + 2–3 trusted contributors. Approve first-time uploads, remove junk.

---

## 2. High-Level Design

### 2.1 Architecture

```
Student browser (mobile-first)
        |
        v
Vercel Edge / CDN
        |
        v
Next.js app (SSR + API routes)
   |         |          |
   v         v          v
Supabase   Supabase   Supabase
Postgres   Storage    Auth
           (PDFs)     (Google login)
```

### 2.2 Tech stack (chosen for a beginner solo dev)

| Layer | Pick | Why |
|---|---|---|
| Framework | **Next.js 14 (App Router)** | Frontend + API in one repo. Great docs. Free deploys. |
| DB + Auth + Storage | **Supabase** | Postgres + Google login + file storage on one free tier. No backend server to run. |
| Hosting | **Vercel** | One-click deploy from GitHub. Free for hobby. |
| UI | **Tailwind CSS + shadcn/ui** | You'll ship 3× faster than writing CSS from scratch. |
| PDF preview | **`react-pdf`** or an `<iframe>` to Supabase public URL | Preview without forcing download. |
| Analytics | **Plausible** (or Vercel Analytics free) | See what pages people actually hit. |
| Search (v1) | Postgres `tsvector` + trigram | Free, no extra service. Add Algolia later only if needed. |

**Why not Firebase?** Its data model (NoSQL) will bite you the moment you want "top contributors this week." Postgres is easier long-term for this domain.

**Why not just PHP + MySQL on shared hosting?** You *can*. But you'll spend more time on server ops than product. Supabase eliminates that.

### 2.3 Database schema

See `supabase/migrations/0001_init.sql` for the actual SQL. Tables:

- `profiles` — extends Supabase auth users with username, college, reputation, role.
- `subjects` — subject code, name, branch, semester, college.
- `papers` — a PDF for a subject + term + year, with moderation status.
- `questions` — individual questions parsed out of a paper.
- `solutions` — community-written answers, with upvotes/downvotes.
- `votes` — one row per user per solution.
- `notes` — subject-level notes (not tied to a specific paper).
- `reports` — flags for moderation.

### 2.4 URL structure (for SEO — this matters a lot)

Bad (your current site): `solvd.com/#discrete-maths-midterm`
Good:
```
/[college]/cse/sem-1/discrete-maths
/[college]/cse/sem-1/discrete-maths/midterm-2024
/[college]/cse/sem-1/discrete-maths/midterm-2024/q1a
```
Each URL is a real page with its own `<title>`, `<meta description>`, JSON-LD schema. This is what shows up when someone Googles *"discrete maths mid term pyq [your college]"* the night before their exam.

### 2.5 Core user flows

**Seeker (no login):**
1. Lands on `/[college]/cse/sem-1/discrete-maths` → sees list of papers by year + notes.
2. Taps a paper → PDF preview inline + question list on the side.
3. Taps a question → sees top-voted solution first.

**Contributor (logged in via Google):**
1. Clicks "Upload paper" → picks subject, term, year, PDF.
2. Paper goes to `status = 'pending'` queue.
3. Once approved by a mod, they get +10 reputation.
4. They can also add solutions to any existing question (auto-published after first approved contribution — trust-graduation).

**Moderator:**
1. `/mod` dashboard shows pending queue.
2. Approve / reject / edit in one click.
3. Report queue for community flags.

### 2.6 Moderation model (don't skip this)

The moment you allow uploads, you get: joke uploads, copyright-flagged material, spam links inside PDFs, and eventually someone uploading someone else's solved assignment.

**Rules:**
- First 3 uploads by any user → require mod approval.
- After 3 approved uploads → auto-publish, but flaggable.
- Any flag → auto-hide until reviewed.
- Solutions: same trust-graduation model.

**Copyright note:** Publishing question papers is generally accepted in Indian college culture, but if you host actual scanned solved answer sheets from official exams, you're in murkier territory. Stick to question papers + community-written solutions. If your college has an official policy against redistribution, ask before scaling.

### 2.7 Performance rules (non-negotiable if you want traffic)

1. **Kill the video background.** It's 10 MB. Your users are on mobile data. Use a static SVG pattern or a CSS gradient. This alone will double your bounce-rate → engagement.
2. Lazy-load PDFs — only fetch when user taps.
3. Static-generate subject index pages, revalidate every 5 min (Next.js ISR).
4. Aim for Lighthouse mobile score ≥ 90.

---

## 3. Build phases (don't build everything at once)

### Phase 0 — This weekend (2 days)
- Scaffold Next.js + Supabase + Tailwind.
- Migrate your existing 3 subjects' content into the DB (via `scripts/extract_questions.mjs`).
- Deploy to Vercel with your real domain.
- Ship: **read-only site with real URLs per subject.** No login yet.

### Phase 1 — Week 2–3
- Google login via Supabase.
- Upload paper (PDF) with the pending-queue moderation.
- Mod dashboard (just for you initially).
- Basic search across questions.

### Phase 2 — Week 4–6
- Solutions with upvotes/downvotes.
- User profiles + reputation.
- Weekly leaderboard page.
- Notes section per subject.

### Phase 3 — Post-launch
- Comments/discussion under each solution.
- Email digest ("5 new solutions this week in Discrete Maths").
- Bookmarks.
- Multi-college support (only after you dominate your own).

**Rule:** Don't start Phase 2 features until Phase 1 is public and you have 50+ real users. It's easy to keep building forever and never ship.

---

## 4. Growth plan (this is where most student projects die)

You will not get traffic from Google in month 1. You get traffic by **going where your users already are, at the moment they need you most.**

### 4.1 Pick your beachhead

Do not launch "for all students in India." Launch for **one branch, one year, at your own college.** Example: "CSE first-year at [your college]." That's ~200–500 people. If 100 of them use it, you've won. Expand outward from there.

### 4.2 Distribution channels, ranked

1. **WhatsApp/Telegram groups** — This is *the* channel. Every batch has a group. Get your link into the CSE-1st-year group 3 days before mid-terms. One good message beats 10 Instagram reels.
2. **Google search (long-tail SEO)** — People Google *"[subject name] mid term pyq [college name]"* at 1 AM. If your URL structure (§2.4) is right and you have 5+ pages per subject, you'll rank. Traffic here compounds every semester.
3. **Reddit** — subreddits for your college (r/BennettUniversity, r/vit, r/kiit, r/DelhiUniversity, etc.). One post per launch, framed as "hey, made this for us, contribute if you want." Do not spam.
4. **Instagram** — Not for reach, for credibility. A clean page with the site link in bio. Post one carousel every 2 weeks: "5 discrete maths questions that came in the last 3 years." Meme content > polished content.
5. **On-campus poster** — Yes, a physical A4 poster in the CSE block with a QR code. Zero cost. Insanely effective at Indian colleges.

### 4.3 Timing is everything

The single highest-leverage window is **10 days before each term exam.** Concentrate 80% of your marketing effort in these windows:

- Week -2: Post PYQs and updated notes.
- Week -1: Push in every WhatsApp group.
- Exam week: Push to add fresh solutions ("first to solve Q3 gets 50 rep").
- Post-exam: Ask top scorers to upload the paper they just took. This is the crown-jewel contribution.

### 4.4 Viral loops to design in

- **Weekly leaderboard email** to registered users. FOMO loop.
- **"You just contributed! Share your rep badge on your story"** — one-tap Instagram Story with a pre-designed template.
- **Referral rep bonus** — invite a friend who uploads a paper → both get +20 rep.
- **Public profile page** — `solvd.com/@yourname` — a portfolio students can share ("500 rep, top 5 in Discrete Maths"). CS students love this stuff.

### 4.5 Content moat

Your defensibility is not code — anyone can rebuild this in a week. Your moat is:
1. **The paper archive** — once you have 5+ years × 20+ subjects, you're irreplaceable.
2. **Community-written solutions** — new site would take a semester to catch up.
3. **URL authority** — once you rank #1 for "[subject] pyq [college]," momentum is hard to break.

Focus every early move on filling the archive fast. Consider a one-time bounty week: "First person to upload a valid paper for each subject gets ₹100 UPI." Costs you ~₹2,000. Saves you a semester.

### 4.6 Metrics to track from day 1

- **Weekly active seekers** (not signups — page views by returning visitors)
- **Papers in archive**
- **Solutions per question** (health of the community, not the audience)
- **7-day retention of contributors** — the one metric that predicts survival

Install Plausible or Vercel Analytics on day 1. You cannot fix what you don't measure.

---

## 5. Things you'll be tempted to do — don't

- **Don't build a mobile app.** A fast mobile web is 20× cheaper and reaches everyone. Add a PWA install prompt later.
- **Don't add AI-generated solutions** at launch. They're often subtly wrong, and one wrong solution on an exam question destroys trust forever. Add "AI hints" as an optional side feature after you have real solutions.
- **Don't launch a Discord.** You'll spend hours moderating chit-chat. Async contribution beats real-time chat for this domain.
- **Don't monetize in year 1.** No ads, no paywalls. Trust first. Ads on a student site are a slow death — students will just uBlock you and switch sites.
