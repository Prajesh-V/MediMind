import styles from './StatCard.module.css';

interface StatCardProps {
  icon: string;
  value: number | string;
  label: string;
}

export function StatCard({ icon, value, label }: StatCardProps) {
  return (
    <div className={styles.stat}>
      <div className={styles.icon} aria-hidden="true">{icon}</div>
      <div className={styles.value}>{value}</div>
      <div className={styles.label}>{label}</div>
    </div>
  );
}
