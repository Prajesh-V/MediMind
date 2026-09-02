import styles from './Timeline.module.css';
import type { ReactNode } from 'react';

interface TimelineEvent {
  id: string;
  content: ReactNode;
}

interface TimelineProps {
  events: TimelineEvent[];
}

export function Timeline({ events }: TimelineProps) {
  if (events.length === 0) return null;

  return (
    <div className={styles.timeline} role="list">
      {events.map((event) => (
        <div key={event.id} className={styles.event} role="listitem">
          {event.content}
        </div>
      ))}
    </div>
  );
}
