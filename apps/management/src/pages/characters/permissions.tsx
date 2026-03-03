/**
 * Character Permissions Page
 *
 * Gestione permessi granulari dei personaggi con divisione Game vs Admin.
 * Auto-enable permessi dai ruoli con indicatori visivi.
 */

import React, { useState, useMemo } from 'react';
import Head from 'next/head';
import { ManagementLayout } from '@/components/layout/ManagementLayout';
import { ConfigurableDataTable, FilterState } from '@/components/shared/ConfigurableDataTable';
import { SidePanel } from '@/components/shared/SidePanel';
import { PermissionCheckboxGroup, Permission } from '@/components/shared/PermissionCheckboxGroup';
import { useTableConfig } from '@/hooks/useTableConfig';
import { useTableFilters } from '@/hooks/useTableFilters';
import { useCharacters, useUpdateCharacter } from '@/hooks/api/useCharacters';
import { useNotificationStore } from '@/store/notificationStore';
import { useURLFilter } from '@/hooks/useURLFilter';
import { clearFilterHash } from '@/lib/utils/urlFilters';
import type { Character, CharacterListParams } from '@/types/api/Character';
import styles from '@/styles/pages/CharacterList.module.scss';

// ============================================================================
// ROLES AND PERMISSIONS (synced with services/unified-backend/src/config/roles/roles.json)
// ============================================================================

const CHARACTER_ROLES = [
  { value: 'personaggio', label: 'Personaggio' },
  { value: 'master', label: 'Master' },
  { value: 'moderatore', label: 'Moderatore' }
];

const ROLE_PERMISSIONS: Record<string, string[]> = {
  personaggio: ['chat.send', 'documents.read', 'locations.view', 'market.browse'],
  master: [
    'chat.send', 'chat.moderate', 'documents.read', 'documents.create', 'documents.edit_own',
    'documents.edit_all', 'locations.view', 'locations.manage', 'market.browse', 'market.manage',
    'quests.create', 'quests.edit', 'quests.delete', 'logs.view', 'character.assignPoints',
    'events.view', 'events.create'
  ],
  moderatore: [
    'chat.send', 'chat.moderate', 'chat.delete_messages', 'documents.read', 'documents.edit_all',
    'locations.view', 'market.browse'
  ]
};

const GAME_PERMISSIONS: Permission[] = [
  { value: 'chat.send', label: 'Inviare messaggi chat', category: 'chat', description: 'Permesso base per partecipare alle chat di gioco' },
  { value: 'chat.moderate', label: 'Moderare chat', category: 'chat', description: 'Moderare discussioni e contenuti in chat' },
  { value: 'chat.delete_messages', label: 'Eliminare messaggi', category: 'chat', description: 'Rimuovere messaggi inappropriati dalla chat' },
  { value: 'documents.read', label: 'Leggere documenti', category: 'documents', description: 'Visualizzare documenti di gioco pubblici' },
  { value: 'documents.create', label: 'Creare documenti', category: 'documents', description: 'Creare nuovi documenti di gioco' },
  { value: 'documents.edit_own', label: 'Modificare propri documenti', category: 'documents', description: 'Modificare documenti creati da sé' },
  { value: 'documents.edit_all', label: 'Modificare tutti i documenti', category: 'documents', description: 'Modificare qualsiasi documento di gioco' },
  { value: 'documents.delete', label: 'Eliminare documenti', category: 'documents', description: 'Rimuovere documenti dal sistema' },
  { value: 'locations.view', label: 'Visualizzare location', category: 'locations', description: 'Vedere le location disponibili' },
  { value: 'locations.manage', label: 'Gestire location', category: 'locations', description: 'Creare, modificare location di gioco' },
  { value: 'locations.delete', label: 'Eliminare location', category: 'locations', description: 'Rimuovere location permanentemente' },
  { value: 'market.browse', label: 'Navigare mercato', category: 'market', description: 'Vedere articoli in vendita' },
  { value: 'market.manage', label: 'Gestire mercato', category: 'market', description: 'Creare, modificare articoli nel mercato' },
  { value: 'quests.create', label: 'Creare quest', category: 'quests', description: 'Creare nuove missioni' },
  { value: 'quests.edit', label: 'Modificare quest', category: 'quests', description: 'Modificare missioni esistenti' },
  { value: 'quests.delete', label: 'Eliminare quest', category: 'quests', description: 'Rimuovere missioni' },
  { value: 'events.view', label: 'Visualizzare eventi', category: 'events', description: 'Vedere calendario eventi di gioco' },
  { value: 'events.create', label: 'Creare eventi', category: 'events', description: 'Creare nuovi eventi nel calendario' },
  { value: 'logs.view', label: 'Visualizzare log gioco', category: 'logs', description: 'Vedere log delle giocate' },
  { value: 'character.assignPoints', label: 'Assegnare punti personaggi', category: 'character', description: 'Modificare punti/stats dei personaggi in gioco' }
];

