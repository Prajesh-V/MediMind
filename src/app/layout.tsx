import type { Metadata } from 'next';
import { Providers } from './providers';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'MediMind | AI-Assisted Personalized Medication & Healthcare Companion',
  description:
    'A personalized medication companion connecting prescriptions, medication schedules, food intake, drug-food interactions, adherence and professional monitoring.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
