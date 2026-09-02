'use client';

import { useState } from 'react';
import { useTranslation } from '@/i18n';
import { ContentCard } from '@/components/cards/ContentCard';
import { Button } from '@/components/forms/Button';
import { PatientMedicationList } from '@/components/medications/PatientMedicationList';
import { AddMedicationModal } from '@/components/medications/AddMedicationModal';
import { DoseTimeline } from '@/components/medications/DoseTimeline';

export default function MedicationsPage() {
  const { t } = useTranslation();
  const [modalOpen, setModalOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleSuccess = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <section>
      <ContentCard
        title="Medication Management"
        action={
          <Button variant="primary" type="button" onClick={() => setModalOpen(true)} style={{ width: 'auto' }}>
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
