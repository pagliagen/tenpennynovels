import React, { useState, useMemo } from 'react';
import Head from 'next/head';
import { ManagementLayout } from '@/components/layout/ManagementLayout';
import { useSystemConfigurations, useUpdateConfiguration, useInvalidateConfigCache } from '@/hooks/api/useSystemConfigurations';
import { useNotificationStore } from '@/store/notificationStore';
import type { SystemConfigRecord } from '@/lib/api/system';
import styles from '@/styles/pages/SystemConfig.module.scss';

const SECTION_LABELS: Record<string, string> = {
  system: 'Sistema',
  character_creation: 'Personaggio',
  economy: 'Economia',
  moderation: 'Moderazione',
  postal_system: 'Posta',
  combat_system: 'Combattimento',
  email_templates: 'Email',
  experience_system: 'Esperienza',
  housing_system: 'Abitazioni',
};

function formatValuePreview(cfg: SystemConfigRecord): string {
  if (cfg.configType === 'boolean') return cfg.value ? 'Attivo' : 'Disattivato';
  if (cfg.configType === 'json') {
    const json = JSON.stringify(cfg.value);
    return json.length > 60 ? json.slice(0, 57) + '...' : json;
  }
  return String(cfg.value ?? '—');
}

function ConfigValueEditor({
  config,
  value,
  onChange,
}: {
  config: SystemConfigRecord;
  value: any;
  onChange: (v: any) => void;
}) {
  switch (config.configType) {
    case 'boolean':
      return (
        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span>{value ? 'Attivo' : 'Disattivato'}</span>
        </label>
      );
    case 'number':
      return (
        <input
          type="number"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        />
      );
    case 'string':
      return (
        <input
          type="text"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'json':
      return (
        <textarea
          value={typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
          onChange={(e) => onChange(e.target.value)}
          rows={10}
        />
      );
    case 'template':
      return (
        <textarea
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          rows={10}
        />
      );
    default:
      return (
        <input
          type="text"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}

export default function SystemConfigurations() {
  const addNotification = useNotificationStore((s) => s.addNotification);
  const { data: configs, isLoading, error } = useSystemConfigurations();
  const updateMutation = useUpdateConfiguration();
  const cacheMutation = useInvalidateConfigCache();

  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<any>(null);
  const [editReason, setEditReason] = useState('');

  const grouped = useMemo(() => {
    if (!configs) return {};
    return configs.reduce<Record<string, SystemConfigRecord[]>>((acc, cfg) => {
      const section = cfg.configSection;
      if (!acc[section]) acc[section] = [];
      acc[section].push(cfg);
      return acc;
    }, {});
  }, [configs]);

  const sectionKeys = useMemo(() => Object.keys(grouped), [grouped]);

  const currentTab = activeTab && sectionKeys.includes(activeTab)
    ? activeTab
    : sectionKeys[0] ?? null;

  const currentConfigs = currentTab ? grouped[currentTab] ?? [] : [];

  const startEditing = (config: SystemConfigRecord) => {
    setEditingKey(config.configKey);
    setEditValue(
      config.configType === 'json' && typeof config.value !== 'string'
        ? JSON.stringify(config.value, null, 2)
        : config.value
    );
    setEditReason('');
  };

  const cancelEditing = () => {
    setEditingKey(null);
    setEditValue(null);
    setEditReason('');
  };

  const handleSave = (config: SystemConfigRecord) => {
    let finalValue = editValue;

    if (config.configType === 'json' && typeof editValue === 'string') {
      try {
        finalValue = JSON.parse(editValue);
      } catch {
        addNotification({ type: 'error', message: 'JSON non valido' });
        return;
      }
    }

    updateMutation.mutate(
      { configKey: config.configKey, value: finalValue, updateReason: editReason || undefined },
      {
        onSuccess: () => {
          addNotification({ type: 'success', message: `"${config.configKey}" aggiornato con successo` });
          cancelEditing();
        },
        onError: (err: Error) => {
          addNotification({ type: 'error', message: err.message || 'Errore durante il salvataggio' });
        },
      }
    );
  };

  const handleInvalidateCache = () => {
    cacheMutation.mutate(undefined, {
      onSuccess: () => addNotification({ type: 'success', message: 'Cache invalidata con successo' }),
      onError: (err: Error) => addNotification({ type: 'error', message: err.message || 'Errore invalidazione cache' }),
    });
  };

  if (isLoading) {
    return (
      <ManagementLayout>
        <div className={styles.loading}>Caricamento configurazioni...</div>
      </ManagementLayout>
    );
  }

  if (error) {
    return (
      <ManagementLayout>
        <div className={styles.error}>
          <h2>Errore nel caricamento</h2>
          <p>{error instanceof Error ? error.message : 'Errore sconosciuto'}</p>
          <button onClick={() => window.location.reload()}>Riprova</button>
        </div>
      </ManagementLayout>
    );
  }

  return (
    <ManagementLayout>
      <Head>
        <title>Configurazioni Sistema - Ten Penny Novels Management</title>
      </Head>

      <div className={styles.container}>
        <header className={styles.header}>
          <div>
            <h1>Configurazioni Sistema</h1>
            <p>Gestione configurazioni avanzate per sezione</p>
          </div>
          <button
            className={styles.editButton}
            onClick={handleInvalidateCache}
            disabled={cacheMutation.isPending}
          >
            {cacheMutation.isPending ? 'Invalidando...' : 'Invalida Cache'}
          </button>
        </header>

        <nav className={styles.tabBar}>
          {sectionKeys.map((section) => (
            <button
              key={section}
              className={`${styles.tab} ${currentTab === section ? styles.tabActive : ''}`}
              onClick={() => { setActiveTab(section); cancelEditing(); }}
            >
              {SECTION_LABELS[section] || section}
              <span className={styles.tabCount}>{grouped[section].length}</span>
            </button>
          ))}
        </nav>

        {currentTab && (
          <div className={styles.tabPanel}>
            <div className={styles.configList}>
              {currentConfigs.map((cfg) => {
                const isEditing = editingKey === cfg.configKey;

                return (
                  <div
                    key={cfg._id}
                    className={`${styles.configRow} ${isEditing ? styles.configRowEditing : ''}`}
                  >
                    <div className={styles.configRowMain}>
                      <div className={styles.configInfo}>
                        <div className={styles.configName}>
                          <span className={styles.typeBadge}>{cfg.configType.toUpperCase()}</span>
                          <span className={styles.configKey}>{cfg.configKey}</span>
                        </div>
                        {cfg.description && (
                          <span className={styles.configDesc}>{cfg.description}</span>
                        )}
                      </div>

                      <div className={styles.configValueCol}>
                        {!isEditing && (
                          <>
                            <span
                              className={`${styles.configValuePreview} ${cfg.configType === 'boolean' ? (cfg.value ? styles.valActive : styles.valInactive) : ''}`}
                            >
                              {formatValuePreview(cfg)}
                            </span>
                            <button className={styles.editButton} onClick={() => startEditing(cfg)}>
                              Modifica
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {isEditing && (
                      <div className={styles.configEditPanel}>
                        <ConfigValueEditor
                          config={cfg}
                          value={editValue}
                          onChange={setEditValue}
                        />
                        <div className={styles.configEditFooter}>
                          <input
                            type="text"
                            placeholder="Motivo modifica (opzionale)"
                            value={editReason}
                            onChange={(e) => setEditReason(e.target.value)}
                            className={styles.reasonInput}
                          />
                          <div className={styles.configEditActions}>
                            <button
                              className={styles.cancelButton}
                              onClick={cancelEditing}
                              disabled={updateMutation.isPending}
                            >
                              Annulla
                            </button>
                            <button
                              className={styles.saveButton}
                              onClick={() => handleSave(cfg)}
                              disabled={updateMutation.isPending}
                            >
                              {updateMutation.isPending ? 'Salvataggio...' : 'Salva'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {!isEditing && cfg.metadata?.lastUpdatedAt && (
                      <span className={styles.configMeta}>
                        Aggiornato: {new Date(cfg.metadata.lastUpdatedAt).toLocaleString('it-IT')}
                        {cfg.metadata.updateReason && ` — ${cfg.metadata.updateReason}`}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </ManagementLayout>
  );
}
