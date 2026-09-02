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
  const { t } = useTranslation();
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
          <p style={{ color: 'var(--mm-text-secondary)', fontSize: '14px' }}>Loading symptom reports...</p>
        ) : symptomReports.length === 0 ? (
          <EmptyState icon="⚕" message={t('no_safety_reports')} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {symptomReports.map(report => (
              <div key={report.id} style={{
                padding: '16px',
                borderRadius: 'var(--mm-radius-md)',
                background: 'var(--mm-surface)',
                border: '1px solid var(--mm-border)'
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
                    background: report.severity === 'severe' ? 'var(--mm-error-light)' : report.severity === 'moderate' ? 'var(--mm-warning-light)' : 'var(--mm-surface-subdued)',
                    color: report.severity === 'severe' ? 'var(--mm-error-dark)' : report.severity === 'moderate' ? 'var(--mm-warning-dark)' : 'var(--mm-text-secondary)'
                  }}>
                    {report.severity.toUpperCase()}
                  </span>
                </div>
                
                <p style={{ margin: '4px 0', fontSize: '14px', color: 'var(--mm-text-secondary)' }}>
                  <strong>Onset:</strong> {new Date(report.onset_at).toLocaleString()}
                </p>
                
                {report.related_medication_id && (
                  <p style={{ margin: '4px 0', fontSize: '14px', color: 'var(--mm-text-secondary)' }}>
                    <strong>Related to:</strong> {activeMedications.find(m => m.id === report.related_medication_id)?.display_name || 'Unknown Medication'}
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