const ADMIN_PERMISSIONS: Permission[] = [
  { value: 'users.view', label: 'Visualizzare utenti', category: 'users', description: 'Accedere alla lista utenti (pagina /users/user-list)' },
  { value: 'users.edit', label: 'Modificare utenti', category: 'users', description: 'Modificare dati account utente' },
  { value: 'users.delete', label: 'Eliminare utenti', category: 'users', description: 'Eliminare account utente permanentemente' },
  { value: 'users.warn', label: 'Avvisare utenti', category: 'users', description: 'Inviare warning ufficiali agli utenti' },
  { value: 'users.mute', label: 'Silenziare utenti', category: 'users', description: 'Mettere utenti in mute temporaneo' },
  { value: 'users.ban', label: 'Bannare utenti', category: 'users', description: 'Bannare utenti dal sistema (pagina /users/ban-list)' },
  { value: 'characters.approve', label: 'Approvare personaggi', category: 'characters', description: 'Approvare personaggi in attesa (pagina /characters/character-pending)' },
  { value: 'characters.reject', label: 'Rifiutare personaggi', category: 'characters', description: 'Rifiutare richieste di creazione personaggi' },
  { value: 'characters.manage_permissions', label: 'Gestire permessi personaggi', category: 'characters', description: 'Modificare ruoli e permessi dei personaggi (pagina /characters/permissions)' },
  { value: 'system.view_audit_logs', label: 'Visualizzare audit logs', category: 'system', description: 'Accedere ai log di audit del sistema (pagina /system/audit-logs)' },
  { value: 'system.broadcast', label: 'Broadcast messaggi', category: 'system', description: 'Inviare messaggi broadcast a tutti gli utenti (pagina /system/broadcast)' },
  { value: 'system.manage_config', label: 'Gestire configurazioni', category: 'system', description: 'Modificare configurazioni di sistema (pagina /system/configurations)' },
  { value: 'system.maintenance_mode', label: 'Modalità manutenzione', category: 'system', description: 'Attivare/disattivare manutenzione sistema (pagina /system/maintenance)' },
  { value: 'system.manage_roles', label: 'Gestire ruoli', category: 'system', description: 'Modificare ruoli e permessi di altri utenti' },
  { value: 'logs.view_moderation', label: 'Visualizzare log moderazione', category: 'logs', description: 'Vedere log azioni di moderazione admin' }
];

