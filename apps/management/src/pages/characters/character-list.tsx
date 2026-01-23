import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { ManagementLayout } from '@/components/ManagementLayout';
import { ConfigurableDataTable } from '@/components/shared/ConfigurableDataTable';
import { CharacterReviewPanel } from '@/components/character/CharacterReviewPanel';
import { ColumnVisibilityToggle } from '@/components/shared/ColumnVisibilityToggle';
import { AuthContext } from '@/lib/auth';
import { useAuditLogger } from '@/hooks/useAuditLogger';
import { characterAPI } from '@/lib/api';
import { useTableConfig } from '@/hooks/useTableConfig';
import styles from '@/styles/pages/CharacterList.module.scss';

const API_GATEWAY_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'https://api.tenpennynovels.com';
 
interface Character {
  id: string;
  characterName: string;
  characterSurname: string;
  userId: string;
  username: string;
  occupation: string;
  socialClass: string;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'DELETED';
  createdAt: Date;
  submittedAt?: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  rejectionReason?: string;
  lastActivity?: Date;
  stats: {
    str: number;
    dex: number;
    int: number;
    con: number;
    app: number;
    pow: number;
    siz: number;
    edu: number;
  } | null;
  skills?: Record<string, number>;
  backstory?: string;
  notes?: string;
  characterRoles: string[];
  corporationMemberships: string[];
  equipment?: string[];
}

interface CharacterListProps {
  authContext: AuthContext;
}

