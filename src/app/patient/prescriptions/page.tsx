'use client';

import { useTranslation } from '@/i18n';
import { ContentCard } from '@/components/cards/ContentCard';
import { PrescriptionManager } from '@/components/prescriptions/PrescriptionManager';
import Link from 'next/link';

export default function PrescriptionsPage() {
  const { t } = useTranslation();

  return (
    <section>
      <div style={{ display: 'flex', gap: 'var(--mm-space-6)', marginBottom: 'var(--mm-space-6)', borderBottom: '1px solid var(--mm-border-divider)', paddingBottom: 'var(--mm-space-3)' }}>
        <Link href="/patient/medications" style={{ color: 'var(--mm-text-secondary)', textDecoration: 'none', transition: 'color 0.2s' }}>
          Active Medications
        </Link>
        <span style={{ fontWeight: 'var(--mm-font-weight-bold)', color: 'var(--mm-text-primary)' }}>Prescription History</span>
      </div>
      <ContentCard title="Prescriptions & Medication Staging">
        <PrescriptionManager />
      </ContentCard>
    </section>
  );
}
