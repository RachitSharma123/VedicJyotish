import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'VedicJyotish',
  description: 'Vedic astrology chart insights',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
