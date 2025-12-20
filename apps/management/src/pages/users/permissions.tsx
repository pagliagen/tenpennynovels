import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { ManagementLayout } from '@/components/ManagementLayout';
import { ConfigurableDataTable } from '@/components/shared/ConfigurableDataTable';
import { SidePanel } from '@/components/shared/SidePanel';
import { AuthContext } from '@/lib/auth';
import { userAPI } from '@/lib/api';
import { logUserAction } from '@/lib/auditLogger';
import { useTableConfig } from '@/hooks/useTableConfig';
import styles from '@/styles/pages/UserManagement.module.scss';

// User account being managed (simplified: only userRoles and canAccessAdminPanel)
interface ManagedUser {
  id: string;
  username: string;
  email: string;
  displayName: string;
  // Simplified user-level permissions
  userRoles: string[];
  canAccessAdminPanel: boolean;
  accountStatus: {
    isActive: boolean;
    isBanned: boolean;
  };
  registrationInfo: {
    registeredAt: string;
  };
  activity: {
    lastLoginAt?: string;
  };
}

interface UserPermissionsProps {
  authContext: AuthContext;
}


export default function UserPermissions({ authContext }: UserPermissionsProps) {
  const router = useRouter();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<ManagedUser | null>(null);
  const [activeSidePanel, setActiveSidePanel] = useState<string | null>(null);
  const [sidePanelLoading, setSidePanelLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<ManagedUser[]>([]);

  // Pagination state
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 25,
    total: 0
  });

  // Table configuration
  const { 
    config: tableConfig, 
    getNestedValue, 
    columnVisibility,
    toggleColumnVisibility,
    resetColumnVisibility,
    resolveConditionalValue,
    interpolateTemplate
  } = useTableConfig('user-permissions-list');

  // Check if current user can edit permissions (only gestore)
  const canAccessAdminPanel = authContext?.user?.canAccessAdminPanel;
  const isGestore = authContext?.user?.userRoles?.includes('gestore');

  useEffect(() => { 
    // Don't do anything if auth is still loading
    if (authContext?.isLoading) {
      // console.log('⏳ Auth still loading, skipping permissions check');
      return;
    }
    
    if (!canAccessAdminPanel || !isGestore) {
      // console.log('❌ ACCESS DENIED - REDIRECTING FROM PERMISSIONS PAGE:', { canAccessAdminPanel, isGestore });
      // console.log('🚨 REDIRECT TO ACCESS-DENIED FROM: permissions.tsx line 68 (access denied)');
      router.push('/access-denied');
      return;
    }
    // console.log('✅ ACCESS GRANTED - LOADING USERS');
    loadUsers();
  }, [canAccessAdminPanel, isGestore, authContext?.isLoading]);

  const loadUsers = async () => {
    try {
      // console.log('🔄 START LOADING USERS...');
      setLoading(true);
      
      // console.log('📞 CALLING userAPI.getUsers...');
      const response = await userAPI.getUsers({
        page: 1,
        pageSize: 100,
        sortBy: 'username',
        sortOrder: 'asc'
      });
      
      // console.log('📨 API RESPONSE:', response);
      
      if (response.success && response.data) {
        // console.log('✅ USERS LOADED SUCCESSFULLY:', response.data.users);
        setUsers(response.data.items);
      } else {
        // console.log('❌ API ERROR:', response.error);
        setError('Failed to load users');
      }
    } catch (err) {
      console.error('💥 EXCEPTION IN LOAD USERS:', err);
      setError('Error loading users');
    } finally {
      // console.log('🏁 LOADING FINISHED');
      setLoading(false);
    }
  };

  // Open side panel for specific action
  const openSidePanel = (panelKey: string, user: ManagedUser) => {
    setCurrentUser(user);
    setActiveSidePanel(panelKey);
  };

  // Handle table actions from configuration
  const handleAction = (actionKey: string, user: ManagedUser) => {
    switch (actionKey) {
      case 'edit_permissions':
        openSidePanel('edit_permissions', user);
        break;
      default:
        console.warn(`Unknown action: ${actionKey}`);
    }
  };

  // Handle bulk actions
  const handleBulkAction = (actionKey: string, users: ManagedUser[]) => {
    switch (actionKey) {
      default:
        console.warn(`Unknown bulk action: ${actionKey}`);
    }
  };

  // Handle cell clicks
  const handleCellClick = (user: ManagedUser, columnKey: string, value: any) => {
    // Handle cell click interactions if needed
  };

  // Pagination handlers
  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
    // In a real implementation, you would fetch data for the new page
  };

  const handlePageSizeChange = (newSize: number) => {
    setPagination(prev => ({ ...prev, pageSize: newSize, page: 1 }));
    // In a real implementation, you would fetch data with new page size
  };

  // Handle side panel actions
  const handleSidePanelAction = async (actionKey: string, formData: Record<string, any>) => {
    if (!currentUser) return;

    try {
      setSidePanelLoading(true);
      
      switch (actionKey) {
        case 'save_permissions':
          const response = await userAPI.updateUserPermissions(currentUser.id, {
            userRole: formData.userRoles,
            canAccessAdminPanel: formData.canAccessAdminPanel
          });
          
          if (response.success) {
            logUserAction.changePermissions({
              targetUsername: currentUser.username,
              newUserRoles: formData.userRoles,
              newCanAccessAdminPanel: formData.canAccessAdminPanel
            });

            // Update local state
            setUsers(prev => prev.map(user => 
              user.id === currentUser.id 
                ? {
                    ...user,
                    userRoles: formData.userRoles,
                    canAccessAdminPanel: formData.canAccessAdminPanel
                  }
                : user
            ));

            setActiveSidePanel(null);
            setCurrentUser(null);
          } else {
            setError(response.error || 'Failed to update permissions');
          }
          break;
        case 'cancel':
          setActiveSidePanel(null);
          setCurrentUser(null);
          break;
        default:
          console.warn(`Unknown side panel action: ${actionKey}`);
      }
    } catch (err) {
      setError('Error updating permissions');
      console.error('Error updating permissions:', err);
    } finally {
      setSidePanelLoading(false);
    }
  };

  // Columns are now automatically generated from the table configuration

  if (!isGestore) {
    return null; // Will redirect in useEffect
  }

  return (
    <>
      <Head>
        <title>TenpennyNovels Management - Gestione Permessi Utenti</title>
      </Head>

      <ManagementLayout authContext={authContext}>
        <div className={styles.pageContainer}>
          <div className={styles.pageHeader}>
            <h1>Gestione Permessi Utenti</h1>
            <p>Gestisci i ruoli utente e l'accesso al pannello amministrativo</p>
          </div>

          {error && (
            <div className={styles.errorAlert}>
              {error}
              <button onClick={() => setError(null)}>×</button>
            </div>
          )}

          <ConfigurableDataTable
            tableName="user-permissions-list"
            data={users}
            loading={loading}
            selectedItems={selectedUsers}
            onSelectionChange={setSelectedUsers}
            onAction={handleAction}
            onBulkAction={handleBulkAction}
            onCellClick={handleCellClick}
            pagination={pagination ? {
              page: pagination.page,
              pageSize: pagination.pageSize,
              total: pagination.total,
              onPageChange: handlePageChange,
              onPageSizeChange: handlePageSizeChange
            } : undefined}
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
        </div>

        {/* Side Panel for User Permissions */}
        {activeSidePanel && currentUser && (
          <SidePanel
            isOpen={true}
            config={{
              title: `Edit Permissions - ${currentUser.username}`,
              subtitle: `Gestisci ruolo utente e accesso pannello amministrativo per ${currentUser.displayName}`,
              width: 'medium',
              fields: [
                {
                  key: 'userRoles',
                  label: 'User Roles',
                  type: 'multi_checkbox',
                  required: true,
                  options: [
                    { value: 'user', label: 'Utente (Accesso standard)' },
                    { value: 'gestore', label: 'Gestore (Accesso amministrativo completo)' }
                  ]
                },
                {
                  key: 'canAccessAdminPanel',
                  label: 'Admin Panel Access',
                  type: 'checkbox',
                  required: false
                }
              ],
              actions: [
                {
                  key: 'cancel',
                  label: 'Cancel',
                  type: 'secondary'
                },
                {
                  key: 'save_permissions',
                  label: 'Save Permissions',
                  type: 'primary',
                  loading: sidePanelLoading
                }
              ]
            }}
            data={currentUser}
            loading={sidePanelLoading}
            columnVisibility={columnVisibility}
            getNestedValue={getNestedValue}
            onAction={handleSidePanelAction}
            onClose={() => {
              setActiveSidePanel(null);
              setCurrentUser(null);
            }}
          />
        )}
      </ManagementLayout>
    </>
  );
}

