'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '@/i18n';
import { ContentCard } from '@/components/cards/ContentCard';
import { EmptyState } from '@/components/feedback/EmptyState';
import { InteractionList } from '@/components/interactions/InteractionList';
import { getPatientAssessments } from '@/app/actions/interactions';
import { getPatientAdministrationGuidance, MedicationAdministrationGuidance } from '@/app/actions/guidance';
import type { InteractionAssessment } from '@/services/medical/types';

export default function GuidancePage() {
  const { t } = useTranslation();
  const [foodInteractions, setFoodInteractions] = useState<InteractionAssessment[]>([]);
  const [administrationGuidance, setAdministrationGuidance] = useState<MedicationAdministrationGuidance[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGuidanceData = useCallback(async () => {
    setLoading(true);
    try {
      const [assessments, adminGuidance] = await Promise.all([
        getPatientAssessments(),
        getPatientAdministrationGuidance()
      ]);
      
      setFoodInteractions(assessments.filter(a => a.interaction_type === 'medication-food'));
      setAdministrationGuidance(adminGuidance);
    } catch (err) {
      console.error('Error fetching guidance:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGuidanceData();
  }, [fetchGuidanceData]);

  // Helper to get a human readable version of food_relation
  const formatFoodRelation = (relation: string) => {
    const map: Record<string, string> = {
      'no_relation': 'No relation to food',
      'before_meal': 'Take before a meal',
      'with_meal': 'Take with a meal',
      'after_meal': 'Take after a meal',
      'empty_stomach': 'Take on an empty stomach'
    };
    return map[relation] || relation;
  };

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <ContentCard title="🥗 Food Interactions">
        {loading ? (
          <p style={{ color: 'var(--mm-text-secondary)', fontSize: '14px' }}>Loading active food interactions...</p>
        ) : foodInteractions.length === 0 ? (
          <EmptyState message="No active food interactions detected based on your current medications and dietary log." />
        ) : (
          <InteractionList assessments={foodInteractions} />
        )}
      </ContentCard>

      <ContentCard title="📋 Administration Guidance">
        {loading ? (
          <p style={{ color: 'var(--mm-text-secondary)', fontSize: '14px' }}>Loading administration guidance...</p>
        ) : administrationGuidance.length === 0 ? (
          <EmptyState icon="🍽" message="No specific administration guidance available for your active medications." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {administrationGuidance.map((med) => {
              const hasNoSpecifics = med.food_relation === 'no_relation' && !med.administration_instructions && med.separation_rules.length === 0;

              return (
                <div key={med.medication_id} style={{
                  padding: '16px',
                  borderRadius: 'var(--mm-radius-md)',
                  background: 'var(--mm-bg-surface)',
                  border: '1px solid var(--mm-border-default)'
                }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '16px', color: 'var(--mm-text-primary)' }}>
                    {med.display_name}
                  </h4>
                  
                  {hasNoSpecifics ? (
                    <p style={{ margin: 0, fontSize: '14px', color: 'var(--mm-text-secondary)' }}>
                      No specific food administration instructions.
                    </p>
                  ) : (
                    <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--mm-text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {med.food_relation !== 'no_relation' && (
                        <li><strong>Timing:</strong> {formatFoodRelation(med.food_relation)}</li>
                      )}
                      
                      {med.administration_instructions && (
                        <li><strong>Instructions:</strong> {med.administration_instructions}</li>
                      )}
                      
                      {med.separation_rules.map((rule) => (
                        <li key={rule.rule_key} style={{ color: 'var(--mm-semantic-warning-text)' }}>
                          <strong>Separation Requirement:</strong> {rule.recommendation} ({rule.mechanism})
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </ContentCard>
    </section>
  );
}
