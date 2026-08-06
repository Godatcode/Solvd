import { DEFAULT_BRANCH, DEFAULT_COLLEGE } from '@/lib/config';
import type { PaperRow, SubjectRow } from '@/lib/db/types';

/**
 * URL structure, per PLAN.md §2.4:
 *
 *   /[college]/[branch]/sem-[n]/[subject]
 *   /[college]/[branch]/sem-[n]/[subject]/[term]-[year]
 *
 * A note on folder names: the App Router cannot express a partial dynamic
 * segment, so there is no way to name a folder `sem-[n]` or `[term]-[year]`.
 * The route folders are therefore `[sem]` and `[paper]`, and the `sem-1` /
 * `mid-2024` shape is parsed here. The public URLs are exactly as specified —
 * only the folder names differ.
 */

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ---------------------------------------------------------------------------
// Semester: 1 <-> "sem-1"
// ---------------------------------------------------------------------------

export function semToSlug(semester: number): string {
  return `sem-${semester}`;
}

/** Returns null for anything that is not literally "sem-<positive integer>". */
export function slugToSem(slug: string): number | null {
  const match = /^sem-(\d{1,2})$/.exec(slug);
  if (!match) return null;
  const semester = Number(match[1]);
  return semester >= 1 ? semester : null;
}

// ---------------------------------------------------------------------------
// Paper: ("mid", 2024) <-> "mid-2024"
// ---------------------------------------------------------------------------

export function paperToSlug(term: string, year: number): string {
  return `${slugify(term)}-${year}`;
}

/** Returns null for anything that is not "<term>-<4-digit year>". */
export function slugToPaper(slug: string): { term: string; year: number } | null {
  const match = /^([a-z0-9]+)-(\d{4})$/.exec(slug);
  if (!match) return null;
  return { term: match[1], year: Number(match[2]) };
}

// ---------------------------------------------------------------------------
// Subject-derived slugs (with fallbacks for rows seeded before college existed)
// ---------------------------------------------------------------------------

export function collegeSlug(subject: SubjectRow): string {
  return subject.college ? slugify(subject.college) : DEFAULT_COLLEGE;
}

export function branchSlug(subject: SubjectRow): string {
  return subject.branch ? slugify(subject.branch) : DEFAULT_BRANCH;
}

export function semesterOf(subject: SubjectRow): number {
  return subject.semester ?? 1;
}

// ---------------------------------------------------------------------------
// Path builders — the only place that concatenates a Solvd URL
// ---------------------------------------------------------------------------

export function subjectPath(subject: SubjectRow): string {
  return `/${collegeSlug(subject)}/${branchSlug(subject)}/${semToSlug(
    semesterOf(subject),
  )}/${subject.code}`;
}

export function paperPath(subject: SubjectRow, paper: PaperRow): string {
  return `${subjectPath(subject)}/${paperToSlug(paper.term, paper.year)}`;
}

// ---------------------------------------------------------------------------
// Display labels
// ---------------------------------------------------------------------------

const TERM_LABELS: Record<string, string> = {
  mid: 'Mid Term',
  end: 'End Term',
  quiz: 'Quiz',
};

/** "mid" -> "Mid Term". Unknown terms are title-cased rather than dropped. */
export function termLabel(term: string): string {
  return TERM_LABELS[term] ?? term.charAt(0).toUpperCase() + term.slice(1);
}

/** "mid", 2024 -> "Mid Term 2024" — the [Term] [Year] half of the page title. */
export function paperLabel(term: string, year: number): string {
  return `${termLabel(term)} ${year}`;
}

/**
 * Sort "1", "2", "10", "2b" the way a human reads a question paper.
 * A plain text sort in Postgres would give 1, 10, 2.
 */
export function compareQuestionNumbers(a: string, b: string): number {
  const numA = parseInt(a, 10);
  const numB = parseInt(b, 10);
  if (Number.isNaN(numA) || Number.isNaN(numB) || numA === numB) {
    return a.localeCompare(b, 'en', { numeric: true });
  }
  return numA - numB;
}
