import { getWorkspaceContext, acknowledgeWorkspaceAssessment } from '@/app/actions/workspace';
import { InteractionCard } from '@/components/interactions/InteractionCard';
import { redirect } from 'next/navigation';

export default async function PatientWorkspacePage({ params }: { params: Promise<{ patientId: string }> }) {
  const { patientId } = await params;
  let context;
  try {
    context = await getWorkspaceContext(patientId);
  } catch (err: any) {
    return (
      <div className="p-8">
        <h1 className="text-2xl text-red-600">Access Denied</h1>
        <p>{err.message}</p>
      </div>
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
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <header className="border-b pb-6 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Clinical Workspace</h1>
          <h2 className="text-xl text-gray-600 mt-2">Patient: {patient_name}</h2>
        </div>
        <div className="text-right">
          <span className={`px-3 py-1 rounded-full text-sm font-bold ${unreviewedCount > 0 ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'}`}>
            {unreviewedCount > 0 ? `${unreviewedCount} Action(s) Required` : 'All Clear'}
          </span>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <section className="bg-white p-6 rounded shadow-sm border">
          <h3 className="text-xl font-bold mb-4 text-gray-800 border-b pb-2">Canonical Medications</h3>
          {medications.length === 0 ? (
            <p className="text-gray-500 italic">No active medications.</p>
          ) : (
            <ul className="space-y-3">
              {medications.map(m => (
                <li key={m.id} className="border-l-4 border-blue-500 pl-3">
                  <p className="font-semibold text-gray-800">{m.display_name}</p>
                  <p className="text-sm text-gray-500">Food Relation: {m.food_relation.replace('_', ' ')}</p>
                  {m.schedules && m.schedules.length > 0 && (
                    <div className="mt-1 text-sm text-gray-600">
                      Schedules: {m.schedules.map((s: any) => s.time_of_day).join(', ')}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="bg-white p-6 rounded shadow-sm border">
          <h3 className="text-xl font-bold mb-4 text-gray-800 border-b pb-2">Canonical Dietary Intake</h3>
          {!dietary_records || dietary_records.length === 0 ? (
            <p className="text-gray-500 italic">No dietary records.</p>
          ) : (
            <ul className="space-y-3">
              {dietary_records.map(d => (
                <li key={d.id} className="border-l-4 border-green-500 pl-3">
                  <p className="font-semibold text-gray-800 capitalize">{d.component_name}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="mt-10">
        <h3 className="text-2xl font-bold mb-6 text-gray-800">Deterministic Assessments</h3>
        {assessments.length === 0 ? (
          <p className="text-gray-600">No interaction assessments found.</p>
        ) : (
          <div className="space-y-6">
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
    </div>
  );
}
