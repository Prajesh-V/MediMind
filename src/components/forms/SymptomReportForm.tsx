'use client';

import { useState } from 'react';
import { Button } from './Button';
import { createSymptomReport } from '@/app/actions/symptoms';

interface SymptomReportFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  activeMedications: Array<{ id: string; display_name: string }>;
}

export function SymptomReportForm({ onSuccess, onCancel, activeMedications }: SymptomReportFormProps) {
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
      setError('Symptom description and onset time are required.');
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
        setError(result.error || 'Failed to submit report');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px', background: 'var(--mm-surface-subdued)', borderRadius: 'var(--mm-radius-md)' }}>
      <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--mm-text-primary)' }}>Report a Symptom</h3>
      
      {error && (
        <div style={{ color: 'var(--mm-error-dark)', background: 'var(--mm-error-light)', padding: '12px', borderRadius: '4px', fontSize: '14px' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <label htmlFor="symptom" style={{ fontSize: '14px', fontWeight: 'bold' }}>Symptom Description</label>
        <input 
          id="symptom"
          type="text" 
          value={symptom} 
          onChange={(e) => setSymptom(e.target.value)} 
          placeholder="e.g. Headache, Nausea" 
          required 
          disabled={loading}
          style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--mm-border)' }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <label htmlFor="severity" style={{ fontSize: '14px', fontWeight: 'bold' }}>Severity</label>
        <select 
          id="severity" 
          value={severity} 
          onChange={(e) => setSeverity(e.target.value as any)}
          disabled={loading}
          style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--mm-border)' }}
        >
          <option value="mild">Mild</option>
          <option value="moderate">Moderate</option>
          <option value="severe">Severe</option>
        </select>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <label htmlFor="onsetAt" style={{ fontSize: '14px', fontWeight: 'bold' }}>Onset Time</label>
        <input 
          id="onsetAt" 
          type="datetime-local" 
          value={onsetAt} 
          onChange={(e) => setOnsetAt(e.target.value)} 
          required 
          disabled={loading}
          style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--mm-border)' }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <label htmlFor="relatedMedication" style={{ fontSize: '14px', fontWeight: 'bold' }}>Related Medication (Optional)</label>
        <select 
          id="relatedMedication" 
          value={relatedMedicationId} 
          onChange={(e) => setRelatedMedicationId(e.target.value)}
          disabled={loading}
          style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--mm-border)' }}
        >
          <option value="">None / Not sure</option>
          {activeMedications.map(med => (
            <option key={med.id} value={med.id}>{med.display_name}</option>
          ))}
        </select>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <label htmlFor="notes" style={{ fontSize: '14px', fontWeight: 'bold' }}>Additional Notes (Optional)</label>
        <textarea 
          id="notes" 
          value={notes} 
          onChange={(e) => setNotes(e.target.value)} 
          placeholder="Any other relevant details..." 
          disabled={loading}
          rows={3}
          style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--mm-border)' }}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={loading}>
          {loading ? 'Submitting...' : 'Submit Report'}
        </Button>
      </div>
    </form>
  );
}
