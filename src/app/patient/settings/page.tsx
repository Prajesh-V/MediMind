'use client'

import { useTranslation, LOCALE_LABELS, type Locale } from '@/i18n';
import { useTheme } from '@/theme/ThemeContext';
import { ContentCard } from '@/components/cards/ContentCard';
import { PatientConnections } from '@/components/connections/PatientConnections';
import styles from './page.module.css';

export default function SettingsPage() {
  const { t, locale, setLocale } = useTranslation();
  const { theme, toggleTheme } = useTheme();

  return (
    <section>
      <ContentCard title="Professional Connections">
        <PatientConnections />
      </ContentCard>

      <ContentCard title={t('settings')}>
        <div className={styles.settingsGrid}>
          {/* Appearance */}
          <div className={styles.settingsSection}>
            <h3 className={styles.sectionTitle}>{t('settings_appearance')}</h3>

            <div className={styles.settingRow}>
              <div>
                <strong>{t('settings_dark_mode')}</strong>
                <small>Toggle dark theme</small>
              </div>
              <label className={styles.toggle}>
                <input
                  type="checkbox"
                  checked={theme === 'dark'}
                  onChange={toggleTheme}
                  aria-label={t('settings_dark_mode')}
                />
                <span className={styles.slider} />
              </label>
            </div>

            <div className={styles.settingRow}>
              <div>
                <strong>{t('settings_font_scale')}</strong>
                <small>Adjust text size (100%–140%)</small>
              </div>
              <div className={styles.fontScaleControl}>
                <input
                  type="range"
                  min={100}
                  max={140}
                  step={5}
                  defaultValue={100}
                  aria-label={t('settings_font_scale')}
                  className={styles.rangeInput}
                  disabled
                />
                <span className={styles.fontScaleValue}>100%</span>
              </div>
            </div>
          </div>

          {/* Language */}
          <div className={styles.settingsSection}>
            <h3 className={styles.sectionTitle}>{t('settings_language')}</h3>
            <div className={styles.settingRow}>
              <div>
                <strong>{t('language_label')}</strong>
                <small>Choose your preferred language</small>
              </div>
              <select
                value={locale}
                onChange={(e) => setLocale(e.target.value as Locale)}
                className={styles.langSelect}
                aria-label={t('language_label')}
              >
                {Object.entries(LOCALE_LABELS).map(([code, name]) => (
                  <option key={code} value={code}>{name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Notifications */}
          <div className={styles.settingsSection}>
            <h3 className={styles.sectionTitle}>{t('settings_notifications')}</h3>

            {[
              { key: 'settings_med_reminders', label: t('settings_med_reminders') },
              { key: 'settings_reminder_sound', label: t('settings_reminder_sound') },
              { key: 'settings_reminder_vibration', label: t('settings_reminder_vibration') },
              { key: 'settings_food_alerts', label: t('settings_food_alerts') },
            ].map((item) => (
              <div key={item.key} className={styles.settingRow}>
                <div>
                  <strong>{item.label}</strong>
                  <small>Available after account setup</small>
                </div>
                <label className={styles.toggle}>
                  <input type="checkbox" disabled aria-label={item.label} />
                  <span className={styles.slider} />
                </label>
              </div>
            ))}
          </div>
        </div>
      </ContentCard>
    </section>
  );
}