export default function CharacterPermissions() {
  // State
  const { filters, params, setParams, handleFilterChange } = useTableFilters<CharacterListParams>({
    page: 1,
    pageSize: 25,
    sortBy: 'metadata.createdAt',
    sortOrder: 'desc'
  });
  const [activeSidePanel, setActiveSidePanel] = useState<'edit' | null>(null);
  const [currentCharacter, setCurrentCharacter] = useState<Character | null>(null);

  // Local state for permissions form
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedGamePerms, setSelectedGamePerms] = useState<string[]>([]);
  const [selectedAdminPerms, setSelectedAdminPerms] = useState<string[]>([]);
  const [isGestore, setIsGestore] = useState(false);

  // Hooks
  const urlFilter = useURLFilter<{ userId?: string }>();

  // Apply URL filter to params
  const filteredParams = useMemo(() => {
    if (urlFilter?.userId) {
      return { ...params, userId: urlFilter.userId };
    }
    return params;
  }, [params, urlFilter]);

  const { data, isLoading, error } = useCharacters(filteredParams);
  const tableConfig = useTableConfig('character-permissions');
  const updateCharacter = useUpdateCharacter();
  const addNotification = useNotificationStore(state => state.addNotification);

  // Prepare visible columns
  const visibleColumns = useMemo(() => {
    if (!tableConfig.config) return [];
    return tableConfig.config.columns.filter(
      col => tableConfig.columnVisibility[col.key] !== false
    );
  }, [tableConfig.config, tableConfig.columnVisibility]);

  // Calculate permissions granted by selected roles
  const roleGrantedPermissions = useMemo(() => {
    const perms = new Set<string>();
    selectedRoles.forEach(role => {
      ROLE_PERMISSIONS[role]?.forEach(perm => perms.add(perm));
    });
    return Array.from(perms);
  }, [selectedRoles]);

  // Map permission -> role label
  const permissionRoleLabels = useMemo(() => {
    const labels: Record<string, string> = {};
    selectedRoles.forEach(role => {
      const roleLabel = CHARACTER_ROLES.find(r => r.value === role)?.label || role;
      ROLE_PERMISSIONS[role]?.forEach(perm => {
        if (!labels[perm]) {
          labels[perm] = roleLabel;
        }
      });
    });
    return labels;
  }, [selectedRoles]);

  /**
   * Handler azioni row
   */
  const handleAction = async (action: string, character: Character) => {
    if (action === 'edit-permissions') {
      // DEBUG: Log character data to verify fields
      console.log('📊 Character data:', {
        fullName: character.fullName,
        isGestore: character.isGestore,
        characterRoles: character.characterRoles,
        characterPermissions: character.characterPermissions
      });

      setCurrentCharacter(character);
      setSelectedRoles(character.characterRoles || []);
      setSelectedGamePerms(character.characterPermissions?.filter(p =>
        GAME_PERMISSIONS.some(gp => gp.value === p)
      ) || []);
      setSelectedAdminPerms(character.characterPermissions?.filter(p =>
        ADMIN_PERMISSIONS.some(ap => ap.value === p)
      ) || []);
      setIsGestore(character.isGestore || false);
      setActiveSidePanel('edit');
    }
  };

  /**
   * Handler save permissions
   */
  const handleSavePermissions = async () => {
    if (!currentCharacter) return;

    try {
      // Merge game + admin permissions (excluding role-granted ones to avoid redundancy)
      const manualPerms = [
        ...selectedGamePerms.filter(p => !roleGrantedPermissions.includes(p)),
        ...selectedAdminPerms.filter(p => !roleGrantedPermissions.includes(p))
      ];

      await updateCharacter.mutateAsync({
        id: currentCharacter._id,
        data: {
          isGestore,
          characterRoles: selectedRoles,
          characterPermissions: manualPerms
        }
      });

      addNotification({ type: 'success', message: 'Permessi aggiornati con successo' });
      setActiveSidePanel(null);
      setCurrentCharacter(null);
    } catch (error) {
      addNotification({
        type: 'error',
        message: error instanceof Error ? error.message : 'Errore nell\'aggiornamento'
      });
    }
  };

  /**
   * Handler pagination
   */
  const handlePageChange = (page: number) => {
    setParams(prev => ({ ...prev, page }));
  };

  const handlePageSizeChange = (pageSize: number) => {
    setParams(prev => ({ ...prev, pageSize, page: 1 }));
  };

  /**
   * Handler sorting
   */
  const handleSortChange = (sortBy: string, sortOrder: 'asc' | 'desc') => {
    setParams(prev => ({ ...prev, sortBy, sortOrder, page: 1 }));
  };


  /**
   * Render error state
   */
  if (error) {
    return (
      <ManagementLayout>
        <div className={styles.errorContainer}>
          <h2>Errore nel caricamento personaggi</h2>
          <p>{error instanceof Error ? error.message : 'Errore sconosciuto'}</p>
          <button onClick={() => window.location.reload()}>Riprova</button>
        </div>
      </ManagementLayout>
    );
  }

  return (
    <ManagementLayout>
      <Head>
        <title>Gestione Permessi Personaggi - TenpennyNovels Management</title>
      </Head>

      <div className={styles.characterList}>
        <header className={styles.header}>
          <h1>Gestione Permessi Personaggi</h1>
          <p>Totale: {data?.pagination.totalItems ?? 0} personaggi</p>
        </header>

        {/* Filter Badge */}
        {urlFilter?.userId && (
          <div className={styles.filterBadge}>
            <span className={styles.filterLabel}>
              🔓 Filtrato per utente
            </span>
            <button
              className={styles.filterRemove}
              onClick={() => {
                clearFilterHash();
                window.location.reload();
              }}
              title="Rimuovi filtro"
            >
              ✕
            </button>
          </div>
        )}

        <ConfigurableDataTable<Character>
          tableName="character-permissions"
          data={data?.items ?? []}
          loading={isLoading || tableConfig.loading}
          onAction={handleAction}
          pagination={{
            page: params.page,
            pageSize: params.pageSize,
            total: data?.pagination.totalItems ?? 0,
            onPageChange: handlePageChange,
            onPageSizeChange: handlePageSizeChange
          }}
          sortBy={params.sortBy}
          sortOrder={params.sortOrder}
          onSortChange={handleSortChange}
          filters={filters}
          onFilterChange={handleFilterChange}
          externalConfig={tableConfig.config ? {
            config: tableConfig.config,
            visibleColumns: visibleColumns,
            getNestedValue: tableConfig.getNestedValue,
            resolveConditionalValue: tableConfig.resolveConditionalValue
          } : undefined}
        />

        {/* Side Panel: Edit Permissions */}
        {activeSidePanel === 'edit' && currentCharacter && (
          <SidePanel
            isOpen={true}
            config={{
              title: `Modifica Permessi - ${currentCharacter.fullName}`,
              subtitle: 'Gestisci ruoli e permessi del personaggio',
              width: 'xlarge',
              fields: [],
              actions: [
                { key: 'save', label: 'Salva', type: 'primary', loading: updateCharacter.isPending },
                { key: 'cancel', label: 'Annulla', type: 'secondary', loading: false }
              ]
            }}
            data={{}}
            customContent={
              <div style={{ padding: '1rem' }}>
                {/* Gestore Checkbox */}
                <div style={{ marginBottom: '2rem', padding: '1rem', background: '#f8f9fa', borderRadius: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={isGestore}
                      onChange={(e) => setIsGestore(e.target.checked)}
                      style={{ width: '20px', height: '20px' }}
                    />
                    <strong style={{ fontSize: '1.1rem' }}>Gestore (Super-Admin)</strong>
                  </label>
                  <p style={{ margin: '0.5rem 0 0 1.75rem', color: '#6c757d', fontSize: '0.9rem' }}>
                    Il flag Gestore garantisce tutti i permessi automaticamente
                  </p>
                </div>

                {/* Character Roles */}
                <div style={{ marginBottom: '2rem', padding: '1rem', background: '#f8f9fa', borderRadius: '8px' }}>
                  <h3 style={{ marginBottom: '1rem' }}>Ruoli Personaggio</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {CHARACTER_ROLES.map(role => (
                      <label key={role.value} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={selectedRoles.includes(role.value)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedRoles([...selectedRoles, role.value]);
                            } else {
                              setSelectedRoles(selectedRoles.filter(r => r !== role.value));
                            }
                          }}
                          style={{ width: '18px', height: '18px' }}
                        />
                        <span style={{ fontWeight: 500 }}>{role.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Game Permissions */}
                <PermissionCheckboxGroup
                  title="🎮 Permessi di Gioco"
                  permissions={GAME_PERMISSIONS}
                  selectedPermissions={selectedGamePerms}
                  rolePermissions={roleGrantedPermissions}
                  roleLabels={permissionRoleLabels}
                  isGestore={isGestore}
                  onChange={setSelectedGamePerms}
                />

                {/* Admin Permissions */}
                <PermissionCheckboxGroup
                  title="⚙️ Permessi Admin"
                  permissions={ADMIN_PERMISSIONS}
                  selectedPermissions={selectedAdminPerms}
                  rolePermissions={[]} // Admin permissions are never granted by character roles
                  roleLabels={{}}
                  isGestore={isGestore}
                  onChange={setSelectedAdminPerms}
                />
              </div>
            }
            onAction={(action) => {
              if (action === 'save') {
                handleSavePermissions();
              } else if (action === 'cancel') {
                setActiveSidePanel(null);
                setCurrentCharacter(null);
              }
            }}
            onClose={() => {
              setActiveSidePanel(null);
              setCurrentCharacter(null);
            }}
          />
        )}
      </div>
    </ManagementLayout>
  );
}
