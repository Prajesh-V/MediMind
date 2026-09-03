'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { AdherenceCalendar } from './AdherenceCalendar';
import { Surface } from '@/components/ui/Surface';
import { useTranslation } from '@/i18n';

interface PatientOption {
  id: string;
  name: string;
}

export function ProfessionalHomeCalendar() {
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { t } = useTranslation();

  useEffect(() => {
    async function loadPatients() {
      const supabase = createClient();
      
      const { data, error } = await supabase
        .from('patient_professional_connections')
        .select('status, patients(id, first_name, last_name)')
        .eq('status', 'active');

      if (!error && data) {
        const activePatients = data
          .filter((row: any) => row.patients != null)
          .map((row: any) => ({
            id: row.patients.id,
            name: `${row.patients.first_name} ${row.patients.last_name}`.trim()
          }));
        
        setPatients(activePatients);
        if (activePatients.length > 0) {
          setSelectedPatientId(activePatients[0].id);
        }
      }
      setLoading(false);
    }
    loadPatients();
  }, []);

  if (loading) {
    return <Surface padding="md"><p style={{ color: 'var(--mm-text-muted)', fontStyle: 'italic', fontSize: 'var(--mm-font-size-sm)' }}>{t('calendar_loading')}</p></Surface>;
  }

  if (patients.length === 0) {
    return (
      <Surface padding="md">
        <p style={{ color: 'var(--mm-text-muted)', fontStyle: 'italic', fontSize: 'var(--mm-font-size-sm)' }}>
          {t('calendar_no_patients')}
        </p>
      </Surface>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--mm-space-4)' }}>
      {patients.length > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--mm-space-3)' }}>
          <label htmlFor="calendar-patient-select" style={{ fontSize: 'var(--mm-font-size-sm)', color: 'var(--mm-text-secondary)', fontWeight: 500 }}>
            {t('select_patient')}
          </label>
          <select 
            id="calendar-patient-select"
            value={selectedPatientId || ''} 
            onChange={(e) => setSelectedPatientId(e.target.value)}
            style={{
              padding: 'var(--mm-space-2) var(--mm-space-3)',
              borderRadius: 'var(--mm-radius-sm)',
              border: '1px solid var(--mm-border-divider)',
              background: 'var(--mm-bg-surface-alt)',
              color: 'var(--mm-text-primary)',
              fontFamily: 'var(--mm-font-family)',
              fontSize: 'var(--mm-font-size-sm)',
              cursor: 'pointer',
              outline: 'none'
            }}
          >
            {patients.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      )}
      
      {selectedPatientId && (
        <Surface padding="md">
          <AdherenceCalendar patientId={selectedPatientId} />
        </Surface>
      )}
    </div>
  );
}
