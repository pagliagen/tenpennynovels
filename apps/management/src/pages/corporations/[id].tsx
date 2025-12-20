import React, { useState, useEffect } from 'react';
import { NextPage } from 'next';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { corporationAPI, CorporationDetails, handleApiError } from '../../lib/api';

// Types are now imported from api.ts

const CorporationDetailsPage: NextPage = () => {
  const router = useRouter();
  const { id } = router.query;
  
  // State
  const [corporation, setCorporation] = useState<CorporationDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusUpdateLoading, setStatusUpdateLoading] = useState(false);
  
  // Status update modal state
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState<string>('');
  const [statusReason, setStatusReason] = useState<string>('');

  // Fetch corporation details
  const fetchCorporation = async () => {
    if (!id || typeof id !== 'string') return;
    
    try {
      setLoading(true);
      const result = await corporationAPI.getCorporation(id);
      
      if (result.success && result.data) {
        setCorporation(result.data.corporation);
        setError(null);
      } else {
        setError(handleApiError(result, 'Failed to fetch corporation details'));
      }
    } catch (error) {
      console.error('Error fetching corporation:', error);
      setError(handleApiError(error, 'Failed to fetch corporation details'));
    } finally {
      setLoading(false);
    }
  };

  // Update corporation status
  const updateCorporationStatus = async () => {
    if (!corporation || !newStatus || !statusReason.trim()) return;
    
    try {
      setStatusUpdateLoading(true);
      const result = await corporationAPI.updateCorporation(corporation.id, {
        status: newStatus as 'active' | 'inactive' | 'disbanded',
        reason: statusReason.trim()
      });
      
      if (result.success) {
        // Update local state
        setCorporation(prev => prev ? { ...prev, status: newStatus as any } : null);
        setShowStatusModal(false);
        setNewStatus('');
        setStatusReason('');
        
        // Refresh data to get updated activity log
        setTimeout(fetchCorporation, 500);
      } else {
        setError(handleApiError(result, 'Failed to update corporation status'));
      }
    } catch (error) {
      console.error('Error updating corporation status:', error);
      setError(handleApiError(error, 'Failed to update corporation status'));
    } finally {
      setStatusUpdateLoading(false);
    }
  };

  // Effects
  useEffect(() => {
    if (id) {
      fetchCorporation();
    }
  }, [id]);

  // Handlers
  const handleStatusUpdate = (status: string) => {
    setNewStatus(status);
    setShowStatusModal(true);
  };

  const closeStatusModal = () => {
    setShowStatusModal(false);
    setNewStatus('');
    setStatusReason('');
  };

  // Helper functions
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

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDateShort = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="management-page">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading corporation details...</p>
        </div>
      </div>
    );
  }

  if (error || !corporation) {
    return (
      <div className="management-page">
        <div className="error-state">
          <div className="error-icon">
            <i className="icon-alert-circle"></i>
          </div>
          <h3>Error Loading Corporation</h3>
          <p>{error || 'Corporation not found'}</p>
          <div className="error-actions">
            <button 
              className="btn btn--primary"
              onClick={fetchCorporation}
            >
              Try Again
            </button>
            <Link href="/corporations" className="btn btn--secondary">
              Back to Corporations
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="management-page">
      <div className="page-header">
        <div className="page-header__content">
          <div className="breadcrumb">
            <Link href="/corporations" className="breadcrumb__link">
              Corporations
            </Link>
            <span className="breadcrumb__separator">/</span>
            <span className="breadcrumb__current">{corporation.name}</span>
          </div>
          <h1 className="page-title">{corporation.name}</h1>
          <p className="page-description">
            {corporation.description || 'No description provided'}
          </p>
        </div>
        <div className="page-header__actions">
          <div className="action-menu">
            <button 
              className="btn btn--secondary btn--sm dropdown-toggle"
              onClick={() => document.querySelector('.dropdown-menu')?.classList.toggle('show')}
            >
              <i className="icon-more-horizontal"></i>
              Actions
            </button>
            <div className="dropdown-menu">
              {corporation.status !== 'active' && (
                <button 
                  className="dropdown-item"
                  onClick={() => handleStatusUpdate('active')}
                >
                  <i className="icon-check-circle"></i>
                  Activate Corporation
                </button>
              )}
              {corporation.status !== 'inactive' && (
                <button 
                  className="dropdown-item"
                  onClick={() => handleStatusUpdate('inactive')}
                >
                  <i className="icon-pause-circle"></i>
                  Deactivate Corporation
                </button>
              )}
              {corporation.status !== 'disbanded' && (
                <button 
                  className="dropdown-item dropdown-item--danger"
                  onClick={() => handleStatusUpdate('disbanded')}
                >
                  <i className="icon-x-circle"></i>
                  Disband Corporation
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Corporation Overview */}
      <div className="content-section">
        <div className="grid grid--2">
          {/* Basic Information */}
          <div className="card">
            <div className="card__header">
              <h3 className="card__title">Basic Information</h3>
            </div>
            <div className="card__content">
              <div className="info-grid">
                <div className="info-item">
                  <label className="info-label">Status</label>
                  <div className="info-value">
                    <span className={getStatusBadgeClass(corporation.status)}>
                      {corporation.status}
                    </span>
                  </div>
                </div>
                
                <div className="info-item">
                  <label className="info-label">Type</label>
                  <div className="info-value">
                    <span className={`type-badge type-badge--${corporation.type}`}>
                      {corporation.type}
                    </span>
                  </div>
                </div>

                <div className="info-item">
                  <label className="info-label">Created</label>
                  <div className="info-value">{formatDateShort(corporation.createdAt)}</div>
                </div>

                <div className="info-item">
                  <label className="info-label">Last Activity</label>
                  <div className="info-value">{formatDate(corporation.lastActivity)}</div>
                </div>

                <div className="info-item">
                  <label className="info-label">Members</label>
                  <div className="info-value">
                    <span className="metric-value">{corporation.memberCount}</span>
                    <span className="metric-label">total members</span>
                  </div>
                </div>

                <div className="info-item">
                  <label className="info-label">Officers</label>
                  <div className="info-value">
                    <span className="metric-value">{corporation.officers.length}</span>
                    <span className="metric-label">appointed officers</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Treasury Information */}
          <div className="card">
            <div className="card__header">
              <h3 className="card__title">Treasury</h3>
              <span className="card__subtitle">
                Last updated: {formatDate(corporation.treasury.lastUpdated)}
              </span>
            </div>
            <div className="card__content">
              <div className="treasury-overview">
                <div className="treasury-item">
                  <label className="treasury-label">Cash on Hand</label>
                  <div className="treasury-value treasury-value--cash">
                    {formatCurrency(corporation.treasury.cash)}
                  </div>
                </div>

                <div className="treasury-item">
                  <label className="treasury-label">Bank Deposits</label>
                  <div className="treasury-value treasury-value--bank">
                    {formatCurrency(corporation.treasury.bankDeposit)}
                  </div>
                </div>

                <div className="treasury-item treasury-item--total">
                  <label className="treasury-label">Total Assets</label>
                  <div className="treasury-value treasury-value--total">
                    {formatCurrency(corporation.treasury.totalValue)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Owner Information */}
      <div className="content-section">
        <div className="card">
          <div className="card__header">
            <h3 className="card__title">Owner Information</h3>
          </div>
          <div className="card__content">
            <div className="owner-details">
              <div className="owner-info">
                <div className="owner-identity">
                  <h4 className="owner-character-name">{corporation.ownerName}</h4>
                  <p className="owner-user-info">
                    Played by <strong>{corporation.ownerUsername}</strong> ({corporation.ownerEmail})
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Officers and Members */}
      <div className="content-section">
        <div className="grid grid--2">
          {/* Officers */}
          <div className="card">
            <div className="card__header">
              <h3 className="card__title">Officers ({corporation.officers.length})</h3>
            </div>
            <div className="card__content">
              {corporation.officers.length > 0 ? (
                <div className="member-list">
                  {corporation.officers.map((officer) => (
                    <div key={officer.characterId} className="member-item member-item--officer">
                      <div className="member-info">
                        <h4 className="member-name">{officer.characterName}</h4>
                        <p className="member-details">
                          <span className="member-role">{officer.role}</span>
                          {officer.appointedAt && (
                            <span className="member-appointed">
                              • Appointed {formatDateShort(officer.appointedAt)}
                            </span>
                          )}
                        </p>
                        <p className="member-user">
                          {officer.username} ({officer.email})
                        </p>
                      </div>
                      {officer.gameplayRoles.length > 0 && (
                        <div className="member-roles">
                          {officer.gameplayRoles.map((role) => (
                            <span key={role} className="role-badge">
                              {role}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state empty-state--compact">
                  <i className="icon-users"></i>
                  <p>No officers appointed</p>
                </div>
              )}
            </div>
          </div>

          {/* Members */}
          <div className="card">
            <div className="card__header">
              <h3 className="card__title">Members ({corporation.members.length})</h3>
            </div>
            <div className="card__content">
              {corporation.members.length > 0 ? (
                <div className="member-list">
                  {corporation.members.slice(0, 10).map((member) => (
                    <div key={member.characterId} className="member-item">
                      <div className="member-info">
                        <h4 className="member-name">{member.characterName}</h4>
                        <p className="member-user">
                          {member.username} ({member.email})
                        </p>
                      </div>
                      {member.gameplayRoles.length > 0 && (
                        <div className="member-roles">
                          {member.gameplayRoles.map((role) => (
                            <span key={role} className="role-badge">
                              {role}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {corporation.members.length > 10 && (
                    <div className="member-item member-item--more">
                      <p>...and {corporation.members.length - 10} more members</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="empty-state empty-state--compact">
                  <i className="icon-users"></i>
                  <p>No members yet</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Activity Log */}
      <div className="content-section">
        <div className="card">
          <div className="card__header">
            <h3 className="card__title">Recent Activity</h3>
            <span className="card__subtitle">Last 10 activities</span>
          </div>
          <div className="card__content">
            {corporation.activityLog.length > 0 ? (
              <div className="activity-log">
                {corporation.activityLog.map((activity, index) => (
                  <div key={index} className="activity-item">
                    <div className="activity-icon">
                      <i className="icon-activity"></i>
                    </div>
                    <div className="activity-content">
                      <p className="activity-action">{activity.details}</p>
                      <p className="activity-meta">
                        By {activity.performedByName} • {formatDate(activity.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state empty-state--compact">
                <i className="icon-activity"></i>
                <p>No recent activity</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status Update Modal */}
      {showStatusModal && (
        <div className="modal modal--active">
          <div className="modal__backdrop" onClick={closeStatusModal}></div>
          <div className="modal__content">
            <div className="modal__header">
              <h3 className="modal__title">
                Update Corporation Status
              </h3>
              <button className="modal__close" onClick={closeStatusModal}>
                <i className="icon-x"></i>
              </button>
            </div>
            <div className="modal__body">
              <p className="modal__description">
                You are about to change the status of <strong>{corporation.name}</strong> to{' '}
                <span className={getStatusBadgeClass(newStatus)}>{newStatus}</span>.
              </p>
              
              <div className="form-group">
                <label className="form-label" htmlFor="statusReason">
                  Reason for status change *
                </label>
                <textarea
                  id="statusReason"
                  className="form-textarea"
                  rows={3}
                  placeholder="Explain why you are changing the corporation status..."
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                />
              </div>
            </div>
            <div className="modal__footer">
              <button 
                className="btn btn--secondary"
                onClick={closeStatusModal}
                disabled={statusUpdateLoading}
              >
                Cancel
              </button>
              <button 
                className={`btn ${newStatus === 'disbanded' ? 'btn--danger' : 'btn--primary'}`}
                onClick={updateCorporationStatus}
                disabled={statusUpdateLoading || !statusReason.trim()}
              >
                {statusUpdateLoading ? (
                  <>
                    <div className="spinner spinner--sm"></div>
                    Updating...
                  </>
                ) : (
                  `Update Status to ${newStatus}`
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CorporationDetailsPage;