/**
 * Row types transcribed by hand from supabase/migrations/0001_init.sql.
 *
 * If you change that SQL file, change this file in the same commit. Column
 * nullability here mirrors the SQL exactly: `not null` columns are required,
 * everything else is `| null`.
 *
 * `term` and `status` are plain `text` in Postgres with no CHECK constraint, so
 * they are typed as `string` rather than a union — pretending the database
 * enforces a union it does not would be a lie that bites at runtime. Use the
 * helpers in @/lib/routes to turn them into labels.
 *
 * EVERYTHING HERE IS A `type`, NEVER AN `interface`. postgrest-js constrains
 * rows to `Record<string, unknown>`, and TypeScript only grants an implicit
 * index signature to type aliases. Declare one of these as an interface and the
 * constraint fails silently: every `.select()` still compiles but comes back
 * typed as `never[]`. This is also why the Supabase type generator emits type
 * aliases.
 */

/** Columns Postgres fills in for us, so they are optional on insert. */
type Generated = 'id' | 'created_at';

/** Row -> Insert: generated columns optional, defaulted columns optional. */
type Insertable<Row, Defaulted extends keyof Row = never> = Omit<
  Row,
  Extract<Generated, keyof Row> | Defaulted
> &
  Partial<Pick<Row, Extract<Generated, keyof Row> | Defaulted>>;

export type ProfileRow = {
  id: string;
  username: string;
  college: string | null;
  batch_year: number | null;
  branch: string | null;
  reputation: number;
  role: string;
  created_at: string;
};

export type SubjectRow = {
  id: number;
  code: string;
  name: string;
  branch: string | null;
  semester: number | null;
  college: string | null;
};

export type PaperRow = {
  id: number;
  subject_id: number;
  term: string;
  year: number;
  pdf_path: string | null;
  uploaded_by: string | null;
  status: string;
  created_at: string;
};

export type QuestionRow = {
  id: number;
  paper_id: number;
  q_number: string;
  title: string | null;
  body: string;
  marks: number | null;
};

export type SolutionRow = {
  id: number;
  question_id: number;
  body: string;
  author_id: string | null;
  upvotes: number;
  downvotes: number;
  is_accepted: boolean;
  status: string;
  created_at: string;
};

export type VoteRow = {
  user_id: string;
  solution_id: number;
  value: number;
  created_at: string;
};

export type NoteRow = {
  id: number;
  subject_id: number;
  title: string;
  body: string;
  author_id: string | null;
  status: string;
  created_at: string;
};

export type ReportRow = {
  id: number;
  target_type: string;
  target_id: number;
  reason: string | null;
  reporter_id: string | null;
  created_at: string;
};

/**
 * The shape @supabase/supabase-js wants so that `.from('papers').select('*')`
 * comes back typed instead of `any`. Hand-written because CLAUDE.md rules out
 * an ORM and we are not running the Supabase type generator yet.
 *
 * `Relationships: []` is required by postgrest-js's GenericTable constraint. It
 * means "no typed foreign-key joins", which is fine — the query functions in
 * this folder deliberately do flat selects and join in JS.
 */
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: Insertable<ProfileRow, 'reputation' | 'role'>;
        Update: Partial<ProfileRow>;
        Relationships: [];
      };
      subjects: {
        Row: SubjectRow;
        Insert: Insertable<SubjectRow>;
        Update: Partial<SubjectRow>;
        Relationships: [];
      };
      papers: {
        Row: PaperRow;
        Insert: Insertable<PaperRow, 'status'>;
        Update: Partial<PaperRow>;
        Relationships: [];
      };
      questions: {
        Row: QuestionRow;
        Insert: Insertable<QuestionRow>;
        Update: Partial<QuestionRow>;
        Relationships: [];
      };
      solutions: {
        Row: SolutionRow;
        Insert: Insertable<SolutionRow, 'upvotes' | 'downvotes' | 'is_accepted' | 'status'>;
        Update: Partial<SolutionRow>;
        Relationships: [];
      };
      votes: {
        Row: VoteRow;
        Insert: Insertable<VoteRow>;
        Update: Partial<VoteRow>;
        Relationships: [];
      };
      notes: {
        Row: NoteRow;
        Insert: Insertable<NoteRow, 'status'>;
        Update: Partial<NoteRow>;
        Relationships: [];
      };
      reports: {
        Row: ReportRow;
        Insert: Insertable<ReportRow>;
        Update: Partial<ReportRow>;
        Relationships: [];
      };
    };
    // `[_ in never]: never` is the empty-map form the Supabase type generator
    // emits. Do NOT use Record<string, never> here: that gives EVERY name a
    // value, so a table name would also resolve as a view of type `never`.
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
