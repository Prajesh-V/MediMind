'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, Moon, Sun, LogOut } from 'lucide-react';
import { useTranslation, LOCALE_LABELS, type Locale } from '@/i18n';
import { useTheme } from '@/theme/ThemeContext';
import styles from './PatientNavbar.module.css';
import type { NavItem } from './Sidebar';

interface PatientNavbarProps {
  navItems: NavItem[];
}

export function PatientNavbar({ navItems }: PatientNavbarProps) {
  const pathname = usePathname();
  const { t, locale, setLocale } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    async function loadProfile() {
      try {
        const { createClient } = await import('@/utils/supabase/client');
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data } = await supabase.from('patients').select('first_name, last_name').eq('id', user.id).single();
          if (data) setProfile(data);
        }
      } catch (e) {
        console.error('Failed to load profile for Navbar', e);
      }
    }
    loadProfile();
  }, []);

  // Close overlay on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Handle escape key and body scroll lock
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const avatarLetter = profile ? profile.first_name.charAt(0).toUpperCase() : 'P';

  return (
    <>
      <nav className={styles.navbar}>
        <div className={styles.left}>
          <Link href="/patient" className={styles.logoText}>
            MediMind
          </Link>
          <span className={styles.tagline}>AI Healthcare Companion</span>
        </div>

        <div className={styles.center}>
          {navItems.map(item => (
            <Link 
              key={item.key} 
              href={item.href}
              className={`${styles.navLink} ${pathname === item.href || pathname.startsWith(item.href + '/') ? styles.active : ''}`}
            >
              {t(item.labelKey)}
            </Link>
          ))}
        </div>

        <div className={styles.right}>
          <div className={styles.controls}>
            <select
              className={styles.langSelect}
              value={locale}
              onChange={(e) => setLocale(e.target.value as Locale)}
              aria-label="Language selector"
            >
              {Object.entries(LOCALE_LABELS).map(([code, name]) => (
                <option key={code} value={code}>{name}</option>
              ))}
            </select>

            <button 
              onClick={toggleTheme} 
              className={styles.iconBtn} 
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
          
          <div className={styles.avatar} aria-hidden="true">{avatarLetter}</div>

          <button 
            className={styles.mobileToggle}
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open navigation menu"
          >
            <Menu size={24} />
          </button>
        </div>
      </nav>

      {/* Full Screen Overlay for Mobile */}
      {mobileMenuOpen && (
        <div className={styles.mobileOverlay} role="dialog" aria-modal="true" aria-label="Mobile navigation">
          <div className={styles.overlayHeader}>
            <Link href="/patient" className={styles.logoText} onClick={() => setMobileMenuOpen(false)}>
              MediMind
            </Link>
            <button 
              className={styles.overlayCloseBtn}
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close navigation menu"
            >
              <X size={28} />
            </button>
          </div>

          <div className={styles.overlayNav}>
            {navItems.map(item => (
              <Link 
                key={item.key} 
                href={item.href}
                className={`${styles.overlayLink} ${pathname === item.href || pathname.startsWith(item.href + '/') ? styles.active : ''}`}
              >
                {t(item.labelKey)}
              </Link>
            ))}
          </div>

          <div className={styles.overlayFooter}>
            <div className={styles.overlayControls}>
              <select
                className={styles.langSelect}
                value={locale}
                onChange={(e) => setLocale(e.target.value as Locale)}
                aria-label="Language selector"
              >
                {Object.entries(LOCALE_LABELS).map(([code, name]) => (
                  <option key={code} value={code}>{name}</option>
                ))}
              </select>

              <button 
                onClick={toggleTheme} 
                className={styles.iconBtn} 
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
              </button>
            </div>
            
            <Link href="/" className={styles.iconBtn} aria-label="Log out" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <LogOut size={20} />
              <span style={{ fontSize: '13px', textTransform: 'uppercase', fontWeight: 600 }}>Log Out</span>
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
