-- Solvd — initial schema
-- Run this once in your Supabase project's SQL editor.
-- Everything is idempotent; safe to re-run.

-- =============================================================
-- PROFILES  (extends Supabase auth.users)
-- =============================================================
create table if not exists profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  username     text unique not null,
  college      text,
  batch_year   int,
  branch       text,
  reputation   int not null default 0,
  role         text not null default 'user',        -- 'user' | 'mod' | 'admin'
  created_at   timestamptz not null default now()
);

-- Auto-create a profile row when a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'user_name',
             split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================
-- SUBJECTS
-- =============================================================
create table if not exists subjects (
  id         serial primary key,
  code       text unique not null,                  -- 'discrete-maths'
  name       text not null,                         -- 'Discrete Maths'
  branch     text,                                  -- 'CSE'
  semester   int,
  college    text                                   -- scope-by-college for later
);

-- =============================================================
-- PAPERS
-- =============================================================
create table if not exists papers (
  id            serial primary key,
  subject_id    int not null references subjects(id) on delete cascade,
  term          text not null,                      -- 'mid' | 'end' | 'quiz'
  year          int not null,
  pdf_path      text,                               -- Supabase Storage key, nullable in Phase 0
  uploaded_by   uuid references profiles(id) on delete set null,
  status        text not null default 'approved',   -- 'pending' | 'approved' | 'rejected'
  created_at    timestamptz not null default now(),
  unique (subject_id, term, year)
);

-- =============================================================
-- QUESTIONS
-- =============================================================
create table if not exists questions (
  id        serial primary key,
  paper_id  int not null references papers(id) on delete cascade,
  q_number  text not null,                          -- '1', '1a', '2b'
  title     text,                                   -- 'Logic Gates'
  body      text not null,                          -- markdown / plain
  marks     int,
  unique (paper_id, q_number)
);

-- =============================================================
-- SOLUTIONS
-- =============================================================
create table if not exists solutions (
  id            serial primary key,
  question_id   int not null references questions(id) on delete cascade,
  body          text not null,                      -- markdown, supports LaTeX / code fences
  author_id     uuid references profiles(id) on delete set null,
  upvotes       int not null default 0,
  downvotes     int not null default 0,
  is_accepted   boolean not null default false,
  status        text not null default 'approved',   -- 'pending' | 'approved' | 'rejected'
  created_at    timestamptz not null default now()
);

-- =============================================================
-- VOTES
-- =============================================================
create table if not exists votes (
  user_id       uuid not null references profiles(id) on delete cascade,
  solution_id   int not null references solutions(id) on delete cascade,
  value         smallint not null check (value in (-1, 1)),
  created_at    timestamptz not null default now(),
  primary key (user_id, solution_id)
);

-- =============================================================
-- NOTES  (subject-level, not tied to a paper)
-- =============================================================
create table if not exists notes (
  id           serial primary key,
  subject_id   int not null references subjects(id) on delete cascade,
  title        text not null,
  body         text not null,                       -- markdown
  author_id    uuid references profiles(id) on delete set null,
  status       text not null default 'approved',
  created_at   timestamptz not null default now()
);

-- =============================================================
-- REPORTS  (flags for moderation)
-- =============================================================
create table if not exists reports (
  id            serial primary key,
  target_type   text not null,                      -- 'solution' | 'paper' | 'note'
  target_id     int not null,
  reason        text,
  reporter_id   uuid references profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);

-- =============================================================
-- INDEXES  (search + hot queries)
-- =============================================================
create index if not exists idx_papers_subject      on papers(subject_id);
create index if not exists idx_questions_paper     on questions(paper_id);
create index if not exists idx_solutions_question  on solutions(question_id);
create index if not exists idx_notes_subject       on notes(subject_id);

create index if not exists questions_fts_idx on questions
  using gin (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(body,'')));
create index if not exists solutions_fts_idx on solutions
  using gin (to_tsvector('english', body));
create index if not exists notes_fts_idx     on notes
  using gin (to_tsvector('english', title || ' ' || body));

-- =============================================================
-- ROW-LEVEL SECURITY  (public read, restricted write)
-- =============================================================
alter table profiles  enable row level security;
alter table subjects  enable row level security;
alter table papers    enable row level security;
alter table questions enable row level security;
alter table solutions enable row level security;
alter table votes     enable row level security;
alter table notes     enable row level security;
alter table reports   enable row level security;

-- Public read for approved content
drop policy if exists "public read subjects"  on subjects;
create policy "public read subjects"  on subjects  for select using (true);

drop policy if exists "public read papers"    on papers;
create policy "public read papers"    on papers    for select using (status = 'approved');

drop policy if exists "public read questions" on questions;
create policy "public read questions" on questions for select using (true);

drop policy if exists "public read solutions" on solutions;
create policy "public read solutions" on solutions for select using (status = 'approved');

drop policy if exists "public read notes"     on notes;
create policy "public read notes"     on notes     for select using (status = 'approved');

drop policy if exists "public read profiles"  on profiles;
create policy "public read profiles"  on profiles  for select using (true);

-- Authenticated users can write their own content (used in Phase 1+)
drop policy if exists "auth insert papers"    on papers;
create policy "auth insert papers"    on papers
  for insert to authenticated
  with check (uploaded_by = auth.uid());

drop policy if exists "auth insert solutions" on solutions;
create policy "auth insert solutions" on solutions
  for insert to authenticated
  with check (author_id = auth.uid());

drop policy if exists "auth insert notes"     on notes;
create policy "auth insert notes"     on notes
  for insert to authenticated
  with check (author_id = auth.uid());

drop policy if exists "auth vote"             on votes;
create policy "auth vote"             on votes
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "auth report"           on reports;
create policy "auth report"           on reports
  for insert to authenticated
  with check (reporter_id = auth.uid());

drop policy if exists "auth update own profile" on profiles;
create policy "auth update own profile" on profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());
