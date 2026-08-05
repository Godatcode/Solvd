import { createStaticClient } from '@/lib/supabase/server';
import type { SolutionRow } from '@/lib/db/types';

/**
 * Approved solutions for a set of questions, best first.
 *
 * One `.in()` query for the whole page rather than one per question — a paper
 * page renders up to ~10 questions and an N+1 here would be ~10 round trips on
 * a 3G connection's worth of build time.
 *
 * Ordering matches the Phase 2 intent in PLAN.md §2.5 ("top-voted solution
 * first"): accepted answers, then score, then oldest. In Phase 0 every question
 * has exactly one seeded solution, so this only matters later.
 */
export async function listSolutionsForQuestions(
  questionIds: number[],
): Promise<SolutionRow[]> {
  if (questionIds.length === 0) return [];

  const supabase = createStaticClient();
  const { data, error } = await supabase
    .from('solutions')
    .select('*')
    .in('question_id', questionIds)
    .eq('status', 'approved')
    .order('is_accepted', { ascending: false })
    .order('upvotes', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) throw new Error(`listSolutionsForQuestions failed: ${error.message}`);
  return data ?? [];
}

/** Bucket solutions by question_id, preserving the order above. Pure. */
export function groupByQuestion(solutions: SolutionRow[]): Map<number, SolutionRow[]> {
  const byQuestion = new Map<number, SolutionRow[]>();

  for (const solution of solutions) {
    const bucket = byQuestion.get(solution.question_id);
    if (bucket) bucket.push(solution);
    else byQuestion.set(solution.question_id, [solution]);
  }

  return byQuestion;
}
