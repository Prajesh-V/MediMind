'use client';

import { useState, useEffect } from 'react';

import { useTranslation } from '@/i18n';
import styles from './TopBar.module.css';

interface TopBarProps {
  role: 'patient' | 'professional';
  onMenuToggle?: () => void;
}

export function TopBar({ role, onMenuToggle }: TopBarProps) {
  const { t } = useTranslation();
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
  const subtitle = role === 'patient' ? t('subtitle_patient') : t('subtitle_pro');
  const avatarLetter = profile ? profile.first_name.charAt(0).toUpperCase() : (role === 'patient' ? 'P' : 'H');
  const profileLabel = profile ? `${profile.first_name} ${profile.last_name}` : (role === 'patient' ? t('patient') : t('professional'));

  return (
    <div className={styles.topbar}>
      <div className={styles.left}>
        {onMenuToggle && (
          <button
            className={styles.menuBtn}
            onClick={onMenuToggle}
            aria-label="Open navigation"
          >
            ☰
          </button>
        )}
        <div className={styles.welcome}>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.subtitle}>{subtitle}</p>
        </div>
      </div>

      <div className={styles.actions}>
        <span className={styles.devBadge}>{t('dev_preview_badge')}</span>
        <div className={styles.profile}>
          <div>
            <strong className={styles.profileName}>{profileLabel}</strong>
            <small className={styles.profileSub}>MediMind profile</small>
          </div>
          <div className={styles.avatar} aria-hidden="true">{avatarLetter}</div>
        </div>
      </div>
    </div>
  );
}
