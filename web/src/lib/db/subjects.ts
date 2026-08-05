import { createStaticClient } from '@/lib/supabase/server';
import type { SubjectRow } from '@/lib/db/types';

/** Every subject, ordered the way the homepage renders them. */
export async function listSubjects(): Promise<SubjectRow[]> {
  const supabase = createStaticClient();
  const { data, error } = await supabase
    .from('subjects')
    .select('*')
    .order('semester', { ascending: true })
    .order('name', { ascending: true });

  if (error) throw new Error(`listSubjects failed: ${error.message}`);
  return data ?? [];
}

/** One subject by its `code` column (the URL slug). Null when absent. */
export async function getSubjectBySlug(slug: string): Promise<SubjectRow | null> {
  const supabase = createStaticClient();
  const { data, error } = await supabase
    .from('subjects')
    .select('*')
    .eq('code', slug)
    .maybeSingle();

  if (error) throw new Error(`getSubjectBySlug(${slug}) failed: ${error.message}`);
  return data ?? null;
}

/**
 * Group subjects by semester for the homepage. Pure — no DB access.
 * Subjects with a null semester are bucketed under 1 so they stay visible.
 */
export function groupBySemester(subjects: SubjectRow[]): Array<{
  semester: number;
  subjects: SubjectRow[];
}> {
  const buckets = new Map<number, SubjectRow[]>();

  for (const subject of subjects) {
    const semester = subject.semester ?? 1;
    const bucket = buckets.get(semester);
    if (bucket) bucket.push(subject);
    else buckets.set(semester, [subject]);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([semester, grouped]) => ({ semester, subjects: grouped }));
}
