import type { ReactNode } from 'react';
import './globals.css';

export const metadata = { title: 'WONDERfull', description: 'Build interactive 3D scenes and pages, then publish them.' };

// Bricolage Grotesque and Onest are the interface faces. Righteous is used inside scenes.
const FONTS = 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Onest:wght@400;500;600&family=Righteous&display=swap';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href={FONTS} rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
