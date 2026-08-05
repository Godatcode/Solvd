import { createBrowserClient } from '@supabase/ssr';

import type { Database } from '@/lib/db/types';

/**
 * Supabase client for Client Components.
 *
 * Unused in Phase 0 — the site is read-only and every page renders on the
 * server. It exists so Phase 1 (Google login, uploads) has the browser half of
 * the @supabase/ssr pair ready. Do not reach for this to fetch page data;
 * CLAUDE.md forbids useEffect data fetching.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
        'Copy .env.example to web/.env.local and fill in your Supabase keys.',
    );
  }

  return createBrowserClient<Database>(url, anonKey);
}
