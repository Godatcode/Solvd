import type { QuestionRow, SolutionRow } from '@/lib/db/types';

/**
 * One question plus its "Show answer" disclosure.
 *
 * This is a Server Component on purpose. The disclosure is a native
 * <details>/<summary>, so it works with zero client-side JavaScript — no
 * "use client", no hydration cost. That matters because, per PLAN.md, this page
 * gets opened on mobile data 20 minutes before an exam.
 */
export function QuestionCard({
  question,
  solutions,
}: {
  question: QuestionRow;
  solutions: SolutionRow[];
}) {
  const answer = solutions[0];

  return (
    <article className="rounded-xl border border-slate-200 bg-white/80 p-4 shadow-sm sm:p-5">
      <header className="mb-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="rounded-md bg-slate-900 px-2 py-0.5 text-xs font-semibold text-white">
          Q{question.q_number}
        </span>
        {question.title ? (
          <h2 className="text-base font-semibold leading-snug text-slate-900 sm:text-lg">
            {question.title}
          </h2>
        ) : null}
        {question.marks !== null ? (
          <span className="ml-auto text-xs text-slate-500">{question.marks} marks</span>
        ) : null}
      </header>

      {/*
        whitespace-pre-wrap keeps the line breaks in ASCII diagrams and I/O
        examples that the extractor preserved; tabular-nums keeps digit columns
        roughly aligned without forcing prose into a monospace font.
      */}
      <div className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700 tabular-nums sm:text-[15px]">
        {question.body}
      </div>

      {answer ? (
        <details className="group mt-4">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200 [&::-webkit-details-marker]:hidden">
            <span aria-hidden="true" className="text-xs text-slate-400 group-open:hidden">
              ▶
            </span>
            <span aria-hidden="true" className="hidden text-xs text-slate-400 group-open:inline">
              ▼
            </span>
            <span className="group-open:hidden">Show answer</span>
            <span className="hidden group-open:inline">Hide answer</span>
          </summary>

          <AnswerBody body={answer.body} />

          {solutions.length > 1 ? (
            <p className="mt-2 text-xs text-slate-500">
              {solutions.length - 1} more{' '}
              {solutions.length - 1 === 1 ? 'solution' : 'solutions'} available.
            </p>
          ) : null}
        </details>
      ) : (
        <p className="mt-4 text-sm text-slate-400">No answer yet.</p>
      )}
    </article>
  );
}

function AnswerBody({ body }: { body: string }) {
  // Multi-line answers in the legacy site are all source code; single-line ones
  // are prose. Monospace the former so indentation reads correctly.
  const isCode = body.includes('\n');

  return (
    <div
      className={
        isCode
          ? 'mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-[13px] leading-relaxed text-slate-800'
          : 'mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm leading-relaxed text-emerald-900'
      }
    >
      <div className="whitespace-pre-wrap break-words">{body}</div>
    </div>
  );
}
