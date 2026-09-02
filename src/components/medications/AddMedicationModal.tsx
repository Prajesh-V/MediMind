'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { searchMedicationConcepts, createMedication } from '@/app/actions/medication';
import type { CreateMedicationInput } from '@/app/actions/medication';
import { Button } from '@/components/forms/Button';
import styles from './Medications.module.css';

interface AddMedicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddMedicationModal({ isOpen, onClose, onSuccess }: AddMedicationModalProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedConcept, setSelectedConcept] = useState<any | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

  // Form Fields
  const [displayName, setDisplayName] = useState('');
  const [dosageAmount, setDosageAmount] = useState('10');
  const [dosageUnit, setDosageUnit] = useState('mg');
  const [dosageForm, setDosageForm] = useState('Tablet');
  const [foodRelation, setFoodRelation] = useState<'no_relation' | 'before_meal' | 'with_meal' | 'after_meal' | 'empty_stomach'>('with_meal');
  const [instructions, setInstructions] = useState('');
  const [isPrn, setIsPrn] = useState(false);

  // Schedules
  const [morning, setMorning] = useState(true);
  const [evening, setEvening] = useState(false);
  const [morningTime, setMorningTime] = useState('08:00');
  const [eveningTime, setEveningTime] = useState('20:00');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounced Live RxNorm Search
  useEffect(() => {
    if (!isOpen) return;

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
  }, [query, selectedConcept, isOpen]);

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
    setDisplayName(cleanName);
    setQuery(cleanName);
    setSuggestions([]);
    setShowDropdown(false);
    setHighlightedIndex(-1);
  }, [query]);

  const handleResetSearch = () => {
    setSelectedConcept(null);
    setQuery('');
    setDisplayName('');
    setSuggestions([]);
    setShowDropdown(false);
    inputRef.current?.focus();
  };

  // Keyboard navigation
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setError('Please provide a medication name.');
      return;
    }

    setLoading(true);
    setError('');

    const schedules: any[] = [];
    if (!isPrn) {
      if (morning) {
        schedules.push({
          timeOfDay: `${morningTime}:00`,
          slotLabel: 'morning',
          doseQuantity: parseFloat(dosageAmount) || 1.0,
        });
      }
      if (evening) {
        schedules.push({
          timeOfDay: `${eveningTime}:00`,
          slotLabel: 'evening',
          doseQuantity: parseFloat(dosageAmount) || 1.0,
        });
      }
    }

    const isVerified = Boolean(selectedConcept?.rxcui && selectedConcept.name === displayName.trim());

    const payload: CreateMedicationInput = {
      rxcui: isVerified ? selectedConcept.rxcui : undefined,
      displayName: displayName.trim(),
      genericName: isVerified ? selectedConcept.name : displayName.trim(),
      dosageAmount: parseFloat(dosageAmount) || undefined,
      dosageUnit: dosageUnit.trim(),
      dosageForm: dosageForm.trim(),
      route: 'oral',
      foodRelation,
      administrationInstructions: instructions.trim() || undefined,
      isPrn,
      verificationStatus: isVerified ? 'verified_rxnorm' : 'manual_custom',
      schedules,
    };

    const res = await createMedication(payload);
    if (res.success) {
      onSuccess();
      onClose();
    } else {
      setError(res.error || 'Failed to save medication.');
    }
    setLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h3>Add Medication</h3>
          <button className={styles.closeBtn} onClick={onClose} type="button" aria-label="Close">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {/* RxNorm Live Autocomplete Search */}
          <div className={styles.field} ref={dropdownRef}>
            <label htmlFor="medication-search-input">
              Search Clinical Medication (RxNorm) *
            </label>
            <div className={styles.searchWrapper}>
              <input
                id="medication-search-input"
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setDisplayName(e.target.value);
                  if (selectedConcept && selectedConcept.name !== e.target.value) {
                    setSelectedConcept(null);
                  }
                }}
                onFocus={() => {
                  if (suggestions.length > 0) setShowDropdown(true);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Type drug name (e.g. Amlodipine, Lisinopril, Metformin)..."
                className={styles.input}
                autoFocus
                autoComplete="off"
                required
              />
              {(query || selectedConcept) && (
                <button type="button" onClick={handleResetSearch} className={styles.clearBtn}>
                  Clear
                </button>
              )}
            </div>

            {searching && (
              <div className={styles.hint} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className={styles.spinner} /> Searching RxNorm clinical database...
              </div>
            )}

            {/* Suggestions Dropdown */}
            {showDropdown && !searching && (
              <ul className={styles.suggestionList} role="listbox">
                {suggestions.length > 0 ? (
                  suggestions.map((s, idx) => (
                    <li
                      key={s.rxcui || idx}
                      onClick={() => handleSelectSuggestion(s)}
                      className={`${styles.suggestionItem} ${idx === highlightedIndex ? styles.suggestionHighlighted : ''}`}
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
                      {s.rxcui && <span className={styles.rxcuiTag}>RxCUI: {s.rxcui}</span>}
                    </li>
                  ))
                ) : (
                  <li className={styles.suggestionItem} style={{ cursor: 'default', color: 'var(--mm-text-secondary)' }}>
                    <div>
                      <em>No exact RxNorm match found for &quot;{query}&quot;.</em>
                      <div style={{ fontSize: '11px', color: 'var(--mm-text-muted)', marginTop: '2px' }}>
                        You can continue typing to save as a custom unverified medication.
                      </div>
                    </div>
                  </li>
                )}
              </ul>
            )}

            {selectedConcept?.rxcui && (
              <div className={styles.verifiedBadge}>
                ✓ <strong>RxNorm Verified:</strong> {selectedConcept.name} (RxCUI: {selectedConcept.rxcui})
              </div>
            )}

            {!selectedConcept?.rxcui && query.trim().length >= 2 && !searching && !showDropdown && (
              <div style={{ fontSize: '12px', color: 'var(--mm-text-secondary)', marginTop: '4px' }}>
                ℹ️ Unmatched concept: will be saved as <strong>Custom / Unverified</strong>.
              </div>
            )}
          </div>

          {/* Dosage & Unit */}
          <div className={styles.row}>
            <div className={styles.field}>
              <label>Dosage Strength</label>
              <input
                type="number"
                step="any"
                value={dosageAmount}
                onChange={(e) => setDosageAmount(e.target.value)}
                className={styles.input}
                placeholder="10"
              />
            </div>
            <div className={styles.field}>
              <label>Unit</label>
              <select value={dosageUnit} onChange={(e) => setDosageUnit(e.target.value)} className={styles.select}>
                <option value="mg">mg</option>
                <option value="mcg">mcg</option>
                <option value="ml">ml</option>
                <option value="g">g</option>
                <option value="units">units</option>
              </select>
            </div>
            <div className={styles.field}>
              <label>Form</label>
              <select value={dosageForm} onChange={(e) => setDosageForm(e.target.value)} className={styles.select}>
                <option value="Tablet">Tablet</option>
                <option value="Capsule">Capsule</option>
                <option value="Liquid / Syrup">Liquid / Syrup</option>
                <option value="Injection">Injection</option>
                <option value="Inhaler">Inhaler</option>
              </select>
            </div>
          </div>

          {/* Food Relation */}
          <div className={styles.field}>
            <label>Food Administration Guidance</label>
            <select
              value={foodRelation}
              onChange={(e) => setFoodRelation(e.target.value as any)}
              className={styles.select}
            >
              <option value="with_meal">Take With Meal</option>
              <option value="before_meal">Take Before Meal (30 min)</option>
              <option value="after_meal">Take After Meal</option>
              <option value="empty_stomach">Empty Stomach (1 hr before / 2 hr after)</option>
              <option value="no_relation">No Food Restrictions</option>
            </select>
          </div>

          {/* Special Instructions */}
          <div className={styles.field}>
            <label>Special Instructions</label>
            <input
              type="text"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="e.g. Take with a full glass of water. Do not crush."
              className={styles.input}
            />
          </div>

          {/* Schedule */}
          <div className={styles.field}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ margin: 0 }}>Daily Schedule</label>
              <label style={{ fontSize: '13px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={isPrn}
                  onChange={(e) => setIsPrn(e.target.checked)}
                  style={{ marginRight: '6px' }}
                />
                As Needed (PRN)
              </label>
            </div>

            {!isPrn && (
              <div className={styles.scheduleBox}>
                <div className={styles.scheduleRow}>
                  <label>
                    <input
                      type="checkbox"
                      checked={morning}
                      onChange={(e) => setMorning(e.target.checked)}
                      style={{ marginRight: '8px' }}
                    />
                    Morning Slot
                  </label>
                  {morning && (
                    <input
                      type="time"
                      value={morningTime}
                      onChange={(e) => setMorningTime(e.target.value)}
                      className={styles.timeInput}
                    />
                  )}
                </div>

                <div className={styles.scheduleRow}>
                  <label>
                    <input
                      type="checkbox"
                      checked={evening}
                      onChange={(e) => setEvening(e.target.checked)}
                      style={{ marginRight: '8px' }}
                    />
                    Evening Slot
                  </label>
                  {evening && (
                    <input
                      type="time"
                      value={eveningTime}
                      onChange={(e) => setEveningTime(e.target.value)}
                      className={styles.timeInput}
                    />
                  )}
                </div>
              </div>
            )}
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.actions}>
            <Button variant="secondary" onClick={onClose} type="button" disabled={loading}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save Medication'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
