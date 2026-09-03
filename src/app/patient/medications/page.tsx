'use client';

import { useState } from 'react';
import { useTranslation } from '@/i18n';
import { ContentCard } from '@/components/cards/ContentCard';
import { Button } from '@/components/forms/Button';
import { PatientMedicationList } from '@/components/medications/PatientMedicationList';
import { AddMedicationModal } from '@/components/medications/AddMedicationModal';
import { DoseTimeline } from '@/components/medications/DoseTimeline';
import Link from 'next/link';

export default function MedicationsPage() {
  const { t } = useTranslation();
  const [modalOpen, setModalOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleSuccess = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <section>
      <div style={{ display: 'flex', gap: 'var(--mm-space-6)', marginBottom: 'var(--mm-space-6)', borderBottom: '1px solid var(--mm-border-divider)', paddingBottom: 'var(--mm-space-3)', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontWeight: 'var(--mm-font-weight-bold)', color: 'var(--mm-text-primary)', marginRight: 'var(--mm-space-4)' }}>Active Medications</span>
        </div>
        <Link href="/patient/prescriptions" passHref>
          <Button variant="secondary" type="button" style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--mm-space-2)' }}>
            Upload Prescription
          </Button>
        </Link>
      </div>
      <ContentCard
        title="Medication Management"
        action={
          <Button variant="primary" type="button" onClick={() => setModalOpen(true)}>
            + {t('add_medication')}
          </Button>
        }
      >
        <PatientMedicationList refreshTrigger={refreshTrigger} />
      </ContentCard>

      <ContentCard title="Today's Dose Schedule">
        <DoseTimeline onAdherenceUpdate={() => setRefreshTrigger((prev) => prev + 1)} />
      </ContentCard>

      <AddMedicationModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={handleSuccess}
      />
    </section>
  );
}
