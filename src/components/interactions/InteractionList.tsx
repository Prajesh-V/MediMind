'use client';

import type { InteractionAssessment } from '@/services/medical/types';
import { EmptyState } from '@/components/feedback/EmptyState';
import { InteractionCard } from './InteractionCard';
import styles from './InteractionAlerts.module.css';

interface InteractionListProps {
  assessments: InteractionAssessment[];
  isProfessional?: boolean;
  onAcknowledge?: (assessmentId: string, ruleKey: string, severity: string) => Promise<void>;
  emptyMessage?: string;
}

export function InteractionList({
  assessments,
  isProfessional = false,
  onAcknowledge,
  emptyMessage = 'No active drug-drug, drug-food, or timing interactions detected.',
}: InteractionListProps) {
  if (assessments.length === 0) {
    return <EmptyState icon="🛡️" message={emptyMessage} />;
  }

  // Group assessments by severity: high first, then moderate, then low
  const highSeverity = assessments.filter((a) => a.severity === 'high');
  const moderateSeverity = assessments.filter((a) => a.severity === 'moderate');
  const lowSeverity = assessments.filter((a) => a.severity === 'low');

  return (
    <div className={styles.container}>
      {highSeverity.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h5 style={{ color: 'var(--mm-high-text, #b62e2e)', margin: '0 0 4px 0', fontSize: '14px', fontWeight: 700 }}>
            🚨 High Severity Alerts ({highSeverity.length})
          </h5>
          {highSeverity.map((assessment) => (
            <InteractionCard
              key={assessment.assessment_id}
              assessment={assessment}
              isProfessional={isProfessional}
              onAcknowledge={onAcknowledge}
            />
          ))}
        </div>
      )}

      {moderateSeverity.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: highSeverity.length > 0 ? '12px' : '0' }}>
          <h5 style={{ color: 'var(--mm-moderate-text, #986300)', margin: '0 0 4px 0', fontSize: '14px', fontWeight: 700 }}>
            ⚠️ Moderate Interactions ({moderateSeverity.length})
          </h5>
          {moderateSeverity.map((assessment) => (
            <InteractionCard
              key={assessment.assessment_id}
              assessment={assessment}
              isProfessional={isProfessional}
              onAcknowledge={onAcknowledge}
            />
          ))}
        </div>
      )}

      {lowSeverity.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: (highSeverity.length > 0 || moderateSeverity.length > 0) ? '12px' : '0' }}>
          <h5 style={{ color: 'var(--mm-low-text, #087f70)', margin: '0 0 4px 0', fontSize: '14px', fontWeight: 700 }}>
            ℹ️ Low Severity &amp; Advisory ({lowSeverity.length})
          </h5>
          {lowSeverity.map((assessment) => (
            <InteractionCard
              key={assessment.assessment_id}
              assessment={assessment}
              isProfessional={isProfessional}
              onAcknowledge={onAcknowledge}
            />
          ))}
        </div>
      )}
    </div>
  );
}
