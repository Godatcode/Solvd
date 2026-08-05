import Link from 'next/link';

export type Crumb = {
  label: string;
  /** Omit on the last crumb — the current page is not a link. */
  href?: string;
};

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4 text-sm text-slate-500">
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`} className="flex items-center gap-x-1.5">
            {index > 0 ? (
              <span aria-hidden="true" className="text-slate-300">
                /
              </span>
            ) : null}
            {item.href ? (
              <Link href={item.href} className="hover:text-slate-900 hover:underline">
                {item.label}
              </Link>
            ) : (
              <span className="font-medium text-slate-700">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
