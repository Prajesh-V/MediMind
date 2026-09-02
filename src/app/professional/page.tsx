'use client';

import { useState } from 'react';
import { useTranslation } from '@/i18n';
import { StatCard } from '@/components/cards/StatCard';
import { ContentCard } from '@/components/cards/ContentCard';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ProfessionalRedemption } from '@/components/connections/ProfessionalRedemption';
import { ProfessionalPatientList } from '@/components/connections/ProfessionalPatientList';
import styles from './page.module.css';

export default function ProfessionalDashboard() {
  const { t } = useTranslation();
  const [patientCount, setPatientCount] = useState(0);

  return (
    <section>
      {/* KPI Grid */}
      <div className={styles.grid}>
        <StatCard icon="👥" value={patientCount} label="Monitored Patients" />
        <StatCard icon="⚠️" value={0} label="Critical Alerts" />
        <StatCard icon="📋" value={0} label="Pending Reviews" />
        <StatCard icon="📊" value="—" label="Avg Adherence" />
      </div>

      {/* Code Redemption */}
      <ContentCard title="Add Patient Connection">
        <ProfessionalRedemption />
      </ContentCard>

      {/* Two-column section */}
      <div className={styles.sectionGrid}>
        <div>
          <ContentCard title="Patient List">
            <ProfessionalPatientList onCountChange={setPatientCount} />
          </ContentCard>
        </div>

        <div>
          <ContentCard title="Recent Alerts">
            <EmptyState
              icon="🔔"
              message="No recent alerts."
            />
          </ContentCard>
        </div>
      </div>
    </section>
  );
}
