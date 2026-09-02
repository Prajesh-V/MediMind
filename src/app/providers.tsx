'use client';

import { ThemeProvider } from '@/theme/ThemeContext';
import { TranslationProvider } from '@/i18n';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <TranslationProvider>
        {children}
      </TranslationProvider>
    </ThemeProvider>
  );
}
