'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '@/i18n';
import { ContentCard } from '@/components/cards/ContentCard';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Button } from '@/components/forms/Button';
import { FoodIntakeManager } from '@/components/food/FoodIntakeManager';
import { InteractionList } from '@/components/interactions/InteractionList';
import { getPatientAssessments } from '@/app/actions/interactions';
import type { InteractionAssessment } from '@/services/medical/types';
import styles from './page.module.css';

export default function FoodPage() {
  const { t } = useTranslation();
  const [assessments, setAssessments] = useState<InteractionAssessment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAssessments = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getPatientAssessments();
      // Filter to food interactions specifically for this tab
      const foodInteractions = data.filter((a) => a.interaction_type === 'medication-food');
      setAssessments(foodInteractions);
    } catch (err) {
      console.error('Error fetching food interactions:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAssessments();
  }, [fetchAssessments]);

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Food & Drug Interaction Check */}
      <div className={styles.foodChecker}>
        <div className={styles.foodCheckerTitle}>
          <div>
            <h3>🥗 Food &amp; Drug Interaction Check</h3>
            <p>Active deterministic checks between confirmed dietary intake and your medications.</p>
          </div>
        </div>

        <div className={styles.checkResult} style={{ marginTop: '12px' }}>
          {loading ? (
            <p style={{ color: 'var(--mm-text-secondary)', fontSize: '13px' }}>
              Checking active medications against confirmed dietary intake...
            </p>
          ) : assessments.length === 0 ? (
            <EmptyState message="No drug-food interactions detected for your confirmed diet." />
          ) : (
            <InteractionList
              assessments={assessments}
              emptyMessage="No drug-food interactions detected."
            />
          )}
        </div>
      </div>

      <ContentCard title="Dietary Record & Vision Staging">
        <FoodIntakeManager />
      </ContentCard>
    </section>
  );
}
