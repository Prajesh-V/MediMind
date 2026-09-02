import styles from './DataTable.module.css';
import type { ReactNode } from 'react';

interface DataTableProps {
  children: ReactNode;
}

export function DataTable({ children }: DataTableProps) {
  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        {children}
      </table>
    </div>
  );
}
