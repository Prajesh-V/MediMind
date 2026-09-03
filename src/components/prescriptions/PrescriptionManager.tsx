'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { createPrescription, confirmPrescriptionCandidate, rejectPrescriptionCandidate } from '@/app/actions/prescription'
import { searchMedicationConcepts } from '@/app/actions/medication'
import { Button } from '@/components/forms/Button'
import { EmptyState } from '@/components/feedback/EmptyState'
import styles from './Prescriptions.module.css'

import { PrescriptionUploader } from './PrescriptionUploader'

export function PrescriptionManager() {
  const [prescriptions, setPrescriptions] = useState<any[]>([])
  const [candidates, setCandidates] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // New Prescription Form State
  const [doctorName, setDoctorName] = useState('')
  const [facilityName, setFacilityName] = useState('')
  const [prescriptionDate, setPrescriptionDate] = useState(new Date().toISOString().split('T')[0])
  const [candidateName, setCandidateName] = useState('')
  const [candidateDosage, setCandidateDosage] = useState('10mg')
  const [candidateFrequency, setCandidateFrequency] = useState('Once daily')
  const [candidateInstructions, setCandidateInstructions] = useState('Take with food')
  const [submitting, setSubmitting] = useState(false)
  const [formOpen, setFormOpen] = useState(false)

  // RxNorm Search State
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedConcept, setSelectedConcept] = useState<any | null>(null)
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1)

  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const supabase = createClient()

  // Debounced Live RxNorm Search
  useEffect(() => {
    if (!formOpen) return;

    if (query.trim().length < 2 || (selectedConcept && selectedConcept.name === query)) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchMedicationConcepts(query);
        setSuggestions(results || []);
        setShowDropdown(true);
        setHighlightedIndex(-1);
      } catch (e) {
        console.error('Error during RxNorm live search:', e);
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query, selectedConcept, formOpen]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectSuggestion = useCallback((concept: any) => {
    setSelectedConcept(concept);
    const cleanName = concept.name || query;
    setCandidateName(cleanName);
    setQuery(cleanName);
    setSuggestions([]);
    setShowDropdown(false);
    setHighlightedIndex(-1);
  }, [query]);

  const handleResetSearch = () => {
    setSelectedConcept(null);
    setQuery('');
    setCandidateName('');
    setSuggestions([]);
    setShowDropdown(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Enter') {
      if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
        e.preventDefault();
        handleSelectSuggestion(suggestions[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  const fetchData = useCallback(async () => {
    setLoading(true)
    const { data: pData } = await supabase
      .from('prescriptions')
      .select('*')
      .order('created_at', { ascending: false })

    const { data: cData } = await supabase
      .from('prescription_candidates')
      .select('*, extraction_runs(service_provider)')
      .order('created_at', { ascending: false })

    if (pData) setPrescriptions(pData)
    if (cData) setCandidates(cData)
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleCreatePrescription = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!candidateName.trim()) {
      alert('Please enter at least one medication candidate.')
      return
    }

    setSubmitting(true)
    
    const isVerified = Boolean(selectedConcept?.rxcui && selectedConcept.name === candidateName.trim());

    const res = await createPrescription({
      doctorName,
      facilityName,
      prescriptionDate,
      title: 'Manual Prescription Entry',
      candidates: [
        {
          rawName: candidateName.trim(),
          rawDosage: candidateDosage.trim(),
          rawFrequency: candidateFrequency.trim(),
          rawInstructions: candidateInstructions.trim(),
          suggestedRxcui: isVerified ? selectedConcept.rxcui : undefined,
          suggestedName: isVerified ? selectedConcept.name : candidateName.trim(),
          verificationStatus: isVerified ? 'verified_rxnorm' : 'manual_custom'
        }
      ]
    })

    if (res.success) {
      setCandidateName('')
      setQuery('')
      setSelectedConcept(null)
      setDoctorName('')
      setFacilityName('')
      setFormOpen(false)
      fetchData()
    } else {
      alert(res.error || 'Failed to create prescription.')
    }
    setSubmitting(false)
  }

  const handleConfirm = async (candidate: any) => {
    try {
      const isVerified = Boolean(candidate.suggested_rxcui);
      const payload: any = {
        displayName: candidate.suggested_name || candidate.raw_name, // fallback for OCR vs manual
        verificationStatus: isVerified ? 'verified_rxnorm' : 'manual_custom',
        dosageUnit: 'mg',
        dosageForm: 'Tablet',
        foodRelation: 'with_meal',
        schedules: [
          {
            timeOfDay: '08:00:00',
            slotLabel: 'morning',
            doseQuantity: 1.0
          }
        ]
      };

      if (candidate.suggested_rxcui) {
        payload.rxcui = candidate.suggested_rxcui;
      }
      if (candidate.raw_instructions) {
        payload.administrationInstructions = candidate.raw_instructions;
      }

      console.log('Sending payload to confirmPrescriptionCandidate:', payload);
      const res = await confirmPrescriptionCandidate(candidate.id, payload);

      if (res.success) {
        fetchData();
      } else {
        alert(res.error || 'Failed to confirm candidate.');
      }
    } catch (err: any) {
      console.error('Confirmation crash:', err);
      alert(err.message || 'An unexpected error occurred during confirmation.');
    }
  }

  const handleReject = async (candidateId: string) => {
    try {
      const res = await rejectPrescriptionCandidate(candidateId)
      if (res.success) {
        fetchData()
      } else {
        alert(res.error || 'Failed to reject candidate.')
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'An unexpected error occurred during rejection.');
    }
  }

  const pendingCandidates = candidates.filter((c) => c.status === 'pending')

  return (
    <div className={styles.container}>
      
      <PrescriptionUploader onExtractionComplete={fetchData} />

      {/* Pending Candidate Review Staging */}
      {pendingCandidates.length > 0 && (
        <div className={styles.candidateSection}>
          <h4>⚠️ Unconfirmed Prescription Candidates ({pendingCandidates.length})</h4>
          <p className={styles.desc}>
            Prescription items require your review and confirmation before joining your active medication regimen.
          </p>
          <div className={styles.candidateList}>
            {pendingCandidates.map((c) => {
              const isOCR = !!c.extraction_run_id;
              const hasWarnings = isOCR && c.extraction_confidence !== 'high';
              return (
              <div key={c.id} className={styles.candidateCard}>
                <div>
                  <strong style={{ fontSize: '15px' }}>{c.suggested_name || c.raw_name}</strong>
                  {isOCR && <span style={{ marginLeft: '8px', fontSize: '11px', background: 'var(--mm-primary)', color: 'var(--mm-primary-surface)', padding: '2px 6px', borderRadius: '4px' }}>Extracted via {c.extraction_runs?.service_provider?.includes('ollama') ? 'Ollama AI' : 'Gemini AI'}</span>}
                  
                  {hasWarnings && (
                    <div style={{ fontSize: '12px', color: 'var(--mm-warning)', marginTop: '4px', background: 'var(--mm-warning-subtle)', padding: '4px 8px', borderRadius: '4px' }}>
                      ⚠️ <strong>Review carefully:</strong> Some fields were uncertain or missing.
                    </div>
                  )}

                  <div style={{ fontSize: '13px', color: 'var(--mm-text-secondary)', marginTop: '4px' }}>
                    Dosage: {c.dosage || c.raw_dosage || 'Standard'} | Frequency: {c.frequency || c.raw_frequency || 'Daily'}
                  </div>
                  {c.raw_instructions && (
                    <div style={{ fontSize: '12px', color: 'var(--mm-text-muted)', marginTop: '2px' }}>
                      Instructions: {c.raw_instructions}
                    </div>
                  )}
                </div>

                <div className={styles.actions}>
                  <Button
                    variant="primary"
                    onClick={() => handleConfirm(c)}
                  >
                    ✓ Confirm &amp; Add to Regimen
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => handleReject(c.id)}
                  >
                    ✕ Reject
                  </Button>
                </div>
              </div>
            )})}
          </div>
        </div>
      )}

      {/* Manual / Upload Entry Section */}
      <div className={styles.actionRow}>
        <Button variant="secondary" onClick={() => setFormOpen(!formOpen)}>
          {formOpen ? 'Close Form' : '+ Record Prescription Manually'}
        </Button>
      </div>

      {formOpen && (
        <form onSubmit={handleCreatePrescription} className={styles.form}>
          <h5>New Prescription Details</h5>
          <div className={styles.row}>
            <div className={styles.field}>
              <label>Prescribing Doctor</label>
              <input
                type="text"
                value={doctorName}
                onChange={(e) => setDoctorName(e.target.value)}
                placeholder="Dr. Smith"
                className={styles.input}
              />
            </div>
            <div className={styles.field}>
              <label>Clinic / Facility</label>
              <input
                type="text"
                value={facilityName}
                onChange={(e) => setFacilityName(e.target.value)}
                placeholder="City Hospital"
                className={styles.input}
              />
            </div>
            <div className={styles.field}>
              <label>Date</label>
              <input
                type="date"
                value={prescriptionDate}
                onChange={(e) => setPrescriptionDate(e.target.value)}
                className={styles.input}
              />
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.field} ref={dropdownRef}>
              <label htmlFor="medication-search-input">Medication Name *</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  id="medication-search-input"
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setCandidateName(e.target.value);
                    if (selectedConcept && selectedConcept.name !== e.target.value) {
                      setSelectedConcept(null);
                    }
                  }}
                  onFocus={() => {
                    if (suggestions.length > 0) setShowDropdown(true);
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="e.g. Lisinopril"
                  className={styles.input}
                  autoComplete="off"
                  required
                />
                {(query || selectedConcept) && (
                  <button type="button" onClick={handleResetSearch} style={{ position: 'absolute', right: '8px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: 'var(--mm-text-muted)' }}>
                    Clear
                  </button>
                )}
              </div>
              
              {!searching && !showDropdown && query && (
                <div style={{ fontSize: '12px', marginTop: '4px', fontWeight: 500, color: selectedConcept && selectedConcept.name === query ? 'var(--mm-primary)' : 'var(--mm-warning)' }}>
                  {selectedConcept && selectedConcept.name === query ? '✓ RxNorm Verified' : '⚠️ Custom Medication (Unverified)'}
                </div>
              )}

              {searching && (
                <div style={{ fontSize: '12px', marginTop: '4px', color: 'var(--mm-text-muted)' }}>
                  Searching RxNorm database...
                </div>
              )}

              {/* Suggestions Dropdown */}
              {showDropdown && !searching && (
                <ul style={{ position: 'absolute', zIndex: 10, background: 'var(--mm-bg-card)', border: '1px solid var(--mm-border-subtle)', width: '100%', maxHeight: '200px', overflowY: 'auto', listStyle: 'none', padding: 0, margin: '4px 0 0 0', borderRadius: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} role="listbox">
                  {suggestions.length > 0 ? (
                    suggestions.map((s, idx) => (
                      <li
                        key={s.rxcui || idx}
                        onClick={() => handleSelectSuggestion(s)}
                        style={{ padding: '8px 12px', cursor: 'pointer', background: idx === highlightedIndex ? 'var(--mm-bg-hover)' : 'transparent', borderBottom: '1px solid var(--mm-border-light)' }}
                        role="option"
                        aria-selected={idx === highlightedIndex}
                      >
                        <div>
                          <strong style={{ color: 'var(--mm-text-primary)' }}>{s.name}</strong>
                          {s.synonym && (
                            <div style={{ fontSize: '11px', color: 'var(--mm-text-muted)' }}>
                              Synonym: {s.synonym}
                            </div>
                          )}
                        </div>
                        {s.rxcui && <span style={{ fontSize: '11px', background: 'var(--mm-bg-hover)', padding: '2px 6px', borderRadius: '4px' }}>RxCUI: {s.rxcui}</span>}
                      </li>
                    ))
                  ) : (
                    <li style={{ padding: '8px 12px', cursor: 'default', color: 'var(--mm-text-secondary)' }}>
                      <div>
                        <em>No exact match found.</em>
                        <div style={{ fontSize: '11px', color: 'var(--mm-text-muted)', marginTop: '2px' }}>
                          Will be saved as Custom / Unverified.
                        </div>
                      </div>
                    </li>
                  )}
                </ul>
              )}

              {selectedConcept?.rxcui && (
                <div style={{ fontSize: '12px', color: 'var(--mm-success)', marginTop: '4px', background: 'var(--mm-success-subtle)', padding: '4px 8px', borderRadius: '4px', display: 'inline-block' }}>
                  ✓ <strong>RxNorm Verified:</strong> {selectedConcept.name} (RxCUI: {selectedConcept.rxcui})
                </div>
              )}

              {!selectedConcept?.rxcui && query.trim().length >= 2 && !searching && !showDropdown && (
                <div style={{ fontSize: '12px', color: 'var(--mm-text-secondary)', marginTop: '4px' }}>
                  ℹ️ Unmatched concept: will be saved as <strong>Custom / Unverified</strong>.
                </div>
              )}
            </div>
            <div className={styles.field}>
              <label>Dosage</label>
              <input
                type="text"
                value={candidateDosage}
                onChange={(e) => setCandidateDosage(e.target.value)}
                placeholder="10mg"
                className={styles.input}
              />
            </div>
            <div className={styles.field}>
              <label>Frequency</label>
              <input
                type="text"
                value={candidateFrequency}
                onChange={(e) => setCandidateFrequency(e.target.value)}
                placeholder="Once daily"
                className={styles.input}
              />
            </div>
          </div>

          <div className={styles.field}>
            <label>Administration Instructions</label>
            <input
              type="text"
              value={candidateInstructions}
              onChange={(e) => setCandidateInstructions(e.target.value)}
              placeholder="Take in the morning with breakfast"
              className={styles.input}
            />
          </div>

          <Button variant="primary" type="submit" disabled={submitting}>
            {submitting ? 'Submitting...' : 'Save for Review'}
          </Button>
        </form>
      )}

      {/* Prescription History */}
      <div style={{ marginTop: '20px' }}>
        <h4>Prescription Records</h4>
        {loading ? (
          <p className={styles.desc}>Loading records...</p>
        ) : prescriptions.length === 0 ? (
          <EmptyState icon="📋" message="No prescription records found." />
        ) : (
          <div className={styles.list}>
            {prescriptions.map((p) => {
              // Extract the recognized candidate names from the joined data if available
              const candidateNames = p.prescription_candidates && p.prescription_candidates.length > 0 
                ? p.prescription_candidates.map((c: any) => c.raw_name).join(', ') 
                : null;
              
              // Handle title (doctor name or AI upload fallback)
              const title = p.title || p.doctor_name || (candidateNames ? 'AI Extracted Prescription' : 'Uploaded Prescription Document');

              
              // Handle date (explicit date or creation timestamp)
              const displayDate = p.prescription_date 
                ? p.prescription_date 
                : new Date(p.created_at).toLocaleDateString();

              return (
                <div key={p.id} className={styles.prescriptionItem}>
                  <div>
                    <strong>{title}</strong>
                    {p.facility_name && <span className={styles.tag} style={{ marginLeft: '8px' }}>🏥 {p.facility_name}</span>}
                    
                    {candidateNames && (
                      <div style={{ fontSize: '13px', marginTop: '4px', color: 'var(--mm-primary)' }}>
                        Identified: <strong>{candidateNames}</strong>
                      </div>
                    )}
                    
                    {p.ai_summary && (
                      <div className={styles.desc} style={{ marginTop: '6px', background: 'var(--mm-bg-hover)', padding: '8px', borderRadius: '4px', fontStyle: 'italic', fontSize: '13px' }}>
                        💡 AI Summary: {p.ai_summary}
                      </div>
                    )}
                    

                    <div className={styles.desc} style={{ marginTop: '8px' }}>Date: {displayDate}</div>
                    {p.notes && <div className={styles.desc}>Notes: {p.notes}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  )
}
