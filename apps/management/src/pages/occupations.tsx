import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { ManagementLayout } from '@/components/ManagementLayout';
import { ConfigurableDataTable } from '@/components/shared/ConfigurableDataTable';
import { SidePanel } from '@/components/shared/SidePanel';
import { ColumnVisibilityToggle } from '@/components/shared/ColumnVisibilityToggle';
import { RequiredSkillsEditor } from '@/components/shared/RequiredSkillsEditor';
import { BonusSkillsEditor } from '@/components/shared/BonusSkillsEditor';
import { AuthContext } from '@/lib/auth';
import { useTableConfig } from '@/hooks/useTableConfig';
import { useNotification } from '@/contexts/NotificationContext';
import styles from '@/styles/pages/OccupationManagement.module.scss';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'http://localhost:8000';

// Types
interface Occupation {
  _id: string;
  name: string;
  description: string;
  category: string;
  socialClass: string[];
  contacts: string;
  earnings: string;
  requiredSkills: Array<{
    skillId?: string;
    skillName: string;
    baseValue: number;
    isFixed?: boolean;
    alternatives?: Array<{
      skillId?: string;
      skillName: string;
    }>;
  }>;
  bonusSkills: Array<{
    skillId?: string;
    skillName: string;
    bonusValue: number;
  }>;
  typicalEmployers: string[];
  careerProgression?: string[];
  isActive: boolean;
  createdBy: {
    username: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface OccupationStats {
  total: number;
  active: number;
  inactive: number;
  byCategory: Array<{ name: string; count: number }>;
  bySocialClass: Array<{ name: string; count: number }>;
}

interface OccupationsPageProps {
  authContext: AuthContext;
}

export default function OccupationsPage({ authContext }: OccupationsPageProps) {
  // Notification hook
  const { showPrompt, showToast } = useNotification();

  const [occupations, setOccupations] = useState<Occupation[]>([]);
  const [stats, setStats] = useState<OccupationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedOccupations, setSelectedOccupations] = useState<Occupation[]>([]);
  const [currentOccupation, setCurrentOccupation] = useState<Occupation | null>(null);
  const [activeSidePanel, setActiveSidePanel] = useState<string | null>(null);
  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [sidePanelLoading, setSidePanelLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableSkills, setAvailableSkills] = useState<Array<{ _id: string; name: string }>>([]);
  const [loadingSkills, setLoadingSkills] = useState(false);

  // Table configuration with column visibility
  const {
    config: tableConfig,
    getNestedValue,
    setNestedValue,
    columnVisibility,
    toggleColumnVisibility,
    resetColumnVisibility,
    resolveConditionalValue,
    interpolateTemplate,
    allColumns
  } = useTableConfig('occupation-list');

  // Pagination state
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: tableConfig?.table.pagination.defaultPageSize || 25,
    total: 0
  });

  const fetchOccupations = async (page = 1, pageSize = 25) => {
    try {
      setLoading(true);
      setError(null);

      // Fetch occupations and stats in parallel
      const [occupationsResponse, statsResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/admin/occupations?page=${page}&limit=${pageSize}`, {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' }
        }),
        fetch(`${API_BASE_URL}/admin/occupations/stats`, {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' }
        })
      ]);

      if (occupationsResponse.ok && statsResponse.ok) {
        const occupationsData = await occupationsResponse.json();
        const statsData = await statsResponse.json();

        if (occupationsData.success) {
          setOccupations(occupationsData.data.occupations);
          setPagination(prev => ({
            ...prev,
            page: occupationsData.data.pagination.currentPage,
            total: occupationsData.data.pagination.totalItems
          }));
        }

        if (statsData.success) {
          setStats(statsData.data);
        }
      } else {
        throw new Error('Errore nel caricamento delle occupazioni');
      }
    } catch (err) {
      console.error('Errore caricamento occupazioni:', err);
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOccupations(pagination.page, pagination.pageSize);
  }, []);

  const fetchAvailableSkills = async () => {
    try {
      setLoadingSkills(true);
      const response = await fetch(`${API_BASE_URL}/admin/skills?limit=1000&visible=true`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setAvailableSkills(data.data.skills.map((s: any) => ({ _id: s._id, name: s.name })));
        }
      }
    } catch (error) {
      console.error('Error fetching skills:', error);
    } finally {
      setLoadingSkills(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    fetchOccupations(newPage, pagination.pageSize);
  };

  const handlePageSizeChange = (newSize: number) => {
    setPagination(prev => ({ ...prev, pageSize: newSize }));
    fetchOccupations(1, newSize);
  };

  const openSidePanel = (panelKey: string, occupation: Occupation) => {
    // Fetch available skills when opening panel
    fetchAvailableSkills();

    // Set occupation data directly (no JSON conversion needed)
    setCurrentOccupation(occupation);
    setActiveSidePanel(panelKey);
  };

  // Handle table actions from configuration
  const handleAction = (actionKey: string, occupation: Occupation) => {
    switch (actionKey) {
      case 'edit':
        openSidePanel('edit', occupation);
        break;
      case 'toggle_active':
        handleToggleActive(occupation);
        break;
      default:
        console.warn(`Unknown action: ${actionKey}`);
    }
  };

  // Handle bulk actions from configuration
  const handleBulkAction = async (actionKey: string, occupations: Occupation[]) => {
    const reason = await showPrompt('Fornisci una motivazione per questa operazione massiva:', 'Aggiornamento Manutenzione');
    if (!reason) return;

    try {
      let operation = actionKey;
      const occupationIds = occupations.map(occ => occ._id);

      const payload: {
        operation: string;
        occupationIds: string[];
        reason: string;
        data?: { category: string };
      } = {
        operation,
        occupationIds,
        reason
      };

      if (actionKey === 'update_category') {
        const category = await showPrompt('Inserisci la nuova categoria:', '');
        if (!category) return;
        payload.data = { category };
      }

      const response = await fetch(`${API_BASE_URL}/admin/occupations/bulk`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        setSelectedOccupations([]);
        fetchOccupations(pagination.page, pagination.pageSize);
        showToast('Operazione massiva completata con successo', 'success');
      } else {
        const errorData = await response.json();
        showToast(`Errore: ${errorData.error || 'Operazione massiva fallita'}`, 'error');
      }
    } catch (error) {
      console.error('Error performing bulk operation:', error);
      showToast('Impossibile eseguire l\'operazione massiva', 'error');
    }
  };

  // Handle toggle active status
  const handleToggleActive = async (occupation: Occupation) => {
    const reason = await showPrompt(`Fornisci una motivazione per ${occupation.isActive ? 'disattivare' : 'attivare'} questa occupazione:`, 'Aggiornamento Manutenzione');
    if (!reason) return;

    try {
      const response = await fetch(`${API_BASE_URL}/admin/occupations/${occupation._id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !occupation.isActive, reason })
      });

      if (response.ok) {
        fetchOccupations(pagination.page, pagination.pageSize);
        showToast(`Occupazione ${occupation.isActive ? 'disattivata' : 'attivata'} con successo`, 'success');
      } else {
        const errorData = await response.json();
        showToast(`Errore: ${errorData.error || 'Operazione fallita'}`, 'error');
      }
    } catch (error) {
      console.error('Error toggling occupation status:', error);
      showToast('Impossibile cambiare lo stato dell\'occupazione', 'error');
    }
  };

  // Handle bulk update of baseValue for all requiredSkills
  const handleBulkUpdateBaseValue = async () => {
    const newValueStr = await showPrompt('Inserisci il nuovo valore base per tutte le Required Skills (default: 40):', '40');
    if (newValueStr === null) return; // User cancelled

    const newValue = parseInt(newValueStr);
    if (isNaN(newValue) || newValue < 0 || newValue > 100) {
      showToast('Valore non valido. Inserisci un numero tra 0 e 100.', 'error');
      return;
    }

    const confirmMsg = `Sei sicuro di voler impostare baseValue a ${newValue} per TUTTE le Required Skills di TUTTE le occupazioni?`;
    if (!confirm(confirmMsg)) return;

    const reason = await showPrompt('Motivo dell\'aggiornamento massivo:', 'Aggiornamento Manutenzione');
    if (!reason) return;

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/admin/occupations/bulk-update-skills`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skillType: 'required',
          fieldToUpdate: 'baseValue',
          newValue,
          reason
        })
      });

      if (response.ok) {
        const result = await response.json();
        showToast(`Aggiornate ${result.data?.updatedCount || 0} occupazioni con successo!`, 'success');

        // Close any open SidePanel to force reload of fresh data
        setActiveSidePanel(null);
        setCurrentOccupation(null);

        fetchOccupations(pagination.page, pagination.pageSize);
      } else {
        const errorData = await response.json();
        showToast(`Errore: ${errorData.error || 'Operazione fallita'}`, 'error');
      }
    } catch (error) {
      console.error('Error bulk updating baseValue:', error);
      showToast('Errore durante l\'aggiornamento massivo', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Handle bulk update of bonusValue for all bonusSkills
  const handleBulkUpdateBonusValue = async () => {
    const newValueStr = await showPrompt('Inserisci il nuovo valore bonus per tutte le Bonus Skills (default: 30):', '30');
    if (newValueStr === null) return; // User cancelled

    const newValue = parseInt(newValueStr);
    if (isNaN(newValue) || newValue < 0 || newValue > 100) {
      showToast('Valore non valido. Inserisci un numero tra 0 e 100.', 'error');
      return;
    }

    const confirmMsg = `Sei sicuro di voler impostare bonusValue a ${newValue} per TUTTE le Bonus Skills di TUTTE le occupazioni?`;
    if (!confirm(confirmMsg)) return;

    const reason = await showPrompt('Motivo dell\'aggiornamento massivo:', 'Aggiornamento Manutenzione');
    if (!reason) return;

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/admin/occupations/bulk-update-skills`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skillType: 'bonus',
          fieldToUpdate: 'bonusValue',
          newValue,
          reason
        })
      });

      if (response.ok) {
        const result = await response.json();
        showToast(`Aggiornate ${result.data?.updatedCount || 0} occupazioni con successo!`, 'success');

        // Close any open SidePanel to force reload of fresh data
        setActiveSidePanel(null);
        setCurrentOccupation(null);

        fetchOccupations(pagination.page, pagination.pageSize);
      } else {
        const errorData = await response.json();
        showToast(`Errore: ${errorData.error || 'Operazione fallita'}`, 'error');
      }
    } catch (error) {
      console.error('Error bulk updating bonusValue:', error);
      showToast('Errore durante l\'aggiornamento massivo', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Handle SidePanel actions
  const handleSidePanelAction = async (actionKey: string, formData: Record<string, any>) => {
    if (!currentOccupation) return;

    setSidePanelLoading(true);

    try {
      switch (actionKey) {
        case 'save':
          await handleSaveOccupation(currentOccupation, formData);
          break;
        default:
          console.warn(`Unknown SidePanel action: ${actionKey}`);
          return;
      }

      // Close panel on success
      setActiveSidePanel(null);
      setCurrentOccupation(null);
    } catch (err) {
      console.error('Error in SidePanel action:', err);
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setSidePanelLoading(false);
    }
  };

  const handleSaveOccupation = async (occupation: Occupation, formData: Record<string, any>) => {
    const reason = await showPrompt('Fornisci una motivazione per questo aggiornamento:', 'Aggiornamento Manutenzione');
    if (!reason) return;

    const updateData = {
      name: formData.name,
      category: formData.category,
      description: formData.description,
      socialClass: formData.socialClass,
      contacts: formData.contacts,
      earnings: formData.earnings,
      requiredSkills: formData.requiredSkills || [],
      bonusSkills: formData.bonusSkills || [],
      isActive: formData.isActive,
      reason
    };

    const response = await fetch(`${API_BASE_URL}/admin/occupations/${occupation._id}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData)
    });

    if (response.ok) {
      // Update local state
      setOccupations(prev => prev.map(occ =>
        occ._id === occupation._id
          ? { ...occ, ...updateData }
          : occ
      ));
      showToast('Occupazione aggiornata con successo', 'success');
    } else {
      throw new Error('Errore aggiornamento occupazione');
    }
  };

  const handleCreateOccupation = async (formData: Record<string, any>) => {
    const reason = await showPrompt('Fornisci una motivazione per la creazione di questa occupazione:', 'Aggiornamento Manutenzione');
    if (!reason) return;

    const createData = {
      name: formData.name,
      category: formData.category || 'professioni_varie',
      description: formData.description,
      socialClass: formData.socialClass || ['middle'],
      contacts: formData.contacts || '',
      earnings: formData.earnings || '',
      requiredSkills: formData.requiredSkills || [],
      bonusSkills: formData.bonusSkills || [],
      typicalEmployers: formData.typicalEmployers || [],
      careerProgression: formData.careerProgression || [],
      isActive: formData.isActive !== undefined ? formData.isActive : true,
      reason
    };

    const response = await fetch(`${API_BASE_URL}/admin/occupations`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createData)
    });

    if (response.ok) {
      const result = await response.json();
      // Refresh the occupations list
      await fetchOccupations(pagination.page, pagination.pageSize);
      setShowCreatePanel(false);
      showToast(`Occupazione "${formData.name}" creata con successo!`, 'success');
    } else {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Errore creazione occupazione');
    }
  };

  if (loading && !occupations.length) {
    return (
      <ManagementLayout authContext={authContext}>
        <Head>
          <title>Occupations Management - TenpennyNovels</title>
        </Head>
        <div className={styles.loadingContainer}>
          <div className={styles.spinner}></div>
        </div>
      </ManagementLayout>
    );
  }

  return (
    <ManagementLayout authContext={authContext}>
      <Head>
        <title>Occupations Management - TenpennyNovels</title>
      </Head>

      <div className={styles.occupationManagement}>
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>💼 Gestione Occupazioni</h1>
          <div className={styles.pageActions}>
            <button
              onClick={() => {
                fetchAvailableSkills();
                setShowCreatePanel(true);
              }}
              className={styles.btnPrimary}
              disabled={loading}
            >
              Crea Nuova Occupazione
            </button>

            {tableConfig && (
              <ColumnVisibilityToggle
                allColumns={allColumns}
                columnVisibility={columnVisibility}
                onToggleColumn={toggleColumnVisibility}
                onResetToDefaults={resetColumnVisibility}
              />
            )}

            <button
              onClick={handleBulkUpdateBaseValue}
              className={styles.bulkUpdateButton}
              disabled={loading}
              title="Allinea tutti i valori base delle Required Skills"
            >
              📊 Allinea Base Values
            </button>

            <button
              onClick={handleBulkUpdateBonusValue}
              className={styles.bulkUpdateButton}
              disabled={loading}
              title="Allinea tutti i valori bonus delle Bonus Skills"
            >
              ⚡ Allinea Bonus Values
            </button>

            <button
              onClick={() => fetchOccupations(pagination.page, pagination.pageSize)}
              className={styles.refreshButton}
              disabled={loading}
            >
              <span className={styles.refreshIcon}>↻</span>
              Aggiorna
            </button>
          </div>
        </div>

        {error && (
          <div className={styles.errorBanner}>
            <span className={styles.errorIcon}>⚠️</span>
            {error}
            <button
              onClick={() => setError(null)}
              className={styles.closeError}
            >
              ✕
            </button>
          </div>
        )}

        {/* Stats Dashboard */}
        {stats && (
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Occupazioni Totali</div>
              <div className={styles.statValue}>{stats.total}</div>
              <div className={styles.statDetail}>
                {stats.active} attive, {stats.inactive} inattive
              </div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statLabel}>Categorie</div>
              <div className={styles.statValue}>{stats.byCategory.length}</div>
              <div className={styles.statDetail}>
                Top: {stats.byCategory[0]?.name} ({stats.byCategory[0]?.count})
              </div>
            </div>
          </div>
        )}

        <ConfigurableDataTable
          tableName="occupation-list"
          data={occupations}
          loading={loading}
          selectedItems={selectedOccupations}
          onSelectionChange={setSelectedOccupations}
          onAction={handleAction}
          onBulkAction={handleBulkAction}
          pagination={{
            page: pagination.page,
            pageSize: pagination.pageSize,
            total: pagination.total,
            onPageChange: handlePageChange,
            onPageSizeChange: handlePageSizeChange
          }}
          className={styles.occupationsTable}
          externalConfig={tableConfig ? {
            config: tableConfig,
            loading: false,
            error: null,
            visibleColumns: tableConfig.columns.filter(col => {
              if (col.alwaysVisible) return true;
              return columnVisibility[col.key] ?? col.defaultVisible;
            }),
            getNestedValue,
            resolveConditionalValue
          } : undefined}
        />

        {/* SidePanel for Edit */}
        {tableConfig && tableConfig.sidePanels && activeSidePanel && currentOccupation && (
          <SidePanel
            isOpen={true}
            config={{
              title: interpolateTemplate(tableConfig.sidePanels[activeSidePanel].title, currentOccupation),
              subtitle: tableConfig.sidePanels[activeSidePanel].subtitle,
              width: tableConfig.sidePanels[activeSidePanel].width,
              fields: tableConfig.sidePanels[activeSidePanel].fields,
              actions: tableConfig.sidePanels[activeSidePanel].actions.map((action: any) => ({
                ...action,
                loading: sidePanelLoading && action.key !== 'cancel'
              }))
            }}
            data={currentOccupation}
            loading={sidePanelLoading}
            columnVisibility={columnVisibility}
            getNestedValue={getNestedValue}
            setNestedValue={setNestedValue}
            onClose={() => {
              setActiveSidePanel(null);
              setCurrentOccupation(null);
            }}
            onAction={handleSidePanelAction}
            customContent={(formData, setFormData) => (
              <>
                <RequiredSkillsEditor
                  value={formData.requiredSkills || []}
                  onChange={(skills) => setFormData({ ...formData, requiredSkills: skills })}
                  availableSkills={availableSkills}
                  loading={loadingSkills}
                />
                <BonusSkillsEditor
                  value={formData.bonusSkills || []}
                  onChange={(skills) => setFormData({ ...formData, bonusSkills: skills })}
                  availableSkills={availableSkills}
                  loading={loadingSkills}
                />
              </>
            )}
          />
        )}

        {/* SidePanel for Create */}
        {showCreatePanel && tableConfig && tableConfig.sidePanels && tableConfig.sidePanels.edit && (
          <SidePanel
            isOpen={true}
            config={{
              title: 'Crea Nuova Occupazione',
              subtitle: 'Inserisci i dettagli della nuova occupazione',
              width: tableConfig.sidePanels.edit.width,
              fields: tableConfig.sidePanels.edit.fields,
              actions: [
                {
                  key: 'save',
                  label: 'Crea Occupazione',
                  type: 'primary' as const,
                  loading: sidePanelLoading
                },
                {
                  key: 'cancel',
                  label: 'Annulla',
                  type: 'secondary' as const
                }
              ]
            }}
            data={{
              name: '',
              category: 'professioni_varie',
              description: '',
              socialClass: ['middle'],
              contacts: '',
              earnings: '',
              requiredSkills: [],
              bonusSkills: [],
              typicalEmployers: [],
              careerProgression: [],
              isActive: true
            }}
            loading={sidePanelLoading}
            columnVisibility={columnVisibility}
            getNestedValue={getNestedValue}
            setNestedValue={setNestedValue}
            onClose={() => setShowCreatePanel(false)}
            onAction={async (action: string, formData: Record<string, any>) => {
              if (action === 'save') {
                try {
                  setSidePanelLoading(true);
                  await handleCreateOccupation(formData);
                } catch (err) {
                  console.error('Error creating occupation:', err);
                  setError(err instanceof Error ? err.message : 'Errore sconosciuto');
                } finally {
                  setSidePanelLoading(false);
                }
              } else if (action === 'cancel') {
                setShowCreatePanel(false);
              }
            }}
            customContent={(formData, setFormData) => (
              <>
                <RequiredSkillsEditor
                  value={formData.requiredSkills || []}
                  onChange={(skills) => setFormData({ ...formData, requiredSkills: skills })}
                  availableSkills={availableSkills}
                  loading={loadingSkills}
                />
                <BonusSkillsEditor
                  value={formData.bonusSkills || []}
                  onChange={(skills) => setFormData({ ...formData, bonusSkills: skills })}
                  availableSkills={availableSkills}
                  loading={loadingSkills}
                />
              </>
            )}
          />
        )}
      </div>
    </ManagementLayout>
  );
}
