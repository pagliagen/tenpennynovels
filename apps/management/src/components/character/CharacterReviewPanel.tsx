import React, { useState, useEffect } from 'react';
import { characterAPI } from '@/lib/api';
import styles from '@/styles/components/CharacterReviewPanel.module.scss';

interface CharacterReviewPanelProps {
  characterId: string;
  profile: 'character-list' | 'character-pending';
  isOpen: boolean;
  onClose: () => void;
  onAction?: (actionKey: string, formData?: Record<string, any>) => Promise<void>;
  loading?: boolean;
  error?: string | null;
}

interface CharacterData {
  id: string;
  characterName: string;
  characterSurname: string;
  age?: number;
  apparentAge?: number;
  gender?: string;
  physicalDescription?: string;
  birthPlace?: string;
  occupation?: { name?: string } | string;
  socialClass: string;
  status: string;
  username: string;
  email: string;
  submittedAt?: string;
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  stats?: {
    str: number;
    dex: number;
    int: number;
    con: number;
    app: number;
    pow: number;
    siz: number;
    edu: number;
  };
  skills?: Record<string, number>;
  equipment?: Array<{
    id?: string;
    name?: string;
    description?: string;
    category?: string;
    basePrice?: number;
    rarity?: string;
    quantity?: number;
    source?: 'character' | 'occupation';
    note?: string;
  }>;
  characterRoles?: string[];
  corporationMemberships?: string[];
  // Background fields
  publicDescription?: string;
  privateDescription?: string;
  motivations?: string;
  fears?: string;
  backstory?: string;
  backgroundResponses?: any[];
  backgroundCompleted?: boolean;
  // Review data
  notes?: string;
  rejectionReason?: string;
  reviewHistory?: any[];
  approvedBy?: string;
  rejectedBy?: string;
}

interface PanelConfig {
  panel: {
    name: string;
    title: string;
    icon: string;
    width: string;
    fetchEndpoint: string;
  };
  sections: Array<{
    key: string;
    title: string;
    type: string;
    visible: boolean;
    fields: Array<{
      key: string;
      label: string;
      type: string;
      visible: boolean;
      editable: boolean;
      nullable?: boolean;
      fallback?: string;
      placeholder?: string;
      rows?: number;
      required?: boolean;
      conditional?: {
        field: string;
        value: string;
      };
      render?: {
        type: string;
        emptyText: string;
        showDetails?: boolean;
      };
    }>;
  }>;
  profiles: {
    [key: string]: {
      description: string;
      sections: Record<string, { visible: boolean }>;
      actions: Array<{
        key: string;
        label: string;
        type: string;
        icon?: string;
      }>;
    };
  };
}

