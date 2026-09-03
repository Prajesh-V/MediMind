'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { ContentCard } from '@/components/cards/ContentCard';
import { EmptyState } from '@/components/feedback/EmptyState';
import { InteractionList } from '@/components/interactions/InteractionList';
import { getProfessionalAssessments, acknowledgeAssessment } from '@/app/actions/interactions';
import type { InteractionAssessment } from '@/services/medical/types';

interface PatientOption {
  id: string;
  name: string;
}

export default function ProfessionalInteractionsPage() {
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [assessments, setAssessments] = useState<InteractionAssessment[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [loadingAssessments, setLoadingAssessments] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  // 1. Fetch Active Connected Patients
  const fetchPatients = useCallback(async () => {
    setLoadingPatients(true);
    const { data, error: connErr } = await supabase
      .from('patient_professional_connections')
      .select('patient_id, patients(id, first_name, last_name)')
      .eq('status', 'active');

    if (!connErr && data) {
      const patientList: PatientOption[] = data
        .filter((c: any) => c.patients)
        .map((c: any) => ({
          id: c.patients.id,
          name: `${c.patients.first_name} ${c.patients.last_name}`.trim(),
        }));

      setPatients(patientList);
      if (patientList.length > 0) {
        setSelectedPatientId(patientList[0].id);
      }
    }
    setLoadingPatients(false);
  }, [supabase]);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  // 2. Fetch Assessments for Selected Patient
  const fetchAssessments = useCallback(async (patientId: string) => {
    if (!patientId) {
      setAssessments([]);
      return;
    }

    setLoadingAssessments(true);
    setError(null);
    try {
      const data = await getProfessionalAssessments(patientId);
      setAssessments(data);
    } catch (err: any) {
      console.error('Error fetching professional assessments:', err);
      setError(err.message || 'Failed to load interaction assessments for patient.');
    } finally {
      setLoadingAssessments(false);
    }
  }, []);

  useEffect(() => {
    if (selectedPatientId) {
      fetchAssessments(selectedPatientId);
    }
  }, [selectedPatientId, fetchAssessments]);

  // 3. Handle Clinician Acknowledgment
  const handleAcknowledge = async (
    assessmentId: string,
    ruleKey: string,
    severity: string
  ) => {
    if (!selectedPatientId) return;
    const res = await acknowledgeAssessment(
      selectedPatientId,
      assessmentId,
      ruleKey,
      severity
    );
    if (!res.success) {
      throw new Error(res.error || 'Failed to acknowledge assessment');
    }
  };

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <ContentCard title="🛡️ Clinical Interaction & Food Safety Monitoring">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Patient Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <label htmlFor="patient-select" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--mm-text-primary)' }}>
              Select Connected Patient:
            </label>
            {loadingPatients ? (
              <span style={{ fontSize: '13px', color: 'var(--mm-text-secondary)' }}>Loading connected patients...</span>
            ) : patients.length === 0 ? (
              <span style={{ fontSize: '13px', color: 'var(--mm-text-muted)' }}>No active patient connections found.</span>
            ) : (
              <select
                id="patient-select"
                value={selectedPatientId}
                onChange={(e) => setSelectedPatientId(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--mm-border-default)',
                  background: 'var(--mm-bg-surface)',
                  fontSize: '14px',
                  fontWeight: 500,
                  minWidth: '220px',
                }}
              >
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    👤 {p.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Interaction Alerts List */}
          {error ? (
            <div style={{ color: 'var(--mm-error)', padding: '10px' }}>
              ⚠️ {error}
            </div>
          ) : loadingAssessments ? (
            <p style={{ color: 'var(--mm-text-secondary)', fontSize: '14px' }}>
              Running deterministic evaluation against patient&apos;s active regimen...
            </p>
          ) : !selectedPatientId ? (
            <EmptyState
              icon="⚠️"
              message="Select an active patient to review their clinical interaction alerts."
            />
          ) : (
            <InteractionList
              assessments={assessments}
              isProfessional={true}
              onAcknowledge={handleAcknowledge}
              emptyMessage="No clinical interactions or dietary conflicts detected for this patient."
            />
          )}
        </div>
      </ContentCard>
    </section>
  );
}
