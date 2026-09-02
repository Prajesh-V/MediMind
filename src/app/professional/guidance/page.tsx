'use client';

import { ContentCard } from '@/components/cards/ContentCard';
import { EmptyState } from '@/components/feedback/EmptyState';

export default function GuidancePage() {
  return (
    <section>
      <ContentCard title="Guidance Review">
        <EmptyState
          icon="🍽"
          message="No guidance rules pending review."
        />
      </ContentCard>
    </section>
  );
}
