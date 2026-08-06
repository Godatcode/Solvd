import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { Breadcrumbs } from '@/components/breadcrumbs';
import { QuestionCard } from '@/components/question-card';
import { COLLEGE_NAME, SITE_URL } from '@/lib/config';
import { getPaper, listAllPapers } from '@/lib/db/papers';
import { listQuestionsForPaper } from '@/lib/db/questions';
import { groupByQuestion, listSolutionsForQuestions } from '@/lib/db/solutions';
import { getSubjectBySlug, listSubjects } from '@/lib/db/subjects';
import type { PaperRow, QuestionRow, SolutionRow, SubjectRow } from '@/lib/db/types';
import {
  branchSlug,
  collegeSlug,
  paperLabel,
  paperPath,
  paperToSlug,
  semToSlug,
  semesterOf,
  slugToPaper,
  subjectPath,
} from '@/lib/routes';

export const revalidate = 300;

type PaperParams = {
  college: string;
  branch: string;
  sem: string;
  subject: string;
  paper: string;
};

export async function generateStaticParams(): Promise<PaperParams[]> {
  // Two flat queries joined in JS rather than a Supabase relational select —
  // keeps the hand-written types in lib/db/types.ts simple.
  const [subjects, papers] = await Promise.all([listSubjects(), listAllPapers()]);
  const subjectsById = new Map(subjects.map((subject) => [subject.id, subject]));

  return papers.flatMap((paper) => {
    const subject = subjectsById.get(paper.subject_id);
    if (!subject) return [];

    return [
      {
        college: collegeSlug(subject),
        branch: branchSlug(subject),
        sem: semToSlug(semesterOf(subject)),
        subject: subject.code,
        paper: paperToSlug(paper.term, paper.year),
      },
    ];
  });
}

/** Resolves the URL to a real subject + paper, or 404s. See the subject page for why. */
async function loadPaper(params: PaperParams): Promise<{ subject: SubjectRow; paper: PaperRow }> {
  const parsed = slugToPaper(params.paper);
  if (!parsed) notFound();

  const subject = await getSubjectBySlug(params.subject);
  if (
    !subject ||
    collegeSlug(subject) !== params.college ||
    branchSlug(subject) !== params.branch ||
    semToSlug(semesterOf(subject)) !== params.sem
  ) {
    notFound();
  }

  const paper = await getPaper(subject.id, parsed.term, parsed.year);
  if (!paper) notFound();

  return { subject, paper };
}

export async function generateMetadata({ params }: { params: PaperParams }): Promise<Metadata> {
  const { subject, paper } = await loadPaper(params);
  const questions = await listQuestionsForPaper(paper.id);
  const label = paperLabel(paper.term, paper.year);

  return {
    // Title format is fixed by PHASE_0_PROMPT.md item 6; the root layout's
    // template appends " | Solvd".
    title: `${subject.name} — ${label} PYQs`,
    description:
      `All ${questions.length} questions from the ${subject.name} ${label} paper at ` +
      `${COLLEGE_NAME}, with answers. Semester ${semesterOf(subject)} ` +
      `${subject.branch ?? ''} previous-year question paper.`.replace(/\s+/g, ' '),
    alternates: { canonical: paperPath(subject, paper) },
  };
}

export default async function PaperPage({ params }: { params: PaperParams }) {
  const { subject, paper } = await loadPaper(params);

  const questions = await listQuestionsForPaper(paper.id);
  const solutions = await listSolutionsForQuestions(questions.map((question) => question.id));
  const solutionsByQuestion = groupByQuestion(solutions);

  const label = paperLabel(paper.term, paper.year);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <Breadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: subject.name, href: subjectPath(subject) },
          { label },
        ]}
      />

      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          {subject.name} — {label}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          {questions.length} {questions.length === 1 ? 'question' : 'questions'} · Semester{' '}
          {semesterOf(subject)} · {COLLEGE_NAME}
        </p>
      </header>

      {questions.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white/60 p-4 text-sm text-slate-500">
          No questions have been added to this paper yet.
        </p>
      ) : (
        <div className="space-y-4">
          {questions.map((question) => (
            <QuestionCard
              key={question.id}
              question={question}
              solutions={solutionsByQuestion.get(question.id) ?? []}
            />
          ))}
        </div>
      )}

      <QuestionsJsonLd
        subject={subject}
        paper={paper}
        questions={questions}
        solutionsByQuestion={solutionsByQuestion}
      />
    </main>
  );
}

/**
 * Question schema for Google, per CLAUDE.md's SEO rules. An ItemList wrapper
 * lets one page describe every question on the paper.
 */
function QuestionsJsonLd({
  subject,
  paper,
  questions,
  solutionsByQuestion,
}: {
  subject: SubjectRow;
  paper: PaperRow;
  questions: QuestionRow[];
  solutionsByQuestion: Map<number, SolutionRow[]>;
}) {
  const pageUrl = `${SITE_URL}${paperPath(subject, paper)}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${subject.name} — ${paperLabel(paper.term, paper.year)} question paper`,
    url: pageUrl,
    numberOfItems: questions.length,
    itemListElement: questions.map((question, index) => {
      const answer = solutionsByQuestion.get(question.id)?.[0];

      return {
        '@type': 'ListItem',
        position: index + 1,
        item: {
          '@type': 'Question',
          '@id': `${pageUrl}#q${question.q_number}`,
          name: question.title ?? `Question ${question.q_number}`,
          text: question.body,
          ...(answer
            ? {
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: answer.body,
                  upvoteCount: answer.upvotes,
                },
              }
            : {}),
        },
      };
    }),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
