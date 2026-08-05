import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Breadcrumbs } from '@/components/breadcrumbs';
import { COLLEGE_NAME } from '@/lib/config';
import { groupByYear, listPapersForSubject } from '@/lib/db/papers';
import { listNotesForSubject } from '@/lib/db/notes';
import { getSubjectBySlug, listSubjects } from '@/lib/db/subjects';
import type { SubjectRow } from '@/lib/db/types';
import {
  branchSlug,
  collegeSlug,
  paperLabel,
  paperPath,
  semToSlug,
  semesterOf,
  subjectPath,
} from '@/lib/routes';

export const revalidate = 300;

type SubjectParams = {
  college: string;
  branch: string;
  sem: string;
  subject: string;
};

export async function generateStaticParams(): Promise<SubjectParams[]> {
  const subjects = await listSubjects();
  return subjects.map((subject) => ({
    college: collegeSlug(subject),
    branch: branchSlug(subject),
    sem: semToSlug(semesterOf(subject)),
    subject: subject.code,
  }));
}

/**
 * Loads the subject and confirms the college/branch/semester in the URL are the
 * ones this subject actually belongs to. Without that check, every subject would
 * be reachable at unlimited made-up URLs — duplicate content, which is exactly
 * what the SEO plan in PLAN.md §2.4 is trying to avoid.
 */
async function loadSubject(params: SubjectParams): Promise<SubjectRow> {
  const subject = await getSubjectBySlug(params.subject);

  if (
    !subject ||
    collegeSlug(subject) !== params.college ||
    branchSlug(subject) !== params.branch ||
    semToSlug(semesterOf(subject)) !== params.sem
  ) {
    notFound();
  }

  return subject;
}

export async function generateMetadata({
  params,
}: {
  params: SubjectParams;
}): Promise<Metadata> {
  const subject = await loadSubject(params);
  const papers = await listPapersForSubject(subject.id);

  const years = [...new Set(papers.map((paper) => paper.year))].sort((a, b) => b - a);
  const yearRange =
    years.length > 1 ? `${years[years.length - 1]}–${years[0]}` : years[0]?.toString() ?? '';

  return {
    title: `${subject.name} PYQs — Semester ${semesterOf(subject)} ${
      subject.branch ?? ''
    }`.trim(),
    description:
      `${subject.name} previous-year question papers${yearRange ? ` (${yearRange})` : ''} ` +
      `with answers and notes for ${COLLEGE_NAME}. ` +
      `${papers.length} ${papers.length === 1 ? 'paper' : 'papers'} available, free to read.`,
    alternates: { canonical: subjectPath(subject) },
  };
}

export default async function SubjectPage({ params }: { params: SubjectParams }) {
  const subject = await loadSubject(params);
  const [papers, notes] = await Promise.all([
    listPapersForSubject(subject.id),
    listNotesForSubject(subject.id),
  ]);
  const years = groupByYear(papers);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <Breadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: `Semester ${semesterOf(subject)}` },
          { label: subject.name },
        ]}
      />

      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          {subject.name}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          {subject.branch ?? 'All branches'} · Semester {semesterOf(subject)} · {COLLEGE_NAME}
        </p>
      </header>

      <section className="mb-10">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Question papers
        </h2>

        {years.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white/60 p-4 text-sm text-slate-500">
            No papers for {subject.name} yet.
          </p>
        ) : (
          <div className="space-y-6">
            {years.map(({ year, papers: yearPapers }) => (
              <div key={year}>
                <h3 className="mb-2 text-sm font-semibold text-slate-700">{year}</h3>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {yearPapers.map((paper) => (
                    <li key={paper.id}>
                      <Link
                        href={paperPath(subject, paper)}
                        className="flex items-center justify-between rounded-xl border border-slate-200 bg-white/80 px-4 py-3 shadow-sm transition-colors hover:border-slate-300 hover:bg-white"
                      >
                        <span className="font-medium text-slate-900">
                          {paperLabel(paper.term, paper.year)}
                        </span>
                        <span aria-hidden="true" className="text-slate-400">
                          →
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      {notes.length > 0 ? (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Notes
          </h2>
          <ul className="space-y-3">
            {notes.map((note) => (
              <li
                key={note.id}
                className="rounded-xl border border-slate-200 bg-white/80 p-4 shadow-sm"
              >
                <h3 className="font-medium text-slate-900">{note.title}</h3>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-600">
                  {note.body}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
