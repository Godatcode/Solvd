import { createStaticClient } from '@/lib/supabase/server';
import type { NoteRow } from '@/lib/db/types';

/** Approved subject-level notes, newest first. Not tied to a paper. */
export async function listNotesForSubject(subjectId: number): Promise<NoteRow[]> {
  const supabase = createStaticClient();
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('subject_id', subjectId)
    .eq('status', 'approved')
    .order('created_at', { ascending: false });

  if (error) throw new Error(`listNotesForSubject(${subjectId}) failed: ${error.message}`);
  return data ?? [];
}
