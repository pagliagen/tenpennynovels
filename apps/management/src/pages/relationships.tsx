import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import dynamic from 'next/dynamic';

// Dynamically import chart component for performance
const RelationshipChart = dynamic(() => import('../components/charts/RelationshipChart'), {
  ssr: false
});

interface RelationshipType {
  _id: string;
  name: string;
  description: string;
  requiresMutualApproval: boolean;
  isExclusive: boolean;
  allowsSelfProposal: boolean;
  hasReciprocalType: boolean;
  reciprocalTypeId?: string;
  maxInstances?: number;
  requiredGender: ('male' | 'female')[];
  requiredSocialClass: ('working' | 'middle' | 'upper')[];
  socialImplications: string;
  isPublicRelationship: boolean;
  respectabilityModifier: number;
  isActive: boolean;
  createdBy?: {
    username: string;
  };
  usage?: {
    activeRelationships: number;
    pendingProposals: number;
  };
  createdAt: string;
  updatedAt: string;
}

interface CharacterRelationship {
  _id: string;
  fromCharacterId: {
    _id: string;
    name?: string;
    basicInfo?: {
      fullName: string;
    };
  };
  toCharacterId: {
    _id: string;
    name?: string;
    basicInfo?: {
      fullName: string;
    };
  };
  relationshipTypeId: {
    _id: string;
    name: string;
    description: string;
    respectabilityModifier: number;
  };
  status: 'PROPOSED' | 'PENDING_MUTUAL' | 'ESTABLISHED' | 'REJECTED' | 'ENDED' | 'DISPUTED';
  currentStrength: number;
  trustLevel: number;
  establishedDate?: string;
  relationshipNotes?: string;
  publicDescription?: string;
  createdAt: string;
}

interface RelationshipProposal {
  _id: string;
  fromCharacterId: {
    _id: string;
    name?: string;
    basicInfo?: {
      fullName: string;
    };
  };
  toCharacterId: {
    _id: string;
    name?: string;
    basicInfo?: {
      fullName: string;
    };
  };
  relationshipTypeId: {
    _id: string;
    name: string;
    description: string;
  };
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  proposalMessage?: string;
  proposedAt: string;
  expiresAt?: string;
  response?: {
    accept: boolean;
    responseMessage?: string;
    respondedBy: {
      _id: string;
      name?: string;
      basicInfo?: {
        fullName: string;
      };
    };
    respondedAt: string;
  };
}

interface RelationshipStats {
  overview: {
    relationships: Array<{
      _id: string;
      count: number;
    }>;
    proposals: Array<{
      _id: string;
      count: number;
    }>;
  };
  popularTypes: Array<{
    _id: {
      typeId: string;
      typeName: string;
    };
    activeCount: number;
    totalCount: number;
  }>;
  strengthAndTrust: {
    avgStrength: number;
    avgTrust: number;
    minStrength: number;
    maxStrength: number;
    minTrust: number;
    maxTrust: number;
    count: number;
  };
  mostConnectedCharacters: Array<{
    _id: string;
    characterName: string;
    relationshipCount: number;
  }>;
  recentActivity: Array<{
    _id: string;
    actionType: string;
    performedBy: {
      _id: string;
      name?: string;
      basicInfo?: {
        fullName: string;
      };
    };
    affectedCharacter: {
      _id: string;
      name?: string;
      basicInfo?: {
        fullName: string;
      };
    };
    performedAt: string;
  }>;
}

interface RelationshipTypeStats {
  overview: {
    total: number;
    active: number;
    inactive: number;
    requiresMutualApproval: number;
    exclusive: number;
    allowsSelfProposal: number;
  };
  restrictions: {
    byGender: Array<{
      _id: string;
      count: number;
    }>;
    bySocialClass: Array<{
      _id: string;
      count: number;
    }>;
  };
  usage: {
    mostUsed: Array<{
      _id: string;
      name: string;
      activeRelationships: number;
    }>;
  };
  respectability: Array<{
    _id: number;
    count: number;
  }>;
  recentActivity: RelationshipType[];
}

