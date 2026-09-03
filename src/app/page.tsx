'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslation, LOCALE_LABELS, type Locale } from '@/i18n';
import { createClient } from '@/utils/supabase/client';
import { Button } from '@/components/forms/Button';
import { FormField } from '@/components/forms/FormField';
import styles from './page.module.css';

type Role = 'patient' | 'professional';
type ViewState = 'login' | 'signup';

export default function LoginPage() {
  const router = useRouter();
  const { t, locale, setLocale } = useTranslation();
  const [view, setView] = useState<ViewState>('login');
  
  // Shared state
  const [selectedRole, setSelectedRole] = useState<Role>('patient');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Signup only state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      router.push(`/${selectedRole}`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Invalid login credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !firstName || !lastName) {
      setErrorMsg('Please complete all fields to sign up.');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
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
        setSuccessMsg('Account created! Please check your email to verify.');
        setView('login');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred during sign up.');
    } finally {
      setLoading(false);
    }
  };

  const switchView = (newView: ViewState) => {
    setView(newView);
    setErrorMsg('');
    setSuccessMsg('');
    setPassword('');
  };

  return (
    <section className={styles.loginPage}>
      <div className={styles.container}>
        {/* Left panel — branding */}
        <div className={styles.leftPanel}>
          <div className={styles.brandHeader}>
            <div className={styles.logo}>
              Medi<span className={styles.logoAccent}>Mind</span>
            </div>
            <div className={styles.tagline}>
              AI Healthcare Companion
            </div>
          </div>
          
          <div className={styles.heroContent}>
            <h1 className={styles.heroTitle}>
              Smarter medication.<br />
              Safer decisions.
            </h1>
            <p className={styles.heroDesc}>
              A personalized healthcare companion connecting prescriptions,
              schedules, adherence, and professional monitoring through 
              advanced clinical intelligence.
            </p>
            <div className={styles.aiBadge}>
              <span className={styles.badgeIcon}>✦</span> Clinical Intelligence
            </div>
          </div>
          <div className={styles.ambientGraphic} aria-hidden="true" />
        </div>

        {/* Right panel — form */}
        <div className={styles.rightPanel}>
          <div className={styles.formHeader}>
            <h2 className={styles.formTitle}>
              {view === 'login' ? 'Sign In to MediMind' : 'Create your account'}
            </h2>
            <p className={styles.formSubtitle}>
              {view === 'login' 
                ? 'Welcome back. Please enter your details.' 
                : 'Join MediMind as a patient or healthcare professional.'}
            </p>
          </div>

          {errorMsg && (
            <div className={styles.errorAlert} role="alert">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className={styles.successAlert} role="status">
              {successMsg}
            </div>
          )}

          <div className={styles.roleToggleGroup} role="radiogroup" aria-label="Select role">
            <button
              type="button"
              className={`${styles.roleToggle} ${selectedRole === 'patient' ? styles.roleToggleActive : ''}`}
              onClick={() => setSelectedRole('patient')}
              role="radio"
              aria-checked={selectedRole === 'patient'}
            >
              Patient
            </button>
            <button
              type="button"
              className={`${styles.roleToggle} ${selectedRole === 'professional' ? styles.roleToggleActive : ''}`}
              onClick={() => setSelectedRole('professional')}
              role="radio"
              aria-checked={selectedRole === 'professional'}
            >
              Professional
            </button>
          </div>

          <form 
            className={styles.authForm} 
            onSubmit={view === 'login' ? handleLogin : handleSignup}
          >
            {view === 'signup' && (
              <div className={styles.nameRow}>
                <FormField
                  id="fname"
                  label="First Name"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  disabled={loading}
                  required
                />
                <FormField
                  id="lname"
                  label="Last Name"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>
            )}

            <FormField
              id="email"
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
            />

            <FormField
              id="password"
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
            />

            <Button
              variant="primary"
              type="submit"
              disabled={loading}
              style={{ marginTop: 'var(--mm-space-2)' }}
            >
              {loading ? (
                <span className={styles.spinner} />
              ) : (
                view === 'login' ? 'Sign In' : 'Create Account'
              )}
            </Button>
          </form>

          <div className={styles.formFooter}>
            {view === 'login' ? (
              <p>
                Don&apos;t have an account?{' '}
                <button type="button" className={styles.textBtn} onClick={() => switchView('signup')}>
                  Sign up
                </button>
              </p>
            ) : (
              <p>
                Already have an account?{' '}
                <button type="button" className={styles.textBtn} onClick={() => switchView('login')}>
                  Sign in
                </button>
              </p>
            )}
            
            <div className={styles.footerControls}>
              <div className={styles.langSelectWrapper}>
                <label htmlFor="lang-select" className={styles.srOnly}>Select Language</label>
                <select
                  id="lang-select"
                  className={styles.langSelect}
                  value={locale}
                  onChange={(e) => setLocale(e.target.value as Locale)}
                >
                  {Object.entries(LOCALE_LABELS).map(([code, name]) => (
                    <option key={code} value={code}>{name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
