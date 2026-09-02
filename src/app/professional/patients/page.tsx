import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';

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
      <div className="p-8">
        <h1 className="text-2xl text-red-600">Error Loading Patients</h1>
        <p>{error.message}</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">My Patients</h1>
      
      {connections?.length === 0 ? (
        <p className="text-gray-600">You do not have any active patient connections.</p>
      ) : (
        <div className="grid gap-4">
          {connections?.map((conn: any) => {
            const patient = conn.patients;
            if (!patient) return null;
            return (
              <div key={patient.id} className="border p-4 rounded shadow-sm bg-white flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-semibold text-gray-800">
                    {patient.first_name} {patient.last_name}
                  </h2>
                  <p className="text-gray-500 text-sm">
                    DOB: {new Date(patient.date_of_birth).toLocaleDateString()}
                  </p>
                </div>
                <Link
                  href={`/professional/workspace/${patient.id}`}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                >
                  Open Workspace
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
