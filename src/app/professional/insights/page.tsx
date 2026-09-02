'use client';

import { ContentCard } from '@/components/cards/ContentCard';
import { EmptyState } from '@/components/feedback/EmptyState';
import { useTranslation } from '@/i18n';

export default function InsightsPage() {
  const { t } = useTranslation();
  return (
    <section>
      <ContentCard title="AI Clinical Insights">
        <EmptyState
          icon="✦"
          message={t('no_insights')}
        />
      </ContentCard>
    </section>
  );
}
