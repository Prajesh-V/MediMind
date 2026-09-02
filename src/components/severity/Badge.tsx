import styles from './Badge.module.css';

type Severity = 'high' | 'moderate' | 'low' | 'neutral';

interface BadgeProps {
  severity: Severity;
  children: React.ReactNode;
}

export function Badge({ severity, children }: BadgeProps) {
  return (
    <span className={`${styles.badge} ${styles[severity]}`}>
      {children}
    </span>
  );
}
