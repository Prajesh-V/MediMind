'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from '@/i18n';
import { StatCard } from '@/components/cards/StatCard';
import { ContentCard } from '@/components/cards/ContentCard';
import { EmptyState } from '@/components/feedback/EmptyState';
import { DoseTimeline } from '@/components/medications/DoseTimeline';
import { getAdherenceMetrics, getTodayDoses } from '@/app/actions/dose';
import { getPatientDietaryRecords } from '@/app/actions/intake';
import { getPatientAssessments } from '@/app/actions/interactions';
import { triggerAlertReconciliation, getPatientAlerts, PatientAlert, markAlertRead } from '@/app/actions/alerts';
import styles from './page.module.css';

export default function PatientDashboard() {
  const { t } = useTranslation();
  const [scheduledCount, setScheduledCount] = useState(0);
  const [foodCount, setFoodCount] = useState(0);
  const [interactionCount, setInteractionCount] = useState(0);
  const [adherenceRate, setAdherenceRate] = useState('—');
  const [alerts, setAlerts] = useState<PatientAlert[]>([]);

  const loadMetrics = async () => {
    const today = await getTodayDoses();
    setScheduledCount(today.length);

    const diet = await getPatientDietaryRecords();
    setFoodCount(diet.length);

    const assessments = await getPatientAssessments();
    setInteractionCount(assessments.length);

    const metrics = await getAdherenceMetrics();
    if (metrics.total > 0) {
      setAdherenceRate(`${metrics.rate}%`);
    } else {
      setAdherenceRate('—');
    }

    // Explicit background reconciliation
    await triggerAlertReconciliation();
    const fetchedAlerts = await getPatientAlerts();
    setAlerts(fetchedAlerts);
  };

  useEffect(() => {
    loadMetrics();
  }, []);

  return (
    <section>
      {/* KPI Grid */}
      <div className={styles.grid}>
        <StatCard icon="💊" value={scheduledCount} label={t('scheduled_doses')} />
        <StatCard icon="🥗" value={foodCount} label={t('food_records')} />
        <StatCard icon="⚠️" value={interactionCount} label={t('active_safety_warnings')} />
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
            {alerts.length === 0 ? (
              <EmptyState icon="🔔" message="No active alerts." />
            ) : (
              <ul className={styles.alertList}>
                {alerts.map(a => (
                  <li key={a.id} className={`${styles.alertItem} ${styles[a.priority.toLowerCase()]}`}>
                    <div className={styles.alertHeader}>
                      <span className={styles.alertPriority}>{a.priority}</span>
                      <span className={styles.alertTime}>{new Date(a.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className={styles.alertBody}>
                      <strong>{a.snapshot?.title}</strong>
                      <p>{a.snapshot?.summary}</p>
                    </div>
                    {!a.read_at && (
                      <button onClick={async () => {
                        await markAlertRead(a.id);
                        loadMetrics();
                      }}>Mark Read</button>
                    )}
                  </li>
                ))}
              </ul>
            )}
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
