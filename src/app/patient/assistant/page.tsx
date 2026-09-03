'use client';

import React from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Surface } from '@/components/ui/Surface';
import { ChatAssistant } from '@/components/chat/ChatAssistant';

export default function AssistantPage() {
  return (
    <section>
      <PageHeader 
        title="AI Assistant"
        subtitle="Ask MediMind about your medications, food, and safety information."
      />
      
      <Surface padding="none" style={{ maxWidth: '900px', margin: '0 auto', height: 'calc(100vh - 200px)' }}>
        <ChatAssistant />
      </Surface>
    </section>
  );
}
