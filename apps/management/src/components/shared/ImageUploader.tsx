import React, { useState, useCallback, useRef } from 'react';
import classNames from 'classnames';
import { uploadImage, deleteImage } from '@/lib/api/cdn';
import styles from '@/styles/components/ImageUploader.module.scss';

export type CDNEntityType = 'locations' | 'items' | 'characters' | 'occupations';

interface ImageUploaderProps {
  value: string;
  onChange: (url: string) => void;
  entityType: CDNEntityType;
  entityId?: string;
  placeholder?: string;
  helpText?: string;
}

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE_MB = 10;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

export function ImageUploader({
  value,
  onChange,
  entityType,
  entityId,
  placeholder = 'Trascina un\'immagine qui oppure clicca per selezionare',
  helpText,
}: ImageUploaderProps): React.ReactElement {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasImage = value && value.trim().length > 0;

  const validateFile = useCallback((file: File): string | null => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return 'Formato non supportato. Accettati: JPG, PNG, WebP, GIF';
    }
    if (file.size > MAX_SIZE_BYTES) {
      return `File troppo grande. Massimo ${MAX_SIZE_MB}MB`;
    }
    return null;
  }, []);

  const handleUpload = useCallback(async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!entityId) {
      setError('Salva prima il record per poter caricare immagini');
      return;
    }

    setError(null);
    setUploading(true);
    setProgress(0);

    try {
      const result = await uploadImage(file, entityType, entityId, setProgress);
      onChange(result.url);
      setPreviewError(false);
    } catch (err: any) {
      setError(err.message || 'Errore durante il caricamento');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }, [entityType, entityId, onChange, validateFile]);

  const handleRemove = useCallback(async () => {
    if (!hasImage) return;

    try {
      const urlParts = value.split('/');
      const filename = urlParts[urlParts.length - 1];
      const eId = urlParts[urlParts.length - 2];
      const eType = urlParts[urlParts.length - 3];

      if (filename && eId && eType) {
        await deleteImage(eType, eId, filename);
      }
    } catch {
      // Best-effort delete on CDN, proceed with clearing the value regardless
    }

    onChange('');
    setPreviewError(false);
    setError(null);
  }, [value, hasImage, onChange]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  }, [handleUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => setDragOver(false), []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [handleUpload]);

  const handleClick = useCallback(() => {
    if (!uploading) fileInputRef.current?.click();
  }, [uploading]);

  return (
    <div className={styles.uploader}>
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        onChange={handleFileSelect}
        className={styles.hiddenInput}
      />

      {hasImage && !previewError ? (
        <div className={styles.previewContainer}>
          <img
            src={value}
            alt="Anteprima"
            className={styles.previewImage}
            onError={() => setPreviewError(true)}
          />
          <div className={styles.previewOverlay}>
            <button type="button" className={styles.changeBtn} onClick={handleClick}>
              Cambia
            </button>
            <button type="button" className={styles.removeBtn} onClick={handleRemove}>
              Rimuovi
            </button>
          </div>
        </div>
      ) : (
        <div
          className={classNames(styles.dropZone, {
            [styles.dragOver]: dragOver,
            [styles.disabled]: uploading || !entityId,
          })}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={handleClick}
          role="button"
          tabIndex={0}
        >
          {uploading ? (
            <div className={styles.uploadingState}>
              <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ width: `${progress}%` }} />
              </div>
              <span className={styles.progressText}>Caricamento... {progress}%</span>
            </div>
          ) : (
            <div className={styles.idleState}>
              <span className={styles.dropIcon}>+</span>
              <span className={styles.dropText}>{placeholder}</span>
              <span className={styles.dropHint}>JPG, PNG, WebP, GIF - max {MAX_SIZE_MB}MB</span>
              {!entityId && (
                <span className={styles.dropWarning}>
                  Salva prima il record per caricare immagini
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {hasImage && previewError && (
        <div className={styles.previewError}>
          Impossibile caricare l'anteprima. L'URL potrebbe non essere valido.
          <button type="button" className={styles.clearErrorBtn} onClick={handleRemove}>
            Rimuovi
          </button>
        </div>
      )}

      {error && (
        <div className={styles.errorMessage}>{error}</div>
      )}

      {helpText && <p className={styles.helpText}>{helpText}</p>}
    </div>
  );
}
