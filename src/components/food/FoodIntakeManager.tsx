'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { extractFoodImage, confirmFoodCandidate } from '@/app/actions/extraction';
import { registerUploadedDocument } from '@/app/actions/intake';
import { Button } from '@/components/forms/Button';
import { EmptyState } from '@/components/feedback/EmptyState';
import styles from '../uploads/IntakeUpload.module.css';

export function FoodIntakeManager() {
  const [intakeRecords, setIntakeRecords] = useState<any[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const supabase = createClient();

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: iData } = await supabase
      .from('patient_dietary_intake')
      .select('*')
      .order('created_at', { ascending: false });

    const { data: cData } = await supabase
      .from('food_intake_candidates')
      .select('*')
      .order('created_at', { ascending: false });

    if (iData) setIntakeRecords(iData);
    if (cData) setCandidates(cData);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const processFile = async (file: File) => {
    if (!file) return;

    setUploading(true);
    setError(null);
    setSuccess(null);
    setStatusMessage('Uploading meal photo securely...');

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('You must be signed in to log food photos.');

      // 1. Upload to Supabase Storage
      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const storagePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('multimodal_uploads')
        .upload(storagePath, file);

      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

      // 2. Register Document
      setStatusMessage('Registering uploaded food image...');
      const documentId = await registerUploadedDocument(
        user.id,
        storagePath,
        file.type || 'image/jpeg',
        'food'
      );

      // 3. Extract using Gemini Vision
      setStatusMessage('Identifying dietary components in meal image...');
      const result = await extractFoodImage(documentId, user.id);

      if (result.status === 'failed') {
        throw new Error('Vision model could not detect dietary components. Please ensure the image is clear.');
      }

      setSuccess('Dietary components detected! Confirm below before adding to your record.');
      fetchData();
    } catch (err: any) {
      console.error('Food intake extraction error:', err);
      setError(err.message || 'An error occurred during food image analysis');
    } finally {
      setUploading(false);
      setStatusMessage('');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (uploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleConfirm = async (candidateId: string, editedName: string) => {
    try {
      await confirmFoodCandidate(candidateId, editedName);
      setSuccess('Dietary intake confirmed and saved!');
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to confirm food intake.');
    }
  };

  const handleReject = async (candidateId: string) => {
    try {
      await supabase
        .from('food_intake_candidates')
        .update({ status: 'rejected' })
        .eq('id', candidateId);
      fetchData();
    } catch {
      alert('Failed to reject candidate.');
    }
  };

  const pendingCandidates = candidates.filter((c) => c.status === 'pending');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Upload Drop Zone */}
      <div>
        <div
          className={`${styles.dropzone} ${isDragOver ? styles.dropzoneActive : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          role="region"
          aria-label="Food photo upload area"
        >
          <input
            id="food-file-input"
            type="file"
            accept="image/jpeg, image/png"
            onChange={handleFileChange}
            disabled={uploading}
            className={styles.fileInput}
            aria-label="Upload photo of your meal"
          />

          {uploading ? (
            <div className={styles.statusContainer}>
              <div className={styles.spinner} />
              <div className={styles.statusText}>{statusMessage}</div>
              <div style={{ fontSize: '12px', color: 'var(--mm-text-muted)' }}>
                Analyzing dietary components...
              </div>
            </div>
          ) : (
            <>
              <div className={styles.icon} aria-hidden="true">
                🥗
              </div>
              <h4 className={styles.title}>Upload a photo of your meal</h4>
              <p className={styles.subtitle}>
                JPG or PNG • Identify dietary components
              </p>
              <label htmlFor="food-file-input" className={styles.chooseButton} tabIndex={0}>
                Choose Food Photo
              </label>
              <p className={styles.footerNote}>
                Identified dietary components will be staged for your review before adding to your dietary record.
              </p>
            </>
          )}
        </div>

        {error && <div className={styles.errorBanner}>⚠️ {error}</div>}
        {success && <div className={styles.successBanner}>✓ {success}</div>}
      </div>

      {/* Staged Candidate Review */}
      {pendingCandidates.length > 0 && (
        <div style={{
          background: 'var(--mm-semantic-warning-bg-subtle, #fff8e8)',
          border: '1px solid var(--mm-semantic-warning-border-subtle, #ffe6a7)',
          padding: '16px',
          borderRadius: 'var(--mm-radius-md, 8px)'
        }}>
          <h4 style={{ margin: '0 0 4px 0', color: 'var(--mm-semantic-warning-text, #986300)', fontSize: '15px' }}>
            ⚠️ Confirm Dietary Components ({pendingCandidates.length})
          </h4>
          <p style={{ fontSize: '13px', color: 'var(--mm-text-secondary)', marginBottom: '12px' }}>
            Vision model detected these components. Please confirm or edit before logging to your dietary record.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {pendingCandidates.map((c) => (
              <div
                key={c.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'var(--mm-bg-surface)',
                  padding: '12px 14px',
                  borderRadius: 'var(--mm-radius-md)',
                  border: '1px solid var(--mm-border-default)',
                  flexWrap: 'wrap',
                  gap: '10px',
                }}
              >
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <input
                    type="text"
                    defaultValue={c.component_name}
                    id={`edit-name-${c.id}`}
                    style={{
                      fontWeight: 'bold',
                      fontSize: '14px',
                      padding: '6px 10px',
                      borderRadius: '4px',
                      border: '1px solid var(--mm-border-input)',
                      background: 'var(--mm-bg-input)',
                      color: 'var(--mm-text-primary)',
                      width: '100%',
                      maxWidth: '260px',
                    }}
                  />
                  <div style={{ fontSize: '12px', color: 'var(--mm-text-muted)', marginTop: '4px' }}>
                    Confidence: {Math.round((c.confidence_score || 0.8) * 100)}%
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <Button
                    variant="primary"
                    type="button"
                    onClick={() =>
                      handleConfirm(
                        c.id,
                        (document.getElementById(`edit-name-${c.id}`) as HTMLInputElement).value
                      )
                    }
                    style={{ padding: '6px 14px', fontSize: '12px', width: 'auto' }}
                  >
                    ✓ Confirm
                  </Button>
                  <Button
                    variant="danger"
                    type="button"
                    onClick={() => handleReject(c.id)}
                    style={{ padding: '6px 10px', fontSize: '12px', width: 'auto' }}
                  >
                    ✕ Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Confirmed Dietary History */}
      <div>
        <h4 style={{ margin: '0 0 10px 0', fontSize: '15px' }}>Confirmed Dietary Log</h4>
        {loading ? (
          <p style={{ color: 'var(--mm-text-muted)', fontSize: '13px' }}>Loading records...</p>
        ) : intakeRecords.length === 0 ? (
          <EmptyState icon="🥗" message="No dietary records found. Log your meals above." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {intakeRecords.map((r) => (
              <div
                key={r.id}
                style={{
                  padding: '12px 14px',
                  border: '1px solid var(--mm-border-divider)',
                  borderRadius: 'var(--mm-radius-md)',
                  background: 'var(--mm-bg-surface)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <strong style={{ textTransform: 'capitalize', color: 'var(--mm-text-primary)' }}>
                    🥗 {r.component_name}
                  </strong>
                  <div style={{ fontSize: '11px', color: 'var(--mm-text-muted)', marginTop: '2px' }}>
                    Logged on {new Date(r.consumed_at || r.created_at).toLocaleString()}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: '11px',
                    color: 'var(--mm-primary, #087f70)',
                    background: 'var(--mm-primary-bg, #eafaf7)',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontWeight: 600,
                  }}
                >
                  Confirmed
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
