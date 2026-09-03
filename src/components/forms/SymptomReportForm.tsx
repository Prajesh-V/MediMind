'use client';

import { useState } from 'react';
import { Button } from './Button';
import { createSymptomReport } from '@/app/actions/symptoms';
import { useTranslation } from '@/i18n';

interface SymptomReportFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  activeMedications: Array<{ id: string; display_name: string }>;
}

export function SymptomReportForm({ onSuccess, onCancel, activeMedications }: SymptomReportFormProps) {
  const { t } = useTranslation();
  const [symptom, setSymptom] = useState('');
  const [severity, setSeverity] = useState<'mild' | 'moderate' | 'severe'>('mild');
  const [onsetAt, setOnsetAt] = useState('');
  const [relatedMedicationId, setRelatedMedicationId] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!symptom.trim() || !onsetAt) {
      setError(t('symptom_err_req'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await createSymptomReport(
        symptom,
        severity,
        new Date(onsetAt).toISOString(),
        relatedMedicationId || null,
        notes
      );

      if (result.success) {
        onSuccess();
      } else {
        setError(result.error || t('symptom_err_fail'));
      }
    } catch (err: any) {
      setError(err.message || t('symptom_err_unexp'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px', background: 'var(--mm-bg-surface)', borderRadius: 'var(--mm-radius-md)' }}>
      <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--mm-text-primary)' }}>{t('symptom_form_title')}</h3>
      
      {error && (
        <div style={{ color: 'var(--mm-semantic-critical-text)', background: 'var(--mm-semantic-critical-bg-subtle)', padding: '12px', borderRadius: '4px', fontSize: '14px' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <label htmlFor="symptom" style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--mm-text-secondary)' }}>{t('symptom_label_desc')}</label>
        <input 
          id="symptom"
          type="text" 
          value={symptom} 
          onChange={(e) => setSymptom(e.target.value)} 
          placeholder={t('symptom_ph_desc')} 
          required 
          disabled={loading}
          style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--mm-border-default)', background: 'var(--mm-bg-input)', color: 'var(--mm-text-primary)' }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <label htmlFor="severity" style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--mm-text-secondary)' }}>{t('symptom_label_sev')}</label>
        <select 
          id="severity" 
          value={severity} 
          onChange={(e) => setSeverity(e.target.value as any)}
          disabled={loading}
          style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--mm-border-default)', background: 'var(--mm-bg-input)', color: 'var(--mm-text-primary)' }}
        >
          <option value="mild">{t('symptom_sev_mild')}</option>
          <option value="moderate">{t('symptom_sev_mod')}</option>
          <option value="severe">{t('symptom_sev_sev')}</option>
        </select>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label htmlFor="onsetAt" style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--mm-text-secondary)' }}>{t('symptom_label_onset')}</label>
          <button 
            type="button" 
            onClick={() => {
              const now = new Date(); 
              const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
              setOnsetAt(localNow);
            }}
            disabled={loading}
            style={{ background: 'transparent', border: 'none', color: 'var(--mm-primary)', fontSize: '12px', cursor: 'pointer', padding: 0, fontWeight: 'bold' }}
          >
            {t('symptom_btn_current_time')}
          </button>
        </div>
        <input 
          id="onsetAt" 
          type="datetime-local" 
          value={onsetAt} 
          onChange={(e) => setOnsetAt(e.target.value)} 
          required 
          disabled={loading}
          style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--mm-border-default)', background: 'var(--mm-bg-input)', color: 'var(--mm-text-primary)' }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <label htmlFor="relatedMedication" style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--mm-text-secondary)' }}>{t('symptom_label_med')}</label>
        <select 
          id="relatedMedication" 
          value={relatedMedicationId} 
          onChange={(e) => setRelatedMedicationId(e.target.value)}
          disabled={loading}
          style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--mm-border-default)', background: 'var(--mm-bg-input)', color: 'var(--mm-text-primary)' }}
        >
          <option value="">{t('symptom_med_none')}</option>
          {activeMedications.map(med => (
            <option key={med.id} value={med.id}>{med.display_name}</option>
          ))}
        </select>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <label htmlFor="notes" style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--mm-text-secondary)' }}>{t('symptom_label_notes')}</label>
        <textarea 
          id="notes" 
          value={notes} 
          onChange={(e) => setNotes(e.target.value)} 
          placeholder={t('symptom_ph_notes')} 
          disabled={loading}
          rows={3}
          style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--mm-border-default)', background: 'var(--mm-bg-input)', color: 'var(--mm-text-primary)' }}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
          {t('symptom_btn_cancel')}
        </Button>
        <Button type="submit" variant="primary" disabled={loading}>
          {loading ? t('symptom_btn_submitting') : t('symptom_btn_submit')}
        </Button>
      </div>
    </form>
  );
}
