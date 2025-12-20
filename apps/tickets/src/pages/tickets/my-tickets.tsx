import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { TicketsLayout } from '@/components/TicketsLayout';
import { ConfigurableDataTable } from '@/components/shared/ConfigurableDataTable';
import { SidePanel } from '@/components/shared/SidePanel';
import { ColumnVisibilityToggle } from '@/components/shared/ColumnVisibilityToggle';
import { AuthContext } from '@/lib/auth';
import { logUserAction } from '@/lib/auditLogger';
import { useTableConfig } from '@/hooks/useTableConfig';
import { TicketManagementItem } from './all-tickets';
import styles from '@/styles/pages/TicketManagement.module.scss';

const API_GATEWAY_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'https://api.tenpennynovels.com';

const ACTION_OPTIONS = [
  { value: 'IN_PROGRESS', label: 'Prendi in carico', icon: '🔄' },
  { value: 'WAITING_FOR_USER', label: 'Richiedi informazioni', icon: '⏳' },
  { value: 'ESCALATED', label: 'Escala ticket', icon: '⬆️' },
  { value: 'CLOSED', label: 'Chiudi ticket', icon: '✅' }
];

interface MyTicketsProps {
  authContext: AuthContext;
}

export default function MyTicketsPage({ authContext }: MyTicketsProps) {
  const router = useRouter();
  const [tickets, setTickets] = useState<TicketManagementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTickets, setSelectedTickets] = useState<TicketManagementItem[]>([]);
  const [currentTicket, setCurrentTicket] = useState<TicketManagementItem | null>(null);
  const [activeSidePanel, setActiveSidePanel] = useState<string | null>(null);
  const [sidePanelLoading, setSidePanelLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionNote, setActionNote] = useState('');

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
  } = useTableConfig('tickets-my');

  // Pagination state
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: tableConfig?.table.pagination.defaultPageSize || 25,
    total: 0
  });

  const fetchMyTickets = async (page = 1, pageSize = 25) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_GATEWAY_URL}/admin/tickets/my?page=${page}&pageSize=${pageSize}`, {
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
      console.error('Error fetching my tickets:', err);
      setError(err instanceof Error ? err.message : 'Errore durante il caricamento dei tuoi ticket');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authContext.isLoading) {
      fetchMyTickets(pagination.page, pagination.pageSize);
    }
  }, [authContext.isLoading]);

  const handlePageChange = (newPage: number) => {
    fetchMyTickets(newPage, pagination.pageSize);
  };

  const handlePageSizeChange = (newSize: number) => {
    setPagination(prev => ({ ...prev, pageSize: newSize }));
    fetchMyTickets(1, newSize);
  };

  const openSidePanel = (panelKey: string, ticket: TicketManagementItem) => {
    setCurrentTicket(ticket);
    setActiveSidePanel(panelKey);
    setActionNote('');
  };

  // Handle table actions from configuration
  const handleAction = (actionKey: string, ticket: TicketManagementItem) => {
    switch (actionKey) {
      case 'view':
        openSidePanel('view', ticket);
        break;
      case 'update_status':
        if (ticket.status !== 'CLOSED') {
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
        case 'update_status':
          // Qui si potrebbe aprire un modal o permettere di scegliere il nuovo status
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

  const handleUpdateTicketStatus = async (newStatus: string) => {
    if (!currentTicket) return;

    try {
      setSidePanelLoading(true);
      
      const response = await fetch(`${API_GATEWAY_URL}/admin/tickets/${currentTicket.ticketId}/status`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          status: newStatus,
          note: actionNote.trim() || undefined
        }),
      });

      if (!response.ok) {
        throw new Error(`Errore ${response.status}: ${response.statusText}`);
      }

      // Log the action
      const actionLabel = ACTION_OPTIONS.find(opt => opt.value === newStatus)?.label || newStatus;
      logUserAction.update({
        ticketId: currentTicket.ticketId,
        action: 'ticket_status_updated',
        details: { 
          newStatus: actionLabel, 
          note: actionNote.trim(),
          ticketTitle: currentTicket.title 
        }
      });
      
      // Refresh tickets list
      await fetchMyTickets(pagination.page, pagination.pageSize);
      
      // Close panel
      setActiveSidePanel(null);
      setCurrentTicket(null);
      setActionNote('');

    } catch (err) {
      console.error('Error updating ticket status:', err);
      setError(err instanceof Error ? err.message : 'Errore durante l\'aggiornamento del ticket');
    } finally {
      setSidePanelLoading(false);
    }
  };

  // Handle cell clicks for specific columns
  const handleCellClick = (ticket: TicketManagementItem, columnKey: string, value: any) => {
    if (columnKey === 'ticketId') {
      openSidePanel('view', ticket);
    }
  };

  // Calculate stats (manteniamo le stats esistenti)
  const stats = {
    total: tickets.length,
    inProgress: tickets.filter(t => t.status === 'IN_PROGRESS').length,
    urgent: tickets.filter(t => t.priority === 'URGENT').length,
    unread: tickets.reduce((sum, t) => sum + t.unreadMessagesCount, 0)
  };

  // Show loading screen while checking authentication
  if (authContext.isLoading) {
    return (
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
    );
  }

  return (
    <>
      <Head>
        <title>TenpennyNovels Management - I Miei Ticket</title>
      </Head>

      <div className={styles.userManagement}>
        {/* Stats (manteniamo le stats esistenti) */}
        <div className={styles.statsContainer}>
          <div className={styles.statCard}>
            <span className={styles.statNumber}>{stats.total}</span>
            <span className={styles.statLabel}>Totale Assegnati</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statNumber}>{stats.inProgress}</span>
            <span className={styles.statLabel}>In Lavorazione</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statNumber}>{stats.urgent}</span>
            <span className={styles.statLabel}>Urgenti</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statNumber}>{stats.unread}</span>
            <span className={styles.statLabel}>Messaggi Non Letti</span>
          </div>
        </div>

        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>👤 I Miei Ticket</h1>
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
              onClick={() => fetchMyTickets(pagination.page, pagination.pageSize)}
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
          tableName="tickets-my"
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
              setActionNote('');
            }}
            onAction={handleSidePanelAction}
          />
        )}

        {/* Additional Status Update UI (moved from SidePanel children) */}
        {activeSidePanel === 'view' && currentTicket && currentTicket.status !== 'CLOSED' && (
          <div style={{ 
            position: 'fixed', 
            top: '50%', 
            left: '50%', 
            transform: 'translate(-50%, -50%)',
            zIndex: 10000,
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            padding: '24px',
            borderRadius: '8px',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            maxWidth: '500px',
            width: '90%'
          }}>
            <h4 style={{ color: '#ffffff', marginBottom: '16px' }}>Aggiorna Stato Ticket</h4>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', color: '#ffffff', marginBottom: '8px', fontSize: '14px' }}>
                Nota opzionale:
              </label>
              <textarea
                value={actionNote}
                onChange={(e) => setActionNote(e.target.value)}
                placeholder="Aggiungi una nota per il log di audit..."
                rows={3}
                style={{
                  width: '100%',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '6px',
                  color: '#ffffff',
                  padding: '8px 12px',
                  fontSize: '14px',
                  resize: 'vertical'
                }}
              />
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {ACTION_OPTIONS
                .filter(action => action.value !== currentTicket.status)
                .map(action => (
                <button
                  key={action.value}
                  onClick={() => handleUpdateTicketStatus(action.value)}
                  disabled={sidePanelLoading}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: 'rgba(212, 175, 55, 0.2)',
                    border: '1px solid #d4af37',
                    borderRadius: '6px',
                    color: '#ffffff',
                    cursor: 'pointer',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  {action.icon} {action.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}