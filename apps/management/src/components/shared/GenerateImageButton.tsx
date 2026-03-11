import React from 'react';
import classNames from 'classnames';
import { useImageGeneration, ImageGenEntityType, ImageGenStatus } from '@/hooks/useImageGeneration';
import { useAIServiceAvailable } from '@/hooks/useAIServiceAvailable';
import styles from '@/styles/components/GenerateImageButton.module.scss';

interface GenerateImageButtonProps {
  entityType: ImageGenEntityType;
  entityId: string | undefined;
  entityName?: string;
  onSuccess?: (imageUrl: string) => void;
  style?: string;
  disabled?: boolean;
}

const STATUS_LABELS: Record<ImageGenStatus, string> = {
  idle: 'Genera con AI',
  generating: 'Generazione in corso...',
  completed: 'Completato!',
  error: 'Riprova',
};

export function GenerateImageButton({
  entityType,
  entityId,
  entityName,
  onSuccess,
  style,
  disabled,
}: GenerateImageButtonProps): React.ReactElement | null {
  const aiAvailable = useAIServiceAvailable();
  const { generate, status, error, isGenerating } = useImageGeneration(
    entityType,
    entityId,
    { onSuccess, style, entityName }
  );

  if (!aiAvailable) return null;

  return (
    <div className={styles.container}>
      <button
        type="button"
        className={classNames(styles.generateBtn, {
          [styles.generating]: isGenerating,
          [styles.completed]: status === 'completed',
          [styles.hasError]: status === 'error',
        })}
        onClick={generate}
        disabled={disabled || !entityId || isGenerating}
      >
        {isGenerating && <span className={styles.spinner} />}
        <span>{STATUS_LABELS[status]}</span>
      </button>

      {status === 'error' && error && (
        <p className={styles.errorMessage}>{error}</p>
      )}
    </div>
  );
}
