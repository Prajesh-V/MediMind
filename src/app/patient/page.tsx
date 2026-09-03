'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from '@/i18n';
import Link from 'next/link';
import { Surface } from '@/components/ui/Surface';
import { Button } from '@/components/forms/Button';
import { BackgroundRippleEffect } from '@/components/ui/BackgroundRippleEffect';
import { Pill, ShieldAlert, Sparkles, Utensils, ChevronRight } from 'lucide-react';
import { getTodayDoses } from '@/app/actions/dose';
import { getPatientDietaryRecords } from '@/app/actions/intake';
import { getPatientAssessments } from '@/app/actions/interactions';
import { triggerAlertReconciliation, getPatientAlerts, PatientAlert, markAlertRead } from '@/app/actions/alerts';
import styles from './page.module.css';

export default function PatientDashboard() {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<any>(null);
  const [todayDoses, setTodayDoses] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<PatientAlert[]>([]);
  const [recentFood, setRecentFood] = useState<any[]>([]);
  const [assessments, setAssessments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const { createClient } = await import('@/utils/supabase/client');
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from('patients').select('first_name').eq('id', user.id).single();
        setProfile(data);
      }

      const doses = await getTodayDoses();
      setTodayDoses(doses.slice(0, 3)); 

      const diet = await getPatientDietaryRecords();
      setRecentFood(diet.slice(0, 2));

      const interactions = await getPatientAssessments();
      setAssessments(interactions);

      await triggerAlertReconciliation();
      const fetchedAlerts = await getPatientAlerts();
      setAlerts(fetchedAlerts);
    } catch (e) {
      console.error('Failed to load dashboard data', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const greeting = profile ? `Good morning, ${profile.first_name}.` : 'Good morning.';

  if (loading) {
    return (
      <div className={styles.loadingState}>
        <div className={styles.loadingSpinner} />
      </div>
    );
  }

  return (
    <div className={styles.workspaceContainer}>
      
      {/* 1. HERO & NEXT ACTION */}
      <section className={styles.heroSection}>
        <BackgroundRippleEffect />
        <div className={styles.heroContent}>
          <h1 className={styles.heroTitle}>{greeting}</h1>
          <p className={styles.heroSubtitle}>Here&apos;s what matters today.</p>
        </div>
      </section>

      <div className={styles.editorialGrid}>
        
        {/* Left / Main Editorial Column */}
        <div className={styles.mainColumn}>
          
          {/* 3. SAFETY WHEN RELEVANT */}
          {alerts.length > 0 && (
            <section className={styles.contentSection}>
              <h2 className={styles.sectionHeading}>Clinical Assessment</h2>
              <div className={styles.alertList}>
                {alerts.map(a => (
                  <Surface key={a.id} className={styles.safetySummary} variant="subtle" padding="md">
                    <div className={styles.safetyIconBox}>
                      <ShieldAlert size={20} />
                    </div>
                    <div className={styles.safetyContent}>
                      <h3 className={styles.safetyTitle}>{a.snapshot?.title}</h3>
                      <p className={styles.safetyDesc}>{a.snapshot?.summary}</p>
                      {!a.read_at && (
                        <button 
                          className={styles.editorialBtn}
                          onClick={async () => {
                            await markAlertRead(a.id);
                            loadData();
                          }}
                        >
                          Acknowledge Assessment
                        </button>
                      )}
                    </div>
                  </Surface>
                ))}
              </div>
            </section>
          )}

          {/* 4. MEDICATION PREVIEW */}
          <section className={styles.contentSection}>
            <div className={styles.sectionHeaderLine}>
              <h2 className={styles.sectionHeading}>Active Medications</h2>
              <Link href="/patient/medications" className={styles.sectionActionLink}>
                View all <ChevronRight size={16} />
              </Link>
            </div>
            
            {todayDoses.length > 0 ? (
              <ul className={styles.editorialList}>
                {todayDoses.map(dose => (
                  <li key={dose.id} className={styles.editorialListItem}>
                    <div className={styles.listIconBox}>
                      <Pill size={18} />
                    </div>
                    <div className={styles.listInfo}>
                      <span className={styles.listTitle}>{dose.patient_medications?.display_name || dose.medication_name || 'Unknown Medication'}</span>
                      <span className={styles.listMeta}>
                        {dose.scheduled_for ? new Date(dose.scheduled_for).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'As needed'}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className={styles.editorialEmpty}>
                <p>No doses scheduled for today.</p>
              </div>
            )}
          </section>

          {/* 5. FOOD & GUIDANCE */}
          {recentFood.length > 0 && (
            <section className={styles.contentSection}>
              <div className={styles.sectionHeaderLine}>
                <h2 className={styles.sectionHeading}>Recent Intake</h2>
                <Link href="/patient/food" className={styles.sectionActionLink}>
                  History <ChevronRight size={16} />
                </Link>
              </div>
              {recentFood.length > 0 ? (
                <ul className={styles.editorialList}>
                  {recentFood.map(f => (
                    <li key={f.id} className={styles.editorialListItem}>
                      <div className={styles.listIconBox}>
                        <Utensils size={18} />
                      </div>
                      <div className={styles.listInfo}>
                        <span className={styles.listTitle}>{f.component_name}</span>
                        <span className={styles.listMeta}>
                          {new Date(f.consumed_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          )}
        </div>

        {/* Right / Secondary Context Column */}
        <div className={styles.sideColumn}>
          {/* 6. AI ASSISTANT ENTRY */}
          <div className={styles.assistantCard}>
            <div className={styles.assistantHeader}>
              <div className={styles.assistantAvatar}>
                <Sparkles size={20} />
              </div>
              <div>
                <h3 className={styles.assistantTitle}>Have a question?</h3>
              </div>
            </div>
            
            <p className={styles.assistantDesc}>Ask MediMind about your medications, food, recent doses, or safety information.</p>
            
            <div className={styles.assistantPrompts}>
              <Link href="/patient/assistant" className={styles.promptLink}>
                &quot;What medications am I taking?&quot;
              </Link>
              <Link href="/patient/assistant" className={styles.promptLink}>
                &quot;Are there any food interactions?&quot;
              </Link>
            </div>
            
            <div style={{ marginTop: 'var(--mm-space-2)' }}>
              <Link href="/patient/assistant" passHref>
                <Button variant="secondary" type="button" style={{ width: 'auto' }}>
                  Open Assistant
                </Button>
              </Link>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
