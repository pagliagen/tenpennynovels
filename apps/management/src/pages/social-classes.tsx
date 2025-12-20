import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import dynamic from 'next/dynamic';

// Dynamically import chart component for performance
const SocialClassChart = dynamic(() => import('../components/charts/SocialClassChart'), {
  ssr: false
});

interface SocialClass {
  _id: string;
  name: string;
  label: string;
  minFinanceSkill: number;
  maxFinanceSkill: number;
  weeklyCredit: number;
  initialWealth: {
    minCash: number;
    maxCash: number;
    hasPrivateApartment: boolean;
    apartmentType?: string;
    bonusItems: string[];
  };
  displayOrder: number;
  description?: string;
  usage?: {
    characterCount: number;
  };
  createdAt: string;
  updatedAt: string;
}

interface SocialClassStats {
  overview: {
    totalClasses: number;
    characterDistribution: Array<{
      _id: {
        classId: string;
        className: string;
        classLabel: string;
      };
      characterCount: number;
      avgFinanceSkill: number;
      minFinanceSkill: number;
      maxFinanceSkill: number;
    }>;
    financeDistribution: Array<{
      _id: string;
      name: string;
      label: string;
      minFinanceSkill: number;
      maxFinanceSkill: number;
      range: number;
      midpoint: number;
    }>;
    wealthDistribution: Array<{
      _id: string;
      name: string;
      label: string;
      weeklyCredit: number;
      avgStartingCash: number;
      hasPrivateApartment: boolean;
      bonusItemsCount: number;
    }>;
  };
  economics: {
    totalWeeklyCredit: number;
    avgWeeklyCredit: number;
    maxWeeklyCredit: number;
    minWeeklyCredit: number;
    avgMinStartingCash: number;
    avgMaxStartingCash: number;
    totalBonusItems: number;
  };
  housing: Array<{
    _id: boolean;
    count: number;
    classes: Array<{
      name: string;
      label: string;
    }>;
  }>;
  recentModifications: Array<{
    _id: string;
    name: string;
    label: string;
    updatedAt: string;
  }>;
}

interface CharacterDistribution {
  _id: string;
  name: string;
  surname?: string;
  fullName: string;
  financeSkill: number;
  status: string;
  socialClass?: {
    _id: string;
    name: string;
    label: string;
    displayOrder: number;
  } | null;
  createdAt: string;
}

interface Pagination {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  limit: number;
}

