import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { ManagementLayout } from '@/components/ManagementLayout';
import { ConfigurableDataTable } from '@/components/shared/ConfigurableDataTable';
import { SidePanel } from '@/components/shared/SidePanel';
import { ColumnVisibilityToggle } from '@/components/shared/ColumnVisibilityToggle';
import { AuthContext } from '@/lib/auth';
import { logUserAction } from '@/lib/auditLogger';
import { useTableConfig } from '@/hooks/useTableConfig';
import { TicketManagementItem } from './all-tickets';
import styles from '@/styles/pages/UserManagement.module.scss';
import ticketStyles from '@/styles/pages/TicketManagement.module.scss';

const API_GATEWAY_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'https://api.tenpennynovels.com';

const DEPARTMENT_OPTIONS = [
  { value: 'MODERATION', label: 'Moderazione' },
  { value: 'CHARACTER_REVIEW', label: 'Revisione Personaggi' },
  { value: 'TECHNICAL_SUPPORT', label: 'Supporto Tecnico' },
  { value: 'GAMEPLAY_SUPPORT', label: 'Supporto Gameplay' },
  { value: 'GENERAL_SUPPORT', label: 'Supporto Generale' }
];

interface DepartmentTicketsProps {
  authContext: AuthContext;
}

export default function DepartmentTicketsPage({ authContext }: DepartmentTicketsProps) {
  const router = useRouter();
  const [tickets, setTickets] = useState<TicketManagementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTickets, setSelectedTickets] = useState<TicketManagementItem[]>([]);
  const [currentTicket, setCurrentTicket] = useState<TicketManagementItem | null>(null);
  const [activeSidePanel, setActiveSidePanel] = useState<string | null>(null);
  const [sidePanelLoading, setSidePanelLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userDepartment, setUserDepartment] = useState<string>('');
  const [departmentStaff, setDepartmentStaff] = useState<{ characterName: string }[]>([]);

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
  } = useTableConfig('tickets-department');

  // Pagination state
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: tableConfig?.table.pagination.defaultPageSize || 25,
    total: 0
  });

  const fetchUserDepartment = async () => {
    try {
      const response = await fetch(`${API_GATEWAY_URL}/admin/tickets/my-department`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUserDepartment(data.department || 'GENERAL_SUPPORT');
      } else {
        setUserDepartment('GENERAL_SUPPORT');
      }
    } catch (error) {
      console.error('Error fetching user department:', error);
      setUserDepartment('GENERAL_SUPPORT');
    }
  };

  const fetchDepartmentTickets = async (page = 1, pageSize = 25) => {
    if (!userDepartment) return;
    
    try {
      setLoading(true);
      setError(null);

      const searchParams = new URLSearchParams({
        department: userDepartment,
        page: page.toString(),
        pageSize: pageSize.toString()
      });

      const response = await fetch(`${API_GATEWAY_URL}/admin/tickets/department?${searchParams.toString()}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Errore ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Map API response to frontend format
      const mappedTickets = (data.data?.tickets || data.tickets || []).map((ticket: any) => ({
        _id: ticket.id,
        ticketId: ticket.id,
        title: ticket.title,
        category: ticket.category,
        status: ticket.status.toUpperCase(),
        priority: ticket.priority, // Mantieni lowercase per il mapping CSS
        unreadMessagesCount: ticket.messageCount || 0,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt || ticket.createdAt,
        characterName: ticket.createdBy?.name || 'Unknown',
        assignedToName: ticket.assignedTo?.name || null,
        department: ticket.department
      }));
      
      setTickets(mappedTickets);
      setPagination(prev => ({
        ...prev,
        page: data.pagination?.page || page,
        total: data.pagination?.total || (data.data?.tickets || data.tickets || []).length
      }));
    } catch (err) {
      console.error('Error fetching department tickets:', err);
      setError(err instanceof Error ? err.message : 'Errore durante il caricamento dei ticket del reparto');
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartmentStaff = async () => {
    if (!userDepartment) return;
    
    try {
      const response = await fetch(`${API_GATEWAY_URL}/admin/tickets/staff?department=${userDepartment}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setDepartmentStaff(data.staff || []);
      }
    } catch (error) {
      console.error('Error fetching department staff:', error);
    }
  };

  useEffect(() => {
    if (!authContext.isLoading) {
      fetchUserDepartment();
    }
  }, [authContext.isLoading]);

  useEffect(() => {
    if (userDepartment) {
      fetchDepartmentTickets(pagination.page, pagination.pageSize);
      fetchDepartmentStaff();
    }
  }, [userDepartment]);

  const handlePageChange = (newPage: number) => {
    fetchDepartmentTickets(newPage, pagination.pageSize);
  };

  const handlePageSizeChange = (newSize: number) => {
    setPagination(prev => ({ ...prev, pageSize: newSize }));
    fetchDepartmentTickets(1, newSize);
  };

  const openSidePanel = (panelKey: string, ticket: TicketManagementItem) => {
    setCurrentTicket(ticket);
    setActiveSidePanel(panelKey);
  };

  // Handle table actions from configuration
  const handleAction = (actionKey: string, ticket: TicketManagementItem) => {
    switch (actionKey) {
      case 'view':
        openSidePanel('view', ticket);
        break;
      case 'assign':
        if (ticket.assignedStaff) {
          openSidePanel('view', ticket);
        }
        break;
      default:
        console.warn(`Unknown action: ${actionKey}`);
    }
  };

  // Handle bulk actions from configuration
  const handleBulkAction = (actionKey: string, tickets: TicketManagementItem[]) => {
    switch (actionKey) {
      default:
        console.warn(`Unknown bulk action: ${actionKey}`);
    }
  };

  // Handle SidePanel actions
  const handleSidePanelAction = async (actionKey: string, formData: Record<string, any>) => {
    if (!currentTicket) return;

    setSidePanelLoading(true);
    
    try {
      switch (actionKey) {
        case 'take_ownership':
          await handleTakeOwnership(currentTicket);
          break;
        case 'reassign':
          // Logic per riassegnazione - qui si potrebbe aprire un altro modal
          break;
        case 'open_thread':
          window.open(`/tickets/thread/${currentTicket.ticketId}`, '_blank');
          break;
        default:
          console.warn(`Unknown SidePanel action: ${actionKey}`);
          return;
      }

      // Close panel on success for certain actions
      if (actionKey !== 'open_thread') {
        setActiveSidePanel(null);
        setCurrentTicket(null);
      }
    } catch (err) {
      console.error('Error in SidePanel action:', err);
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setSidePanelLoading(false);
    }
  };

  const handleTakeOwnership = async (ticket: TicketManagementItem) => {
    if (!authContext.character?.name) return;

    try {
      setSidePanelLoading(true);
      
      const response = await fetch(`${API_GATEWAY_URL}/admin/tickets/${ticket.ticketId}/assign`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          staffCharacterName: authContext.character.name 
        }),
      });

      if (!response.ok) {
        throw new Error(`Errore ${response.status}: ${response.statusText}`);
      }

      // Log the action
      logUserAction.update({
        ticketId: ticket.ticketId,
        action: 'ticket_self_assigned',
        details: { ticketTitle: ticket.title }
      });
      
      // Refresh tickets list
      await fetchDepartmentTickets(pagination.page, pagination.pageSize);
      
    } catch (err) {
      console.error('Error taking ticket ownership:', err);
      setError(err instanceof Error ? err.message : 'Errore durante la presa in carico del ticket');
    } finally {
      setSidePanelLoading(false);
    }
  };

  const handleAssignTicket = async (staffCharacterName: string) => {
    if (!currentTicket) return;

    try {
      setSidePanelLoading(true);
      
      const response = await fetch(`${API_GATEWAY_URL}/admin/tickets/${currentTicket.ticketId}/assign`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ staffCharacterName }),
      });

      if (!response.ok) {
        throw new Error(`Errore ${response.status}: ${response.statusText}`);
      }

      // Log the action
      const currentDepartment = DEPARTMENT_OPTIONS.find(d => d.value === userDepartment);
      logUserAction.update({
        ticketId: currentTicket.ticketId,
        action: 'ticket_assigned',
        details: { 
          staffCharacterName,
          department: currentDepartment?.label,
          ticketTitle: currentTicket.title
        }
      });
      
      // Refresh tickets list
      await fetchDepartmentTickets(pagination.page, pagination.pageSize);
      
      // Close panel
      setActiveSidePanel(null);
      setCurrentTicket(null);

    } catch (err) {
      console.error('Error assigning ticket:', err);
      setError(err instanceof Error ? err.message : 'Errore durante l\'assegnazione del ticket');
    } finally {
      setSidePanelLoading(false);
    }
  };

  // Handle cell clicks for specific columns (including "take ownership" functionality)
  const handleCellClick = (ticket: TicketManagementItem, columnKey: string, value: any) => {
    if (columnKey === 'ticketId') {
      openSidePanel('view', ticket);
    } else if (columnKey === 'assignedStaff' && !value) {
      // Handle "take ownership" click for unassigned tickets
      handleTakeOwnership(ticket);
    }
  };

  // Calculate department stats (manteniamo le stats esistenti)
  const stats = {
    total: tickets.length,
    unassigned: tickets.filter(t => !t.assignedStaff).length,
    urgent: tickets.filter(t => t.priority === 'URGENT').length,
    overdue: tickets.filter(t => {
      const hoursSinceCreation = (Date.now() - new Date(t.createdAt).getTime()) / (1000 * 60 * 60);
      return t.status !== 'CLOSED' && hoursSinceCreation > 24; // Simple SLA: 24 hours
    }).length
  };

  // Get current department info
  const currentDepartment = DEPARTMENT_OPTIONS.find(d => d.value === userDepartment);

  // Show loading screen while checking authentication
  if (authContext.isLoading) {
    return (
      <ManagementLayout 
        title="Caricamento..." 
        authContext={authContext}
      >
        <div style={{
          minHeight: '50vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid rgba(212, 175, 55, 0.3)',
            borderLeft: '4px solid #d4af37',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }}></div>
          <p style={{ color: '#e8e8e8' }}>Verifica autorizzazioni...</p>
          <style jsx>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </ManagementLayout>
    );
  }

  return (
    <ManagementLayout authContext={authContext}>
      <Head>
        <title>TenpennyNovels Management - Ticket del Reparto</title>
      </Head>

      <div className={styles.userManagement}>
        {/* Department Stats (manteniamo le stats esistenti) */}
        <div className={ticketStyles.statsContainer}>
          <div className={ticketStyles.statCard}>
            <span className={ticketStyles.statNumber}>{stats.total}</span>
            <span className={ticketStyles.statLabel}>Totale Reparto</span>
          </div>
          <div className={ticketStyles.statCard}>
            <span className={ticketStyles.statNumber}>{stats.unassigned}</span>
            <span className={ticketStyles.statLabel}>Non Assegnati</span>
          </div>
          <div className={ticketStyles.statCard}>
            <span className={ticketStyles.statNumber}>{stats.urgent}</span>
            <span className={ticketStyles.statLabel}>Urgenti</span>
          </div>
          <div className={ticketStyles.statCard}>
            <span className={ticketStyles.statNumber}>{stats.overdue}</span>
            <span className={ticketStyles.statLabel}>In Scadenza</span>
          </div>
        </div>

        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>🏢 Ticket del Reparto - {currentDepartment?.label || 'Reparto'}</h1>
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
              onClick={() => fetchDepartmentTickets(pagination.page, pagination.pageSize)}
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
          tableName="tickets-department"
          data={tickets}
          loading={loading}
          selectedItems={selectedTickets}
          onSelectionChange={setSelectedTickets}
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

        {/* SidePanel for View */}
        {tableConfig && tableConfig.sidePanels && activeSidePanel && currentTicket && (
          <SidePanel
            isOpen={true}
            config={{
              title: interpolateTemplate(tableConfig.sidePanels[activeSidePanel].title, currentTicket),
              subtitle: tableConfig.sidePanels[activeSidePanel].subtitle,
              width: tableConfig.sidePanels[activeSidePanel].width,
              fields: tableConfig.sidePanels[activeSidePanel].fields,
              actions: tableConfig.sidePanels[activeSidePanel].actions.map((action: any) => ({
                ...action,
                loading: sidePanelLoading && action.key !== 'cancel'
              }))
            }}
            data={currentTicket}
            loading={sidePanelLoading}
            columnVisibility={columnVisibility}
            getNestedValue={getNestedValue}
            setNestedValue={setNestedValue}
            onClose={() => {
              setActiveSidePanel(null);
              setCurrentTicket(null);
            }}
            onAction={handleSidePanelAction}
          />
        )}
      </div>
    </ManagementLayout>
  );
}