import './globals.css';
import type { Metadata } from 'next';
import { Cinzel, Inter } from 'next/font/google';

const cinzel = Cinzel({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-cinzel',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'VedicJyotish · Prashna Oracle',
  description: 'Ancient Vedic astrology — AI-powered Prashna Kundali chart readings',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${cinzel.variable} ${inter.variable}`}>{children}</body>
    </html>
  );
}
