'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from '@/i18n';
import { StatCard } from '@/components/cards/StatCard';
import { ContentCard } from '@/components/cards/ContentCard';
import { EmptyState } from '@/components/feedback/EmptyState';
import { DoseTimeline } from '@/components/medications/DoseTimeline';
import { getAdherenceMetrics, getTodayDoses } from '@/app/actions/dose';
import styles from './page.module.css';

export default function PatientDashboard() {
  const { t } = useTranslation();
  const [scheduledCount, setScheduledCount] = useState(0);
  const [adherenceRate, setAdherenceRate] = useState('—');

  const loadMetrics = async () => {
    const today = await getTodayDoses();
    setScheduledCount(today.length);

    const metrics = await getAdherenceMetrics();
    if (metrics.total > 0) {
      setAdherenceRate(`${metrics.rate}%`);
    } else {
      setAdherenceRate('—');
    }
  };

  useEffect(() => {
    loadMetrics();
  }, []);

  return (
    <section>
      {/* KPI Grid */}
      <div className={styles.grid}>
        <StatCard icon="💊" value={scheduledCount} label={t('scheduled_doses')} />
        <StatCard icon="🥗" value={0} label={t('food_records')} />
        <StatCard icon="⚠️" value={0} label={t('interaction_events')} />
        <StatCard icon="📊" value={adherenceRate} label={t('adherence')} />
      </div>

      {/* Two-column section */}
      <div className={styles.sectionGrid}>
        <div>
          <ContentCard title="Today's Dose Schedule">
            <DoseTimeline onAdherenceUpdate={loadMetrics} />
          </ContentCard>

          <ContentCard title="Recent Food &amp; Interaction Timeline">
            <EmptyState
              icon="🥗"
              message={t('no_food_records')}
            />
          </ContentCard>
        </div>

        <div>
          <ContentCard title="Active Alerts">
            <EmptyState
              icon="🔔"
              message="No active alerts."
            />
          </ContentCard>

          <ContentCard title="AI Assistant">
            <EmptyState
              icon="✦"
              message="AI assistant will be available in a future update."
            />
          </ContentCard>
        </div>
      </div>
    </section>
  );
}
