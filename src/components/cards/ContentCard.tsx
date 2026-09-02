import styles from './ContentCard.module.css';
import type { ReactNode } from 'react';

interface ContentCardProps {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function ContentCard({ title, action, children, className }: ContentCardProps) {
  return (
    <div className={`${styles.card} ${className ?? ''}`}>
      {(title || action) && (
        <div className={styles.header}>
          {title && <h2 className={styles.title}>{title}</h2>}
          {action && <span className={styles.action}>{action}</span>}
        </div>
      )}
      {children}
    </div>
  );
}
