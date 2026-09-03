'use client';

import { useTranslation } from '@/i18n';
import { ContentCard } from '@/components/cards/ContentCard';
import { PatientConnections } from '@/components/connections/PatientConnections';

export default function SettingsPage() {
  const { t } = useTranslation();

  return (
    <section>
      <div style={{ marginBottom: 'var(--mm-space-6)', borderBottom: '1px solid var(--mm-border-divider)', paddingBottom: 'var(--mm-space-3)' }}>
        <h1 style={{ fontWeight: 'var(--mm-font-weight-bold)', color: 'var(--mm-text-primary)', fontSize: 'var(--mm-font-size-2xl)', margin: 0 }}>
          Settings & Connections
        </h1>
      </div>
      <ContentCard title="Professional Connections">
        <p style={{ color: 'var(--mm-text-secondary)', fontSize: 'var(--mm-font-size-sm)', marginBottom: 'var(--mm-space-4)' }}>
          Manage access to your MediMind profile for healthcare professionals. Generate a secure code to share with your provider.
        </p>
        <PatientConnections />
      </ContentCard>
    </section>
  );
}
