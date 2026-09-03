'use client';

import { useState } from 'react';
import type { InteractionAssessment, ClinicalTraceEvent, ExplanationOutput } from '@/services/medical/types';
import type { WorkspaceAssessment } from '@/app/actions/workspace';
import { Button } from '@/components/forms/Button';
import { getExplanation } from '@/app/actions/explanations';
import { getTraceEvents } from '@/app/actions/trace';
import styles from './InteractionAlerts.module.css';

interface InteractionCardProps {
  assessment: InteractionAssessment | WorkspaceAssessment;
  isProfessional?: boolean;
  onAcknowledge?: (assessmentId: string, fingerprint: string, ruleKey: string, severity: string) => Promise<void>;
}

export function InteractionCard({
  assessment,
  isProfessional = false,
  onAcknowledge,
}: InteractionCardProps) {
  const [showEvidence, setShowEvidence] = useState(false);
  const [showTrace, setShowTrace] = useState(false);
  const [traces, setTraces] = useState<ClinicalTraceEvent[]>([]);
  const [fetchingTrace, setFetchingTrace] = useState(false);
  const [traceError, setTraceError] = useState<string | null>(null);
  const [acknowledging, setAcknowledging] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  
  const [explanation, setExplanation] = useState<ExplanationOutput | null>(null);
  const [explaining, setExplaining] = useState(false);
  const [explanationError, setExplanationError] = useState<string | null>(null);

  const handleExplain = async () => {
    setExplaining(true);
    setExplanationError(null);
    try {
      const result = await getExplanation(assessment.assessment_id, isProfessional ? 'professional' : 'patient');
      if (result.success) {
        setExplanation(result.data);
      } else {
        setExplanationError(result.error || 'An explanation is temporarily unavailable.');
      }
    } catch (err: any) {
      console.error(err);
      setExplanationError(err.message || 'An explanation is temporarily unavailable.');
    } finally {
      setExplaining(false);
    }
  };

  const handleFetchTrace = async () => {
    if (showTrace) {
      setShowTrace(false);
      return;
    }
    setFetchingTrace(true);
    setTraceError(null);
    try {
      const data = await getTraceEvents(assessment.patient_id, assessment.assessment_id);
      setTraces(data);
      setShowTrace(true);
    } catch (err: any) {
      console.error(err);
      setTraceError('Failed to load trace events');
    } finally {
      setFetchingTrace(false);
    }
  };

  const severityClass =
    assessment.severity === 'high'
      ? styles.high
      : assessment.severity === 'moderate'
      ? styles.moderate
      : styles.low;

  const badgeClass =
    assessment.severity === 'high'
      ? styles.badgeHigh
      : assessment.severity === 'moderate'
      ? styles.badgeModerate
      : styles.badgeLow;

  const handleAck = async () => {
    if (!onAcknowledge) return;
    setAcknowledging(true);
    try {
      await onAcknowledge(
        assessment.assessment_id,
        assessment.state_fingerprint,
        assessment.rule_key,
        assessment.severity
      );
      setAcknowledged(true);
    } catch (err: any) {
      console.error(err);
      alert(`Failed to record acknowledgment: ${err.message || 'Unknown error'}`);
    } finally {
      setAcknowledging(false);
    }
  };

  const formattedMeds = assessment.affected_medication_names.join(' + ');

  return (
    <div className={`${styles.card} ${severityClass}`} id={`assessment-${assessment.assessment_id}`}>
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <span className={`${styles.badge} ${badgeClass}`}>
            {assessment.severity} Severity
          </span>
          <span className={styles.typeTag}>
            {assessment.interaction_type === 'medication-medication' && 'Drug-Drug Interaction'}
            {assessment.interaction_type === 'medication-food' && 'Drug-Food Interaction'}
            {assessment.interaction_type === 'medication-timing' && 'Administration Timing Conflict'}
          </span>
          {'review_state' in assessment && assessment.review_state === 'SUPERSEDED' && (
            <span style={{ marginLeft: '0.5rem', padding: '0.2rem 0.5rem', backgroundColor: 'var(--mm-semantic-warning-bg-subtle)', color: 'var(--mm-semantic-warning-text)', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>
              SUPERSEDED (DATA CHANGED)
            </span>
          )}
          {'review_state' in assessment && assessment.review_state === 'REVIEWED' && (
            <span style={{ marginLeft: '0.5rem', padding: '0.2rem 0.5rem', backgroundColor: '#d4edda', color: '#155724', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>
              REVIEWED
            </span>
          )}
          <h4 className={styles.title}>{formattedMeds || assessment.rule_key}</h4>
        </div>
        {assessment.requires_professional_review && (
          <div className={styles.reviewRequiredBanner}>
            ⚠️ Clinical Review Required
          </div>
        )}
      </div>

      <div className={styles.body}>
        <div className={styles.section}>
          <span className={styles.sectionLabel}>Clinical Mechanism</span>
          <span className={styles.sectionValue}>{assessment.mechanism}</span>
        </div>

        <div className={styles.section}>
          <span className={styles.sectionLabel}>Potential Clinical Effect</span>
          <span className={styles.sectionValue}>{assessment.effect}</span>
        </div>

        <div className={styles.recommendationBox}>
          <span className={styles.sectionLabel} style={{ color: 'var(--mm-primary)' }}>
            Clinical Guidance / Action
          </span>
          <div style={{ marginTop: '2px' }}>{assessment.recommendation_template}</div>
        </div>

        <div className={styles.explanationSection} style={{ marginTop: '16px', padding: '12px', background: 'var(--mm-bg-alt)', borderRadius: '8px' }}>
          {!explanation && !explaining && !explanationError && (
            <Button variant="secondary" onClick={handleExplain}>
              {isProfessional ? 'Generate Clinical Summary' : 'Explain this warning'}
            </Button>
          )}
          
          {explaining && <div style={{ fontSize: '13px', color: 'var(--mm-text-muted)' }}>Generating explanation...</div>}
          
          {explanationError && (
            <div style={{ fontSize: '13px', color: 'var(--mm-danger)' }}>
              {explanationError}
            </div>
          )}

          {explanation && (
            <div style={{ fontSize: '14px', lineHeight: '1.5' }}>
              <div style={{ marginBottom: '8px', fontWeight: 600 }}>Explanation Summary:</div>
              <p style={{ marginBottom: '8px' }}>{explanation.summary}</p>
              
              <div style={{ marginBottom: '8px', fontWeight: 600 }}>What was detected:</div>
              <p style={{ marginBottom: '8px' }}>{explanation.what_was_detected}</p>
              
              <div style={{ marginBottom: '8px', fontWeight: 600 }}>Why it matters:</div>
              <p style={{ marginBottom: '8px' }}>{explanation.why_this_matters}</p>

              <div style={{ marginBottom: '8px', fontWeight: 600 }}>System Assessment:</div>
              <p style={{ marginBottom: '8px' }}>{explanation.what_the_system_determined}</p>

              {explanation.next_steps && explanation.next_steps.length > 0 && (
                <>
                  <div style={{ marginBottom: '8px', fontWeight: 600 }}>Next Steps:</div>
                  <ul style={{ paddingLeft: '20px', marginBottom: '8px' }}>
                    {explanation.next_steps.map((step, idx) => (
                      <li key={idx}>{step}</li>
                    ))}
                  </ul>
                </>
              )}

              <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--mm-text-muted)', borderTop: '1px solid var(--mm-border)', paddingTop: '8px' }}>
                <strong>Important:</strong> {explanation.limitations}
              </div>
            </div>
          )}
        </div>

        {assessment.evidence_references && assessment.evidence_references.length > 0 && (
          <div className={styles.evidenceSection}>
            <button
              type="button"
              className={styles.toggleBtn}
              onClick={() => setShowEvidence(!showEvidence)}
              aria-expanded={showEvidence}
            >
              {showEvidence ? '▼ Hide Authoritative Evidence' : '► View Authoritative Evidence & Sources'} ({assessment.evidence_references.length})
            </button>

            {showEvidence && (
              <div className={styles.evidenceList}>
                {assessment.evidence_references.map((ev, index) => (
                  <div key={index} className={styles.evidenceItem}>
                    <strong>Source:</strong> {ev.source.toUpperCase()} ({ev.jurisdiction})
                    <br />
                    <strong>Citation:</strong> {ev.citation_text}
                    {ev.identifier && <span> (ID: {ev.identifier})</span>}
                    {ev.jurisdiction !== 'GLOBAL' && (
                      <div className={styles.jurisdictionDisclaimer}>
                        * Evidence sourced under {ev.jurisdiction} regulatory frameworks. Follow regional clinical standards.
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {isProfessional && assessment.requires_professional_review && onAcknowledge && (
          <div className={styles.ackButton}>
            {acknowledged ? (
              <span style={{ fontSize: '13px', color: 'var(--mm-primary)', fontWeight: 600 }}>
                ✓ Acknowledged &amp; Logged to Audit Trail
              </span>
            ) : (
              <Button
                variant="primary"
                type="button"
                onClick={handleAck}
                disabled={acknowledging}
              >
                {acknowledging ? 'Logging...' : 'Mark Reviewed & Acknowledge'}
              </Button>
            )}
          </div>
        )}

        {/* M8 Trace UI */}
        <div className={styles.traceSection} style={{ marginTop: 'var(--mm-space-4)', borderTop: '1px solid var(--mm-border-divider)', paddingTop: 'var(--mm-space-3)' }}>
          <button
            type="button"
            className={styles.toggleBtn}
            onClick={handleFetchTrace}
            disabled={fetchingTrace}
          >
            {fetchingTrace ? 'Loading trace...' : showTrace ? '▼ Hide Assessment Details' : '► View Assessment Details (Trace)'}
          </button>
          
          {traceError && (
            <div style={{ color: 'var(--mm-semantic-error-text)', fontSize: '12px', marginTop: 'var(--mm-space-1)' }}>{traceError}</div>
          )}

          {showTrace && (
            <div style={{ marginTop: 'var(--mm-space-3)', fontSize: '13px', background: 'var(--mm-bg-surface-alt)', padding: 'var(--mm-space-3)', borderRadius: 'var(--mm-radius-md)', border: '1px solid var(--mm-border-divider)' }}>
              <div style={{ fontWeight: 600, marginBottom: 'var(--mm-space-2)' }}>Assessment Event Trace</div>
              {traces.length === 0 ? (
                <div style={{ color: 'var(--mm-text-muted)' }}>No events recorded for this assessment yet.</div>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {traces.map((trace) => (
                    <li key={trace.id} style={{ marginBottom: 'var(--mm-space-2)', borderBottom: '1px dotted var(--mm-border-divider)', paddingBottom: 'var(--mm-space-2)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--mm-space-1)' }}>
                        <strong style={{ color: trace.event_type === 'EXPLANATION_FAILED' ? 'var(--mm-semantic-error-text)' : 'inherit' }}>{trace.event_type}</strong>
                        <span style={{ color: 'var(--mm-text-muted)', fontSize: '11px' }}>
                          {new Date(trace.event_timestamp).toLocaleString()}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', display: 'flex', gap: 'var(--mm-space-2)' }}>
                        <span style={{ color: 'var(--mm-text-muted)' }}>Actor:</span> {trace.actor_type}
                        {isProfessional && trace.actor_id && <span style={{ color: 'var(--mm-text-muted)' }}> ({trace.actor_id.substring(0, 8)}...)</span>}
                      </div>
                      {isProfessional && (
                        <div style={{ fontSize: '11px', color: 'var(--mm-text-muted)', marginTop: '2px', wordBreak: 'break-all' }}>
                          Hash: {trace.event_hash}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
