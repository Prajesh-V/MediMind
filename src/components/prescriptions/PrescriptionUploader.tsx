'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { registerUploadedDocument } from '@/app/actions/intake';
import { extractPrescription } from '@/app/actions/extraction';
import styles from '../uploads/IntakeUpload.module.css';

interface PrescriptionUploaderProps {
  onExtractionComplete: () => void;
}

export function PrescriptionUploader({ onExtractionComplete }: PrescriptionUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [title, setTitle] = useState('');
  const [prescriptionDate, setPrescriptionDate] = useState(new Date().toISOString().split('T')[0]);

  const processFile = async (file: File) => {
    if (!file) return;
    if (!title.trim()) {
      setError('Please provide a Prescription Name before uploading.');
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(null);
    setStatusMessage('Uploading prescription securely to storage...');

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('You must be signed in to upload prescriptions.');

      // 1. Upload to Supabase Storage
      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const storagePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('multimodal_uploads')
        .upload(storagePath, file);

      if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

      // 2. Register Document entity
      setStatusMessage('Registering uploaded prescription document...');
      const documentId = await registerUploadedDocument(
        user.id,
        storagePath,
        file.type || 'application/octet-stream',
        'prescription'
      );

      // 3. Extract using Gemini (Server Action)
      setStatusMessage('Analyzing document and extracting medication candidates...');
      const result = await extractPrescription(documentId, user.id, title.trim(), prescriptionDate);

      if (result.status === 'failed') {
        throw new Error('Could not extract medication information from this image. Please ensure the prescription is clearly legible.');
      }

      setSuccess('Prescription analyzed successfully! Review the extracted candidates below.');
      setTitle(''); // reset
      onExtractionComplete();
    } catch (err: any) {
      console.error('Prescription intake error:', err);
      setError(err.message || 'An error occurred during prescription extraction');
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

  return (
    <div style={{ marginBottom: '20px' }}>
      <div style={{ marginBottom: '16px', display: 'flex', gap: '12px' }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: 'var(--mm-text-secondary)' }}>Prescription Name *</label>
          <input 
            type="text" 
            value={title} 
            onChange={e => setTitle(e.target.value)} 
            placeholder="e.g. March Antibiotics, Dr. Smith"
            style={{ display: 'block', width: '100%', padding: '8px', border: '1px solid var(--mm-border-divider)', borderRadius: '4px', backgroundColor: 'var(--mm-bg-body)', color: 'var(--mm-text-primary)' }}
            disabled={uploading}
          />
        </div>
        <div style={{ width: '150px' }}>
          <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: 'var(--mm-text-secondary)' }}>Prescription Date</label>
          <input 
            type="date" 
            value={prescriptionDate} 
            onChange={e => setPrescriptionDate(e.target.value)} 
            style={{ display: 'block', width: '100%', padding: '8px', border: '1px solid var(--mm-border-divider)', borderRadius: '4px', backgroundColor: 'var(--mm-bg-body)', color: 'var(--mm-text-primary)' }}
            disabled={uploading}
          />
        </div>
      </div>

      <div
        className={`${styles.dropzone} ${isDragOver ? styles.dropzoneActive : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        role="region"
        aria-label="Prescription upload area"
      >
        <input
          id="prescription-file-input"
          type="file"
          accept="image/jpeg, image/png, application/pdf"
          onChange={handleFileChange}
          disabled={uploading}
          className={styles.fileInput}
          aria-label="Upload prescription image or PDF"
        />

        {uploading ? (
          <div className={styles.statusContainer}>
            <div className={styles.spinner} />
            <div className={styles.statusText}>{statusMessage}</div>
            <div style={{ fontSize: '12px', color: 'var(--mm-text-muted)' }}>
              This may take a few seconds...
            </div>
          </div>
        ) : (
          <>
            <div className={styles.icon} aria-hidden="true">
              📄
            </div>
            <h4 className={styles.title}>Upload your prescription</h4>
            <p className={styles.subtitle}>
              JPG, PNG or PDF • Secure &amp; private
            </p>
            <label
              htmlFor="prescription-file-input"
              className={styles.chooseButton}
              tabIndex={0}
            >
              Choose Prescription
            </label>
            <p className={styles.footerNote}>
              The document will be analyzed and shown to you for confirmation.
            </p>
          </>
        )}
      </div>

      {error && <div className={styles.errorBanner}>⚠️ {error}</div>}
      {success && <div className={styles.successBanner}>✓ {success}</div>}
    </div>
  );
}
