'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Moon, Sun, LogOut, PanelLeftClose, PanelLeftOpen, Menu } from 'lucide-react';
import { useTranslation, LOCALE_LABELS, type Locale } from '@/i18n';
import { useTheme } from '@/theme/ThemeContext';
import styles from './TopBar.module.css';

interface TopBarProps {
  role: 'patient' | 'professional';
  isCollapsed?: boolean;
  onMenuToggle?: () => void;
  onDesktopToggle?: () => void;
}

export function TopBar({ role, isCollapsed, onMenuToggle, onDesktopToggle }: TopBarProps) {
  const { t, locale, setLocale } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    async function loadProfile() {
      try {
        const { createClient } = await import('@/utils/supabase/client');
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          const table = role === 'patient' ? 'patients' : 'professionals';
          const { data } = await supabase.from(table).select('first_name, last_name').eq('id', user.id).single();
          if (data) setProfile(data);
        }
      } catch (e) {
        console.error('Failed to load profile for TopBar', e);
      }
    }
    loadProfile();
  }, [role]);

  const defaultTitle = role === 'patient' ? t('welcome_patient') : t('welcome_pro');
  const title = profile ? `Good morning, ${profile.first_name}` : defaultTitle;
  const avatarLetter = profile ? profile.first_name.charAt(0).toUpperCase() : (role === 'patient' ? 'P' : 'H');
  const profileLabel = profile ? `${profile.first_name} ${profile.last_name}` : (role === 'patient' ? t('patient') : t('professional'));

  return (
    <div className={styles.topbar}>
      <div className={styles.left}>
        {onMenuToggle && (
          <button
            className={`${styles.menuBtn} ${styles.mobileToggle}`}
            onClick={onMenuToggle}
            aria-label="Open mobile navigation"
          >
            <Menu size={24} />
          </button>
        )}
        {onDesktopToggle && (
          <button
            className={`${styles.menuBtn} ${styles.desktopToggle}`}
            onClick={onDesktopToggle}
            aria-label={isCollapsed ? "Expand navigation" : "Collapse navigation"}
            title={isCollapsed ? "Expand navigation" : "Collapse navigation"}
          >
            {isCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
          </button>
        )}
        <div className={styles.welcome}>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.subtitle}>{profileLabel}</p>
        </div>
      </div>

      <div className={styles.right}>
        <div className={styles.controls}>
          <select
            className={styles.langSelect}
            value={locale}
            onChange={(e) => setLocale(e.target.value as Locale)}
            aria-label="Language selector"
            title={t('language_label')}
          >
            {Object.entries(LOCALE_LABELS).map(([code, name]) => (
              <option key={code} value={code}>{name}</option>
            ))}
          </select>

          <button 
            onClick={toggleTheme} 
            className={styles.iconBtn} 
            aria-label="Toggle theme"
            title="Toggle Theme"
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>

          <Link 
            href="/" 
            className={styles.iconBtn} 
            aria-label="Log out"
            title={t('logout')}
          >
            <LogOut size={20} />
          </Link>
        </div>
        
        <div className={styles.avatar} aria-hidden="true">{avatarLetter}</div>
      </div>
    </div>
  );
}
