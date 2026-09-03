import { createClient } from '@/utils/supabase/server';
import { ContentCard } from '@/components/cards/ContentCard';
import { ProfessionalRedemption } from '@/components/connections/ProfessionalRedemption';
import { ProfessionalPatientList } from '@/components/connections/ProfessionalPatientList';
import { ProfessionalHomeCalendar } from '@/components/professional/ProfessionalHomeCalendar';
import { getServerTranslation } from '@/i18n/server';
import styles from './page.module.css';

export default async function ProfessionalDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { t, locale } = await getServerTranslation();

  // Get total active patients for summary
  const { data: patients, error: patientErr } = await supabase
    .from('patient_professional_connections')
    .select('id')
    .eq('status', 'active');
  const patientCount = patientErr ? 0 : (patients?.length || 0);

  // Get active alerts for this professional's patients
  // RLS will automatically restrict this to alerts for patients this professional is connected to
  const { data: alerts, error: alertsErr } = await supabase
    .from('system_alerts')
    .select('id, title, priority, created_at, patients(first_name, last_name)')
    .eq('audience', 'PROFESSIONAL')
    .eq('status', 'ACTIVE')
    .order('created_at', { ascending: false })
    .limit(5);

  const activeAlerts = alertsErr ? [] : (alerts || []);

  const professionalName = user?.user_metadata?.first_name 
    ? `Dr. ${user.user_metadata.last_name || user.user_metadata.first_name}` 
    : 'Professional';

  return (
    <section>
      {/* A. Header */}
      <header style={{ marginBottom: 'var(--mm-space-6)', borderBottom: '1px solid var(--mm-border-divider)', paddingBottom: 'var(--mm-space-4)' }}>
        <h1 style={{ fontFamily: 'var(--mm-font-family-display)', fontSize: 'var(--mm-font-size-3xl)', fontWeight: 'normal', color: 'var(--mm-text-primary)', margin: 0 }}>
          {t('prof_greeting')} {professionalName}
        </h1>
        <h2 style={{ fontSize: 'var(--mm-font-size-lg)', color: 'var(--mm-text-secondary)', marginTop: 'var(--mm-space-2)', fontWeight: 'normal' }}>
          {t('prof_overview')}
        </h2>
      </header>

      {/* B. Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--mm-space-4)', marginBottom: 'var(--mm-space-6)' }}>
        <div style={{ background: 'var(--mm-bg-surface)', padding: 'var(--mm-space-4)', borderRadius: 'var(--mm-radius-lg)', border: '1px solid var(--mm-border-divider)' }}>
          <div style={{ fontSize: 'var(--mm-font-size-xs)', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--mm-text-muted)', fontWeight: 'bold' }}>{t('prof_patients_title')}</div>
          <div style={{ fontSize: 'var(--mm-font-size-4xl)', fontFamily: 'var(--mm-font-family-display)', color: 'var(--mm-text-primary)' }}>{patientCount}</div>
          <div style={{ fontSize: 'var(--mm-font-size-sm)', color: 'var(--mm-text-secondary)' }}>{t('prof_patients_desc')}</div>
        </div>
        <div style={{ background: 'var(--mm-bg-surface)', padding: 'var(--mm-space-4)', borderRadius: 'var(--mm-radius-lg)', border: '1px solid var(--mm-border-divider)' }}>
          <div style={{ fontSize: 'var(--mm-font-size-xs)', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--mm-text-muted)', fontWeight: 'bold' }}>{t('prof_alerts_title')}</div>
          <div style={{ fontSize: 'var(--mm-font-size-4xl)', fontFamily: 'var(--mm-font-family-display)', color: activeAlerts.length > 0 ? 'var(--mm-semantic-warning-text)' : 'var(--mm-text-primary)' }}>{activeAlerts.length}</div>
          <div style={{ fontSize: 'var(--mm-font-size-sm)', color: 'var(--mm-text-secondary)' }}>{t('prof_alerts_desc')}</div>
        </div>
      </div>

      <div className={styles.sectionGrid} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 'var(--mm-space-6)', marginBottom: 'var(--mm-space-6)' }}>
        {/* D. Medication Adherence Calendar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--mm-space-4)' }}>
          <ContentCard title={t('prof_med_adherence')}>
            <ProfessionalHomeCalendar />
          </ContentCard>
          
          {/* E. Quick Patient List */}
          <ContentCard title={t('prof_patients_title')}>
            <ProfessionalPatientList />
          </ContentCard>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--mm-space-4)' }}>
          {/* C. Add Patient */}
          <ContentCard title={t('prof_add_patient')}>
            <div style={{ marginBottom: 'var(--mm-space-4)', fontSize: 'var(--mm-font-size-sm)', color: 'var(--mm-text-secondary)' }}>
              {t('prof_enter_code')}
            </div>
            <ProfessionalRedemption />
          </ContentCard>

          {/* F. Alerts */}
          <ContentCard title={t('prof_active_alerts')}>
            {activeAlerts.length === 0 ? (
              <p style={{ color: 'var(--mm-text-muted)', fontStyle: 'italic', fontSize: 'var(--mm-font-size-sm)' }}>{t('prof_no_alerts')}</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--mm-space-3)' }}>
                {activeAlerts.map((alert: any) => (
                  <li key={alert.id} style={{ padding: 'var(--mm-space-3)', background: 'var(--mm-bg-surface-alt)', border: '1px solid var(--mm-border-divider)', borderRadius: 'var(--mm-radius-sm)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--mm-space-2)' }}>
                      <span style={{ fontWeight: 600, color: 'var(--mm-text-primary)' }}>{alert.title}</span>
                      <span style={{ fontSize: 'var(--mm-font-size-xs)', padding: '2px 6px', borderRadius: '4px', background: alert.priority === 'CRITICAL' ? 'var(--mm-semantic-critical-bg-subtle)' : 'var(--mm-semantic-warning-bg-subtle)', color: alert.priority === 'CRITICAL' ? 'var(--mm-semantic-critical-text)' : 'var(--mm-semantic-warning-text)' }}>
                        {alert.priority}
                      </span>
                    </div>
                    {alert.patients && (
                      <div style={{ fontSize: 'var(--mm-font-size-sm)', color: 'var(--mm-text-secondary)' }}>
                        {t('prof_patient_label')} {alert.patients.first_name} {alert.patients.last_name}
                      </div>
                    )}
                    <div style={{ fontSize: 'var(--mm-font-size-xs)', color: 'var(--mm-text-muted)', marginTop: 'var(--mm-space-1)' }}>
                      {new Date(alert.created_at).toLocaleString(locale === 'en' ? 'en-US' : `${locale}-IN`)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </ContentCard>
        </div>
      </div>
    </section>
  );
}