export const CharacterReviewPanel: React.FC<CharacterReviewPanelProps> = ({
  characterId,
  profile,
  isOpen,
  onClose,
  onAction,
  loading: externalLoading = false,
  error: externalError = null
}) => {
  const [character, setCharacter] = useState<CharacterData | null>(null);
  const [config, setConfig] = useState<PanelConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [lastFailedAction, setLastFailedAction] = useState<{ actionKey: string, formData: Record<string, any> } | null>(null);

  // Load panel configuration
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await fetch('/config/panels/character-review.json');
        if (response.ok) {
          const configData = await response.json();
          setConfig(configData);
        } else {
          console.error('Failed to load character review panel config');
        }
      } catch (err) {
        console.error('Error loading panel config:', err);
      }
    };

    loadConfig();
  }, []);

  // Load character data when panel opens
  useEffect(() => {
    if (isOpen && characterId && config) {
      loadCharacterData();
      // Reset last failed action when loading new character
      setLastFailedAction(null);
    }
  }, [isOpen, characterId, config]);

  const loadCharacterData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await characterAPI.getCharacter(characterId);
      
      if (response.success && response.data) {
        setCharacter(response.data.character);
      } else {
        setError('Failed to load character data');
      }
    } catch (err) {
      console.error('Error loading character:', err);
      setError('Error loading character data');
    } finally {
      setLoading(false);
    }
  };

  const getNestedValue = (obj: any, path: string): any => {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  };

  const formatDate = (dateString?: string): string => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      DRAFT: { label: 'Bozza', className: styles.statusDraft },
      PENDING_APPROVAL: { label: 'In Attesa', className: styles.statusPending },
      APPROVED: { label: 'Approvato', className: styles.statusApproved },
      REJECTED: { label: 'Respinto', className: styles.statusRejected },
      DELETED: { label: 'Eliminato', className: styles.statusDeleted }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.DRAFT;
    
    return (
      <span className={`${styles.statusBadge} ${config.className}`}>
        {config.label}
      </span>
    );
  };

  const calculateTotalStats = (stats?: CharacterData['stats']): number => {
    if (!stats) return 0;
    return Object.values(stats).reduce((sum, stat) => sum + stat, 0);
  };

  const renderFieldValue = (field: any, character: CharacterData): React.ReactNode => {
    const value = field.fallback ? 
      getNestedValue(character, field.key) || getNestedValue(character, field.fallback) :
      getNestedValue(character, field.key);

    // Handle conditional fields
    if (field.conditional) {
      const conditionValue = getNestedValue(character, field.conditional.field);
      if (conditionValue !== field.conditional.value) {
        return null;
      }
    }

    if (field.nullable && (!value && value !== 0)) {
      return <span className={styles.nullValue}>-</span>;
    }

    switch (field.type) {
      case 'datetime':
        return formatDate(value);
      
      case 'status_badge':
        return getStatusBadge(value);
      
      case 'nested_number':
      case 'nested_text':
        return value || '-';
      
      case 'email':
        return value ? <a href={`mailto:${value}`} className={styles.emailLink}>{value}</a> : '-';
      
      case 'object_entries':
        if (!value || typeof value !== 'object') {
          return <span className={styles.emptyText}>{field.render?.emptyText || 'N/A'}</span>;
        }
        return (
          <div className={styles.skillsGrid}>
            {Object.entries(value).map(([skill, skillValue]) => (
              <div key={skill} className={styles.skillItem}>
                <span className={styles.skillName}>{skill}:</span>
                <span className={styles.skillValue}>{String(skillValue)}</span>
              </div>
            ))}
          </div>
        );
      
      case 'array_objects':
        if (!Array.isArray(value) || value.length === 0) {
          return <span className={styles.emptyText}>{field.render?.emptyText || 'Nessun elemento'}</span>;
        }
        return (
          <div className={styles.equipmentList}>
            {value.map((item: any, index: number) => (
              <div key={index} className={`${styles.equipmentItem} ${item.source ? styles[`source_${item.source}`] : ''}`}>
                <div className={styles.itemHeader}>
                  <strong>{item.name || `Item ${index + 1}`}</strong>
                  {item.source && (
                    <span className={`${styles.sourceBadge} ${styles[`source_${item.source}`]}`}>
                      {item.source === 'character' ? 'Personaggio' : 'Occupazione'}
                    </span>
                  )}
                  {item.quantity && item.quantity > 1 && (
                    <span className={styles.quantityBadge}>x{item.quantity}</span>
                  )}
                </div>
                {item.description && <div className={styles.itemDescription}>{item.description}</div>}
                {item.note && <div className={styles.itemNote}>{item.note}</div>}
                {field.render?.showDetails && (
                  <div className={styles.itemDetails}>
                    {item.category && <span className={styles.itemMeta}>Categoria: {item.category}</span>}
                    {item.basePrice && <span className={styles.itemMeta}>Prezzo: {item.basePrice} pence</span>}
                    {item.rarity && <span className={styles.itemMeta}>Rarità: {item.rarity}</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      
      case 'array_badges':
        if (!Array.isArray(value) || value.length === 0) {
          return <span className={styles.emptyText}>{field.render?.emptyText || 'Nessun elemento'}</span>;
        }
        return (
          <div className={styles.badgesList}>
            {value.map((item: string) => (
              <span key={item} className={`${styles.badge} ${styles[field.render?.type] || styles.defaultBadge}`}>
                {item}
              </span>
            ))}
          </div>
        );
      
      case 'long_text':
        if (!value) {
          // Handle conditional text for rejection reason
          if (field.render?.type === 'conditional_text') {
            const isRejected = getNestedValue(character, 'status') === 'REJECTED';
            const emptyText = isRejected ? 
              (field.render.rejectedEmptyText || 'Nessun motivo fornito') : 
              (field.render.emptyText || 'Non respinto');
            return <span className={styles.emptyText}>{emptyText}</span>;
          }
          return <span className={styles.emptyText}>{field.render?.emptyText || 'Non disponibile'}</span>;
        }
        return <div className={styles.longText}>{value}</div>;
      
      case 'textarea':
        return (
          <textarea
            value={formData[field.key] || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, [field.key]: e.target.value }))}
            placeholder={field.placeholder}
            rows={field.rows || 3}
            className={styles.textarea}
            disabled={!field.editable}
          />
        );

      default:
        return value || '-';
    }
  };

  const renderSection = (section: any, character: CharacterData): React.ReactNode => {
    const profileConfig = config?.profiles[profile];
    const sectionConfig = profileConfig?.sections[section.key];
    
    if (!sectionConfig?.visible && !section.visible) return null;

    // Special handling for feedback section in character-pending profile
    if (section.key === 'feedback_section' && profile === 'character-pending') {
      return (
        <div key={section.key} className={styles.section}>
          <h3 className={styles.sectionTitle}>{section.title}</h3>
          <div className={styles.sectionContent}>
            {section.fields.map((field: any) => (
              <div key={field.key} className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>{field.label}</label>
                {renderFieldValue(field, character)}
              </div>
            ))}
          </div>
        </div>
      );
    }

    const visibleFields = section.fields.filter((field: any) => field.visible);
    if (visibleFields.length === 0) return null;

    return (
      <div key={section.key} className={styles.section}>
        <h3 className={styles.sectionTitle}>{section.title}</h3>
        <div className={`${styles.sectionContent} ${styles[section.type] || ''}`}>
          {section.type === 'info_grid' && (
            <div className={styles.infoGrid}>
              {visibleFields.map((field: any) => (
                <div key={field.key} className={styles.infoItem}>
                  <span className={styles.infoLabel}>{field.label}:</span>
                  <span className={styles.infoValue}>{renderFieldValue(field, character)}</span>
                </div>
              ))}
            </div>
          )}
          {section.type === 'stats_grid' && character.stats && (
            <div className={styles.statsGrid}>
              {visibleFields.map((field: any) => (
                <div key={field.key} className={styles.statItem}>
                  <span className={styles.statLabel}>{field.label}:</span>
                  <span className={styles.statValue}>{renderFieldValue(field, character)}</span>
                </div>
              ))}
              <div className={styles.statTotal}>
                <strong>Totale: {calculateTotalStats(character.stats)} / 400</strong>
              </div>
            </div>
          )}
          {(section.type === 'skills_list' || section.type === 'equipment_list' || section.type === 'roles_section' || section.type === 'text_section' || section.type === 'notes_section') && (
            <div className={styles.contentSection}>
              {visibleFields.map((field: any) => (
                <div key={field.key} className={styles.fieldGroup}>
                  {field.label !== field.key && <h4 className={styles.fieldTitle}>{field.label}</h4>}
                  {renderFieldValue(field, character)}
                </div>
              ))}
            </div>
          )}
          {section.type === 'timeline_section' && (
            <div className={styles.timeline}>
              {visibleFields.map((field: any) => {
                const value = renderFieldValue(field, character);
                if (value === '-' || !value) return null;
                return (
                  <div key={field.key} className={styles.timelineItem}>
                    <strong>{field.label}:</strong> {value}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  const handleAction = async (actionKey: string) => {
    if (onAction) {
      try {
        await onAction(actionKey, formData);
        // Clear last failed action on success
        setLastFailedAction(null);
      } catch (error) {
        // Store failed action for retry
        setLastFailedAction({ actionKey, formData: { ...formData } });
        throw error; // Re-throw to let parent handle the error
      }
    } else {
      // Default actions
      switch (actionKey) {
        case 'close':
        case 'cancel':
          onClose();
          break;
        default:
          console.warn(`Unhandled action: ${actionKey}`);
      }
    }
  };

  const handleRetry = async () => {
    if (lastFailedAction) {
      // Retry the last failed action
      await handleAction(lastFailedAction.actionKey);
    } else {
      // Fallback to loading character data
      loadCharacterData();
    }
  };

  if (!isOpen) return null;

  const currentLoading = loading || externalLoading;
  const currentError = error || externalError;
  const profileConfig = config?.profiles[profile];

  return (
    <div className={styles.overlay}>
      <div className={`${styles.panel} ${styles[config?.panel.width || 'medium']}`}>
        <div className={styles.panelHeader}>
          <div className={styles.headerContent}>
            <h2 className={styles.panelTitle}>
              {config?.panel.icon} {config?.panel.title}
              {character && ` - ${character.characterName} ${character.characterSurname}`}
            </h2>
            <p className={styles.panelSubtitle}>
              {profileConfig?.description}
            </p>
          </div>
          <button
            onClick={onClose}
            className={styles.closeButton}
            disabled={currentLoading}
          >
            ✕
          </button>
        </div>

        <div className={styles.panelBody}>
          {currentLoading && (
            <div className={styles.loadingState}>
              <div className={styles.spinner}></div>
              <p>Caricamento dati personaggio...</p>
            </div>
          )}

          {currentError && (
            <div className={styles.errorState}>
              <p>⚠️ {currentError}</p>
              <button onClick={handleRetry} className={styles.retryButton}>
                {lastFailedAction ? `Riprova ${lastFailedAction.actionKey === 'approve_character' ? 'Approvazione' : lastFailedAction.actionKey === 'reject_character' ? 'Rifiuto' : 'Azione'}` : 'Ricarica Dati'}
              </button>
            </div>
          )}

          {!currentLoading && !currentError && character && config && (
            <div className={styles.panelContent}>
              {config.sections.map((section) => renderSection(section, character))}
              
              {/* Special feedback section for character-pending profile */}
              {profile === 'character-pending' && (
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>Feedback</h3>
                  <div className={styles.sectionContent}>
                    <div className={styles.fieldGroup}>
                      <label className={styles.fieldLabel}>Feedback/Note</label>
                      <textarea
                        value={formData.feedback || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, feedback: e.target.value }))}
                        placeholder="Aggiungi feedback per approvazione o respinta (obbligatorio per respinta)..."
                        rows={4}
                        className={styles.textarea}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {!currentLoading && !currentError && profileConfig && (
          <div className={styles.panelFooter}>
            <div className={styles.actions}>
              {profileConfig.actions.map((action) => (
                <button
                  key={action.key}
                  onClick={() => handleAction(action.key)}
                  className={`${styles.actionButton} ${styles[action.type]}`}
                  disabled={currentLoading}
                >
                  {action.icon && <span className={styles.actionIcon}>{action.icon}</span>}
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};