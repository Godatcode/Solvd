#!/usr/bin/env node
/**
 * seed.mjs
 *
 * Reads ./seed.json (produced by extract_questions.mjs) and pushes it into
 * Supabase using the service-role key.
 *
 * Run it as many times as you like — it is idempotent:
 *   subjects   upsert on  code
 *   papers     upsert on  (subject_id, term, year)
 *   questions  upsert on  (paper_id, q_number)
 *   solutions  matched on (question_id, author_id IS NULL)   <- see note below
 *   notes      matched on (subject_id, title)
 *
 * solutions and notes have no unique constraint in 0001_init.sql, so a plain
 * upsert would duplicate rows on every run. Instead we look for the row this
 * script would have created before (a seeded row has author_id = NULL) and
 * update it. That keeps re-runs clean WITHOUT touching solutions real users
 * write in Phase 2.
 *
 * Usage, from the repo root:
 *   npm install --prefix scripts
 *   npm run seed --prefix scripts
 */

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED_PATH = resolve(__dirname, 'seed.json');

// -----------------------------------------------------------------
// Environment
// -----------------------------------------------------------------

// web/.env.local is the real one (Next.js only reads env files from web/).
// The repo root is checked too, in case you put it there by habit.
const ENV_CANDIDATES = [
  resolve(__dirname, '../web/.env.local'),
  resolve(__dirname, '../.env.local'),
];

const loadedFrom = ENV_CANDIDATES.filter((path) => existsSync(path));
for (const path of loadedFrom) dotenv.config({ path });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function fail(message) {
  console.error(`\n❌ ${message}\n`);
  process.exit(1);
}

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  fail(
    'Missing Supabase credentials.\n\n' +
      (loadedFrom.length
        ? `   Loaded env from: ${loadedFrom.join(', ')}\n`
        : '   No .env.local found.\n') +
      '\n   Fix it:\n' +
      '     1. cp .env.example web/.env.local\n' +
      '     2. Fill in NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY\n' +
      '        (Supabase dashboard -> Project Settings -> API)',
  );
}

if (!existsSync(SEED_PATH)) {
  fail(
    'scripts/seed.json not found.\n\n' +
      '   Generate it first:\n' +
      '     npm run extract --prefix scripts',
  );
}

// The service-role key bypasses Row Level Security, which is exactly why this
// runs on your machine and never in the browser or on Vercel.
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Throw with a readable message instead of Supabase's bare object. */
function check(label, { data, error }) {
  if (error) fail(`${label} failed: ${error.message}${error.hint ? `\n   Hint: ${error.hint}` : ''}`);
  return data;
}

// -----------------------------------------------------------------
// Seed
// -----------------------------------------------------------------

const seed = JSON.parse(readFileSync(SEED_PATH, 'utf8'));

const stats = {
  subjects: 0,
  papers: 0,
  questions: 0,
  solutionsInserted: 0,
  solutionsUpdated: 0,
  notesInserted: 0,
  notesUpdated: 0,
};

// --- Subjects -----------------------------------------------------
const subjectRows = check(
  'upsert subjects',
  await supabase
    .from('subjects')
    .upsert(
      seed.subjects.map((subject) => ({
        code: subject.code,
        name: subject.name,
        branch: subject.branch ?? null,
        semester: subject.semester ?? null,
        college: subject.college ?? null,
      })),
      { onConflict: 'code' },
    )
    .select('id, code'),
);

const subjectIdByCode = new Map(subjectRows.map((row) => [row.code, row.id]));
stats.subjects = subjectRows.length;

// --- Papers -------------------------------------------------------
const paperPayload = [];
for (const paper of seed.papers) {
  const subjectId = subjectIdByCode.get(paper.subject_code);
  if (!subjectId) {
    console.warn(`⚠  Skipping paper for unknown subject "${paper.subject_code}"`);
    continue;
  }
  paperPayload.push({ subject_id: subjectId, term: paper.term, year: paper.year });
}

const paperRows = paperPayload.length
  ? check(
      'upsert papers',
      await supabase
        .from('papers')
        .upsert(paperPayload, { onConflict: 'subject_id,term,year' })
        .select('id, subject_id, term, year'),
    )
  : [];

const paperKey = (subjectId, term, year) => `${subjectId}|${term}|${year}`;
const paperIdByKey = new Map(
  paperRows.map((row) => [paperKey(row.subject_id, row.term, row.year), row.id]),
);
stats.papers = paperRows.length;

