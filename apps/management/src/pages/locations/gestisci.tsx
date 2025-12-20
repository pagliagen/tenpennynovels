import React, { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { ManagementLayout } from '@/components/ManagementLayout';
import { ConfigurableDataTable } from '@/components/shared/ConfigurableDataTable';
import { SidePanel } from '@/components/shared/SidePanel';
import { ColumnVisibilityToggle } from '@/components/shared/ColumnVisibilityToggle';
import { AuthContext } from '@/lib/auth';
import { locationAPI, LocationData } from '@/lib/api';
import { logLocationAction } from '@/lib/auditLogger';
import { useTableConfig } from '@/hooks/useTableConfig';
import styles from '@/styles/pages/UserManagement.module.scss';

interface LocationListProps {
  authContext: AuthContext;
}

export default function LocationList({ authContext }: LocationListProps) {
  const router = useRouter();
  const [locations, setLocations] = useState<LocationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [activeSidePanel, setActiveSidePanel] = useState<string | null>(null);
  const [sidePanelLoading, setSidePanelLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLocations, setSelectedLocations] = useState<LocationData[]>([]);

  // Filters
  const [districtFilter, setDistrictFilter] = useState<string>('');
  const [showHidden, setShowHidden] = useState(false);

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
  } = useTableConfig('location-list');

  // Pagination state
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: tableConfig?.table.pagination.defaultPageSize || 25,
    total: 0
  });

  const fetchLocations = async (page = 1, pageSize = 25) => {
    try {
      setLoading(true);
      setError(null);

      const filters: any = { page, pageSize };
      if (districtFilter) filters.district = districtFilter;
      if (showHidden) filters.showHidden = true;

      const response = await locationAPI.getLocations(filters);

      if (response.success && response.data) {
        setLocations(response.data.locations);
        setPagination(prev => ({
          ...prev,
          page: response.data!.pagination.currentPage,
          total: response.data!.pagination.totalItems
        }));
      } else {
        throw new Error(response.error || 'Errore nel caricamento locations');
      }
    } catch (err) {
      console.error('Errore caricamento locations:', err);
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations(pagination.page, pagination.pageSize);
  }, [districtFilter, showHidden]);

  const handlePageChange = (newPage: number) => {
    fetchLocations(newPage, pagination.pageSize);
  };

  const handlePageSizeChange = (newSize: number) => {
    setPagination(prev => ({ ...prev, pageSize: newSize }));
    fetchLocations(1, newSize);
  };

  const openSidePanel = (panelKey: string, location?: LocationData) => {
    setCurrentLocation(location || null);
    setActiveSidePanel(panelKey);
  };

  // Handle table actions from configuration
  const handleAction = (actionKey: string, location: LocationData) => {
    switch (actionKey) {
      case 'edit':
        openSidePanel('edit', location);
        break;
      case 'access':
        openSidePanel('access', location);
        break;
      case 'delete':
        handleDeleteLocation(location);
        break;
      case 'view':
        router.push(`/locations/${location.id}`);
        break;
      default:
        console.warn(`Unknown action: ${actionKey}`);
    }
  };

  // Handle bulk actions
  const handleBulkAction = (actionKey: string, locations: LocationData[]) => {
    const locationIds = locations.map(l => l.id);

    switch (actionKey) {
      case 'bulk_delete':
        handleBulkDelete(locationIds);
        break;
      case 'bulk_hide':
        handleBulkVisibility(locationIds, false);
        break;
      case 'bulk_show':
        handleBulkVisibility(locationIds, true);
        break;
      default:
        console.warn(`Unknown bulk action: ${actionKey}`);
    }
  };

  // Handle SidePanel actions
  const handleSidePanelAction = async (actionKey: string, formData: Record<string, any>) => {
    setSidePanelLoading(true);

    try {
      switch (actionKey) {
        case 'save':
          if (currentLocation) {
            await handleUpdateLocation(currentLocation.id, formData);
          } else {
            await handleCreateLocation(formData);
          }
          break;
        case 'save_access':
          if (currentLocation) {
            await handleUpdateAccess(currentLocation.id, formData);
          }
          break;
        default:
          console.warn(`Unknown SidePanel action: ${actionKey}`);
          return;
      }

      // Close panel on success
      setActiveSidePanel(null);
      setCurrentLocation(null);
    } catch (err) {
      console.error('Error in SidePanel action:', err);
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setSidePanelLoading(false);
    }
  };

  const handleCreateLocation = async (formData: Record<string, any>) => {
    const response = await locationAPI.createLocation(formData);

    if (response.success) {
      await fetchLocations(pagination.page, pagination.pageSize);

      logLocationAction.create({
        entityId: response.data!.id,
        details: formData
      });
    } else {
      throw new Error(response.error || 'Errore creazione location');
    }
  };

  const handleUpdateLocation = async (locationId: string, formData: Record<string, any>) => {
    const response = await locationAPI.updateLocation(locationId, formData);

    if (response.success) {
      // Update local state
      setLocations(prev => prev.map(l =>
        l.id === locationId ? { ...l, ...formData } : l
      ));

      logLocationAction.update({
        entityId: locationId,
        details: formData
      });
    } else {
      throw new Error(response.error || 'Errore aggiornamento location');
    }
  };

  const handleUpdateAccess = async (locationId: string, accessData: any) => {
    const response = await locationAPI.manageAccess(locationId, accessData);

    if (response.success) {
      await fetchLocations(pagination.page, pagination.pageSize);

      logLocationAction.manageAccess({
        entityId: locationId,
        details: accessData
      });
    } else {
      throw new Error(response.error || 'Errore aggiornamento accessi');
    }
  };

  const handleDeleteLocation = async (location: LocationData) => {
    if (!confirm(`Sei sicuro di voler eliminare la location "${location.name}"?`)) {
      return;
    }

    try {
      setLoading(true);
      const response = await locationAPI.deleteLocation(location.id);

      if (response.success) {
        // Remove from local state
        setLocations(prev => prev.filter(l => l.id !== location.id));

        logLocationAction.delete({
          entityId: location.id,
          details: { name: location.name }
        });
      } else {
        throw new Error(response.error || 'Errore eliminazione location');
      }
    } catch (err) {
      console.error('Errore eliminazione location:', err);
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkDelete = async (locationIds: string[]) => {
    if (!confirm(`Sei sicuro di voler eliminare ${locationIds.length} locations?`)) {
      return;
    }

    try {
      setLoading(true);
      const response = await locationAPI.bulkOperation('delete', locationIds);

      if (response.success) {
        await fetchLocations(pagination.page, pagination.pageSize);
        setSelectedLocations([]);
      } else {
        throw new Error(response.error || 'Errore bulk delete');
      }
    } catch (err) {
      console.error('Errore bulk delete:', err);
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkVisibility = async (locationIds: string[], visible: boolean) => {
    try {
      setLoading(true);
      const response = await locationAPI.bulkOperation('updateVisibility', locationIds, { visible });

      if (response.success) {
        await fetchLocations(pagination.page, pagination.pageSize);
        setSelectedLocations([]);
      } else {
        throw new Error(response.error || 'Errore bulk visibility update');
      }
    } catch (err) {
      console.error('Errore bulk visibility:', err);
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setLoading(false);
    }
  };

  // Build hierarchical tree and flatten it for display
  const hierarchicalLocations = useMemo(() => {
    if (!locations.length) return [];

    // Create a map for quick lookup
    const locationMap = new Map<string, LocationData>();
    locations.forEach(loc => locationMap.set(loc.id, loc));

    // Find root locations (no parent)
    const roots = locations.filter(loc => !loc.parentLocation);

    // Recursive function to flatten tree in hierarchical order
    const flattenTree = (parentId: string | null, result: LocationData[] = []): LocationData[] => {
      const children = locations.filter(loc =>
        loc.parentLocation === parentId ||
        (parentId && loc.parentLocation?.toString() === parentId)
      ).sort((a, b) => a.name.localeCompare(b.name));

      children.forEach(child => {
        result.push(child);
        flattenTree(child.id, result);
      });

      return result;
    };

    // Build the complete hierarchical list
    const hierarchical: LocationData[] = [];

    // Start with roots, sorted by name
    roots.sort((a, b) => a.name.localeCompare(b.name)).forEach(root => {
      hierarchical.push(root);
      flattenTree(root.id, hierarchical);
    });

    return hierarchical;
  }, [locations]);

  // Get unique districts for filter
  const districts = Array.from(new Set(locations.map(l => l.district))).sort();

  // Custom renderer for hierarchical name display
  const renderHierarchicalName = (value: any, item: LocationData) => {
    const getIndentLevel = (level: string) => {
      switch (level) {
        case 'root': return 0;
        case 'district': return 1;
        case 'location': return 2;
        default: return 0;
      }
    };

    const getLevelIcon = (level: string) => {
      switch (level) {
        case 'root': return '🌍';
        case 'district': return '🏘️';
        case 'location': return '📍';
        default: return '';
      }
    };

    const indentLevel = getIndentLevel(item.locationLevel);
    const icon = getLevelIcon(item.locationLevel);
    const indentStyle = {
      paddingLeft: `${indentLevel * 24}px`,
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    };

    return (
      <div style={indentStyle}>
        <span style={{ fontSize: '14px' }}>{icon}</span>
        <strong>{value}</strong>
      </div>
    );
  };

  return (
    <ManagementLayout authContext={authContext}>
      <Head>
        <title>TenpennyNovels Management - Gestione Locations</title>
      </Head>

      <div className={styles.userManagement}>
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>🏛️ Gestione Locations</h1>
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
              onClick={() => openSidePanel('create')}
              className={styles.createButton}
              disabled={loading}
            >
              ➕ Nuova Location
            </button>

            <button
              onClick={() => fetchLocations(pagination.page, pagination.pageSize)}
              className={styles.refreshButton}
              disabled={loading}
            >
              <span className={styles.refreshIcon}>↻</span>
              Aggiorna
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className={styles.filters}>
          <div className={styles.filterGroup}>
            <label>Distretto:</label>
            <select
              value={districtFilter}
              onChange={(e) => setDistrictFilter(e.target.value)}
              className={styles.filterSelect}
            >
              <option value="">Tutti i distretti</option>
              {districts.map(district => (
                <option key={district} value={district}>{district}</option>
              ))}
            </select>
          </div>

          <div className={styles.filterGroup}>
            <label>
              <input
                type="checkbox"
                checked={showHidden}
                onChange={(e) => setShowHidden(e.target.checked)}
              />
              Mostra locations nascoste
            </label>
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
          tableName="location-list"
          data={hierarchicalLocations}
          loading={loading}
          selectedItems={selectedLocations}
          onSelectionChange={setSelectedLocations}
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
            resolveConditionalValue,
            customRenderers: {
              'hierarchical_name': renderHierarchicalName
            }
          } : undefined}
        />

        {/* SidePanel for Create/Edit */}
        {tableConfig && tableConfig.sidePanels && activeSidePanel && (
          <SidePanel
            isOpen={true}
            config={{
              title: interpolateTemplate(
                tableConfig.sidePanels[activeSidePanel]?.title || 'Location',
                currentLocation || {}
              ),
              subtitle: tableConfig.sidePanels[activeSidePanel]?.subtitle,
              width: tableConfig.sidePanels[activeSidePanel]?.width,
              fields: tableConfig.sidePanels[activeSidePanel]?.fields || [],
              actions: (tableConfig.sidePanels[activeSidePanel]?.actions || []).map((action: any) => ({
                ...action,
                loading: sidePanelLoading && action.key !== 'cancel'
              }))
            }}
            data={currentLocation || {}}
            loading={sidePanelLoading}
            columnVisibility={columnVisibility}
            getNestedValue={getNestedValue}
            setNestedValue={setNestedValue}
            onClose={() => {
              setActiveSidePanel(null);
              setCurrentLocation(null);
            }}
            onAction={handleSidePanelAction}
          />
        )}
      </div>
    </ManagementLayout>
  );
}
