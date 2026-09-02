'use client';

import { useTranslation } from '@/i18n';
import { ContentCard } from '@/components/cards/ContentCard';
import { EmptyState } from '@/components/feedback/EmptyState';

export default function GuidancePage() {
  const { t } = useTranslation();

  return (
    <section>
      <ContentCard title="Personalized Food &amp; Administration Guidance">
        <EmptyState icon="🍽" message={t('no_guidance')} />
      </ContentCard>
    </section>
  );
}
