'use client';

import { ContentCard } from '@/components/cards/ContentCard';
import { EmptyState } from '@/components/feedback/EmptyState';
import { useTranslation } from '@/i18n';

export default function SafetyPage() {
  const { t } = useTranslation();
  return (
    <section>
      <ContentCard title="Safety Reports Review">
        <EmptyState
          icon="⚕"
          message={t('no_safety_reports')}
        />
      </ContentCard>
    </section>
  );
}
