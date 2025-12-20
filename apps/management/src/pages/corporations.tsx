import React, { useState, useEffect } from 'react';
import { NextPage } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { corporationAPI, Corporation, CorporationStats, PaginationInfo, handleApiError } from '../lib/api';
import CorporationModal from '../components/corporations/CorporationModal';

// Types are now imported from api.ts

const CorporationsPage: NextPage = () => {
  const router = useRouter();
  
  // State
  const [corporations, setCorporations] = useState<Corporation[]>([]);
  const [stats, setStats] = useState<CorporationStats | null>(null);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedCorporation, setSelectedCorporation] = useState<Corporation | null>(null);
  
  // Fetch corporations
  const fetchCorporations = async () => {
    try {
      setLoading(true);
      const params = {
        page: currentPage,
        pageSize: pageSize,
        ...(statusFilter !== 'all' && { status: statusFilter })
      };

      const result = await corporationAPI.getCorporations(params);
      
      if (result.success && result.data) {
        setCorporations(result.data.corporations);
        setPagination(result.data.pagination);
        setError(null);
      } else {
        setError(handleApiError(result, 'Failed to fetch corporations'));
      }
    } catch (error) {
      console.error('Error fetching corporations:', error);
      setError(handleApiError(error, 'Failed to fetch corporations'));
    } finally {
      setLoading(false);
    }
  };

  // Fetch statistics
  const fetchStats = async () => {
    try {
      const result = await corporationAPI.getStats('month');
      
      if (result.success && result.data) {
        setStats(result.data);
      }
    } catch (error) {
      console.error('Error fetching corporation stats:', error);
    }
  };

  // Effects
  useEffect(() => {
    fetchCorporations();
  }, [currentPage, pageSize, statusFilter]);

  useEffect(() => {
    fetchStats();
  }, []);

  // Handlers
  const handleStatusChange = (status: string) => {
    setStatusFilter(status);
    setCurrentPage(1); // Reset to first page when filtering
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Modal handlers
  const handleCreateCorporation = () => {
    setSelectedCorporation(null);
    setShowCreateModal(true);
  };

  const handleEditCorporation = (corporation: Corporation) => {
    setSelectedCorporation(corporation);
    setShowEditModal(true);
  };

  const handleCorporationSuccess = (corporation: Corporation) => {
    // Refresh the list to show the new/updated corporation
    fetchCorporations();
    fetchStats();
  };

  const closeModals = () => {
    setShowCreateModal(false);
    setShowEditModal(false);
    setSelectedCorporation(null);
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'active':
        return 'status-badge status-badge--success';
      case 'inactive':
        return 'status-badge status-badge--warning';
      case 'disbanded':
        return 'status-badge status-badge--danger';
      default:
        return 'status-badge status-badge--neutral';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="management-page">
      <div className="page-header">
        <div className="page-header__content">
          <h1 className="page-title">Corporation Management</h1>
          <p className="page-description">
            Manage corporations, review membership requests, and monitor corporate activities
          </p>
        </div>
        <div className="page-header__actions">
          <button 
            className="btn btn--primary"
            onClick={handleCreateCorporation}
          >
            <i className="icon-plus"></i>
            Create Corporation
          </button>
          <Link href="/membership-requests" className="btn btn--secondary">
            <i className="icon-users"></i>
            Membership Requests
            {(stats?.overview?.pendingRequests ?? 0) > 0 && (
              <span className="badge badge--danger">{stats?.overview?.pendingRequests}</span>
            )}
          </Link>
        </div>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="stats-grid stats-grid--4">
          <div className="stat-card">
            <div className="stat-card__icon stat-card__icon--primary">
              <i className="icon-building"></i>
            </div>
            <div className="stat-card__content">
              <h3 className="stat-card__value">{stats.overview.totalCorporations}</h3>
              <p className="stat-card__label">Total Corporations</p>
              <span className="stat-card__change stat-card__change--positive">
                +{stats.overview.recentCorporations} this month
              </span>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-card__icon stat-card__icon--success">
              <i className="icon-check-circle"></i>
            </div>
            <div className="stat-card__content">
              <h3 className="stat-card__value">{stats.overview.activeCorporations}</h3>
              <p className="stat-card__label">Active Corporations</p>
              <span className="stat-card__change">
                {((stats.overview.activeCorporations / stats.overview.totalCorporations) * 100).toFixed(1)}% of total
              </span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-card__icon stat-card__icon--info">
              <i className="icon-users"></i>
            </div>
            <div className="stat-card__content">
              <h3 className="stat-card__value">{stats.overview.totalMembers}</h3>
              <p className="stat-card__label">Total Members</p>
              <span className="stat-card__change">
                Across all corporations
              </span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-card__icon stat-card__icon--warning">
              <i className="icon-clock"></i>
            </div>
            <div className="stat-card__content">
              <h3 className="stat-card__value">{stats.overview.pendingRequests}</h3>
              <p className="stat-card__label">Pending Requests</p>
              <span className="stat-card__change">
                Awaiting review
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="content-section">
        <div className="filters">
          <div className="filter-group">
            <label className="filter-label">Status Filter:</label>
            <select 
              className="select select--sm"
              value={statusFilter}
              onChange={(e) => handleStatusChange(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="disbanded">Disbanded</option>
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-label">Per Page:</label>
            <select 
              className="select select--sm"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        {/* Corporation Table */}
        <div className="data-table-container">
          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading corporations...</p>
            </div>
          ) : error ? (
            <div className="error-state">
              <div className="error-icon">
                <i className="icon-alert-circle"></i>
              </div>
              <h3>Error Loading Corporations</h3>
              <p>{error}</p>
              <button 
                className="btn btn--primary"
                onClick={fetchCorporations}
              >
                Try Again
              </button>
            </div>
          ) : (
            <div className="data-table">
              <table className="table">
                <thead>
                  <tr>
                    <th>Corporation</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Owner</th>
                    <th>Members</th>
                    <th>Treasury</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {corporations.map((corporation) => (
                    <tr key={corporation.id}>
                      <td>
                        <div className="corporation-info">
                          <h4 className="corporation-name">{corporation.name}</h4>
                          {corporation.description && (
                            <p className="corporation-description">
                              {corporation.description.length > 60 
                                ? `${corporation.description.substring(0, 60)}...`
                                : corporation.description
                              }
                            </p>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className="type-badge type-badge--{corporation.type}">
                          {corporation.type}
                        </span>
                      </td>
                      <td>
                        <span className={getStatusBadgeClass(corporation.status)}>
                          {corporation.status}
                        </span>
                      </td>
                      <td>
                        <div className="owner-info">
                          <span className="owner-name">{corporation.ownerName}</span>
                        </div>
                      </td>
                      <td>
                        <div className="member-stats">
                          <span className="member-count">{corporation.memberCount}</span>
                          {corporation.officerCount > 0 && (
                            <span className="officer-count">
                              ({corporation.officerCount} officers)
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className="treasury-amount">
                          {formatCurrency(corporation.treasury)}
                        </span>
                      </td>
                      <td>
                        <span className="date-text">
                          {formatDate(corporation.createdAt)}
                        </span>
                      </td>
                      <td>
                        <div className="action-buttons">
                          <Link 
                            href={`/corporations/${corporation.id}`}
                            className="btn btn--sm btn--outline"
                          >
                            <i className="icon-eye"></i>
                            View
                          </Link>
                          <button 
                            className="btn btn--sm btn--secondary"
                            onClick={() => handleEditCorporation(corporation)}
                          >
                            <i className="icon-edit"></i>
                            Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {corporations.length === 0 && (
                <div className="empty-state">
                  <div className="empty-state__icon">
                    <i className="icon-building"></i>
                  </div>
                  <h3>No Corporations Found</h3>
                  <p>
                    {statusFilter !== 'all' 
                      ? `No corporations with status "${statusFilter}" found.`
                      : 'No corporations have been created yet.'
                    }
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="pagination-container">
            <div className="pagination-info">
              Showing {((pagination.page - 1) * pagination.pageSize) + 1} to{' '}
              {Math.min(pagination.page * pagination.pageSize, pagination.total)} of{' '}
              {pagination.total} corporations
            </div>
            <div className="pagination">
              <button
                className="pagination__btn pagination__btn--prev"
                disabled={pagination.page <= 1}
                onClick={() => handlePageChange(pagination.page - 1)}
              >
                <i className="icon-chevron-left"></i>
                Previous
              </button>

              <div className="pagination__numbers">
                {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                  const pageNum = pagination.page - 2 + i;
                  if (pageNum < 1 || pageNum > pagination.totalPages) return null;
                  
                  return (
                    <button
                      key={pageNum}
                      className={`pagination__number ${pageNum === pagination.page ? 'pagination__number--active' : ''}`}
                      onClick={() => handlePageChange(pageNum)}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button 
                className="pagination__btn pagination__btn--next"
                disabled={!pagination.hasMore}
                onClick={() => handlePageChange(pagination.page + 1)}
              >
                Next
                <i className="icon-chevron-right"></i>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Top Corporations Sidebar */}
      {stats && stats.topCorporations.length > 0 && (
        <div className="sidebar-section">
          <div className="card">
            <div className="card__header">
              <h3 className="card__title">Top Corporations</h3>
              <p className="card__subtitle">By member count</p>
            </div>
            <div className="card__content">
              <div className="ranking-list">
                {stats.topCorporations.map((corp, index) => (
                  <div key={corp.id} className="ranking-item">
                    <div className="ranking-item__position">#{index + 1}</div>
                    <div className="ranking-item__content">
                      <Link 
                        href={`/corporations/${corp.id}`}
                        className="ranking-item__name"
                      >
                        {corp.name}
                      </Link>
                      <span className="ranking-item__type">{corp.type}</span>
                    </div>
                    <div className="ranking-item__value">
                      {corp.memberCount} members
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Corporation Modals */}
      <CorporationModal
        isOpen={showCreateModal}
        onClose={closeModals}
        onSuccess={handleCorporationSuccess}
      />

      <CorporationModal
        isOpen={showEditModal}
        onClose={closeModals}
        onSuccess={handleCorporationSuccess}
        corporation={selectedCorporation}
      />
    </div>
  );
};

export default CorporationsPage;