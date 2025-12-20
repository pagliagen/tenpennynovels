import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import { ManagementLayout } from '@/components/ManagementLayout';
import { ConfigurableDataTable } from '@/components/shared/ConfigurableDataTable';
import { SidePanel } from '@/components/shared/SidePanel';
import { PredefinedValuesEditor } from '@/components/skills/PredefinedValuesEditor';
import type { AuthContext } from '@/lib/auth';
import { useTableConfig } from '@/hooks/useTableConfig';
import { useNotification } from '@/contexts/NotificationContext';
import styles from '@/styles/pages/SkillManagement.module.scss';

// Dynamically import chart component for performance
const SkillChart = dynamic(() => import('../components/charts/SkillChart'), {
  ssr: false
});

const API_BASE_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'http://localhost:8000';

interface Skill {
  _id: string;
  name: string;
  baseValue: string | number;
  category: 'general' | 'combat' | 'knowledge' | 'social' | 'technical' | 'special' | 'criminal' | 'physical' | 'artistic' | 'financial' | 'occult';
  description: string;
  visible: boolean;
  defaultSkill: boolean;
  sortOrder: number;
  isPlaceholder: boolean;
  placeholderType?: string;
  predefinedValues?: string[];
  canRollWithoutPoints: boolean;
  createdAt: string;
  updatedAt: string;
}

interface SkillStats {
  total: number;
  byCategory: Array<{
    category: string;
    count: number;
  }>;
  byType: {
    visible: number;
    hidden: number;
    defaultSkills: number;
    specialSkills: number;
    placeholderSkills: number;
    academicSkills: number;
  };
  usage: Array<{
    _id: string;
    avgValue: number;
    maxValue: number;
    usageCount: number;
  }>;
  recentlyUpdated: Array<{
    name: string;
    category: string;
    updatedAt: string;
  }>;
}

interface SkillsPageProps {
  authContext: AuthContext;
}

