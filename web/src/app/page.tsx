import type { Metadata } from 'next';
import Link from 'next/link';

import { COLLEGE_NAME, SITE_DESCRIPTION, SITE_NAME } from '@/lib/config';
import { groupBySemester, listSubjects } from '@/lib/db/subjects';
import { subjectPath } from '@/lib/routes';

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: {
      absolute: `${SITE_NAME} — Previous Year Question Papers for ${COLLEGE_NAME}`,
    },
    description: SITE_DESCRIPTION,
    alternates: { canonical: '/' },
  };
}

export default async function HomePage() {
  const subjects = await listSubjects();
  const semesters = groupBySemester(subjects);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          {SITE_NAME}
        </h1>
        <p className="mt-3 text-base leading-relaxed text-slate-600 sm:text-lg">
          Previous-year question papers, answers and notes for {COLLEGE_NAME}. Pick your
          subject.
        </p>
      </header>

      {semesters.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-10">
          {semesters.map(({ semester, subjects: semesterSubjects }) => (
            <section key={semester}>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Semester {semester}
              </h2>
              <ul className="grid gap-3 sm:grid-cols-2">
                {semesterSubjects.map((subject) => (
                  <li key={subject.id}>
                    <Link
                      href={subjectPath(subject)}
                      className="block rounded-xl border border-slate-200 bg-white/80 p-4 shadow-sm transition-colors hover:border-slate-300 hover:bg-white"
                    >
                      <span className="block font-semibold text-slate-900">{subject.name}</span>
                      <span className="mt-0.5 block text-sm text-slate-500">
                        {subject.branch ?? 'All branches'} · Semester {subject.semester ?? semester}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 p-6 text-center">
      <p className="font-medium text-slate-700">No subjects yet.</p>
      <p className="mt-1 text-sm text-slate-500">
        Run the seed script from the repo root:{' '}
        <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">
          npm run seed --prefix scripts
        </code>
      </p>
    </div>
  );
}
