import React, { useState, useEffect } from 'react';
import { NextPage } from 'next';
import Link from 'next/link';
import { corporationAPI, MembershipRequest, PaginationInfo, handleApiError } from '../lib/api';

// Types are now imported from api.ts

const MembershipRequestsPage: NextPage = () => {
  // State
  const [requests, setRequests] = useState<MembershipRequest[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewLoading, setReviewLoading] = useState<string | null>(null);
  
  // Filters
  const [corporationFilter, setCorporationFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  
  // Review modal state
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<MembershipRequest | null>(null);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject'>('approve');
  const [reviewNote, setReviewNote] = useState<string>('');

  // Fetch membership requests
  const fetchRequests = async () => {
    try {
      setLoading(true);
      const params = {
        page: currentPage,
        limit: pageSize,
        ...(corporationFilter !== 'all' && { corporationId: corporationFilter })
      };

      const result = await corporationAPI.getAllMembershipRequests(params);
      
      if (result.success && result.data) {
        setRequests(result.data.requests);
        setPagination(result.data.pagination);
        setError(null);
      } else {
        setError(handleApiError(result, 'Failed to fetch membership requests'));
      }
    } catch (error) {
      console.error('Error fetching membership requests:', error);
      setError(handleApiError(error, 'Failed to fetch membership requests'));
    } finally {
      setLoading(false);
    }
  };

  // Review membership request
  const reviewMembershipRequest = async () => {
    if (!selectedRequest || !reviewNote.trim()) return;
    
    try {
      setReviewLoading(selectedRequest.id);
      const result = await corporationAPI.handleMembershipRequest(
        selectedRequest.corporationId,
        selectedRequest.id,
        {
          action: reviewAction,
          note: reviewNote.trim()
        }
      );
      
      if (result.success) {
        // Remove the reviewed request from the list
        setRequests(prev => prev.filter(req => req.id !== selectedRequest.id));
        closeReviewModal();
        
        // If this was the last request on the current page, go back one page
        if (requests.length === 1 && currentPage > 1) {
          setCurrentPage(prev => prev - 1);
        }
      } else {
        setError(handleApiError(result, 'Failed to review membership request'));
      }
    } catch (error) {
      console.error('Error reviewing membership request:', error);
      setError(handleApiError(error, 'Failed to review membership request'));
    } finally {
      setReviewLoading(null);
    }
  };

  // Effects
  useEffect(() => {
    fetchRequests();
  }, [currentPage, pageSize, corporationFilter]);

  // Handlers
  const handleCorporationFilterChange = (corporationId: string) => {
    setCorporationFilter(corporationId);
    setCurrentPage(1); // Reset to first page when filtering
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const openReviewModal = (request: MembershipRequest, action: 'approve' | 'reject') => {
    setSelectedRequest(request);
    setReviewAction(action);
    setShowReviewModal(true);
  };

  const closeReviewModal = () => {
    setShowReviewModal(false);
    setSelectedRequest(null);
    setReviewAction('approve');
    setReviewNote('');
  };

  // Helper functions
  const formatDate = (dateString: string) => {
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

  const getTimeSinceSubmission = (dateString: string) => {
    const now = new Date();
    const submitted = new Date(dateString);
    const diffInHours = Math.floor((now.getTime() - submitted.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInHours < 48) return 'Yesterday';
    return `${Math.floor(diffInHours / 24)}d ago`;
  };

  return (
    <div className="management-page">
      <div className="page-header">
        <div className="page-header__content">
          <h1 className="page-title">Membership Requests</h1>
          <p className="page-description">
            Review and approve corporation membership requests
          </p>
        </div>
        <div className="page-header__actions">
          <Link href="/corporations" className="btn btn--secondary">
            <i className="icon-building"></i>
            Back to Corporations
          </Link>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="content-section">
        <div className="stats-grid stats-grid--3">
          <div className="stat-card">
            <div className="stat-card__icon stat-card__icon--warning">
              <i className="icon-clock"></i>
            </div>
            <div className="stat-card__content">
              <h3 className="stat-card__value">{pagination?.totalItems || 0}</h3>
              <p className="stat-card__label">Pending Requests</p>
              <span className="stat-card__change">
                Awaiting review
              </span>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-card__icon stat-card__icon--info">
              <i className="icon-users"></i>
            </div>
            <div className="stat-card__content">
              <h3 className="stat-card__value">
                {new Set(requests.map(r => r.corporationId)).size}
              </h3>
              <p className="stat-card__label">Corporations</p>
              <span className="stat-card__change">
                Have pending requests
              </span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-card__icon stat-card__icon--primary">
              <i className="icon-user-plus"></i>
            </div>
            <div className="stat-card__content">
              <h3 className="stat-card__value">
                {new Set(requests.map(r => r.characterId)).size}
              </h3>
              <p className="stat-card__label">Characters</p>
              <span className="stat-card__change">
                Requesting membership
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="content-section">
        <div className="filters">
          <div className="filter-group">
            <label className="filter-label">Corporation Filter:</label>
            <select 
              className="select select--sm"
              value={corporationFilter}
              onChange={(e) => handleCorporationFilterChange(e.target.value)}
            >
              <option value="all">All Corporations</option>
              {Array.from(new Set(requests.map(r => ({ id: r.corporationId, name: r.corporationName }))))
                .map(corp => (
                  <option key={corp.id} value={corp.id}>
                    {corp.name}
                  </option>
                ))}
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
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>

        {/* Membership Requests List */}
        <div className="data-table-container">
          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading membership requests...</p>
            </div>
          ) : error ? (
            <div className="error-state">
              <div className="error-icon">
                <i className="icon-alert-circle"></i>
              </div>
              <h3>Error Loading Requests</h3>
              <p>{error}</p>
              <button 
                className="btn btn--primary"
                onClick={fetchRequests}
              >
                Try Again
              </button>
            </div>
          ) : (
            <div className="request-list">
              {requests.map((request) => (
                <div key={request.id} className="request-card">
                  <div className="request-card__header">
                    <div className="request-info">
                      <h3 className="request-corporation">
                        <Link href={`/corporations/${request.corporationId}`}>
                          {request.corporationName}
                        </Link>
                      </h3>
                      <span className={`type-badge type-badge--${request.corporationType}`}>
                        {request.corporationType}
                      </span>
                    </div>
                    <div className="request-time">
                      <span className="time-ago">{getTimeSinceSubmission(request.createdAt)}</span>
                      <span className="time-full">{formatDate(request.createdAt)}</span>
                    </div>
                  </div>

                  <div className="request-card__body">
                    <div className="applicant-info">
                      <div className="applicant-details">
                        <h4 className="applicant-name">{request.characterName}</h4>
                        <p className="applicant-user">
                          Played by <strong>{request.username}</strong> ({request.email})
                        </p>
                      </div>
                    </div>

                    {request.message && (
                      <div className="request-message">
                        <label className="message-label">Application Message:</label>
                        <p className="message-text">{request.message}</p>
                      </div>
                    )}
                  </div>

                  <div className="request-card__footer">
                    <div className="request-actions">
                      <button 
                        className="btn btn--success btn--sm"
                        onClick={() => openReviewModal(request, 'approve')}
                        disabled={reviewLoading === request.id}
                      >
                        <i className="icon-check"></i>
                        Approve
                      </button>
                      <button 
                        className="btn btn--danger btn--sm"
                        onClick={() => openReviewModal(request, 'reject')}
                        disabled={reviewLoading === request.id}
                      >
                        <i className="icon-x"></i>
                        Reject
                      </button>
                      {reviewLoading === request.id && (
                        <div className="action-loading">
                          <div className="spinner spinner--sm"></div>
                          Processing...
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {requests.length === 0 && (
                <div className="empty-state">
                  <div className="empty-state__icon">
                    <i className="icon-user-check"></i>
                  </div>
                  <h3>No Pending Requests</h3>
                  <p>
                    {corporationFilter !== 'all' 
                      ? 'No pending membership requests for the selected corporation.'
                      : 'There are no pending membership requests at this time.'
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
              Showing {((pagination.currentPage - 1) * pagination.limit) + 1} to{' '}
              {Math.min(pagination.currentPage * pagination.limit, pagination.totalItems)} of{' '}
              {pagination.totalItems} requests
            </div>
            <div className="pagination">
              <button 
                className="pagination__btn pagination__btn--prev"
                disabled={pagination.currentPage <= 1}
                onClick={() => handlePageChange(pagination.currentPage - 1)}
              >
                <i className="icon-chevron-left"></i>
                Previous
              </button>

              <div className="pagination__numbers">
                {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                  const pageNum = pagination.currentPage - 2 + i;
                  if (pageNum < 1 || pageNum > pagination.totalPages) return null;
                  
                  return (
                    <button
                      key={pageNum}
                      className={`pagination__number ${pageNum === pagination.currentPage ? 'pagination__number--active' : ''}`}
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
                onClick={() => handlePageChange(pagination.currentPage + 1)}
              >
                Next
                <i className="icon-chevron-right"></i>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Review Modal */}
      {showReviewModal && selectedRequest && (
        <div className="modal modal--active">
          <div className="modal__backdrop" onClick={closeReviewModal}></div>
          <div className="modal__content">
            <div className="modal__header">
              <h3 className="modal__title">
                {reviewAction === 'approve' ? 'Approve' : 'Reject'} Membership Request
              </h3>
              <button className="modal__close" onClick={closeReviewModal}>
                <i className="icon-x"></i>
              </button>
            </div>
            <div className="modal__body">
              <div className="review-summary">
                <p className="review-description">
                  You are about to {reviewAction} the membership request from{' '}
                  <strong>{selectedRequest.characterName}</strong> to join{' '}
                  <strong>{selectedRequest.corporationName}</strong>.
                </p>
                
                {selectedRequest.message && (
                  <div className="application-message">
                    <label className="message-label">Original Application:</label>
                    <div className="message-content">
                      {selectedRequest.message}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="form-group">
                <label className="form-label" htmlFor="reviewNote">
                  {reviewAction === 'approve' ? 'Approval' : 'Rejection'} Note *
                </label>
                <textarea
                  id="reviewNote"
                  className="form-textarea"
                  rows={3}
                  placeholder={
                    reviewAction === 'approve' 
                      ? 'Add any notes about the approval...'
                      : 'Explain why this request is being rejected...'
                  }
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                />
              </div>
            </div>
            <div className="modal__footer">
              <button 
                className="btn btn--secondary"
                onClick={closeReviewModal}
                disabled={reviewLoading === selectedRequest.id}
              >
                Cancel
              </button>
              <button 
                className={`btn ${reviewAction === 'approve' ? 'btn--success' : 'btn--danger'}`}
                onClick={reviewMembershipRequest}
                disabled={reviewLoading === selectedRequest.id || !reviewNote.trim()}
              >
                {reviewLoading === selectedRequest.id ? (
                  <>
                    <div className="spinner spinner--sm"></div>
                    Processing...
                  </>
                ) : (
                  `${reviewAction === 'approve' ? 'Approve' : 'Reject'} Request`
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MembershipRequestsPage;