export default function CharacterList({ authContext }: CharacterListProps) {
  const router = useRouter();
  const [currentCharacterId, setCurrentCharacterId] = useState<string | null>(null);
  const [reviewPanelOpen, setReviewPanelOpen] = useState(false);
  const [charactersData, setCharactersData] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCharacters, setSelectedCharacters] = useState<Character[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Check if current user can access this page (canAccessAdminPanel + master/moderatore/amministratore/gestore roles)
  const canAccessAdminPanel = authContext?.user?.canAccessAdminPanel;
  const userRoles = authContext?.user?.userRoles || [];
  const characterRoles = authContext?.user?.characterRoles || [];
  
  // Can access if: has admin panel access AND (is gestore OR has master/moderatore/amministratore character role)
  const canAccessPage = canAccessAdminPanel && (
    userRoles.includes('gestore') ||
    characterRoles.includes('master') ||
    characterRoles.includes('moderatore') ||
    characterRoles.includes('amministratore')
  );

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
  } = useTableConfig('character-list');

  // Pagination state
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 25, // Fixed value to avoid re-render loop
    total: 0
  });
  
  // Audit logging hook
  const auditLogger = useAuditLogger(authContext);

  const fetchCharacters = async (page = 1, pageSize = 25) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_GATEWAY_URL}/admin/characters?page=${page}&pageSize=${pageSize}`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        const characters = data.list || [];
        setCharactersData(characters);
        
        setPagination(prev => ({
          ...prev,
          page: data.pagination?.page || page,
          total: data.pagination?.total || characters.length
        }));
        
        // Log successful data fetch
        auditLogger.logPageAccess('characters/character-list', {
          totalCharacters: characters.length,
          statusCounts: getStatusCounts(characters)
        });
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (err) {
      console.error('Errore caricamento personaggi:', err);
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
      
      auditLogger.logError(
        'characters.fetch',
        'characters',
        { endpoint: '/admin/characters' },
        err instanceof Error ? err.message : 'Network error'
      );
        
      // Set empty array on error - no mock data fallback
      setCharactersData([]);
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    // Don't do anything if auth is still loading
    if (authContext?.isLoading) {
      return;
    }
    
    if (!canAccessPage) {
      router.push('/access-denied');
      return;
    }
    
    fetchCharacters(pagination.page, pagination.pageSize);
  }, [canAccessPage, authContext?.isLoading]); // Check access before loading

  const handlePageChange = (newPage: number) => {
    fetchCharacters(newPage, pagination.pageSize);
  };

  const handlePageSizeChange = (newSize: number) => {
    setPagination(prev => ({ ...prev, pageSize: newSize }));
    fetchCharacters(1, newSize);
  };

  const getStatusCounts = (characters: Character[]) => {
    if (!Array.isArray(characters)) return {};
    const counts: Record<string, number> = {};
    characters.forEach(char => {
      counts[char.status] = (counts[char.status] || 0) + 1;
    });
    return counts;
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

  const getRolesBadges = (roles: string[]) => {
    if (!roles || roles.length === 0) return null;
    
    return (
      <div className={styles.rolesBadges}>
        {roles.map(role => (
          <span key={role} className={`${styles.roleBadge} ${styles[`role${role.charAt(0).toUpperCase()}${role.slice(1)}`]}`}>
            {role}
          </span>
        ))}
      </div>
    );
  };

  const formatDate = (date: Date | string | undefined) => {
    if (!date) return '-';
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const calculateTotalStats = (stats: Character['stats']) => {
    if (!stats) return 0;
    return Object.values(stats).reduce((sum, stat) => sum + stat, 0);
  };

  // Handle table actions from configuration
  const handleAction = (actionKey: string, character: Character) => {
    switch (actionKey) {
      case 'view':
        setCurrentCharacterId(character.id);
        setReviewPanelOpen(true);
        
        // Log character view
        auditLogger.logSuccess('character.view', 'characters', {
          characterId: character.id,
          characterName: `${character.characterName} ${character.characterSurname}`,
          characterStatus: character.status
        });
        break;
      default:
        console.warn(`Unknown action: ${actionKey}`);
    }
  };

  // Handle bulk actions from configuration
  const handleBulkAction = (actionKey: string, characters: Character[]) => {
    switch (actionKey) {
      default:
        console.warn(`Unknown bulk action: ${actionKey}`);
    }
  };

  // Custom renderers for ConfigurableDataTable
  const customRenderers = {
    characterInfo: (_: any, character: Character) => (
      <div className={styles.characterInfo}>
        <div className={styles.characterName}>
          {character.characterName} {character.characterSurname}
        </div>
        <div className={styles.characterMeta}>
          {character.occupation} - {character.socialClass}
        </div>
        {character.characterRoles && character.characterRoles.length > 0 && (
          <div className={styles.characterRoles}>
            {getRolesBadges(character.characterRoles)}
          </div>
        )}
      </div>
    ),
    statusBadge: (value: any) => getStatusBadge(value),
    dateInfo: (value: any) => (
      <div className={styles.dateInfo}>
        <div className={styles.dateValue}>{formatDate(value)}</div>
      </div>
    ),
    rolesBadges: (roles: string[]) => getRolesBadges(roles),
    corporationsList: (corporations: string[]) => (
      <div className={styles.corporationsDetail}>
        {corporations && corporations.map(corp => (
          <span key={corp} className={styles.corporationBadge}>
            {corp}
          </span>
        ))}
      </div>
    ),
    statsPreview: (_: any, character: Character) => (
      <div className={styles.statsPreview}>
        {character.stats ? (
          <>
            <span className={styles.statTotal}>
              Tot: {calculateTotalStats(character.stats)}
            </span>
            <div className={styles.statBreakdown}>
              STR:{character.stats.str} DEX:{character.stats.dex} INT:{character.stats.int}
            </div>
          </>
        ) : (
          <span className={styles.statTotal}>
            Statistiche non disponibili
          </span>
        )}
      </div>
    )
  };


  const statusCounts = getStatusCounts(charactersData);
  const totalCharacters = charactersData.length;

  if (!canAccessPage) {
    return null; // Will redirect in useEffect
  }

  return (
    <ManagementLayout authContext={authContext}>
      <Head>
        <title>TenpennyNovels Management - Lista Personaggi</title>
      </Head>
      
      <div className={styles.characterListPage}>
        <div className={styles.pageHeader}>
          <div className={styles.headerContent}>
            <h1 className={styles.pageTitle}>
              <span className={styles.titleIcon}>📋</span>
              Lista Personaggi
            </h1>
            <p className={styles.pageDescription}>
              Visualizza tutti i personaggi registrati nella piattaforma
            </p>
          </div>
          
          <div className={styles.pageActions}>
            <div className={styles.statsPanel}>
              <div className={styles.statItem}>
                <span className={styles.statValue}>{totalCharacters}</span>
                <span className={styles.statLabel}>Totali</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statValue}>{statusCounts.APPROVED || 0}</span>
                <span className={styles.statLabel}>Approvati</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statValue}>{statusCounts.PENDING_APPROVAL || 0}</span>
                <span className={styles.statLabel}>In Attesa</span>
              </div>
            </div>
            
            <div className={styles.headerButtons}>
              {tableConfig && (
                <ColumnVisibilityToggle
                  allColumns={allColumns}
                  columnVisibility={columnVisibility}
                  onToggleColumn={toggleColumnVisibility}
                  onResetToDefaults={resetColumnVisibility}
                />
              )}
              
              <button 
                onClick={() => fetchCharacters(pagination.page, pagination.pageSize)}
                className={styles.refreshButton}
                disabled={loading}
              >
                <span className={styles.refreshIcon}>↻</span>
                Aggiorna
              </button>
            </div>
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

        <ConfigurableDataTable
          tableName="character-list"
          data={charactersData}
          loading={loading}
          selectedItems={selectedCharacters}
          onSelectionChange={setSelectedCharacters}
          onAction={handleAction}
          onBulkAction={handleBulkAction}
          pagination={{
            page: pagination.page,
            pageSize: pagination.pageSize,
            total: pagination.total,
            onPageChange: handlePageChange,
            onPageSizeChange: handlePageSizeChange
          }}
          className={styles.charactersTable}
          externalConfig={tableConfig ? {
            config: tableConfig,
            loading: false,
            error: null,
            visibleColumns: tableConfig.columns.filter(col => {
              if (col.alwaysVisible) return true;
              return columnVisibility[col.key] ?? col.defaultVisible;
            }),
            getNestedValue,
            resolveConditionalValue,
            interpolateTemplate,
            customRenderers
          } : undefined}
        />

        {/* Character Review Panel */}
        <CharacterReviewPanel
          characterId={currentCharacterId || ''}
          profile="character-list"
          isOpen={reviewPanelOpen}
          onClose={() => {
            setReviewPanelOpen(false);
            setCurrentCharacterId(null);
          }}
          loading={false}
          error={error}
        />
      </div>
    </ManagementLayout>
  );
}

// Note: Authentication is now handled client-side via the ManagementLayout component
// No server-side props needed since we use API-based auth checking