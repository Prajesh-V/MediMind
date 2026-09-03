'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '@/i18n';
import { ContentCard } from '@/components/cards/ContentCard';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Button } from '@/components/forms/Button';
import { InteractionList } from '@/components/interactions/InteractionList';
import { getPatientAssessments } from '@/app/actions/interactions';
import type { InteractionAssessment } from '@/services/medical/types';
import { getPatientSymptomReports, SymptomReport } from '@/app/actions/symptoms';
import { getPatientActiveMedications } from '@/app/actions/medication';
import { SymptomReportForm } from '@/components/forms/SymptomReportForm';

export default function SafetyPage() {
  const { t, locale } = useTranslation();
  const [assessments, setAssessments] = useState<InteractionAssessment[]>([]);
  const [symptomReports, setSymptomReports] = useState<SymptomReport[]>([]);
  const [activeMedications, setActiveMedications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSymptomForm, setShowSymptomForm] = useState(false);

  const fetchAssessments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, reports, meds] = await Promise.all([
        getPatientAssessments(),
        getPatientSymptomReports(),
        getPatientActiveMedications()
      ]);
      setAssessments(data);
      setSymptomReports(reports);
      setActiveMedications(meds);
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
        title={t('safety_interactions_title')}
        action={
          <Button
            variant="secondary"
            type="button"
            onClick={fetchAssessments}
            disabled={loading}
            style={{ fontSize: '13px', padding: '6px 12px' }}
          >
            {loading ? t('safety_evaluating') : t('safety_reevaluate')}
          </Button>
        }
      >
        {error ? (
          <div style={{ color: 'var(--mm-error)', padding: '10px' }}>
            ⚠️ {error}
          </div>
        ) : loading ? (
          <p style={{ color: 'var(--mm-text-secondary)', fontSize: '14px' }}>
            {t('safety_evaluating_desc')}
          </p>
        ) : (
          <InteractionList assessments={assessments} />
        )}
      </ContentCard>

      {/* Symptoms & Safety Reports Section */}
      <ContentCard
        title={t('safety_symptoms_title')}
        action={
          <Button 
            variant="secondary" 
            type="button" 
            onClick={() => setShowSymptomForm(!showSymptomForm)}
            disabled={showSymptomForm}
          >
            {t('report_symptom')}
          </Button>
        }
      >
        {showSymptomForm && (
          <div style={{ marginBottom: '24px' }}>
            <SymptomReportForm 
              activeMedications={activeMedications}
              onCancel={() => setShowSymptomForm(false)}
              onSuccess={() => {
                setShowSymptomForm(false);
                fetchAssessments();
              }}
            />
          </div>
        )}

        {loading ? (
          <p style={{ color: 'var(--mm-text-secondary)', fontSize: '14px' }}>{t('safety_loading_reports')}</p>
        ) : symptomReports.length === 0 ? (
          <EmptyState icon="⚕" message={t('no_safety_reports')} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {symptomReports.map(report => (
              <div key={report.id} style={{
                padding: '16px',
                borderRadius: 'var(--mm-radius-md)',
                background: 'var(--mm-bg-surface)',
                border: '1px solid var(--mm-border-default)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '16px', color: 'var(--mm-text-primary)' }}>
                    {report.symptom}
                  </h4>
                  <span style={{
                    fontSize: '12px',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontWeight: 'bold',
                    background: report.severity === 'severe' ? 'var(--mm-semantic-critical-bg-subtle)' : report.severity === 'moderate' ? 'var(--mm-semantic-warning-bg-subtle)' : 'var(--mm-bg-surface-alt)',
                    color: report.severity === 'severe' ? 'var(--mm-semantic-critical-text)' : report.severity === 'moderate' ? 'var(--mm-semantic-warning-text)' : 'var(--mm-text-secondary)'
                  }}>
                    {report.severity.toUpperCase()}
                  </span>
                </div>
                
                <p style={{ margin: '4px 0', fontSize: '14px', color: 'var(--mm-text-secondary)' }}>
                  <strong>{t('safety_onset')}</strong> {new Date(report.onset_at).toLocaleString(locale === 'en' ? 'en-US' : `${locale}-IN`)}
                </p>
                
                {report.related_medication_id && (
                  <p style={{ margin: '4px 0', fontSize: '14px', color: 'var(--mm-text-secondary)' }}>
                    <strong>{t('safety_related_to')}</strong> {activeMedications.find(m => m.id === report.related_medication_id)?.display_name || t('safety_unknown_med')}
                  </p>
                )}
                
                {report.notes && (
                  <p style={{ margin: '8px 0 0 0', fontSize: '14px', color: 'var(--mm-text-primary)', whiteSpace: 'pre-wrap' }}>
                    {report.notes}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </ContentCard>
    </section>
  );
}
