'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslation } from '@/i18n';
import * as LucideIcons from 'lucide-react';
import styles from './Sidebar.module.css';

export type NavItem = {
  key: string;
  icon: string;
  labelKey: string;
  href: string;
  group?: string;
};

interface SidebarProps {
  role: 'patient' | 'professional';
  navItems: NavItem[];
  isCollapsed?: boolean;
  onClose?: () => void;
}

export function Sidebar({ role, navItems, isCollapsed = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { t } = useTranslation();

  const isActive = (href: string) => {
    if (href === `/${role}`) return pathname === `/${role}`;
    return pathname.startsWith(href);
  };

  // Group items
  const groupedItems = navItems.reduce((acc, item) => {
    const group = item.group || 'GENERAL';
    if (!acc[group]) acc[group] = [];
    acc[group].push(item);
    return acc;
  }, {} as Record<string, NavItem[]>);

  return (
    <aside 
      className={`${styles.sidebar} ${isCollapsed ? styles.collapsed : ''}`} 
      role="navigation" 
      aria-label="Main navigation"
    >
      <div className={styles.logo}>
        {isCollapsed ? (
          <div className={styles.logoTextMini}>M<span className={styles.logoAccent}>M</span></div>
        ) : (
          <>
            <div className={styles.logoText}>
              Medi<span className={styles.logoAccent}>Mind</span>
            </div>
            <div className={styles.tagline}>AI Healthcare Companion</div>
          </>
        )}
      </div>

      {onClose && (
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close navigation">
          <LucideIcons.X size={20} />
        </button>
      )}

      {!isCollapsed && (
        <div className={styles.roleBox}>
          <b className={styles.roleName}>
            {role === 'patient' ? t('patient') : t('professional')}
          </b>
          <span className={styles.roleDesc}>
            {role === 'patient' ? t('role_patient_workspace') : t('role_pro_workspace')}
          </span>
        </div>
      )}

      <nav className={styles.navContent}>
        {Object.entries(groupedItems).map(([group, items]) => (
          <div key={group} className={styles.navGroup}>
            {!isCollapsed && <div className={styles.eyebrow}>{group}</div>}
            
            {items.map((item) => {
              const IconComponent = (LucideIcons as any)[item.icon] || LucideIcons.Circle;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={`${styles.navItem} ${active ? styles.active : ''}`}
                  onClick={onClose}
                  title={isCollapsed ? t(item.labelKey) : undefined}
                >
                  <IconComponent size={20} className={styles.icon} aria-hidden="true" />
                  {!isCollapsed && <span className={styles.label}>{t(item.labelKey)}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
