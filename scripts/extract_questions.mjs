#!/usr/bin/env node
/**
 * extract_questions.mjs
 *
 * Reads ../legacy/index.html and writes ./seed.json.
 *
 * Zero dependencies — uses hand-rolled parsing so you can run it with
 * plain `node scripts/extract_questions.mjs` without an npm install.
 *
 * Output shape:
 * {
 *   subjects: [{ code, name, branch, semester }],
 *   papers:   [{ subject_code, term, year, questions: [{ q_number, title, body, answer }] }],
 *   notes:    [{ subject_code, title, body }]
 * }
 *
 * You (or Claude Code) then feed seed.json into scripts/seed.mjs which
 * inserts everything into Supabase.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HTML_PATH = resolve(__dirname, '../legacy/index.html');
const OUT_PATH  = resolve(__dirname, 'seed.json');

// -----------------------------------------------------------------
// EDIT THIS if your legacy HTML uses different section id prefixes.
// The prefix must match the `id="..."` on each <div class="content-section">.
// -----------------------------------------------------------------
// `college` is stored as the URL SLUG, not the display name — it becomes the
// first path segment (/sst/cse/sem-1/...). The human-readable name lives in
// web/src/lib/config.ts as COLLEGE_NAME. Keep the two in sync.
const COLLEGE = 'sst';

const SUBJECTS = [
  { code: 'discrete-maths', name: 'Discrete Maths',   branch: 'CSE', semester: 1, college: COLLEGE },
  { code: 'icp',            name: 'ICP',              branch: 'CSE', semester: 1, college: COLLEGE },
  { code: 'webdev',         name: 'Web Development',  branch: 'CSE', semester: 1, college: COLLEGE },
];

const TERM_MAP = {
  midterm: 'mid',
  endterm: 'end',
  notes:   'notes',
};

// Year we assume the legacy questions came from. Tweak as needed.
const LEGACY_YEAR = 2024;

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------

/**
 * Strip HTML tags — but ONLY real ones.
 *
 * A naive /<[^>]+>/g is wrong for this file: the legacy <pre><code> blocks
 * contain unescaped source code, so `while (top <= bottom && left <= right)`
 * and `List<Integer>` both look like tags and get eaten. There are 27 such
 * raw `<` in legacy/index.html. So we only strip the tag names that actually
 * appear in the document, which leaves comparison operators and Java
 * generics intact.
 */
const TAG_RE = new RegExp(
  '</?(?:' +
    ['div', 'p', 'h[1-6]', 'strong', 'em', 'b', 'i', 'u', 'button', 'li', 'ul', 'ol',
     'code', 'pre', 'a', 'br', 'span', 'section', 'nav', 'header', 'footer',
     'table', 'thead', 'tbody', 'tr', 'td', 'th', 'img', 'input', 'video', 'source',
     'script', 'style', 'small', 'sup', 'sub', 'blockquote', 'hr'].join('|') +
    ')\\b[^>]*>',
  'gi',
);

function stripTags(s) {
  return s.replace(TAG_RE, '');
}

/**
 * Decode the handful of HTML entities the legacy file actually uses, and
 * normalise exotic whitespace to plain spaces.
 *
 * The legacy file indents with 1,886 literal U+00A0 non-breaking spaces
 * rather than ASCII spaces. Without folding those down, every later
 * /[ \t]+/ collapse silently no-ops and the extracted text keeps the raw
 * HTML source indentation.
 */
function decodeEntities(s) {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/[\u00a0\u2000-\u200a\u202f\u205f\u3000]/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&'); // last, so "&amp;lt;" survives as "&lt;"
}

/** Strip HTML tags, collapse whitespace, decode a few common entities. */
function textOf(html) {
  return decodeEntities(
    stripTags(
      html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<\/li>/gi, '\n'),
    ),
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/^[ \t]+|[ \t]+$/gm, '') // per-line trim: kills source-indent leftovers
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Same as textOf, but whitespace-sensitive blocks survive intact.
 *
 * The legacy file has two kinds of content where indentation IS the meaning:
 *   <pre>…</pre>                        — Java/JS code in answers
 *   <div class="example-content">…</div> — ASCII matrices in I/O examples
 * Collapsing runs of spaces in those turns a 7x7 matrix into one long line.
 * So we lift them out behind placeholders, run the normal text pass, then
 * splice the untouched originals back in.
 */