interface Pagination {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  limit: number;
}

const RelationshipsPage: React.FC = () => {
  const router = useRouter();
  const { user } = useAuth();
  
  // State management
  const [activeTab, setActiveTab] = useState<'types' | 'relationships' | 'proposals' | 'analytics'>('types');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Relationship Types state
  const [relationshipTypes, setRelationshipTypes] = useState<RelationshipType[]>([]);
  const [relationshipTypeStats, setRelationshipTypeStats] = useState<RelationshipTypeStats | null>(null);
  const [typesPagination, setTypesPagination] = useState<Pagination | null>(null);

  // Character Relationships state
  const [relationships, setRelationships] = useState<CharacterRelationship[]>([]);
  const [relationshipsPagination, setRelationshipsPagination] = useState<Pagination | null>(null);

  // Relationship Proposals state
  const [proposals, setProposals] = useState<RelationshipProposal[]>([]);
  const [proposalsPagination, setProposalsPagination] = useState<Pagination | null>(null);

  // Analytics state
  const [relationshipStats, setRelationshipStats] = useState<RelationshipStats | null>(null);

  // Filter states
  const [typeFilters, setTypeFilters] = useState({
    search: '',
    isActive: '',
    requiresMutualApproval: '',
    isExclusive: '',
    allowsSelfProposal: '',
    requiredGender: '',
    requiredSocialClass: '',
    page: 1,
    limit: 25,
    sortBy: 'name',
    sortOrder: 'asc'
  });

  const [relationshipFilters, setRelationshipFilters] = useState({
    search: '',
    status: '',
    relationshipTypeId: '',
    characterId: '',
    page: 1,
    limit: 25,
    sortBy: 'createdAt',
    sortOrder: 'desc'
  });

  const [proposalFilters, setProposalFilters] = useState({
    status: '',
    relationshipTypeId: '',
    characterId: '',
    page: 1,
    limit: 25,
    sortBy: 'createdAt',
    sortOrder: 'desc'
  });

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showModerationModal, setShowModerationModal] = useState(false);
  const [selectedType, setSelectedType] = useState<RelationshipType | null>(null);
  const [selectedRelationship, setSelectedRelationship] = useState<CharacterRelationship | null>(null);

  // Form states
  const [formData, setFormData] = useState<Partial<RelationshipType> & { reason?: string }>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Check admin permissions
  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    
    if (!user.canAccessAdminPanel) {
      router.push('/dashboard');
      return;
    }
  }, [user, router]);

  // Fetch data based on active tab
  useEffect(() => {
    if (user?.canAccessAdminPanel) {
      switch (activeTab) {
        case 'types':
          fetchRelationshipTypes();
          fetchRelationshipTypeStats();
          break;
        case 'relationships':
          fetchCharacterRelationships();
          break;
        case 'proposals':
          fetchRelationshipProposals();
          break;
        case 'analytics':
          fetchRelationshipStats();
          break;
      }
    }
  }, [user, activeTab, typeFilters, relationshipFilters, proposalFilters]);

  // API Functions
  const fetchRelationshipTypes = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      Object.entries(typeFilters).forEach(([key, value]) => {
        if (value !== '' && value !== null && value !== undefined) {
          params.append(key, value.toString());
        }
      });

      const response = await fetch(`/api/admin/relationships/types?${params}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch relationship types: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setRelationshipTypes(data.data.relationshipTypes);
        setTypesPagination(data.data.pagination);
      } else {
        throw new Error(data.error || 'Failed to fetch relationship types');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching relationship types:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRelationshipTypeStats = async () => {
    try {
      const response = await fetch('/api/admin/relationships/types/stats', {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setRelationshipTypeStats(data.data);
        }
      }
    } catch (err) {
      console.error('Error fetching relationship type stats:', err);
    }
  };

  const fetchCharacterRelationships = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      Object.entries(relationshipFilters).forEach(([key, value]) => {
        if (value !== '' && value !== null && value !== undefined) {
          params.append(key, value.toString());
        }
      });

      const response = await fetch(`/api/admin/relationships/relationships?${params}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch relationships: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setRelationships(data.data.relationships);
        setRelationshipsPagination(data.data.pagination);
      } else {
        throw new Error(data.error || 'Failed to fetch relationships');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching relationships:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRelationshipProposals = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      Object.entries(proposalFilters).forEach(([key, value]) => {
        if (value !== '' && value !== null && value !== undefined) {
          params.append(key, value.toString());
        }
      });

      const response = await fetch(`/api/admin/relationships/proposals?${params}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch proposals: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setProposals(data.data.proposals);
        setProposalsPagination(data.data.pagination);
      } else {
        throw new Error(data.error || 'Failed to fetch proposals');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching proposals:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRelationshipStats = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/admin/relationships/stats', {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch relationship stats: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setRelationshipStats(data.data);
      } else {
        throw new Error(data.error || 'Failed to fetch relationship stats');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching relationship stats:', err);
    } finally {
      setLoading(false);
    }
  };

  // Helper functions
  const formatCharacterName = (character: any): string => {
    if (!character) return 'Unknown Character';
    return character.basicInfo?.fullName || character.name || `Character ${character._id}`;
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadgeClass = (status: string): string => {
    const statusClasses = {
      'PROPOSED': 'status-proposed',
      'PENDING_MUTUAL': 'status-pending',
      'ESTABLISHED': 'status-established',
      'REJECTED': 'status-rejected',
      'ENDED': 'status-ended',
      'DISPUTED': 'status-disputed',
      'pending': 'status-pending',
      'accepted': 'status-established',
      'rejected': 'status-rejected',
      'expired': 'status-expired'
    };
    return statusClasses[status as keyof typeof statusClasses] || 'status-default';
  };

  const getRespectabilityIcon = (modifier: number): string => {
    if (modifier > 0) return '⬆️';
    if (modifier < 0) return '⬇️';
    return '➖';
  };

  // Event handlers
  const handleCreateRelationshipType = () => {
    setFormData({
      name: '',
      description: '',
      socialImplications: '',
      requiresMutualApproval: true,
      isExclusive: false,
      allowsSelfProposal: true,
      hasReciprocalType: false,
      isPublicRelationship: true,
      respectabilityModifier: 0,
      requiredGender: [],
      requiredSocialClass: []
    });
    setFormErrors({});
    setShowCreateModal(true);
  };

  const handleEditRelationshipType = (relationshipType: RelationshipType) => {
    setSelectedType(relationshipType);
    setFormData({
      ...relationshipType,
      reason: ''
    });
    setFormErrors({});
    setShowEditModal(true);
  };

  const handleDeleteRelationshipType = (relationshipType: RelationshipType) => {
    setSelectedType(relationshipType);
    setShowDeleteModal(true);
  };

  const handleModerateRelationship = (relationship: CharacterRelationship) => {
    setSelectedRelationship(relationship);
    setShowModerationModal(true);
  };

  // Render functions
  const renderRelationshipTypesTab = () => (
    <div className="relationship-types-tab">
      {/* Filters */}
      <div className="filters-section">
        <div className="filters-row">
          <div className="filter-group">
            <input
              type="text"
              placeholder="Search relationship types..."
              value={typeFilters.search}
              onChange={(e) => setTypeFilters(prev => ({ ...prev, search: e.target.value, page: 1 }))}
              className="search-input"
            />
          </div>
          
          <div className="filter-group">
            <select
              value={typeFilters.isActive}
              onChange={(e) => setTypeFilters(prev => ({ ...prev, isActive: e.target.value, page: 1 }))}
              className="filter-select"
            >
              <option value="">All Status</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>

          <div className="filter-group">
            <select
              value={typeFilters.requiresMutualApproval}
              onChange={(e) => setTypeFilters(prev => ({ ...prev, requiresMutualApproval: e.target.value, page: 1 }))}
              className="filter-select"
            >
              <option value="">All Approval Types</option>
              <option value="true">Requires Mutual Approval</option>
              <option value="false">No Mutual Approval</option>
            </select>
          </div>

          <div className="filter-group">
            <select
              value={typeFilters.requiredSocialClass}
              onChange={(e) => setTypeFilters(prev => ({ ...prev, requiredSocialClass: e.target.value, page: 1 }))}
              className="filter-select"
            >
              <option value="">All Social Classes</option>
              <option value="working">Working Class</option>
              <option value="middle">Middle Class</option>
              <option value="upper">Upper Class</option>
            </select>
          </div>
        </div>

        <div className="actions-row">
          <button 
            onClick={handleCreateRelationshipType}
            className="btn btn-primary"
          >
            Create New Relationship Type
          </button>
        </div>
      </div>

      {/* Statistics Overview */}
      {relationshipTypeStats && (
        <div className="stats-overview">
          <div className="stats-grid">
            <div className="stat-card">
              <h3>Total Types</h3>
              <div className="stat-number">{relationshipTypeStats.overview.total}</div>
            </div>
            <div className="stat-card">
              <h3>Active Types</h3>
              <div className="stat-number">{relationshipTypeStats.overview.active}</div>
            </div>
            <div className="stat-card">
              <h3>Require Approval</h3>
              <div className="stat-number">{relationshipTypeStats.overview.requiresMutualApproval}</div>
            </div>
            <div className="stat-card">
              <h3>Exclusive Types</h3>
              <div className="stat-number">{relationshipTypeStats.overview.exclusive}</div>
            </div>
          </div>
        </div>
      )}

      {/* Results Table */}
      <div className="results-section">
        {loading && (
          <div className="loading-indicator">
            <div className="spinner"></div>
            Loading relationship types...
          </div>
        )}

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {!loading && !error && relationshipTypes.length === 0 && (
          <div className="empty-state">
            No relationship types found matching your criteria.
          </div>
        )}

        {!loading && !error && relationshipTypes.length > 0 && (
          <>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Description</th>
                    <th>Properties</th>
                    <th>Respectability</th>
                    <th>Usage</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {relationshipTypes.map((type) => (
                    <tr key={type._id}>
                      <td>
                        <div className="type-name">
                          <strong>{type.name}</strong>
                          {type.hasReciprocalType && (
                            <span className="reciprocal-indicator" title="Has reciprocal type">⭿</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="description-cell">
                          {type.description.substring(0, 80)}
                          {type.description.length > 80 && '...'}
                        </div>
                      </td>
                      <td>
                        <div className="properties-cell">
                          {type.requiresMutualApproval && <span className="property-tag">Mutual</span>}
                          {type.isExclusive && <span className="property-tag">Exclusive</span>}
                          {type.allowsSelfProposal && <span className="property-tag">Self-Proposal</span>}
                          {type.maxInstances && <span className="property-tag">Max: {type.maxInstances}</span>}
                        </div>
                      </td>
                      <td>
                        <div className="respectability-cell">
                          {getRespectabilityIcon(type.respectabilityModifier)}
                          <span>{type.respectabilityModifier}</span>
                        </div>
                      </td>
                      <td>
                        <div className="usage-cell">
                          {type.usage && (
                            <>
                              <div>Active: {type.usage.activeRelationships}</div>
                              <div>Proposals: {type.usage.pendingProposals}</div>
                            </>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className={`status-badge ${type.isActive ? 'active' : 'inactive'}`}>
                          {type.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button 
                            onClick={() => handleEditRelationshipType(type)}
                            className="btn btn-sm btn-secondary"
                            title="Edit"
                          >
                            Edit
                          </button>
                          <button 
                            onClick={() => handleDeleteRelationshipType(type)}
                            className="btn btn-sm btn-danger"
                            title="Delete"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {typesPagination && typesPagination.totalPages > 1 && (
              <div className="pagination-section">
                <div className="pagination-info">
                  Showing {((typesPagination.currentPage - 1) * typesPagination.limit) + 1} to {Math.min(typesPagination.currentPage * typesPagination.limit, typesPagination.totalCount)} of {typesPagination.totalCount} results
                </div>
                <div className="pagination-controls">
                  <button
                    onClick={() => setTypeFilters(prev => ({ ...prev, page: prev.page - 1 }))}
                    disabled={!typesPagination.hasPrevPage}
                    className="btn btn-sm btn-secondary"
                  >
                    Previous
                  </button>
                  <span className="page-info">
                    Page {typesPagination.currentPage} of {typesPagination.totalPages}
                  </span>
                  <button
                    onClick={() => setTypeFilters(prev => ({ ...prev, page: prev.page + 1 }))}
                    disabled={!typesPagination.hasNextPage}
                    className="btn btn-sm btn-secondary"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );

  const renderRelationshipsTab = () => (
    <div className="relationships-tab">
      {/* Filters */}
      <div className="filters-section">
        <div className="filters-row">
          <div className="filter-group">
            <input
              type="text"
              placeholder="Search characters or relationship types..."
              value={relationshipFilters.search}
              onChange={(e) => setRelationshipFilters(prev => ({ ...prev, search: e.target.value, page: 1 }))}
              className="search-input"
            />
          </div>
          
          <div className="filter-group">
            <select
              value={relationshipFilters.status}
              onChange={(e) => setRelationshipFilters(prev => ({ ...prev, status: e.target.value, page: 1 }))}
              className="filter-select"
            >
              <option value="">All Status</option>
              <option value="PROPOSED">Proposed</option>
              <option value="PENDING_MUTUAL">Pending Mutual</option>
              <option value="ESTABLISHED">Established</option>
              <option value="REJECTED">Rejected</option>
              <option value="ENDED">Ended</option>
              <option value="DISPUTED">Disputed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results Table */}
      <div className="results-section">
        {loading && (
          <div className="loading-indicator">
            <div className="spinner"></div>
            Loading relationships...
          </div>
        )}

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {!loading && !error && relationships.length === 0 && (
          <div className="empty-state">
            No relationships found matching your criteria.
          </div>
        )}

        {!loading && !error && relationships.length > 0 && (
          <>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>From Character</th>
                    <th>To Character</th>
                    <th>Relationship Type</th>
                    <th>Status</th>
                    <th>Strength & Trust</th>
                    <th>Established</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {relationships.map((relationship) => (
                    <tr key={relationship._id}>
                      <td>{formatCharacterName(relationship.fromCharacterId)}</td>
                      <td>{formatCharacterName(relationship.toCharacterId)}</td>
                      <td>
                        <div className="relationship-type-cell">
                          <strong>{relationship.relationshipTypeId.name}</strong>
                          <div className="respectability">
                            {getRespectabilityIcon(relationship.relationshipTypeId.respectabilityModifier)}
                            {relationship.relationshipTypeId.respectabilityModifier}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`status-badge ${getStatusBadgeClass(relationship.status)}`}>
                          {relationship.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td>
                        <div className="metrics-cell">
                          <div>Strength: {relationship.currentStrength}/10</div>
                          <div>Trust: {relationship.trustLevel}/10</div>
                        </div>
                      </td>
                      <td>
                        {relationship.establishedDate ? formatDate(relationship.establishedDate) : '-'}
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button 
                            onClick={() => handleModerateRelationship(relationship)}
                            className="btn btn-sm btn-warning"
                            title="Moderate"
                          >
                            Moderate
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {relationshipsPagination && relationshipsPagination.totalPages > 1 && (
              <div className="pagination-section">
                <div className="pagination-info">
                  Showing {((relationshipsPagination.currentPage - 1) * relationshipsPagination.limit) + 1} to {Math.min(relationshipsPagination.currentPage * relationshipsPagination.limit, relationshipsPagination.totalCount)} of {relationshipsPagination.totalCount} results
                </div>
                <div className="pagination-controls">
                  <button
                    onClick={() => setRelationshipFilters(prev => ({ ...prev, page: prev.page - 1 }))}
                    disabled={!relationshipsPagination.hasPrevPage}
                    className="btn btn-sm btn-secondary"
                  >
                    Previous
                  </button>
                  <span className="page-info">
                    Page {relationshipsPagination.currentPage} of {relationshipsPagination.totalPages}
                  </span>
                  <button
                    onClick={() => setRelationshipFilters(prev => ({ ...prev, page: prev.page + 1 }))}
                    disabled={!relationshipsPagination.hasNextPage}
                    className="btn btn-sm btn-secondary"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );

  const renderProposalsTab = () => (
    <div className="proposals-tab">
      {/* Filters */}
      <div className="filters-section">
        <div className="filters-row">
          <div className="filter-group">
            <select
              value={proposalFilters.status}
              onChange={(e) => setProposalFilters(prev => ({ ...prev, status: e.target.value, page: 1 }))}
              className="filter-select"
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
              <option value="expired">Expired</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results Table */}
      <div className="results-section">
        {loading && (
          <div className="loading-indicator">
            <div className="spinner"></div>
            Loading proposals...
          </div>
        )}

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {!loading && !error && proposals.length === 0 && (
          <div className="empty-state">
            No proposals found matching your criteria.
          </div>
        )}

        {!loading && !error && proposals.length > 0 && (
          <>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>From Character</th>
                    <th>To Character</th>
                    <th>Relationship Type</th>
                    <th>Status</th>
                    <th>Proposed</th>
                    <th>Expires</th>
                    <th>Message</th>
                  </tr>
                </thead>
                <tbody>
                  {proposals.map((proposal) => (
                    <tr key={proposal._id}>
                      <td>{formatCharacterName(proposal.fromCharacterId)}</td>
                      <td>{formatCharacterName(proposal.toCharacterId)}</td>
                      <td>{proposal.relationshipTypeId.name}</td>
                      <td>
                        <span className={`status-badge ${getStatusBadgeClass(proposal.status)}`}>
                          {proposal.status.charAt(0).toUpperCase() + proposal.status.slice(1)}
                        </span>
                      </td>
                      <td>{formatDate(proposal.proposedAt)}</td>
                      <td>{proposal.expiresAt ? formatDate(proposal.expiresAt) : '-'}</td>
                      <td>
                        <div className="message-cell">
                          {proposal.proposalMessage?.substring(0, 50) || '-'}
                          {proposal.proposalMessage && proposal.proposalMessage.length > 50 && '...'}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {proposalsPagination && proposalsPagination.totalPages > 1 && (
              <div className="pagination-section">
                <div className="pagination-info">
                  Showing {((proposalsPagination.currentPage - 1) * proposalsPagination.limit) + 1} to {Math.min(proposalsPagination.currentPage * proposalsPagination.limit, proposalsPagination.totalCount)} of {proposalsPagination.totalCount} results
                </div>
                <div className="pagination-controls">
                  <button
                    onClick={() => setProposalFilters(prev => ({ ...prev, page: prev.page - 1 }))}
                    disabled={!proposalsPagination.hasPrevPage}
                    className="btn btn-sm btn-secondary"
                  >
                    Previous
                  </button>
                  <span className="page-info">
                    Page {proposalsPagination.currentPage} of {proposalsPagination.totalPages}
                  </span>
                  <button
                    onClick={() => setProposalFilters(prev => ({ ...prev, page: prev.page + 1 }))}
                    disabled={!proposalsPagination.hasNextPage}
                    className="btn btn-sm btn-secondary"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );

  const renderAnalyticsTab = () => (
    <div className="analytics-tab">
      {loading && (
        <div className="loading-indicator">
          <div className="spinner"></div>
          Loading analytics...
        </div>
      )}

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {!loading && !error && relationshipStats && (
        <div className="analytics-content">
          {/* Overview Stats */}
          <div className="stats-overview">
            <h3>Relationship Overview</h3>
            <div className="stats-grid">
              <div className="stat-card">
                <h4>Established Relationships</h4>
                <div className="stat-number">
                  {relationshipStats.overview.relationships.find(r => r._id === 'ESTABLISHED')?.count || 0}
                </div>
              </div>
              <div className="stat-card">
                <h4>Pending Proposals</h4>
                <div className="stat-number">
                  {relationshipStats.overview.proposals.find(p => p._id === 'pending')?.count || 0}
                </div>
              </div>
              <div className="stat-card">
                <h4>Average Strength</h4>
                <div className="stat-number">
                  {relationshipStats.strengthAndTrust.avgStrength.toFixed(1)}/10
                </div>
              </div>
              <div className="stat-card">
                <h4>Average Trust</h4>
                <div className="stat-number">
                  {relationshipStats.strengthAndTrust.avgTrust.toFixed(1)}/10
                </div>
              </div>
            </div>
          </div>

          {/* Popular Relationship Types */}
          <div className="popular-types-section">
            <h3>Most Popular Relationship Types</h3>
            <div className="popular-types-list">
              {relationshipStats.popularTypes.slice(0, 5).map((type, index) => (
                <div key={type._id.typeId} className="popular-type-item">
                  <div className="rank">#{index + 1}</div>
                  <div className="type-info">
                    <div className="type-name">{type._id.typeName}</div>
                    <div className="type-stats">
                      Active: {type.activeCount}, Total: {type.totalCount}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Most Connected Characters */}
          <div className="connected-characters-section">
            <h3>Most Connected Characters</h3>
            <div className="connected-characters-list">
              {relationshipStats.mostConnectedCharacters.slice(0, 10).map((character, index) => (
                <div key={character._id} className="connected-character-item">
                  <div className="rank">#{index + 1}</div>
                  <div className="character-info">
                    <div className="character-name">{character.characterName}</div>
                    <div className="relationship-count">{character.relationshipCount} relationships</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="recent-activity-section">
            <h3>Recent Relationship Activity</h3>
            <div className="activity-timeline">
              {relationshipStats.recentActivity.map((activity) => (
                <div key={activity._id} className="activity-item">
                  <div className="activity-time">
                    {formatDate(activity.performedAt)}
                  </div>
                  <div className="activity-details">
                    <div className="activity-type">{activity.actionType.toUpperCase()}</div>
                    <div className="activity-characters">
                      {formatCharacterName(activity.performedBy)} → {formatCharacterName(activity.affectedCharacter)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (!user?.canAccessAdminPanel) {
    return (
      <div className="access-denied">
        <h2>Access Denied</h2>
        <p>You don't have permission to access this page.</p>
      </div>
    );
  }

  return (
    <div className="relationships-page">
      <div className="page-header">
        <h1>Relationship Management</h1>
        <p>Manage Victorian relationship types, character relationships, and proposals</p>
      </div>

      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button
          onClick={() => setActiveTab('types')}
          className={`tab-button ${activeTab === 'types' ? 'active' : ''}`}
        >
          Relationship Types
        </button>
        <button
          onClick={() => setActiveTab('relationships')}
          className={`tab-button ${activeTab === 'relationships' ? 'active' : ''}`}
        >
          Character Relationships
        </button>
        <button
          onClick={() => setActiveTab('proposals')}
          className={`tab-button ${activeTab === 'proposals' ? 'active' : ''}`}
        >
          Proposals
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={`tab-button ${activeTab === 'analytics' ? 'active' : ''}`}
        >
          Analytics
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'types' && renderRelationshipTypesTab()}
        {activeTab === 'relationships' && renderRelationshipsTab()}
        {activeTab === 'proposals' && renderProposalsTab()}
        {activeTab === 'analytics' && renderAnalyticsTab()}
      </div>
    </div>
  );
};

export default RelationshipsPage;