import type { ReactNode } from 'react';
// Typefaces ship with the app, so nothing loads from another site.
// Anybody: the wordmark and big headlines. Onest: the interface. Righteous: text inside scenes.
import '@fontsource-variable/anybody/wdth.css';
import '@fontsource-variable/onest';
import '@fontsource/righteous';
import './globals.css';

export const metadata = { title: 'WONDERfull', description: 'Build interactive 3D scenes and pages, then publish them.' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
