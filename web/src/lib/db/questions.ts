import { createStaticClient } from '@/lib/supabase/server';
import type { QuestionRow } from '@/lib/db/types';
import { compareQuestionNumbers } from '@/lib/routes';

/**
 * All questions on one paper, in exam order.
 *
 * `q_number` is `text` (so it can hold "1a", "2b"), which means ordering it in
 * Postgres gives 1, 10, 2. We sort in JS instead — a paper is tens of rows, not
 * thousands, so this costs nothing.
 */
export async function listQuestionsForPaper(paperId: number): Promise<QuestionRow[]> {
  const supabase = createStaticClient();
  const { data, error } = await supabase.from('questions').select('*').eq('paper_id', paperId);

  if (error) throw new Error(`listQuestionsForPaper(${paperId}) failed: ${error.message}`);

  return (data ?? []).sort((a, b) => compareQuestionNumbers(a.q_number, b.q_number));
}