// --- Questions ----------------------------------------------------
// Keep a parallel list of the source questions so we can attach answers after
// the upsert hands back the generated question ids.
const questionPayload = [];
const answerBySourceIndex = [];

for (const paper of seed.papers) {
  const subjectId = subjectIdByCode.get(paper.subject_code);
  if (!subjectId) continue;

  const paperId = paperIdByKey.get(paperKey(subjectId, paper.term, paper.year));
  if (!paperId) continue;

  for (const question of paper.questions) {
    questionPayload.push({
      paper_id: paperId,
      q_number: question.q_number,
      title: question.title || null,
      body: question.body,
      marks: question.marks ?? null,
    });
    answerBySourceIndex.push(question.answer || '');
  }
}

const questionRows = questionPayload.length
  ? check(
      'upsert questions',
      await supabase
        .from('questions')
        .upsert(questionPayload, { onConflict: 'paper_id,q_number' })
        .select('id, paper_id, q_number'),
    )
  : [];

stats.questions = questionRows.length;

// upsert().select() does not guarantee input order, so map back by natural key.
const questionIdByKey = new Map(
  questionRows.map((row) => [`${row.paper_id}|${row.q_number}`, row.id]),
);

// --- Solutions (the legacy answers) -------------------------------
const answers = [];
questionPayload.forEach((question, index) => {
  const body = answerBySourceIndex[index];
  if (!body) return;

  const questionId = questionIdByKey.get(`${question.paper_id}|${question.q_number}`);
  if (!questionId) return;

  answers.push({ questionId, body });
});

if (answers.length) {
  // One query for every already-seeded solution, so we know insert vs update.
  const existing = check(
    'read existing seeded solutions',
    await supabase
      .from('solutions')
      .select('id, question_id')
      .in(
        'question_id',
        answers.map((answer) => answer.questionId),
      )
      .is('author_id', null),
  );

  const seededSolutionIdByQuestion = new Map(
    existing.map((row) => [row.question_id, row.id]),
  );

  const toInsert = [];
  for (const answer of answers) {
    const existingId = seededSolutionIdByQuestion.get(answer.questionId);

    if (existingId) {
      check(
        `update solution ${existingId}`,
        await supabase.from('solutions').update({ body: answer.body }).eq('id', existingId).select('id'),
      );
      stats.solutionsUpdated += 1;
    } else {
      toInsert.push({
        question_id: answer.questionId,
        body: answer.body,
        author_id: null,
        status: 'approved',
      });
    }
  }

  if (toInsert.length) {
    const inserted = check(
      'insert solutions',
      await supabase.from('solutions').insert(toInsert).select('id'),
    );
    stats.solutionsInserted = inserted.length;
  }
}

// --- Notes --------------------------------------------------------
for (const note of seed.notes ?? []) {
  const subjectId = subjectIdByCode.get(note.subject_code);
  if (!subjectId) {
    console.warn(`⚠  Skipping note for unknown subject "${note.subject_code}"`);
    continue;
  }

  const existing = check(
    'read existing notes',
    await supabase
      .from('notes')
      .select('id')
      .eq('subject_id', subjectId)
      .eq('title', note.title)
      .is('author_id', null)
      .limit(1),
  );

  if (existing.length) {
    check(
      'update note',
      await supabase.from('notes').update({ body: note.body }).eq('id', existing[0].id).select('id'),
    );
    stats.notesUpdated += 1;
  } else {
    check(
      'insert note',
      await supabase
        .from('notes')
        .insert({
          subject_id: subjectId,
          title: note.title,
          body: note.body,
          author_id: null,
          status: 'approved',
        })
        .select('id'),
    );
    stats.notesInserted += 1;
  }
}

// -----------------------------------------------------------------
// Summary
// -----------------------------------------------------------------

console.log('✅ Seeded Supabase:');
console.log(`   ${stats.subjects} subjects`);
console.log(`   ${stats.papers} papers`);
console.log(`   ${stats.questions} questions`);
console.log(
  `   ${stats.solutionsInserted} solutions inserted, ${stats.solutionsUpdated} updated`,
);
console.log(`   ${stats.notesInserted} notes inserted, ${stats.notesUpdated} updated`);
console.log('\nRe-running this script is safe — it updates instead of duplicating.');
