import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

import type { Database } from '@/lib/db/types';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. ` +
        'Copy .env.example to web/.env.local and fill in your Supabase keys.',
    );
  }
  return value;
}

const SUPABASE_URL = () => requireEnv('NEXT_PUBLIC_SUPABASE_URL');
const SUPABASE_ANON_KEY = () => requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');

/**
 * Read-only client for public content. USE THIS IN PHASE 0.
 *
 * It deliberately does NOT touch cookies. Reading cookies() opts a route into
 * dynamic rendering, which would silently disable generateStaticParams and the
 * `revalidate = 300` ISR window that the whole mobile performance story in
 * PLAN.md §2.7 depends on. Everything Phase 0 renders is public data guarded by
 * the "public read" RLS policies in supabase/migrations/0001_init.sql, so there
 * is no session to read anyway.
 */
export function createStaticClient() {
  return createSupabaseClient<Database>(SUPABASE_URL(), SUPABASE_ANON_KEY(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Cookie-aware server client, for when there IS a logged-in user (Phase 1+).
 *
 * Any page or route handler using this becomes dynamically rendered. Nothing in
 * Phase 0 calls it yet — it is here so the auth work in Phase 1 has a correct
 * starting point.
 */
export function createServerSupabaseClient() {
  const cookieStore = cookies();

  return createServerClient<Database>(SUPABASE_URL(), SUPABASE_ANON_KEY(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // Middleware refreshes the session instead, so this is safe to ignore.
        }
      },
    },
  });
}
