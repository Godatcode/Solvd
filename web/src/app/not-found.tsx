import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col items-start px-4 py-20 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
        Page not found
      </h1>
      <p className="mt-3 text-slate-600">
        That subject or paper is not in PrepVerse yet.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
      >
        Browse all subjects
      </Link>
    </main>
  );
}
