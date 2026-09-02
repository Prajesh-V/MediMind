import styles from './EmptyState.module.css';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  message: string;
  icon?: string;
  action?: ReactNode;
}

export function EmptyState({ message, icon, action }: EmptyStateProps) {
  return (
    <div className={styles.empty} role="status">
      {icon && <div className={styles.icon} aria-hidden="true">{icon}</div>}
      <p className={styles.message}>{message}</p>
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
