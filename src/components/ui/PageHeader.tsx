'use client';

import React from 'react';
import styles from './ui.module.css';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className={styles.pageHeader}>
      <div className={styles.headerContent}>
        <h1 className={styles.title}>{title}</h1>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      {actions && (
        <div className={styles.actions}>
          {actions}
        </div>
      )}
    </div>
  );
}