function textOfKeepingLayout(html) {
  const kept = [];
  const stash = (raw) => {
    kept.push(
      decodeEntities(stripTags(raw))
        .replace(/^\s*\n/, '')
        .replace(/\s+$/, ''),
    );
    return `@@KEEP${kept.length - 1}@@`;
  };

  let s = html.replace(/<pre\b[^>]*>([\s\S]*?)<\/pre\s*>/gi, (_, inner) => stash(inner));

  // example-content can't be done with a lazy regex safely, so walk it depth-aware.
  const exampleRe = /<div\s+class="example-content"[^>]*>/i;
  for (let m = s.match(exampleRe); m; m = s.match(exampleRe)) {
    const openStart = m.index;
    const innerStart = openStart + m[0].length;
    const end = findMatchingCloseDiv(s, innerStart);
    const inner = s.slice(innerStart, end - '</div>'.length);
    s = s.slice(0, openStart) + stash(inner) + s.slice(end);
  }

  return textOf(s)
    .replace(/@@KEEP(\d+)@@/g, (_, i) => `\n${kept[Number(i)]}\n`)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Given a starting index of an opening `<div ...>`, return the index just
 * past the matching `</div>`. Depth-aware; does NOT trust regex.
 */
function findMatchingCloseDiv(html, openTagEndIdx) {
  let depth = 1;
  let i = openTagEndIdx;
  const openRe  = /<div\b[^>]*>/gi;
  const closeRe = /<\/div\s*>/gi;
  openRe.lastIndex  = i;
  closeRe.lastIndex = i;
  while (depth > 0) {
    const nextOpen  = (openRe.lastIndex  = i, openRe.exec(html));
    const nextClose = (closeRe.lastIndex = i, closeRe.exec(html));
    if (!nextClose) return html.length;
    if (nextOpen && nextOpen.index < nextClose.index) {
      depth++;
      i = nextOpen.index + nextOpen[0].length;
    } else {
      depth--;
      i = nextClose.index + nextClose[0].length;
      if (depth === 0) return i;
    }
  }
  return i;
}

/** Extract all sibling <div class="question">…</div> blocks from a slice of HTML. */
function extractQuestionBlocks(sectionHtml) {
  const blocks = [];
  const openRe = /<div\s+class="question"[^>]*>/gi;
  let m;
  while ((m = openRe.exec(sectionHtml)) !== null) {
    const start = m.index + m[0].length;
    const end   = findMatchingCloseDiv(sectionHtml, start);
    // end includes the closing </div>, so slice up to end - "</div>".length
    const inner = sectionHtml.slice(start, end - '</div>'.length);
    blocks.push(inner);
  }
  return blocks;
}

/**
 * The legacy file uses TWO markup shapes for answers, depending on the section:
 *   <div class="answer">…</div>       — short prose answers (mid-terms)
 *   <div class="code-answer"><pre>…   — full code solutions (end-terms)
 * Matching only the first silently dropped 13 of 37 answers, so match both.
 * Order matters: test "code-answer" first, since /class="answer"/ would not
 * match it but a looser regex easily could if this is ever edited.
 */
const ANSWER_OPEN_RE = /<div\s+class="(?:code-answer|answer)"[^>]*>/i;

/** Extract answer text from a question block. Preserves code/matrix layout. */
function extractAnswer(qHtml) {
  const m = qHtml.match(ANSWER_OPEN_RE);
  if (!m) return '';
  const start = m.index + m[0].length;
  const end   = findMatchingCloseDiv(qHtml, start);
  return textOfKeepingLayout(qHtml.slice(start, end - '</div>'.length));
}

/** Extract the question title from an <h3>. */
function extractTitle(qHtml) {
  const m = qHtml.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
  return m ? textOf(m[1]) : '';
}

/** Extract the question body: everything between <h3> and the answer button/div. */
function extractBody(qHtml) {
  // Drop the h3, drop the show-btn, drop the answer div — what's left is the body.
  let s = qHtml.replace(/<h3[^>]*>[\s\S]*?<\/h3>/i, '');
  s = s.replace(/<button[^>]*class="show-btn"[^>]*>[\s\S]*?<\/button>/i, '');
  // Remove the answer div and its content (either markup shape).
  const ansOpen = s.match(ANSWER_OPEN_RE);
  if (ansOpen) {
    const start = ansOpen.index;
    const end   = findMatchingCloseDiv(s, ansOpen.index + ansOpen[0].length);
    s = s.slice(0, start) + s.slice(end);
  }
  // Keep layout: bodies contain ASCII-matrix example blocks.
  return textOfKeepingLayout(s);
}

/** Parse the section id "discrete-maths-midterm" → { subject_code, section_type }. */
function parseSectionId(id) {
  // Match longest known subject prefix.
  const subject = SUBJECTS.find(s => id.startsWith(s.code + '-'));
  if (!subject) return null;
  const tail = id.slice(subject.code.length + 1);
  return { subject_code: subject.code, section_type: tail }; // 'midterm' | 'endterm' | 'notes'
}

// -----------------------------------------------------------------
// Main
// -----------------------------------------------------------------

const html = readFileSync(HTML_PATH, 'utf8');

const output = {
  subjects: SUBJECTS,
  papers: [],
  notes: [],
};

// Find every <div id="..." class="content-section...">
const sectionOpenRe = /<div\s+id="([\w-]+)"\s+class="content-section[^"]*"[^>]*>/gi;
let match;
while ((match = sectionOpenRe.exec(html)) !== null) {
  const id           = match[1];
  const parsed       = parseSectionId(id);
  if (!parsed) continue; // skip 'prepverse' (the homepage panel) and anything unknown

  const openTagEnd   = match.index + match[0].length;
  const sectionEnd   = findMatchingCloseDiv(html, openTagEnd);
  const inner        = html.slice(openTagEnd, sectionEnd - '</div>'.length);

  if (parsed.section_type === 'notes') {
    const body = textOf(inner);
    if (body) {
      output.notes.push({
        subject_code: parsed.subject_code,
        title:        'Notes (from legacy site)',
        body,
      });
    }
    continue;
  }

  // Otherwise it's a paper (mid/end term).
  const term = TERM_MAP[parsed.section_type];
  if (!term) continue;

  const questionBlocks = extractQuestionBlocks(inner);
  if (questionBlocks.length === 0) continue;

  const questions = questionBlocks.map((qHtml, idx) => {
    const rawTitle = extractTitle(qHtml);
    // Title often looks like "Question 3: Boolean Algebra" — split it.
    const qMatch = rawTitle.match(/^Question\s+(\S+?)\s*[:\-—]\s*(.*)$/i);
    const q_number = qMatch ? qMatch[1] : String(idx + 1);
    const title    = qMatch ? qMatch[2].trim() : rawTitle;
    return {
      q_number,
      title,
      body:   extractBody(qHtml),
      answer: extractAnswer(qHtml),
    };
  });

  output.papers.push({
    subject_code: parsed.subject_code,
    term,
    year: LEGACY_YEAR,
    questions,
  });
}

writeFileSync(OUT_PATH, JSON.stringify(output, null, 2), 'utf8');

// Human summary
console.log('✅ Extracted:');
console.log(`   ${output.subjects.length} subjects`);
console.log(`   ${output.papers.length} papers`);
for (const p of output.papers) {
  console.log(`     - ${p.subject_code} ${p.term} ${p.year}: ${p.questions.length} questions`);
}
console.log(`   ${output.notes.length} notes entries`);
console.log(`\nWrote ${OUT_PATH}`);
