import type { Metadata } from 'next';
import { Playfair_Display, IBM_Plex_Mono, Source_Serif_4 } from 'next/font/google';
import './globals.css';

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['400', '500', '600', '700'],
});

const plex = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500'],
});

const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['300', '400', '600'],
});

export const metadata: Metadata = {
  title: 'ChessLens — Analyze Your Games',
  description: 'Upload PGNs, analyze every move, track your improvement over time. Free, forever.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${playfair.variable} ${plex.variable} ${sourceSerif.variable}`}>
      <body className="bg-background text-text-primary antialiased">
        {children}
      </body>
    </html>
  );
}
