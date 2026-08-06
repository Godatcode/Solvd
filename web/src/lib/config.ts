/**
 * Site-wide constants.
 *
 * The college and branch appear in every URL (see PLAN.md §2.4), so they live
 * in one place. Changing DEFAULT_COLLEGE here + re-running the seed script is
 * all it takes to re-scope the whole site.
 */

export const SITE_NAME = 'Solvd';

/** Slug used in URLs: /sst/cse/sem-1/discrete-maths */
export const DEFAULT_COLLEGE = 'sst';

/** Human-readable name, used in titles and headings. */
export const COLLEGE_NAME = 'Scaler School of Technology';

/** Fallback branch slug for rows where subjects.branch is null. */
export const DEFAULT_BRANCH = 'cse';

/**
 * Absolute site origin, used for canonical URLs and JSON-LD @id values.
 * Set NEXT_PUBLIC_SITE_URL in production (Vercel) — locally the default is fine.
 *
 * `||`, NOT `??`. A declared-but-blank `NEXT_PUBLIC_SITE_URL=` in .env.local is
 * an empty string, which is not nullish, so `??` would let "" through and
 * `new URL("")` in the root layout's metadataBase throws at build time. Blank
 * must mean "use the default", the same as absent.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'http://localhost:3000'
).replace(/\/+$/, '');

export const SITE_DESCRIPTION =
  `Previous-year question papers, solutions and notes for ${COLLEGE_NAME}, ` +
  'organised by semester and subject. Free, fast, and built by students.';
