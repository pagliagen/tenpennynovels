import React, { useState, useEffect } from 'react';
import styles from './CharacterSheet.module.scss';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'http://localhost:8000';

interface CorporationMembership {
  corporationId: string;
  corporationName: string;
  type: string;
  role: string;
  rolePermissions: string[];
  joinedAt: string;
  status: 'active' | 'inactive' | 'disbanded';
  treasury: {
    balance: number;
    canManage: boolean;
  };
  memberCount: number;
  lastActivity?: string;
}

interface CorporationDashboardProps {
  characterId: string;
}

const CorporationDashboard: React.FC<CorporationDashboardProps> = ({ characterId }) => {
  const [memberships, setMemberships] = useState<CorporationMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showJoinCorporation, setShowJoinCorporation] = useState(false);
  const [availableCorporations, setAvailableCorporations] = useState<any[]>([]);

  // Fetch character's corporation memberships
  const fetchMemberships = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/game/characters/${characterId}/corporations`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        if (data.result) {
          setMemberships(data.data?.memberships || []);
        } else {
          setError('Failed to load corporation memberships');
        }
      } else {
        setError('Failed to fetch corporation data');
      }
    } catch (error) {
      console.error('Error fetching memberships:', error);
      setError('Network error while loading corporation data');
    } finally {
      setLoading(false);
    }
  };

  // Fetch available corporations for joining
  const fetchAvailableCorporations = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/game/corporations`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        if (data.result) {
          // Filter out corporations the character is already a member of
          const available = (data.data || []).filter((corp: any) => 
            !memberships.find(m => m.corporationId === corp.id) &&
            corp.isRecruiting &&
            corp.status === 'active'
          );
          setAvailableCorporations(available);
        }
      }
    } catch (error) {
      console.error('Error fetching available corporations:', error);
    }
  };

  // Handle joining a corporation
  const handleJoinCorporation = async (corporationId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/game/corporations/${corporationId}/join`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.result) {
          // Refresh memberships
          await fetchMemberships();
          setShowJoinCorporation(false);
        } else {
          alert(data.error || 'Failed to join corporation');
        }
      } else {
        alert('Failed to join corporation');
      }
    } catch (error) {
      console.error('Error joining corporation:', error);
      alert('Network error while joining corporation');
    }
  };

  // Handle leaving a corporation
  const handleLeaveCorporation = async (corporationId: string, corporationName: string) => {
    if (!confirm(`Are you sure you want to leave ${corporationName}?`)) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/game/corporations/${corporationId}/leave`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.result) {
          // Refresh memberships
          await fetchMemberships();
        } else {
          alert(data.error || 'Failed to leave corporation');
        }
      } else {
        alert('Failed to leave corporation');
      }
    } catch (error) {
      console.error('Error leaving corporation:', error);
      alert('Network error while leaving corporation');
    }
  };

  useEffect(() => {
    if (characterId) {
      fetchMemberships();
    }
  }, [characterId]);

  useEffect(() => {
    if (showJoinCorporation) {
      fetchAvailableCorporations();
    }
  }, [showJoinCorporation, memberships]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount: number) => {
    return `${amount} pence`;
  };

  if (loading) {
    return (
      <div className={styles.descriptionSection}>
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <div>Loading corporation data...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.descriptionSection}>
        <div style={{ textAlign: 'center', padding: '20px', color: '#dc3545' }}>
          <div>{error}</div>
          <button 
            onClick={fetchMemberships}
            style={{ marginTop: '10px', padding: '5px 15px' }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={styles.descriptionSection}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <label>My Corporations:</label>
          <button 
            onClick={() => setShowJoinCorporation(true)}
            style={{ padding: '5px 15px', fontSize: '12px' }}
          >
            Join Corporation
          </button>
        </div>

        {memberships.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
            <div>You are not a member of any corporations.</div>
            <div style={{ fontSize: '12px', marginTop: '5px' }}>
              Click "Join Corporation" to explore available organizations.
            </div>
          </div>
        ) : (
          <div className={styles.corporationList}>
            {memberships.map((membership) => (
              <div key={membership.corporationId} className={styles.corporationCard}>
                <div className={styles.corporationHeader}>
                  <div>
                    <h4 className={styles.corporationName}>{membership.corporationName}</h4>
                    <div className={styles.corporationType}>
                      {membership.type} • {membership.memberCount} members
                    </div>
                  </div>
                  <div className={styles.corporationStatus}>
                    <span className={`${styles.statusBadge} ${styles[membership.status]}`}>
                      {membership.status}
                    </span>
                  </div>
                </div>

                <div className={styles.corporationInfo}>
                  <div className={styles.infoRow}>
                    <span>Role:</span>
                    <span className={styles.roleTitle}>{membership.role}</span>
                  </div>
                  <div className={styles.infoRow}>
                    <span>Joined:</span>
                    <span>{formatDate(membership.joinedAt)}</span>
                  </div>
                  <div className={styles.infoRow}>
                    <span>Treasury:</span>
                    <span>
                      {formatCurrency(membership.treasury.balance)}
                      {membership.treasury.canManage && (
                        <span style={{ fontSize: '10px', marginLeft: '5px' }}>
                          (can manage)
                        </span>
                      )}
                    </span>
                  </div>
                  {membership.lastActivity && (
                    <div className={styles.infoRow}>
                      <span>Last Activity:</span>
                      <span>{formatDate(membership.lastActivity)}</span>
                    </div>
                  )}
                </div>

                <div className={styles.corporationActions}>
                  {membership.rolePermissions.length > 0 && (
                    <div className={styles.permissions}>
                      <span>Permissions:</span>
                      <div className={styles.permissionTags}>
                        {membership.rolePermissions.map((permission, index) => (
                          <span key={index} className={styles.permissionTag}>
                            {permission}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div className={styles.actionButtons}>
                    <button 
                      onClick={() => handleLeaveCorporation(membership.corporationId, membership.corporationName)}
                      className={styles.leaveButton}
                      style={{ fontSize: '11px', padding: '3px 10px' }}
                    >
                      Leave
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Join Corporation Modal */}
      {showJoinCorporation && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3>Join a Corporation</h3>
              <button 
                onClick={() => setShowJoinCorporation(false)}
                className={styles.closeButton}
              >
                ×
              </button>
            </div>
            
            <div className={styles.modalBody}>
              {availableCorporations.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px' }}>
                  <div>No corporations are currently recruiting.</div>
                  <div style={{ fontSize: '12px', marginTop: '5px', color: '#666' }}>
                    Check back later or contact existing corporation members.
                  </div>
                </div>
              ) : (
                <div className={styles.corporationGrid}>
                  {availableCorporations.map((corp) => (
                    <div key={corp.id} className={styles.availableCorporation}>
                      <div className={styles.corpName}>{corp.name}</div>
                      <div className={styles.corpType}>{corp.type}</div>
                      <div className={styles.corpDescription}>
                        {corp.description?.substring(0, 100)}
                        {corp.description?.length > 100 && '...'}
                      </div>
                      <div className={styles.corpStats}>
                        {corp.memberCount} members • Founded {formatDate(corp.createdAt)}
                      </div>
                      <button 
                        onClick={() => handleJoinCorporation(corp.id)}
                        className={styles.joinButton}
                      >
                        Request to Join
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CorporationDashboard;