const SocialClassesPage: React.FC = () => {
  const router = useRouter();
  const { user } = useAuth();
  
  // State management
  const [activeTab, setActiveTab] = useState<'classes' | 'characters' | 'analytics'>('classes');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Social Classes state
  const [socialClasses, setSocialClasses] = useState<SocialClass[]>([]);
  const [socialClassStats, setSocialClassStats] = useState<SocialClassStats | null>(null);
  const [classesPagination, setClassesPagination] = useState<Pagination | null>(null);

  // Character Distribution state
  const [characterDistribution, setCharacterDistribution] = useState<CharacterDistribution[]>([]);
  const [charactersPagination, setCharactersPagination] = useState<Pagination | null>(null);

  // Filter states
  const [classFilters, setClassFilters] = useState({
    search: '',
    page: 1,
    limit: 25,
    sortBy: 'displayOrder',
    sortOrder: 'asc'
  });

  const [characterFilters, setCharacterFilters] = useState({
    socialClassId: '',
    status: '',
    page: 1,
    limit: 25,
    sortBy: 'createdAt',
    sortOrder: 'desc'
  });

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedClass, setSelectedClass] = useState<SocialClass | null>(null);

  // Form states
  const [formData, setFormData] = useState<Partial<SocialClass> & { reason?: string }>({});
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
        case 'classes':
          fetchSocialClasses();
          break;
        case 'characters':
          fetchCharacterDistribution();
          break;
        case 'analytics':
          fetchSocialClassStats();
          break;
      }
    }
  }, [user, activeTab, classFilters, characterFilters]);

  // API Functions
  const fetchSocialClasses = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      Object.entries(classFilters).forEach(([key, value]) => {
        if (value !== '' && value !== null && value !== undefined) {
          params.append(key, value.toString());
        }
      });

      const response = await fetch(`/api/admin/social-classes?${params}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch social classes: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setSocialClasses(data.data.socialClasses);
        setClassesPagination(data.data.pagination);
      } else {
        throw new Error(data.error || 'Failed to fetch social classes');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching social classes:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSocialClassStats = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/admin/social-classes/stats', {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch social class stats: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setSocialClassStats(data.data);
      } else {
        throw new Error(data.error || 'Failed to fetch social class stats');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching social class stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCharacterDistribution = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      Object.entries(characterFilters).forEach(([key, value]) => {
        if (value !== '' && value !== null && value !== undefined) {
          params.append(key, value.toString());
        }
      });

      const response = await fetch(`/api/admin/social-classes/characters/distribution?${params}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch character distribution: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setCharacterDistribution(data.data.characters);
        setCharactersPagination(data.data.pagination);
      } else {
        throw new Error(data.error || 'Failed to fetch character distribution');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching character distribution:', err);
    } finally {
      setLoading(false);
    }
  };

  // Helper functions
  const formatCurrency = (amount: number): string => {
    if (amount === 0) return '0d';
    
    const pounds = Math.floor(amount / 240);
    const remaining = amount % 240;
    const shillings = Math.floor(remaining / 12);
    const pence = remaining % 12;
    
    let result = '';
    if (pounds > 0) result += `£${pounds}`;
    if (shillings > 0) result += `${result ? ' ' : ''}${shillings}s`;
    if (pence > 0) result += `${result ? ' ' : ''}${pence}d`;
    
    return result || '0d';
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
      'APPROVED': 'status-approved',
      'PENDING_APPROVAL': 'status-pending',
      'DRAFT': 'status-draft',
      'REJECTED': 'status-rejected',
      'DELETED': 'status-deleted'
    };
    return statusClasses[status as keyof typeof statusClasses] || 'status-default';
  };

  // Event handlers
  const handleCreateSocialClass = () => {
    setFormData({
      name: '',
      label: '',
      minFinanceSkill: 1,
      maxFinanceSkill: 99,
      weeklyCredit: 0,
      initialWealth: {
        minCash: 0,
        maxCash: 0,
        hasPrivateApartment: false,
        apartmentType: '',
        bonusItems: []
      },
      displayOrder: socialClasses.length,
      description: ''
    });
    setFormErrors({});
    setShowCreateModal(true);
  };

  const handleEditSocialClass = (socialClass: SocialClass) => {
    setSelectedClass(socialClass);
    setFormData({
      ...socialClass,
      reason: ''
    });
    setFormErrors({});
    setShowEditModal(true);
  };

  const handleDeleteSocialClass = (socialClass: SocialClass) => {
    setSelectedClass(socialClass);
    setShowDeleteModal(true);
  };

  // Render functions
  const renderSocialClassesTab = () => (
    <div className="social-classes-tab">
      {/* Filters */}
      <div className="filters-section">
        <div className="filters-row">
          <div className="filter-group">
            <input
              type="text"
              placeholder="Search social classes..."
              value={classFilters.search}
              onChange={(e) => setClassFilters(prev => ({ ...prev, search: e.target.value, page: 1 }))}
              className="search-input"
            />
          </div>
        </div>

        <div className="actions-row">
          <button 
            onClick={handleCreateSocialClass}
            className="btn btn-primary"
          >
            Create New Social Class
          </button>
        </div>
      </div>

      {/* Results Table */}
      <div className="results-section">
        {loading && (
          <div className="loading-indicator">
            <div className="spinner"></div>
            Caricamento classi sociali...
          </div>
        )}

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {!loading && !error && socialClasses.length === 0 && (
          <div className="empty-state">
            Nessuna classe sociale trovata corrispondente ai criteri.
          </div>
        )}

        {!loading && !error && socialClasses.length > 0 && (
          <>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Ordine</th>
                    <th>Classe</th>
                    <th>Intervallo Abilità Finanza</th>
                    <th>Ricchezza Iniziale</th>
                    <th>Credito Settimanale</th>
                    <th>Alloggio</th>
                    <th>Personaggi</th>
                    <th>Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {socialClasses.map((socialClass) => (
                    <tr key={socialClass._id}>
                      <td>
                        <div className="order-cell">
                          <span className="display-order">{socialClass.displayOrder}</span>
                        </div>
                      </td>
                      <td>
                        <div className="class-name">
                          <strong>{socialClass.label}</strong>
                          <div className="class-internal-name">({socialClass.name})</div>
                        </div>
                      </td>
                      <td>
                        <div className="finance-range">
                          {socialClass.minFinanceSkill} - {socialClass.maxFinanceSkill}
                        </div>
                      </td>
                      <td>
                        <div className="wealth-cell">
                          <div>{formatCurrency(socialClass.initialWealth.minCash)} - {formatCurrency(socialClass.initialWealth.maxCash)}</div>
                          {socialClass.initialWealth.bonusItems.length > 0 && (
                            <div className="bonus-items">+{socialClass.initialWealth.bonusItems.length} items</div>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="credit-cell">
                          {formatCurrency(socialClass.weeklyCredit)}
                        </div>
                      </td>
                      <td>
                        <div className="housing-cell">
                          {socialClass.initialWealth.hasPrivateApartment ? (
                            <span className="housing-yes">
                              Alloggio Privato
                              {socialClass.initialWealth.apartmentType && (
                                <div className="apartment-type">({socialClass.initialWealth.apartmentType})</div>
                              )}
                            </span>
                          ) : (
                            <span className="housing-no">Alloggio Comune</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="usage-cell">
                          {socialClass.usage?.characterCount || 0}
                        </div>
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button 
                            onClick={() => handleEditSocialClass(socialClass)}
                            className="btn btn-sm btn-secondary"
                            title="Edit"
                          >
                            Edit
                          </button>
                          <button 
                            onClick={() => handleDeleteSocialClass(socialClass)}
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
            {classesPagination && classesPagination.totalPages > 1 && (
              <div className="pagination-section">
                <div className="pagination-info">
                  Showing {((classesPagination.currentPage - 1) * classesPagination.limit) + 1} to {Math.min(classesPagination.currentPage * classesPagination.limit, classesPagination.totalCount)} of {classesPagination.totalCount} results
                </div>
                <div className="pagination-controls">
                  <button
                    onClick={() => setClassFilters(prev => ({ ...prev, page: prev.page - 1 }))}
                    disabled={!classesPagination.hasPrevPage}
                    className="btn btn-sm btn-secondary"
                  >
                    Previous
                  </button>
                  <span className="page-info">
                    Page {classesPagination.currentPage} of {classesPagination.totalPages}
                  </span>
                  <button
                    onClick={() => setClassFilters(prev => ({ ...prev, page: prev.page + 1 }))}
                    disabled={!classesPagination.hasNextPage}
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

  const renderCharactersTab = () => (
    <div className="characters-tab">
      {/* Filters */}
      <div className="filters-section">
        <div className="filters-row">
          <div className="filter-group">
            <select
              value={characterFilters.socialClassId}
              onChange={(e) => setCharacterFilters(prev => ({ ...prev, socialClassId: e.target.value, page: 1 }))}
              className="filter-select"
            >
              <option value="">Tutte le Classi Sociali</option>
              {socialClasses.map(sc => (
                <option key={sc._id} value={sc._id}>{sc.label}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <select
              value={characterFilters.status}
              onChange={(e) => setCharacterFilters(prev => ({ ...prev, status: e.target.value, page: 1 }))}
              className="filter-select"
            >
              <option value="">Tutti i Stati</option>
              <option value="APPROVED">Approvato</option>
              <option value="PENDING_APPROVAL">In Attesa di Approvazione</option>
              <option value="DRAFT">Bozza</option>
              <option value="REJECTED">Rifiutato</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results Table */}
      <div className="results-section">
        {loading && (
          <div className="loading-indicator">
            <div className="spinner"></div>
            Caricamento distribuzione personaggi...
          </div>
        )}

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {!loading && !error && characterDistribution.length === 0 && (
          <div className="empty-state">
            Nessun personaggio trovato corrispondente ai criteri.
          </div>
        )}

        {!loading && !error && characterDistribution.length > 0 && (
          <>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Personaggio</th>
                    <th>Abilità Finanza</th>
                    <th>Classe Sociale</th>
                    <th>Stato</th>
                    <th>Creato</th>
                  </tr>
                </thead>
                <tbody>
                  {characterDistribution.map((character) => (
                    <tr key={character._id}>
                      <td>
                        <div className="character-name">
                          <strong>{character.fullName}</strong>
                        </div>
                      </td>
                      <td>
                        <div className="finance-skill">
                          {character.financeSkill}
                        </div>
                      </td>
                      <td>
                        <div className="social-class">
                          {character.socialClass ? (
                            <span className="class-label">{character.socialClass.label}</span>
                          ) : (
                            <span className="no-class">Nessuna Classe Corrispondente</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className={`status-badge ${getStatusBadgeClass(character.status)}`}>
                          {character.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td>
                        {formatDate(character.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {charactersPagination && charactersPagination.totalPages > 1 && (
              <div className="pagination-section">
                <div className="pagination-info">
                  Showing {((charactersPagination.currentPage - 1) * charactersPagination.limit) + 1} to {Math.min(charactersPagination.currentPage * charactersPagination.limit, charactersPagination.totalCount)} of {charactersPagination.totalCount} results
                </div>
                <div className="pagination-controls">
                  <button
                    onClick={() => setCharacterFilters(prev => ({ ...prev, page: prev.page - 1 }))}
                    disabled={!charactersPagination.hasPrevPage}
                    className="btn btn-sm btn-secondary"
                  >
                    Previous
                  </button>
                  <span className="page-info">
                    Page {charactersPagination.currentPage} of {charactersPagination.totalPages}
                  </span>
                  <button
                    onClick={() => setCharacterFilters(prev => ({ ...prev, page: prev.page + 1 }))}
                    disabled={!charactersPagination.hasNextPage}
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
          Caricamento analisi...
        </div>
      )}

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {!loading && !error && socialClassStats && (
        <div className="analytics-content">
          {/* Overview Stats */}
          <div className="stats-overview">
            <h3>Panoramica Classi Sociali</h3>
            <div className="stats-grid">
              <div className="stat-card">
                <h4>Totale Classi Sociali</h4>
                <div className="stat-number">{socialClassStats.overview.totalClasses}</div>
              </div>
              <div className="stat-card">
                <h4>Totale Credito Settimanale</h4>
                <div className="stat-number">{formatCurrency(socialClassStats.economics.totalWeeklyCredit)}</div>
              </div>
              <div className="stat-card">
                <h4>Media Ricchezza Iniziale</h4>
                <div className="stat-number">
                  {formatCurrency(Math.round(socialClassStats.economics.avgMinStartingCash))} - {formatCurrency(Math.round(socialClassStats.economics.avgMaxStartingCash))}
                </div>
              </div>
              <div className="stat-card">
                <h4>Totale Bonus</h4>
                <div className="stat-number">{socialClassStats.economics.totalBonusItems}</div>
              </div>
            </div>
          </div>

          {/* Character Distribution by Class */}
          <div className="character-distribution-section">
            <h3>Distribuzione Personaggi per Classe Sociale</h3>
            <div className="distribution-list">
              {socialClassStats.overview.characterDistribution.map((dist) => (
                <div key={dist._id.classId} className="distribution-item">
                  <div className="class-info">
                    <div className="class-name">{dist._id.classLabel}</div>
                    <div className="character-count">{dist.characterCount} personaggi</div>
                  </div>
                  <div className="skill-stats">
                    <div>Media: {dist.avgFinanceSkill.toFixed(1)}</div>
                    <div>Intervallo: {dist.minFinanceSkill}-{dist.maxFinanceSkill}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Housing Distribution */}
          <div className="housing-distribution-section">
            <h3>Distribuzione Alloggi</h3>
            <div className="housing-stats">
              {socialClassStats.housing.map((housing) => (
                <div key={housing._id.toString()} className="housing-item">
                  <div className="housing-type">
                    {housing._id ? 'Alloggi Privati' : 'Alloggi Comuni'}
                  </div>
                  <div className="housing-count">{housing.count} classi</div>
                  <div className="housing-classes">
                    {housing.classes.map(cls => cls.label).join(', ')}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Finance Skill Distribution */}
          <div className="finance-distribution-section">
            <h3>Intervalli Abilità Finanza</h3>
            <div className="finance-ranges">
              {socialClassStats.overview.financeDistribution.map((dist) => (
                <div key={dist._id} className="finance-range-item">
                  <div className="class-name">{dist.label}</div>
                  <div className="skill-range">{dist.minFinanceSkill}-{dist.maxFinanceSkill}</div>
                  <div className="range-width">Intervallo: {dist.range} punti</div>
                  <div className="midpoint">Punto Medio: {dist.midpoint.toFixed(1)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Modifications */}
          <div className="recent-modifications-section">
            <h3>Modifiche Recenti</h3>
            <div className="recent-list">
              {socialClassStats.recentModifications.map((modification) => (
                <div key={modification._id} className="recent-item">
                  <div className="class-name">{modification.label}</div>
                  <div className="modification-time">{formatDate(modification.updatedAt)}</div>
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
    <div className="social-classes-page">
      <div className="page-header">
        <h1>Social Class Management</h1>
        <p>Manage Victorian social classes, economic benefits, and character distribution</p>
      </div>

      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button
          onClick={() => setActiveTab('classes')}
          className={`tab-button ${activeTab === 'classes' ? 'active' : ''}`}
        >
          Social Classes
        </button>
        <button
          onClick={() => setActiveTab('characters')}
          className={`tab-button ${activeTab === 'characters' ? 'active' : ''}`}
        >
          Character Distribution
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
        {activeTab === 'classes' && renderSocialClassesTab()}
        {activeTab === 'characters' && renderCharactersTab()}
        {activeTab === 'analytics' && renderAnalyticsTab()}
      </div>
    </div>
  );
};

export default SocialClassesPage;