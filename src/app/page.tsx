'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslation, LOCALE_LABELS, type Locale } from '@/i18n';
import { createClient } from '@/utils/supabase/client';
import styles from './page.module.css';

type Role = 'patient' | 'professional';

export default function LoginPage() {
  const router = useRouter();
  const { t, locale, setLocale } = useTranslation();
  const [selectedRole, setSelectedRole] = useState<Role>('patient');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const supabase = createClient();

  const handleAuth = async (mode: 'login' | 'signup') => {
    if (!email || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }
    if (mode === 'signup' && (!firstName || !lastName)) {
      setErrorMsg('Please enter your first and last name.');
      return;
    }
    
    setLoading(true);
    setErrorMsg('');

    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { 
              role: selectedRole,
              first_name: firstName,
              last_name: lastName
            }
          }
        });
        
        if (error) throw error;
        
        if (data.session) {
          router.push(`/${selectedRole}`);
        } else {
          setErrorMsg('Sign up successful! Please check your email to verify your account.');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        
        if (error) throw error;
        
        // We route to the selected role for now, but ideally we'd check their actual role in the DB
        router.push(`/${selectedRole}`);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className={styles.loginPage}>
      <div className={styles.container}>
        {/* Left panel — branding */}
        <div className={styles.left}>
          <div className={styles.logo}>
            Medi<span>Mind</span>
          </div>
          <div className={styles.tagline}>
            AI-Assisted Personalized Medication &amp; Healthcare Companion
          </div>
          <div className={styles.hero}>
            <h1>
              Smarter medication.<br />
              Safer decisions.
            </h1>
            <p>
              A personalized healthcare companion that connects prescriptions,
              medication schedules, food intake, drug-food interactions,
              adherence and professional monitoring.
            </p>
            <div className={styles.aiBadge}>✦ AI-Assisted Medication Intelligence</div>
          </div>
          <div className={styles.circle} aria-hidden="true" />
        </div>

        {/* Right panel — form */}
        <div className={styles.right}>
          <h2>{t('login_title')}</h2>
          <p className={styles.subtitle}>{t('login_subtitle')}</p>

          <div className={styles.languageBox}>
            <label htmlFor="login-lang">🌐 {t('language_label')}</label>
            <select
              id="login-lang"
              value={locale}
              onChange={(e) => setLocale(e.target.value as Locale)}
            >
              {Object.entries(LOCALE_LABELS).map(([code, name]) => (
                <option key={code} value={code}>{name}</option>
              ))}
            </select>
          </div>

          <div className={styles.roleSelector} role="radiogroup" aria-label="Select role">
            <button
              className={`${styles.role} ${selectedRole === 'patient' ? styles.roleActive : ''}`}
              onClick={() => setSelectedRole('patient')}
              role="radio"
              aria-checked={selectedRole === 'patient'}
              type="button"
            >
              <div className={styles.roleIcon} aria-hidden="true">👤</div>
              <strong>{t('patient')}</strong>
              <small>{t('role_patient_desc')}</small>
            </button>
            <button
              className={`${styles.role} ${selectedRole === 'professional' ? styles.roleActive : ''}`}
              onClick={() => setSelectedRole('professional')}
              role="radio"
              aria-checked={selectedRole === 'professional'}
              type="button"
            >
              <div className={styles.roleIcon} aria-hidden="true">🩺</div>
              <strong>{t('professional')}</strong>
              <small>{t('role_pro_desc')}</small>
            </button>
          </div>

          <div className={styles.field}>
            <label htmlFor="login-fname">{t('first_name_label') || 'First Name'}</label>
            <input 
              id="login-fname" 
              placeholder="First Name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="login-lname">{t('last_name_label') || 'Last Name'}</label>
            <input 
              id="login-lname" 
              placeholder="Last Name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="login-id">{t('login_email_label')}</label>
            <input 
              id="login-id" 
              placeholder={t('login_email_placeholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="login-pass">{t('login_password_label')}</label>
            <input 
              id="login-pass" 
              type="password" 
              placeholder={t('login_password_placeholder')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          
          {errorMsg && <p style={{ color: 'var(--mm-high-text)', fontSize: '14px', marginBottom: '10px' }}>{errorMsg}</p>}

          <button
            className={styles.primaryBtn}
            onClick={() => handleAuth('login')}
            type="button"
            disabled={loading}
          >
            {loading ? 'Processing...' : t('login_continue')}
          </button>
          
          <button
            className={styles.secondaryBtn}
            onClick={() => handleAuth('signup')}
            type="button"
            disabled={loading}
            style={{ width: '100%', marginTop: '10px', background: 'transparent', border: '1px solid var(--mm-border-input)', padding: '14px', borderRadius: 'var(--mm-radius-base)', cursor: 'pointer', fontWeight: 'bold' }}
          >
            Sign Up
          </button>

          <p className={styles.demoNote}>M2: Supabase Email/Password Auth Enabled</p>
        </div>
      </div>
    </section>
  );
}
