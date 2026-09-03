import { getWorkspaceContext, acknowledgeWorkspaceAssessment } from '@/app/actions/workspace';
import { getPatientSymptomReports } from '@/app/actions/symptoms';
import { InteractionCard } from '@/components/interactions/InteractionCard';
import { triggerAlertReconciliation } from '@/app/actions/alerts';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { Surface } from '@/components/ui/Surface';
import { AdherenceCalendar } from '@/components/professional/AdherenceCalendar';
import styles from './page.module.css';

export default async function PatientWorkspacePage({ params }: { params: Promise<{ patientId: string }> }) {
  const { patientId } = await params;
  let context;
  let symptomReports;
  try {
    context = await getWorkspaceContext(patientId);
    symptomReports = await getPatientSymptomReports(patientId);
    
    // Professional Recovery: ensure alerts are materialized for this patient
    try {
      await triggerAlertReconciliation(patientId);
    } catch (err) {
      console.error('Failed to trigger alert reconciliation on workspace load:', err);
    }
  } catch (err: any) {
    return (
      <section className={styles.workspaceContainer}>
        <PageHeader title="Access Denied" />
        <Surface variant="subtle">
          <p>{err.message}</p>
        </Surface>
      </section>
    );
  }

  const { patient_id, patient_name, medications, dietary_records, assessments } = context;

  const unreviewedCount = assessments.filter(a => a.review_state === 'UNREVIEWED' || a.review_state === 'SUPERSEDED').length;

  // Create bound action for client component
  const handleAcknowledge = async (assessmentId: string, fingerprint: string, ruleKey: string, severity: string) => {
    'use server';
    const res = await acknowledgeWorkspaceAssessment(patient_id, assessmentId, fingerprint, ruleKey, severity);
    if (!res.success) throw new Error(res.error);
  };

  return (
    <section className={styles.workspaceContainer}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '1px solid var(--mm-border-divider)', paddingBottom: 'var(--mm-space-6)' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--mm-font-family-display)', fontSize: 'var(--mm-font-size-3xl)', fontWeight: 'normal', color: 'var(--mm-text-primary)', margin: 0 }}>
            Patient Workspace
          </h1>
          <h2 style={{ fontSize: 'var(--mm-font-size-xl)', color: 'var(--mm-text-secondary)', marginTop: 'var(--mm-space-2)', fontWeight: 'normal' }}>
            {patient_name}
          </h2>
        </div>
        <div>
          <span className={unreviewedCount > 0 ? styles.unreviewedBadge : styles.allClearBadge}>
            {unreviewedCount > 0 ? `${unreviewedCount} Action(s) Required` : 'All Clear'}
          </span>
        </div>
      </header>

      <div className={styles.overviewGrid}>
        {/* Medication Adherence Calendar */}
        <Surface padding="lg">
          <h3 className={styles.sectionHeading}>Medication Adherence</h3>
          <AdherenceCalendar patientId={patientId} />
        </Surface>

        {/* Canonical Medications */}
        <Surface padding="lg">
          <h3 className={styles.sectionHeading}>Canonical Medications</h3>
          {medications.length === 0 ? (
            <p className={styles.emptyState}>No active medications.</p>
          ) : (
            <ul className={styles.clinicalList}>
              {medications.map(m => (
                <li key={m.id} className={`${styles.clinicalListItem} ${styles.medication}`}>
                  <span className={styles.clinicalItemTitle}>{m.display_name}</span>
                  <span className={styles.clinicalItemMeta}>Food Relation: {m.food_relation.replace('_', ' ')}</span>
                  {m.schedules && m.schedules.length > 0 && (
                    <span className={styles.clinicalItemMeta}>
                      Schedules: {m.schedules.map((s: any) => s.time_of_day).join(', ')}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Surface>

        {/* Canonical Dietary Intake */}
        <Surface padding="lg">
          <h3 className={styles.sectionHeading}>Canonical Dietary Intake</h3>
          {!dietary_records || dietary_records.length === 0 ? (
            <p className={styles.emptyState}>No dietary records.</p>
          ) : (
            <ul className={styles.clinicalList}>
              {dietary_records.map(d => (
                <li key={d.id} className={`${styles.clinicalListItem} ${styles.diet}`}>
                  <span className={styles.clinicalItemTitle} style={{ textTransform: 'capitalize' }}>
                    {d.component_name}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Surface>

        {/* Patient-Reported Symptoms */}
        <Surface padding="lg">
          <h3 className={styles.sectionHeading}>Patient-Reported Symptoms</h3>
          {!symptomReports || symptomReports.length === 0 ? (
            <p className={styles.emptyState}>No symptoms reported by patient.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--mm-space-4)' }}>
              {symptomReports.map((report) => (
                <div key={report.id} className={styles.symptomCard}>
                  <div className={styles.symptomHeader}>
                    <span className={styles.symptomTitle}>{report.symptom}</span>
                    <span className={`${styles.symptomBadge} ${styles[report.severity]}`}>
                      {report.severity}
                    </span>
                  </div>
                  <div className={styles.symptomMeta}>
                    Onset: {new Date(report.onset_at).toLocaleString()}
                  </div>
                  {report.related_medication_id && (
                    <div className={styles.symptomMeta}>
                      Related to: {medications.find((m: any) => m.id === report.related_medication_id)?.display_name || 'Unknown Medication'}
                    </div>
                  )}
                  {report.notes && (
                    <div className={styles.symptomNotes}>{report.notes}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Surface>
      </div>

      <section className={styles.assessmentsSection}>
        <header style={{ marginBottom: 'var(--mm-space-6)', borderBottom: '1px solid var(--mm-border-divider)', paddingBottom: 'var(--mm-space-3)' }}>
          <h3 style={{ fontFamily: 'var(--mm-font-family-display)', fontSize: 'var(--mm-font-size-2xl)', fontWeight: 'normal', color: 'var(--mm-text-primary)', margin: 0 }}>
            Deterministic Clinical Assessments
          </h3>
          <p style={{ color: 'var(--mm-text-muted)', fontSize: 'var(--mm-font-size-sm)', marginTop: 'var(--mm-space-2)' }}>
            System-determined clinical findings requiring review. M7 AI explanations can be generated on demand.
          </p>
        </header>

        {assessments.length === 0 ? (
          <Surface variant="subtle" padding="lg">
            <p className={styles.emptyState}>No interaction assessments found.</p>
          </Surface>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--mm-space-6)' }}>
            {assessments.map(a => (
              <InteractionCard 
                key={a.assessment_id} 
                assessment={a} 
                isProfessional={true} 
                onAcknowledge={handleAcknowledge}
              />
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
