import type { ReactNode } from 'react';
import './globals.css';

export const metadata = { title: 'Scene Studio', description: 'Build interactive 3D scenes and pages.' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600&family=Righteous&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
