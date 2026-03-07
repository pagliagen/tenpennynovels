/**
 * System Configurations Page
 *
 * Gestione configurazioni di sistema: impostazioni di gioco, economia, moderazione.
 * Solo per admin con permesso system.configurations.
 *
 * @module pages/system/configurations
 */

import React, { useState } from 'react';
import Head from 'next/head';
import { ManagementLayout } from '@/components/layout/ManagementLayout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { systemAPI, SystemConfig } from '@/lib/api/system';
import { useNotificationStore } from '@/store/notificationStore';
import styles from '@/styles/pages/SystemConfig.module.scss';

export default function SystemConfigurations() {
  const queryClient = useQueryClient();
  const addNotification = useNotificationStore(state => state.addNotification);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState<Partial<SystemConfig>>({});

  // Fetch current configuration
  const { data: config, isLoading, error } = useQuery({
    queryKey: ['system', 'config'],
    queryFn: () => systemAPI.getConfig()
  });

  // Update configuration mutation
  const updateMutation = useMutation({
    mutationFn: (updates: Partial<SystemConfig>) => systemAPI.updateConfig(updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system', 'config'] });
      setEditMode(false);
      setFormData({});
      addNotification({ type: 'success', message: 'Configurazione aggiornata con successo' });
    },
    onError: (error: Error) => {
      addNotification({ type: 'error', message: error.message || 'Errore durante l\'aggiornamento' });
    }
  });

  // Initialize form data when entering edit mode
  const handleEditToggle = () => {
    if (!editMode && config) {
      setFormData(config);
    }
    setEditMode(!editMode);
  };

  // Handle form field changes
  const handleFieldChange = (section: keyof SystemConfig, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...(prev[section] || {}),
        [field]: value
      }
    }));
  };

  // Handle form submit
  const handleSave = () => {
    if (Object.keys(formData).length > 0) {
      updateMutation.mutate(formData);
    }
  };

  if (isLoading) {
    return (
      <ManagementLayout>
        <div className={styles.loading}>Caricamento configurazione...</div>
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

  const currentConfig = editMode ? (formData as SystemConfig) : (config as SystemConfig);

  return (
    <ManagementLayout>
      <Head>
        <title>Configurazioni Sistema - Ten Penny Novels Management</title>
      </Head>

      <div className={styles.container}>
        {/* Header */}
        <header className={styles.header}>
          <div>
            <h1>Configurazioni Sistema</h1>
            <p>Gestione impostazioni globali del sistema</p>
          </div>
          <button
            onClick={handleEditToggle}
            className={styles.editButton}
            disabled={updateMutation.isPending}
          >
            {editMode ? 'Annulla' : '✏️ Modifica'}
          </button>
        </header>

        {/* Game Settings Section */}
        <section className={styles.section}>
          <h2>🎮 Impostazioni Gioco</h2>
          <div className={styles.settingGrid}>
            <div className={styles.settingItem}>
              <label htmlFor="newCharacterApprovalRequired">Approvazione Nuovi Personaggi</label>
              <input
                id="newCharacterApprovalRequired"
                type="checkbox"
                checked={currentConfig?.gameSettings?.newCharacterApprovalRequired ?? false}
                disabled={!editMode}
                onChange={(e) => handleFieldChange('gameSettings', 'newCharacterApprovalRequired', e.target.checked)}
              />
              <span className={styles.helpText}>
                Richiede approvazione admin per nuovi personaggi creati
              </span>
            </div>

            <div className={styles.settingItem}>
              <label htmlFor="maxCharactersPerUser">Personaggi Massimi per Utente</label>
              <input
                id="maxCharactersPerUser"
                type="number"
                min={1}
                max={10}
                value={currentConfig?.gameSettings?.maxCharactersPerUser ?? 3}
                disabled={!editMode}
                onChange={(e) => handleFieldChange('gameSettings', 'maxCharactersPerUser', parseInt(e.target.value))}
              />
            </div>

            <div className={styles.settingItem}>
              <label htmlFor="characterCreationEnabled">Creazione Personaggi Abilitata</label>
              <input
                id="characterCreationEnabled"
                type="checkbox"
                checked={currentConfig?.gameSettings?.characterCreationEnabled ?? true}
                disabled={!editMode}
                onChange={(e) => handleFieldChange('gameSettings', 'characterCreationEnabled', e.target.checked)}
              />
              <span className={styles.helpText}>
                Permette agli utenti di creare nuovi personaggi
              </span>
            </div>

            <div className={styles.settingItem}>
              <label htmlFor="aiCharacterGenerationEnabled">Generazione AI Personaggi</label>
              <input
                id="aiCharacterGenerationEnabled"
                type="checkbox"
                checked={currentConfig?.gameSettings?.aiCharacterGenerationEnabled ?? false}
                disabled={!editMode}
                onChange={(e) => handleFieldChange('gameSettings', 'aiCharacterGenerationEnabled', e.target.checked)}
              />
              <span className={styles.helpText}>
                Abilita generazione assistita AI per personaggi
              </span>
            </div>
          </div>
        </section>

        {/* Economy Settings Section */}
        <section className={styles.section}>
          <h2>💰 Economia</h2>
          <div className={styles.settingGrid}>
            <div className={styles.settingItem}>
              <label htmlFor="startingCash">Contante Iniziale</label>
              <input
                id="startingCash"
                type="number"
                min={0}
                value={currentConfig?.economySettings?.startingCash ?? 100}
                disabled={!editMode}
                onChange={(e) => handleFieldChange('economySettings', 'startingCash', parseInt(e.target.value))}
              />
              <span className={styles.helpText}>£ in contante per nuovi personaggi</span>
            </div>

            <div className={styles.settingItem}>
              <label htmlFor="startingDeposit">Deposito Iniziale</label>
              <input
                id="startingDeposit"
                type="number"
                min={0}
                value={currentConfig?.economySettings?.startingDeposit ?? 0}
                disabled={!editMode}
                onChange={(e) => handleFieldChange('economySettings', 'startingDeposit', parseInt(e.target.value))}
              />
              <span className={styles.helpText}>£ in banca per nuovi personaggi</span>
            </div>

            <div className={styles.settingItem}>
              <label htmlFor="dailySalaryEnabled">Salario Giornaliero</label>
              <input
                id="dailySalaryEnabled"
                type="checkbox"
                checked={currentConfig?.economySettings?.dailySalaryEnabled ?? true}
                disabled={!editMode}
                onChange={(e) => handleFieldChange('economySettings', 'dailySalaryEnabled', e.target.checked)}
              />
              <span className={styles.helpText}>
                Assegna salario giornaliero ai personaggi
              </span>
            </div>
          </div>
        </section>

        {/* Moderation Settings Section */}
        <section className={styles.section}>
          <h2>🛡️ Moderazione</h2>
          <div className={styles.settingGrid}>
            <div className={styles.settingItem}>
              <label htmlFor="chatModerationEnabled">Moderazione Chat Abilitata</label>
              <input
                id="chatModerationEnabled"
                type="checkbox"
                checked={currentConfig?.moderationSettings?.chatModerationEnabled ?? true}
                disabled={!editMode}
                onChange={(e) => handleFieldChange('moderationSettings', 'chatModerationEnabled', e.target.checked)}
              />
              <span className={styles.helpText}>
                Abilita sistema automatico di moderazione chat
              </span>
            </div>

            <div className={styles.settingItem}>
              <label htmlFor="autoModerationLevel">Livello Auto-Moderazione</label>
              <select
                id="autoModerationLevel"
                value={currentConfig?.moderationSettings?.autoModerationLevel ?? 'medium'}
                disabled={!editMode}
                onChange={(e) => handleFieldChange('moderationSettings', 'autoModerationLevel', e.target.value)}
              >
                <option value="low">Basso</option>
                <option value="medium">Medio</option>
                <option value="high">Alto</option>
              </select>
              <span className={styles.helpText}>
                Sensibilità del filtro automatico
              </span>
            </div>
          </div>
        </section>

        {/* Save Actions */}
        {editMode && (
          <div className={styles.actions}>
            <button
              onClick={handleSave}
              disabled={updateMutation.isPending || Object.keys(formData).length === 0}
              className={styles.saveButton}
            >
              {updateMutation.isPending ? 'Salvataggio...' : '✓ Salva Modifiche'}
            </button>
          </div>
        )}
      </div>
    </ManagementLayout>
  );
}
