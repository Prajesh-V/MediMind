import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { Surface } from '@/components/ui/Surface';
import styles from './page.module.css';

export default async function ProfessionalPatientsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // Fetch all patients with an active connection to this professional
  const { data: connections, error } = await supabase
    .from('patient_professional_connections')
    .select(`
      patient_id,
      patients:patient_id (
        id,
        first_name,
        last_name,
        date_of_birth
      )
    `)
    .eq('professional_id', user.id)
    .eq('status', 'active');

  if (error) {
    return (
      <section className={styles.pageContainer}>
        <PageHeader title="My Patients" />
        <div className={styles.errorState}>
          <h2 className="text-xl">Error Loading Patients</h2>
          <p>{error.message}</p>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.pageContainer}>
      <PageHeader 
        title="My Patients" 
        subtitle="Manage and review your actively connected patients."
      />
      
      {connections?.length === 0 ? (
        <Surface variant="subtle" className={styles.emptyState}>
          <div className={styles.emptyIcon}>👤</div>
          <h2>No Active Connections</h2>
          <p>You do not have any active patient connections at this time.</p>
        </Surface>
      ) : (
        <div className={styles.patientList}>
          {connections?.map((conn: any) => {
            const patient = conn.patients;
            if (!patient) return null;
            return (
              <Surface key={patient.id} className={styles.patientCard}>
                <div className={styles.patientInfo}>
                  <div className={styles.patientName}>
                    {patient.first_name} {patient.last_name}
                  </div>
                  <div className={styles.patientMeta}>
                    DOB: {new Date(patient.date_of_birth).toLocaleDateString()}
                  </div>
                </div>
                <Link
                  href={`/professional/workspace/${patient.id}`}
                  className={styles.workspaceBtn}
                >
                  Open Workspace
                </Link>
              </Surface>
            );
          })}
        </div>
      )}
    </section>
  );
}
