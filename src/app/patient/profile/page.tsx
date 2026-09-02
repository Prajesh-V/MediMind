'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { ContentCard } from '@/components/cards/ContentCard';
import { EmptyState } from '@/components/feedback/EmptyState';

export default function PatientProfilePage() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProfile() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          setError('Not authenticated');
          return;
        }

        const { data, error } = await supabase
          .from('patients')
          .select('*')
          .eq('id', user.id)
          .single();

        if (error) {
          if (error.code === 'PGRST116') { // Not found
            setProfile(null);
          } else {
            setError(error.message);
          }
        } else {
          setProfile(data);
        }
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    
    loadProfile();
  }, []);

  if (loading) {
    return <section><ContentCard title="Patient Profile"><p>Loading profile...</p></ContentCard></section>;
  }

  if (error) {
    return <section><ContentCard title="Patient Profile"><EmptyState icon="⚠️" message={`Error loading profile: ${error}`} /></ContentCard></section>;
  }

  if (!profile) {
    return (
      <section>
        <ContentCard title="Patient Profile">
          <EmptyState
            icon="👤"
            message="Your profile will be available after registration."
          />
        </ContentCard>
      </section>
    );
  }

  return (
    <section>
      <ContentCard title="Patient Profile">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '12px', color: 'var(--mm-text-muted)' }}>First Name</label>
            <div style={{ fontSize: '16px', fontWeight: '500' }}>{profile.first_name}</div>
          </div>
          <div>
            <label style={{ fontSize: '12px', color: 'var(--mm-text-muted)' }}>Last Name</label>
            <div style={{ fontSize: '16px', fontWeight: '500' }}>{profile.last_name}</div>
          </div>
          {profile.date_of_birth && (
            <div>
              <label style={{ fontSize: '12px', color: 'var(--mm-text-muted)' }}>Date of Birth</label>
              <div style={{ fontSize: '16px', fontWeight: '500' }}>{profile.date_of_birth}</div>
            </div>
          )}
          <div>
            <label style={{ fontSize: '12px', color: 'var(--mm-text-muted)' }}>Timezone</label>
            <div style={{ fontSize: '16px', fontWeight: '500' }}>{profile.timezone || 'UTC'}</div>
          </div>
        </div>
      </ContentCard>
    </section>
  );
}
