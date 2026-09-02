'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslation, LOCALE_LABELS, type Locale } from '@/i18n';
import styles from './Sidebar.module.css';

export type NavItem = {
  key: string;
  icon: string;
  labelKey: string;
  href: string;
};

interface SidebarProps {
  role: 'patient' | 'professional';
  navItems: NavItem[];
  onClose?: () => void;
}

export function Sidebar({ role, navItems, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { t, locale, setLocale } = useTranslation();

  const isActive = (href: string) => {
    if (href === `/${role}`) return pathname === `/${role}`;
    return pathname.startsWith(href);
  };

  return (
    <aside className={styles.sidebar} role="navigation" aria-label="Main navigation">
      <div className={styles.logo}>
        <div className={styles.logoText}>
          Medi<span className={styles.logoAccent}>Mind</span>
        </div>
        <div className={styles.tagline}>AI Healthcare Companion</div>
      </div>

      {onClose && (
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close navigation">
          ✕
        </button>
      )}

      <div className={styles.roleBox}>
        <b className={styles.roleName}>
          {role === 'patient' ? t('patient') : t('professional')}
        </b>
        <span className={styles.roleDesc}>
          {role === 'patient' ? t('role_patient_workspace') : t('role_pro_workspace')}
        </span>
      </div>

      <nav>
        {navItems.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className={`${styles.navItem} ${isActive(item.href) ? styles.active : ''}`}
            onClick={onClose}
          >
            <span aria-hidden="true">{item.icon}</span> {t(item.labelKey)}
          </Link>
        ))}
      </nav>

      <div className={styles.languageBox}>
        <label htmlFor="sidebar-lang" className={styles.langLabel}>
          🌐 {t('language_label')}
        </label>
        <select
          id="sidebar-lang"
          className={styles.langSelect}
          value={locale}
          onChange={(e) => setLocale(e.target.value as Locale)}
        >
          {Object.entries(LOCALE_LABELS).map(([code, name]) => (
            <option key={code} value={code}>{name}</option>
          ))}
        </select>
      </div>

      <Link href="/" className={styles.logout}>
        {t('logout')}
      </Link>
    </aside>
  );
}
