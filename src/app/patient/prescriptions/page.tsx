'use client';

import { useTranslation } from '@/i18n';
import { ContentCard } from '@/components/cards/ContentCard';
import { PrescriptionManager } from '@/components/prescriptions/PrescriptionManager';

export default function PrescriptionsPage() {
  const { t } = useTranslation();

  return (
    <section>
      <ContentCard title="Prescriptions & Medication Staging">
        <PrescriptionManager />
      </ContentCard>
    </section>
  );
}
