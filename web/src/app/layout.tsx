import type { Metadata } from 'next';

import { COLLEGE_NAME, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/config';

import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  // Pages set just their own half of the title; this appends " | PrepVerse".
  title: {
    default: `${SITE_NAME} — Previous Year Question Papers for ${COLLEGE_NAME}`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: {
    siteName: SITE_NAME,
    type: 'website',
    locale: 'en_IN',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      {/*
        The gradient replaces the 10 MB autoplaying video from legacy/index.html,
        per PLAN.md §2.7. It costs zero bytes over the wire.
      */}
      <body className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-sky-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