export default function SkillsManagement({ authContext }: SkillsPageProps) {
  const router = useRouter();
  const { showPrompt, showToast } = useNotification();

  // Table configuration hook
  const {
    config: tableConfig,
    loading: configLoading,
    error: configError
  } = useTableConfig('skill-list');

  const [skills, setSkills] = useState<Skill[]>([]);
  const [stats, setStats] = useState<SkillStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'skills' | 'analytics' | 'categories'>('skills');
  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [sidePanelLoading, setSidePanelLoading] = useState(false);
  const [selectedSkills, setSelectedSkills] = useState<Skill[]>([]);
  const [activeSidePanel, setActiveSidePanel] = useState<string | null>(null);
  const [currentSkill, setCurrentSkill] = useState<Skill | null>(null);

  // Pagination state
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: tableConfig?.table.pagination.defaultPageSize || 50,
    total: 0
  });

  // Column visibility
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({});

  // Initialize column visibility from config
  useEffect(() => {
    if (tableConfig?.columns) {
      const initialVisibility: Record<string, boolean> = {};
      tableConfig.columns.forEach(col => {
        initialVisibility[col.key] = col.defaultVisible !== false;
      });
      setColumnVisibility(initialVisibility);
    }
  }, [tableConfig]);

  // Load skills data
  useEffect(() => {
    fetchSkills(pagination.page, pagination.pageSize);
  }, [pagination.page, pagination.pageSize]);

  // Load stats
  useEffect(() => {
    if (pagination.page === 1) {
      fetchStats();
    }
  }, [pagination.page]);

  const fetchSkills = async (page: number, pageSize: number) => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: page.toString(),
        limit: pageSize.toString(),
        sortBy: 'sortOrder',
        sortOrder: 'asc'
      });

      const response = await fetch(`${API_BASE_URL}/admin/skills?${params}`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setSkills(data.data.skills);
        setPagination(prev => ({
          ...prev,
          total: data.data.total
        }));
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Errore caricamento skills');
      }
    } catch (err) {
      console.error('Error fetching skills:', err);
      setError('Errore di rete durante il caricamento skills');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/skills/stats`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data.data);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleCreateSkill = async (formData: Record<string, any>) => {
    const reason = await showPrompt('Please provide a reason for creating this skill:', 'Aggiornamento Manutenzione');
    if (!reason) return;

    const createData = {
      name: formData.name,
      category: formData.category || 'general',
      description: formData.description,
      baseValue: formData.baseValue || 0,
      visible: formData.visible !== undefined ? formData.visible : true,
      defaultSkill: formData.defaultSkill !== undefined ? formData.defaultSkill : false,
      sortOrder: formData.sortOrder || 0,
      isPlaceholder: formData.isPlaceholder !== undefined ? formData.isPlaceholder : false,
      placeholderType: formData.placeholderType || '',
      predefinedValues: formData.predefinedValues || undefined,
      canRollWithoutPoints: formData.canRollWithoutPoints !== undefined ? formData.canRollWithoutPoints : true,
      reason
    };

    const response = await fetch(`${API_BASE_URL}/admin/skills`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createData)
    });

    if (response.ok) {
      await fetchSkills(pagination.page, pagination.pageSize);
      setShowCreatePanel(false);
      showToast(`Skill "${formData.name}" creata con successo!`, 'success');
    } else {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Errore creazione skill');
    }
  };

  const handleUpdateSkill = async (skillId: string, formData: Record<string, any>) => {
    const reason = await showPrompt('Please provide a reason for updating this skill:', 'Aggiornamento Manutenzione');
    if (!reason) return;

    const updateData = {
      ...formData,
      reason
    };

    const response = await fetch(`${API_BASE_URL}/admin/skills/${skillId}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData)
    });

    if (response.ok) {
      await fetchSkills(pagination.page, pagination.pageSize);
      showToast('Skill aggiornata con successo!', 'success');
    } else {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Errore aggiornamento skill');
    }
  };

  const handleToggleVisible = async (skill: Skill) => {
    const action = skill.visible ? 'nascondere' : 'rendere visibile';
    if (!confirm(`Sei sicuro di voler ${action} questa skill?`)) return;

    const reason = await showPrompt(`Motivo per ${action} la skill:`, 'Aggiornamento Manutenzione');
    if (!reason) return;

    const response = await fetch(`${API_BASE_URL}/admin/skills/${skill._id}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visible: !skill.visible,
        reason
      })
    });

    if (response.ok) {
      await fetchSkills(pagination.page, pagination.pageSize);
      showToast('Visibilità skill aggiornata con successo!', 'success');
    } else {
      const errorData = await response.json();
      showToast(`Errore: ${errorData.error}`, 'error');
    }
  };

  const handleBulkAction = (actionKey: string, items: Record<string, any>[]) => {
    const skills = items as Skill[];

    (async () => {
      try {
        const reason = await showPrompt('Please provide a reason for this bulk operation:', 'Aggiornamento Manutenzione');
        if (!reason) return;

        const skillIds = skills.map(skill => skill._id);

        const payload: {
          operation: string;
          skillIds: string[];
          reason: string;
          data?: { category: string };
        } = {
          operation: actionKey,
          skillIds,
          reason
        };

        if (actionKey === 'update_category') {
          const category = await showPrompt('Enter new category:', '');
          if (!category) return;
          payload.data = { category };
        }

        const response = await fetch(`${API_BASE_URL}/admin/skills/bulk`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          await fetchSkills(pagination.page, pagination.pageSize);
          showToast('Operazione bulk completata con successo!', 'success');
        } else {
          const errorData = await response.json();
          showToast(`Errore: ${errorData.error}`, 'error');
        }
      } catch (error) {
        console.error('Error performing bulk action:', error);
        showToast('Errore durante l\'operazione bulk', 'error');
      }
    })();
  };

  const getNestedValue = (obj: any, path: string) => {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  };

  const setNestedValue = (obj: any, path: string, value: any) => {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    const target = keys.reduce((current, key) => {
      if (!current[key]) current[key] = {};
      return current[key];
    }, obj);
    target[lastKey] = value;
    return { ...obj };
  };

  const handleAction = (actionKey: string, skill: Skill) => {
    if (actionKey === 'edit') {
      setCurrentSkill(skill);
      setActiveSidePanel('edit');
    } else if (actionKey === 'toggle_visible') {
      handleToggleVisible(skill);
    }
  };

  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const handlePageSizeChange = (newSize: number) => {
    setPagination(prev => ({ ...prev, pageSize: newSize, page: 1 }));
  };

  const resolveConditionalValue = (config: any, row: any): any => {
    if (!config || typeof config !== 'object') return config;

    if (config.type === 'conditional') {
      const fieldValue = getNestedValue(row, config.field);
      return fieldValue ? config.trueValue : config.falseValue;
    }

    return config;
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      general: 'badge-primary',
      combat: 'badge-danger',
      knowledge: 'badge-info',
      social: 'badge-success',
      technical: 'badge-warning',
      special: 'badge-dark',
      criminal: 'badge-secondary',
      physical: 'badge-light',
      artistic: 'badge-pink',
      financial: 'badge-gold',
      occult: 'badge-purple'
    };
    return colors[category] || 'badge-primary';
  };

  if (configLoading || (loading && pagination.page === 1)) {
    return (
      <ManagementLayout authContext={authContext}>
        <Head>
          <title>Skills Management - TenpennyNovels</title>
        </Head>
        <div className={styles.loadingContainer}>
          <div className={styles.spinner}></div>
          <p>Caricamento sistema skills...</p>
        </div>
      </ManagementLayout>
    );
  }

  return (
    <ManagementLayout authContext={authContext}>
      <Head>
        <title>Skills Management - TenpennyNovels</title>
      </Head>
      <div className={styles.skillManagement}>
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>
              🎯 Gestione Skills
            </h1>
            <p className={styles.pageSubtitle}>
              Amministrazione skills Call of Cthulhu e configurazione sistema abilità
            </p>
          </div>

          <div className={styles.pageActions}>
            <button
              onClick={() => setShowCreatePanel(true)}
              className={styles.btnPrimary}
              disabled={loading}
            >
              ➕ Nuova Skill
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

        {stats && (
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Skills Totali</div>
              <div className={styles.statValue}>{stats.total}</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Visibili</div>
              <div className={styles.statValue}>{stats.byType.visible}</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Base</div>
              <div className={styles.statValue}>{stats.byType.defaultSkills}</div>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className={styles.tabNavigation}>
          <button
            className={`${styles.tabButton} ${activeTab === 'skills' ? styles.active : ''}`}
            onClick={() => setActiveTab('skills')}
          >
            📋 Gestione Skills
          </button>
          <button
            className={`${styles.tabButton} ${activeTab === 'analytics' ? styles.active : ''}`}
            onClick={() => setActiveTab('analytics')}
          >
            📊 Analytics
          </button>
          <button
            className={`${styles.tabButton} ${activeTab === 'categories' ? styles.active : ''}`}
            onClick={() => setActiveTab('categories')}
          >
            🏷️ Categorie
          </button>
        </div>

      {/* Skills Management Tab */}
      {activeTab === 'skills' && tableConfig && (
        <>
          <ConfigurableDataTable
            tableName="skill-list"
            data={skills}
            loading={loading}
            selectedItems={selectedSkills}
            onSelectionChange={setSelectedSkills}
            onAction={handleAction}
            onBulkAction={handleBulkAction}
            pagination={{
              page: pagination.page,
              pageSize: pagination.pageSize,
              total: pagination.total,
              onPageChange: handlePageChange,
              onPageSizeChange: handlePageSizeChange
            }}
            className={styles.skillsTable}
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
          {tableConfig && tableConfig.sidePanels && activeSidePanel && currentSkill && (
            <SidePanel
              isOpen={true}
              config={{
                title: tableConfig.sidePanels.edit.title.replace('{name}', currentSkill.name),
                subtitle: tableConfig.sidePanels.edit.subtitle || '',
                width: tableConfig.sidePanels.edit.width,
                fields: tableConfig.sidePanels.edit.fields,
                actions: [
                  {
                    key: 'save',
                    label: 'Salva Modifiche',
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
              data={currentSkill}
              loading={sidePanelLoading}
              columnVisibility={columnVisibility}
              getNestedValue={getNestedValue}
              setNestedValue={setNestedValue}
              onClose={() => {
                setActiveSidePanel(null);
                setCurrentSkill(null);
              }}
              onAction={async (action: string, formData: Record<string, any>) => {
                if (action === 'save') {
                  try {
                    setSidePanelLoading(true);
                    await handleUpdateSkill(currentSkill._id, formData);
                    setActiveSidePanel(null);
                    setCurrentSkill(null);
                  } catch (err) {
                    console.error('Error updating skill:', err);
                    setError(err instanceof Error ? err.message : 'Errore sconosciuto');
                  } finally {
                    setSidePanelLoading(false);
                  }
                } else if (action === 'cancel') {
                  setActiveSidePanel(null);
                  setCurrentSkill(null);
                }
              }}
              customContent={(formData, setFormData) => (
                <>
                  {/* Mostra solo se isPlaceholder = true */}
                  {formData.isPlaceholder && (
                    <PredefinedValuesEditor
                      value={formData.predefinedValues || []}
                      onChange={(values) => setFormData(prev => ({ ...prev, predefinedValues: values }))}
                      disabled={sidePanelLoading}
                    />
                  )}
                </>
              )}
            />
          )}

          {/* SidePanel for Create */}
          {showCreatePanel && tableConfig && tableConfig.sidePanels && (
            <SidePanel
              isOpen={true}
              config={{
                title: 'Crea Nuova Skill',
                subtitle: 'Inserisci i dettagli della nuova skill',
                width: tableConfig.sidePanels.edit.width,
                fields: tableConfig.sidePanels.edit.fields,
                actions: [
                  {
                    key: 'save',
                    label: 'Crea Skill',
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
                category: 'general',
                description: '',
                baseValue: 0,
                visible: true,
                defaultSkill: false,
                sortOrder: 0,
                isPlaceholder: false,
                placeholderType: '',
                predefinedValues: [],
                canRollWithoutPoints: true
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
                    await handleCreateSkill(formData);
                  } catch (err) {
                    console.error('Error creating skill:', err);
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
                  {/* Mostra solo se isPlaceholder = true */}
                  {formData.isPlaceholder && (
                    <PredefinedValuesEditor
                      value={formData.predefinedValues || []}
                      onChange={(values) => setFormData(prev => ({ ...prev, predefinedValues: values }))}
                      disabled={sidePanelLoading}
                    />
                  )}
                </>
              )}
            />
          )}
        </>
      )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && stats && (
          <div className={styles.analyticsSection}>
            <div className={styles.statsBlock}>
              <h3>Panoramica Skills</h3>
              <div className={styles.statItems}>
                <div className={styles.statItem}>
                  <span>Skills Totali:</span>
                  <span>{stats.total}</span>
                </div>
                <div className={styles.statItem}>
                  <span>Visibili:</span>
                  <span>{stats.byType.visible}</span>
                </div>
                <div className={styles.statItem}>
                  <span>Skills Base:</span>
                  <span>{stats.byType.defaultSkills}</span>
                </div>
                <div className={styles.statItem}>
                  <span>Skills Speciali:</span>
                  <span>{stats.byType.specialSkills}</span>
                </div>
                <div className={styles.statItem}>
                  <span>Placeholder:</span>
                  <span>{stats.byType.placeholderSkills}</span>
                </div>
                <div className={styles.statItem}>
                  <span>Accademiche:</span>
                  <span>{stats.byType.academicSkills}</span>
                </div>
              </div>
            </div>

            <div className={styles.statsBlock}>
              <h3>Skills Più Utilizzate</h3>
              <div className={styles.usageList}>
                {stats.usage.slice(0, 10).map((item, index) => (
                  <div key={item._id} className={styles.usageItem}>
                    <span>#{index + 1}</span>
                    <span>{item._id}</span>
                    <span>
                      {item.usageCount} personaggi (avg: {Math.round(item.avgValue)})
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Category Distribution Chart */}
            <div className={styles.chartSection}>
              <h3>Distribuzione per Categoria</h3>
              <SkillChart
                data={stats.byCategory}
                type="category"
              />
            </div>

            {/* Recently Updated */}
            <div className={styles.recentUpdatesSection}>
              <h3>Aggiornamenti Recenti</h3>
              <div className={styles.recentList}>
                {stats.recentlyUpdated.map((skill, index) => (
                  <div key={index} className={styles.recentItem}>
                    <span>{skill.name}</span>
                    <span className={getCategoryColor(skill.category)}>
                      {skill.category}
                    </span>
                    <span>
                      {new Date(skill.updatedAt).toLocaleDateString('it-IT')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Categories Tab */}
        {activeTab === 'categories' && stats && (
          <div className={styles.categoriesSection}>
            <div className={styles.sectionHeader}>
              <h3>Distribuzione Categorie Skills</h3>
              <p>Overview delle categorie Call of Cthulhu e loro utilizzo</p>
            </div>

            <div className={styles.categoriesGrid}>
              {stats.byCategory.map((category) => (
                <div key={category.category} className={styles.categoryCard}>
                  <div className={styles.categoryHeader}>
                    <span className={getCategoryColor(category.category)}>
                      {category.category}
                    </span>
                    <span>{category.count} skills</span>
                  </div>
                  <div className={styles.categoryDescription}>
                    {getCategoryDescription(category.category)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </ManagementLayout>
  );
}

function getCategoryDescription(category: string) {
  const descriptions: Record<string, string> = {
    general: 'Skills generiche utilizzabili da tutti i personaggi',
    combat: 'Abilità di combattimento corpo a corpo e a distanza',
    knowledge: 'Conoscenze accademiche e specialistiche',
    social: 'Abilità interpersonali e di interazione sociale',
    technical: 'Competenze tecniche e artigianali',
    special: 'Abilità speciali o uniche',
    criminal: 'Attività illegali e clandestine',
    physical: 'Abilità fisiche e atletiche',
    artistic: 'Competenze artistiche e creative',
    financial: 'Gestione economica e finanziaria',
    occult: 'Conoscenze occulte e soprannaturali'
  };
  return descriptions[category] || 'Categoria skills';
}
