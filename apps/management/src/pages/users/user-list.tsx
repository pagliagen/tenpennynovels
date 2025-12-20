import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { ManagementLayout } from '@/components/ManagementLayout';
import { ConfigurableDataTable } from '@/components/shared/ConfigurableDataTable';
import { SidePanel } from '@/components/shared/SidePanel';
import { ColumnVisibilityToggle } from '@/components/shared/ColumnVisibilityToggle';
import { AuthContext } from '@/lib/auth';
import { userAPI, UpdateUserData } from '@/lib/api';
import { logUserAction } from '@/lib/auditLogger';
import { useTableConfig } from '@/hooks/useTableConfig';
import styles from '@/styles/pages/UserManagement.module.scss';

interface User {
  id: string;
  username: string;
  email: string;
  displayName: string;
  canAccessAdminPanel: boolean;
  userRoles: string[];
  characterRoles: string[];
  characterPermissions: string[];
  accountStatus: {
    isActive: boolean;
    isEmailVerified: boolean;
    isBanned: boolean;
  };
  multipleCharactersAllowed: boolean;
  characters: Array<{
    id: string;
    name: string;
    status: string;
    occupation: string;
    socialClass: string;
    createdAt: string;
    lastActive: string;
  }>;
  activity: {
    lastLoginAt: string;
    loginCount: number;
    messagesSent: number;
    documentsCreated: number;
    moderationActions: number;
  };
  registrationInfo: {
    registeredAt: string;
    registrationSource: string;
    ipAddress: string;
    referrer: string;
  };
}

interface UserManagementProps {
  authContext: AuthContext;
}

export default function UserList({ authContext }: UserManagementProps) {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
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
  } = useTableConfig('user-list');

  // Pagination state
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: tableConfig?.table.pagination.defaultPageSize || 25,
    total: 0
  });

  const fetchUsers = async (page = 1, pageSize = 25) => {
    try {
      setLoading(true);
      setError(null);

      const response = await userAPI.getUsers({ page, pageSize });
      
      if (response.success && response.data) {
        // Mappiamo i dati dall'API alla struttura che ci aspettiamo
        setUsers(response.data.items);
        setPagination(prev => ({
          ...prev,
          page: response.data!.pagination.currentPage,
          total: response.data!.pagination.totalItems
        }));
      } else {
        throw new Error(response.error || 'Errore nel caricamento utenti');
      }
    } catch (err) {
      console.error('Errore caricamento utenti:', err);
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers(pagination.page, pagination.pageSize);
  }, []);

  const handlePageChange = (newPage: number) => {
    fetchUsers(newPage, pagination.pageSize);
  };

  const handlePageSizeChange = (newSize: number) => {
    setPagination(prev => ({ ...prev, pageSize: newSize }));
    fetchUsers(1, newSize);
  };

  const openSidePanel = (panelKey: string, user: User) => {
    setCurrentUser(user);
    setActiveSidePanel(panelKey);
  };



  // Handle table actions from configuration
  const handleAction = (actionKey: string, user: User) => {
    switch (actionKey) {
      case 'edit':
        openSidePanel('edit', user);
        break;
      default:
        console.warn(`Unknown action: ${actionKey}`);
    }
  };

  // Handle bulk actions from configuration
  const handleBulkAction = (actionKey: string, users: User[]) => {
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
          await handleSaveUser(currentUser, formData);
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

  const handleSaveUser = async (user: User, formData: Record<string, any>) => {
    const updateData: UpdateUserData = {
      username: formData.username,
      email: formData.email,
      displayName: formData.displayName,
      canAccessAdminPanel: formData.canAccessAdminPanel,
      userRoles: formData.userRoles || ['user'],
      isActive: getNestedValue(formData, 'accountStatus.isActive'),
      multipleCharactersAllowed: formData.multipleCharactersAllowed
    };

    const response = await userAPI.updateUser(user.id, updateData);
    
    if (response.success) {
      // Update local state
      setUsers(prev => prev.map(u => 
        u.id === user.id 
          ? { 
              ...u, 
              username: updateData.username || u.username,
              email: updateData.email || u.email,
              displayName: updateData.displayName || u.displayName,
              canAccessAdminPanel: updateData.canAccessAdminPanel ?? u.canAccessAdminPanel,
              userRoles: updateData.userRoles || u.userRoles,
              multipleCharactersAllowed: updateData.multipleCharactersAllowed ?? u.multipleCharactersAllowed,
              accountStatus: { 
                ...u.accountStatus, 
                isActive: updateData.isActive ?? u.accountStatus.isActive 
              }
            }
          : u
      ));

      // Log audit action
      logUserAction.update({
        userId: user.id,
        username: user.username,
        changes: updateData
      });
    } else {
      throw new Error(response.error || 'Errore aggiornamento utente');
    }
  };

  // Handle cell clicks for specific columns (like banned status)
  const handleCellClick = (user: User, columnKey: string, value: any) => {
    if (columnKey === 'accountStatus' && value?.isBanned) {
      // Redirect to ban-list with user filter
      router.push(`/users/ban-list?username=${encodeURIComponent(user.username)}`);
    }
  };



  return (
    <ManagementLayout authContext={authContext}>
      <Head>
        <title>TenpennyNovels Management - Gestione Utenti</title>
      </Head>

      <div className={styles.userManagement}>
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>👥 Gestione Utenti</h1>
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
              onClick={() => fetchUsers(pagination.page, pagination.pageSize)}
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

        <ConfigurableDataTable
          tableName="user-list"
          data={users}
          loading={loading}
          selectedItems={selectedUsers}
          onSelectionChange={setSelectedUsers}
          onAction={handleAction}
          onBulkAction={handleBulkAction}
          onCellClick={handleCellClick}
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

        {/* SidePanel for Edit */}
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