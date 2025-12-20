import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { ManagementLayout } from '@/components/ManagementLayout';
import { ConfigurableDataTable } from '@/components/shared/ConfigurableDataTable';
import { SidePanel } from '@/components/shared/SidePanel';
import { ColumnVisibilityToggle } from '@/components/shared/ColumnVisibilityToggle';
import { AuthContext } from '@/lib/auth';
import { userAPI, BanUserData } from '@/lib/api';
import { logUserAction } from '@/lib/auditLogger';
import { useTableConfig } from '@/hooks/useTableConfig';
import styles from '@/styles/pages/UserManagement.module.scss';

interface BannedUser {
  id: string;
  username: string;
  email: string;
  displayName: string;
  banReason: string;
  bannedUntil: string | null;
  banScopes: string[];
  bannedAt: string | null;
  bannedBy: string;
  isBanned: boolean;
}

interface UserBanListProps {
  authContext: AuthContext;
}

export default function BanList({ authContext }: UserBanListProps) {
  const router = useRouter();
  const [bannedUsers, setBannedUsers] = useState<BannedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<BannedUser | null>(null);
  const [activeSidePanel, setActiveSidePanel] = useState<string | null>(null);
  const [sidePanelLoading, setSidePanelLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  } = useTableConfig('user-ban-list');

  // Pagination state
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: tableConfig?.table.pagination.defaultPageSize || 25,
    total: 0
  });

  const fetchBannedUsers = async (page = 1, pageSize = 25, filters = {}) => {
    try {
      setLoading(true);
      setError(null);

      const response = await userAPI.getUsers({ page, pageSize, ...filters });
      
      if (response.success && response.data) {
        // Transform users to banned user format - show ALL users, not just banned ones
        const transformedUsers: BannedUser[] = response.data.items.map(user => ({
          id: user.id,
          username: user.username,
          email: user.email,
          displayName: user.displayName,
          banReason: user.accountStatus?.banReason || (user.accountStatus?.isBanned ? 'No reason provided' : ''),
          bannedUntil: user.accountStatus?.bannedUntil || null,
          banScopes: user.accountStatus?.banScopes || [],
          bannedAt: user.accountStatus?.bannedAt || (user.accountStatus?.isBanned ? user.registrationInfo?.registeredAt : null),
          bannedBy: user.accountStatus?.bannedBy || (user.accountStatus?.isBanned ? 'System' : ''),
          isBanned: user.accountStatus?.isBanned || false
        }));

        setBannedUsers(transformedUsers);
        setPagination(prev => ({
          ...prev,
          page: response.data!.pagination.currentPage,
          total: response.data!.pagination.totalItems
        }));
      } else {
        throw new Error(response.error || 'Errore nel caricamento utenti bannati');
      }
    } catch (err) {
      console.error('Errore caricamento utenti bannati:', err);
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBannedUsers(pagination.page, pagination.pageSize);
  }, []);

  // Check for username filter from URL (when coming from user-list)
  useEffect(() => {
    if (router.query.username) {
      const usernameFilter = { username: router.query.username as string };
      fetchBannedUsers(1, pagination.pageSize, usernameFilter);
    }
  }, [router.query.username]);

  const handlePageChange = (newPage: number) => {
    fetchBannedUsers(newPage, pagination.pageSize);
  };

  const handlePageSizeChange = (newSize: number) => {
    setPagination(prev => ({ ...prev, pageSize: newSize }));
    fetchBannedUsers(1, newSize);
  };

  const openSidePanel = (panelKey: string, user: BannedUser) => {
    setCurrentUser(user);
    setActiveSidePanel(panelKey);
  };

  // Handle table actions from configuration
  const handleAction = (actionKey: string, user: BannedUser) => {
    switch (actionKey) {
      case 'ban':
        openSidePanel('ban', user);
        break;
      case 'unban':
        handleUnbanUser(user);
        break;
      default:
        console.warn(`Unknown action: ${actionKey}`);
    }
  };

  // Handle bulk actions from configuration (none for now)
  const handleBulkAction = (actionKey: string, users: BannedUser[]) => {
    switch (actionKey) {
      default:
        console.warn(`Unknown bulk action: ${actionKey}`);
    }
  };

  // Handle SidePanel actions
  const handleSidePanelAction = async (actionKey: string, formData: Record<string, any>) => {
    if (!currentUser) return;

    setSidePanelLoading(true);
    
    try {
      switch (actionKey) {
        case 'save':
          // Only handle new bans (edit functionality removed)
          await handleBanUser(currentUser, formData);
          break;
        default:
          console.warn(`Unknown SidePanel action: ${actionKey}`);
          return;
      }

      // Close panel on success
      setActiveSidePanel(null);
      setCurrentUser(null);
    } catch (err) {
      console.error('Error in SidePanel action:', err);
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setSidePanelLoading(false);
    }
  };

  const handleBanUser = async (user: BannedUser, formData: Record<string, any>) => {
    const banData: BanUserData = {
      reason: formData.banReason,
      duration: formData.banDuration === 'permanent' ? 'permanent' : 'temporary',
      banScopes: formData.banScopes || [],
      bannedUntil: formData.banDuration !== 'permanent' ? calculateBanEndDate(formData.banDuration) : undefined
    };

    const response = await userAPI.updateBan(user.id, banData);
    
    if (response.success) {
      // Update local state
      setBannedUsers(prev => prev.map(u => 
        u.id === user.id 
          ? { 
              ...u, 
              isBanned: true,
              banReason: banData.reason,
              bannedUntil: banData.bannedUntil || null,
              banScopes: banData.banScopes,
              bannedAt: new Date().toISOString(),
              bannedBy: 'Administrator' // TODO: Get actual admin info
            }
          : u
      ));

      // Log audit action
      logUserAction.ban({
        userId: user.id,
        username: user.username,
        action: 'banned',
        details: banData
      });
    } else {
      throw new Error(response.error || 'Errore ban utente');
    }
  };


  const handleUnbanUser = async (user: BannedUser) => {
    if (!confirm(`Sei sicuro di voler sbannare ${user.username}?`)) {
      return;
    }

    try {
      setLoading(true);
      const response = await userAPI.unbanUser(user.id, 'Unbanned by administrator');
      
      if (response.success) {
        // Update local state - don't remove, just mark as not banned
        setBannedUsers(prev => prev.map(u => 
          u.id === user.id 
            ? { 
                ...u, 
                isBanned: false,
                banReason: '',
                bannedUntil: null,
                banScopes: [],
                bannedAt: null,
                bannedBy: ''
              }
            : u
        ));

        // Log audit action
        logUserAction.ban({
          userId: user.id,
          username: user.username,
          action: 'unbanned'
        });
      } else {
        throw new Error(response.error || 'Errore unban utente');
      }
    } catch (err) {
      console.error('Errore unban utente:', err);
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setLoading(false);
    }
  };

  const calculateBanEndDate = (duration: string): string => {
    const now = new Date();
    switch (duration) {
      case '1day':
        now.setDate(now.getDate() + 1);
        break;
      case '3days':
        now.setDate(now.getDate() + 3);
        break;
      case '1week':
        now.setDate(now.getDate() + 7);
        break;
      case '1month':
        now.setMonth(now.getMonth() + 1);
        break;
      default:
        now.setDate(now.getDate() + 1);
    }
    return now.toISOString();
  };

  return (
    <ManagementLayout authContext={authContext}>
      <Head>
        <title>TenpennyNovels Management - Gestione Ban Utenti</title>
      </Head>

      <div className={styles.userManagement}>
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>⚖️ Gestione Ban Utenti</h1>
          <div className={styles.pageActions}>
            {tableConfig && (
              <ColumnVisibilityToggle
                allColumns={allColumns}
                columnVisibility={columnVisibility}
                onToggleColumn={toggleColumnVisibility}
                onResetToDefaults={resetColumnVisibility}
              />
            )}
            
            <button 
              onClick={() => fetchBannedUsers(pagination.page, pagination.pageSize)}
              className={styles.refreshButton}
              disabled={loading}
            >
              <span className={styles.refreshIcon}>↻</span>
              Aggiorna
            </button>

            <button 
              onClick={() => router.push('/users/user-list')}
              className={styles.backButton}
            >
              ← Torna alla Lista Utenti
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

        <ConfigurableDataTable
          tableName="user-ban-list"
          data={bannedUsers}
          loading={loading}
          selectedItems={[]}
          onSelectionChange={() => {}} // No bulk selection for bans
          onAction={handleAction}
          onBulkAction={handleBulkAction}
          pagination={{
            page: pagination.page,
            pageSize: pagination.pageSize,
            total: pagination.total,
            onPageChange: handlePageChange,
            onPageSizeChange: handlePageSizeChange
          }}
          className={styles.usersTable}
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

        {/* SidePanel for New Bans Only */}
        {tableConfig && tableConfig.sidePanels && activeSidePanel && currentUser && (
          <SidePanel
            isOpen={true}
            config={{
              title: interpolateTemplate(tableConfig.sidePanels[activeSidePanel].title, currentUser),
              subtitle: tableConfig.sidePanels[activeSidePanel].subtitle,
              width: tableConfig.sidePanels[activeSidePanel].width,
              fields: tableConfig.sidePanels[activeSidePanel].fields,
              actions: tableConfig.sidePanels[activeSidePanel].actions.map((action: any) => ({
                ...action,
                loading: sidePanelLoading && action.key !== 'cancel'
              }))
            }}
            data={currentUser}
            loading={sidePanelLoading}
            columnVisibility={columnVisibility}
            getNestedValue={getNestedValue}
            setNestedValue={setNestedValue}
            onClose={() => {
              setActiveSidePanel(null);
              setCurrentUser(null);
            }}
            onAction={handleSidePanelAction}
          />
        )}
      </div>
    </ManagementLayout>
  );
}