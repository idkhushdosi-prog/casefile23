import type { Metadata, Viewport } from 'next';
import {
  Caveat,
  Courier_Prime,
  Inter,
  Noto_Sans_Devanagari,
  Permanent_Marker,
  Special_Elite,
} from 'next/font/google';
import './globals.css';
import { ClientShell } from '@/components/ClientShell';

const specialElite = Special_Elite({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-special-elite',
  display: 'swap',
});

const courierPrime = Courier_Prime({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-courier',
  display: 'swap',
});

const permanentMarker = Permanent_Marker({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-permanent-marker',
  display: 'swap',
});

const caveat = Caveat({
  weight: ['500', '700'],
  subsets: ['latin'],
  variable: '--font-caveat',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const notoDevanagari = Noto_Sans_Devanagari({
  weight: ['400', '500', '700'],
  subsets: ['devanagari'],
  variable: '--font-devanagari',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'CASE FILE: CLASS OF 23 — Farewell Keepsake Investigation',
  description:
    '23 witnesses. 22 case files. Nobody writes about themselves. The official Batch 23 farewell keepsake evidence collector.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#E8D5A8',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="light"
      className={`${specialElite.variable} ${courierPrime.variable} ${permanentMarker.variable} ${caveat.variable} ${inter.variable} ${notoDevanagari.variable}`}
    >
      <body className="desk-surface min-h-screen antialiased selection:bg-[var(--highlighter)] selection:text-[#1B1B1B]">
        <ClientShell>{children}</ClientShell>
      </body>
    </html>
  );
}
