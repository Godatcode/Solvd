import { createStaticClient } from '@/lib/supabase/server';
import type { PaperRow } from '@/lib/db/types';

/**
 * Approved papers for one subject, newest year first.
 *
 * The `status = 'approved'` filter is belt-and-braces: the "public read papers"
 * RLS policy already enforces it for the anon key. Being explicit means the
 * query still behaves if someone later relaxes that policy.
 */
export async function listPapersForSubject(subjectId: number): Promise<PaperRow[]> {
  const supabase = createStaticClient();
  const { data, error } = await supabase
    .from('papers')
    .select('*')
    .eq('subject_id', subjectId)
    .eq('status', 'approved')
    .order('year', { ascending: false })
    .order('term', { ascending: true });

  if (error) throw new Error(`listPapersForSubject(${subjectId}) failed: ${error.message}`);
  return data ?? [];
}

/** One paper, identified the way the URL identifies it. Null when absent. */
export async function getPaper(
  subjectId: number,
  term: string,
  year: number,
): Promise<PaperRow | null> {
  const supabase = createStaticClient();
  const { data, error } = await supabase
    .from('papers')
    .select('*')
    .eq('subject_id', subjectId)
    .eq('term', term)
    .eq('year', year)
    .eq('status', 'approved')
    .maybeSingle();

  if (error) {
    throw new Error(`getPaper(${subjectId}, ${term}, ${year}) failed: ${error.message}`);
  }
  return data ?? null;
}

/**
 * Every approved paper across every subject — used by generateStaticParams on
 * the paper route. Deliberately a flat list rather than a join: pairing it with
 * listSubjects() in JS keeps the hand-written types in db/types.ts simple, and
 * at build time this is two queries, not N+1.
 */
export async function listAllPapers(): Promise<PaperRow[]> {
  const supabase = createStaticClient();
  const { data, error } = await supabase
    .from('papers')
    .select('*')
    .eq('status', 'approved')
    .order('year', { ascending: false });

  if (error) throw new Error(`listAllPapers failed: ${error.message}`);
  return data ?? [];
}

/** Group a subject's papers by year, newest first. Pure — no DB access. */
export function groupByYear(papers: PaperRow[]): Array<{ year: number; papers: PaperRow[] }> {
  const buckets = new Map<number, PaperRow[]>();

  for (const paper of papers) {
    const bucket = buckets.get(paper.year);
    if (bucket) bucket.push(paper);
    else buckets.set(paper.year, [paper]);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => b - a)
    .map(([year, grouped]) => ({ year, papers: grouped }));
}
