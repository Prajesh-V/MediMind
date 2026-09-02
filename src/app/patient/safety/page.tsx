'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '@/i18n';
import { ContentCard } from '@/components/cards/ContentCard';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Button } from '@/components/forms/Button';
import { InteractionList } from '@/components/interactions/InteractionList';
import { getPatientAssessments } from '@/app/actions/interactions';
import type { InteractionAssessment } from '@/services/medical/types';

export default function SafetyPage() {
  const { t } = useTranslation();
  const [assessments, setAssessments] = useState<InteractionAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAssessments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getPatientAssessments();
      setAssessments(data);
    } catch (err: any) {
      console.error('Error fetching interaction assessments:', err);
      setError(err.message || 'Failed to load safety assessments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAssessments();
  }, [fetchAssessments]);

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Deterministic Medical Interaction Alerts */}
      <ContentCard
        title="🛡️ Medication & Food Interaction Alerts"
        action={
          <Button
            variant="secondary"
            type="button"
            onClick={fetchAssessments}
            disabled={loading}
            style={{ fontSize: '13px', padding: '6px 12px' }}
          >
            {loading ? 'Evaluating...' : '↻ Re-evaluate'}
          </Button>
        }
      >
        {error ? (
          <div style={{ color: 'var(--mm-error)', padding: '10px' }}>
            ⚠️ {error}
          </div>
        ) : loading ? (
          <p style={{ color: 'var(--mm-text-secondary)', fontSize: '14px' }}>
            Evaluating active medications and confirmed dietary intake against clinical knowledge rules...
          </p>
        ) : (
          <InteractionList assessments={assessments} />
        )}
      </ContentCard>

      {/* Symptoms & Safety Reports Section */}
      <ContentCard
        title="Symptoms &amp; Safety Reports"
        action={<Button variant="secondary" type="button">{t('report_symptom')}</Button>}
      >
        <EmptyState icon="⚕" message={t('no_safety_reports')} />
      </ContentCard>
    </section>
  );
}
