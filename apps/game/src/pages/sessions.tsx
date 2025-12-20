import React, { useState, useEffect } from 'react';
import { NextPage } from 'next';
import { useGame } from '../contexts/GameContext';
import { GameLayout } from '../components/GameLayout';
import styles from '../styles/pages/Sessions.module.scss';

interface Session {
  id: string;
  name: string;
  description: string;
  scheduledDate: Date;
  startTime: Date;
  endTime: Date;
  masterCharacter: {
    id: string;
    name: string;
    surname: string;
  };
  location?: {
    id: string;
    name: string;
    type: string;
  };
  maxParticipants?: number;
  currentParticipants: number;
  participants: Array<{
    characterId: string;
    characterName: string;
    characterSurname: string;
    status: string;
    joinedAt: Date;
  }>;
  isPublic: boolean;
  status: string;
  sessionType: string;
  requirements?: string;
  tags: string[];
}

interface MySession {
  id: string;
  session: Session;
  status: string;
  joinedAt: Date;
  leftAt?: Date;
  notes?: string;
}

const SessionsPage: NextPage = () => {
  const { gameData, character } = useGame();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [mySessions, setMySessions] = useState<MySession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [activeTab, setActiveTab] = useState<'available' | 'my-sessions' | 'past-sessions'>('available');
  const [filterType, setFilterType] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (character && gameData) {
      loadSessions();
      loadMySessions();
    }
  }, [character, gameData]);

  useEffect(() => {
    if (character && gameData) {
      loadSessions();
    }
  }, [filterType, searchQuery]);

  const loadSessions = async () => {
    try {
      const params = new URLSearchParams();
      if (filterType) params.append('type', filterType);
      if (searchQuery) params.append('search', searchQuery);
      
      const response = await fetch(`/api/game/sessions/available?${params.toString()}`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setSessions(data.data.sessions);
      }
    } catch (error) {
      console.error('Error loading sessions:', error);
    }
  };

  const loadMySessions = async () => {
    try {
      const response = await fetch('/api/game/sessions/my-sessions', {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setMySessions(data.data.sessions);
      }
    } catch (error) {
      console.error('Error loading my sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinSession = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/game/sessions/${sessionId}/join`, {
        method: 'POST',
        credentials: 'include'
      });

      const data = await response.json();
      if (data.success) {
        loadSessions();
        loadMySessions();
        alert('Successfully joined the session!');
      } else {
        alert(data.error || 'Error joining session');
      }
    } catch (error) {
      console.error('Error joining session:', error);
      alert('Error joining session');
    }
  };

  const handleLeaveSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to leave this session?')) return;

    try {
      const response = await fetch(`/api/game/sessions/${sessionId}/leave`, {
        method: 'DELETE',
        credentials: 'include'
      });

      const data = await response.json();
      if (data.success) {
        loadSessions();
        loadMySessions();
        alert('Successfully left the session');
      } else {
        alert(data.error || 'Error leaving session');
      }
    } catch (error) {
      console.error('Error leaving session:', error);
      alert('Error leaving session');
    }
  };

  const openSessionDetails = (session: Session) => {
    setSelectedSession(session);
  };

  const closeSessionDetails = () => {
    setSelectedSession(null);
  };

  const formatDateTime = (date: Date) => {
    return new Date(date).toLocaleString();
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'scheduled': return '#3b82f6';
      case 'active': return '#10b981';
      case 'completed': return '#6b7280';
      case 'cancelled': return '#ef4444';
      default: return '#6b7280';
    }
  };

  if (!gameData || loading) {
    return (
      <GameLayout gameData={gameData}>
        <div className={styles.loading}>Loading game sessions...</div>
      </GameLayout>
    );
  }

  if (!character || !gameData) {
    return (
      <GameLayout gameData={gameData}>
        <div className={styles.error}>Please select a character to view sessions</div>
      </GameLayout>
    );
  }

  const availableSessions = sessions.filter(s => 
    s.status === 'SCHEDULED' && 
    !mySessions.some(ms => ms.session.id === s.id && ms.status === 'JOINED')
  );

  const activeSessions = mySessions.filter(ms => 
    ms.status === 'JOINED' && 
    (ms.session.status === 'SCHEDULED' || ms.session.status === 'ACTIVE')
  );

  const pastSessions = mySessions.filter(ms => 
    ms.status === 'LEFT' || ms.session.status === 'COMPLETED' || ms.session.status === 'CANCELLED'
  );

  return (
    <GameLayout gameData={gameData}>
      <div className={styles.sessionsPage}>
        <div className={styles.header}>
          <h1>Game Sessions</h1>
          <p className={styles.subtitle}>
            Join role-playing sessions in Victorian London
          </p>
        </div>

        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === 'available' ? styles.active : ''}`}
            onClick={() => setActiveTab('available')}
          >
            Available ({availableSessions.length})
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'my-sessions' ? styles.active : ''}`}
            onClick={() => setActiveTab('my-sessions')}
          >
            My Sessions ({activeSessions.length})
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'past-sessions' ? styles.active : ''}`}
            onClick={() => setActiveTab('past-sessions')}
          >
            Past Sessions ({pastSessions.length})
          </button>
        </div>

        {/* Filters */}
        {activeTab === 'available' && (
          <div className={styles.filters}>
            <div className={styles.filterGroup}>
              <label>Session Type:</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className={styles.select}
              >
                <option value="">All Types</option>
                <option value="main_story">Main Story</option>
                <option value="side_quest">Side Quest</option>
                <option value="investigation">Investigation</option>
                <option value="social_event">Social Event</option>
                <option value="combat_encounter">Combat Encounter</option>
                <option value="mystery">Mystery</option>
                <option value="exploration">Exploration</option>
              </select>
            </div>

            <div className={styles.searchGroup}>
              <input
                type="text"
                placeholder="Search sessions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={styles.searchInput}
              />
            </div>
          </div>
        )}

        {/* Available Sessions Tab */}
        {activeTab === 'available' && (
          <div className={styles.sessionsList}>
            {availableSessions.length === 0 ? (
              <div className={styles.emptyState}>
                <h3>No available sessions</h3>
                <p>Check back later for new gaming sessions.</p>
              </div>
            ) : (
              availableSessions.map((session) => (
                <div key={session.id} className={styles.sessionCard}>
                  <div className={styles.sessionHeader}>
                    <div>
                      <h4>{session.name}</h4>
                      <div className={styles.sessionMeta}>
                        <span className={styles.type}>{session.sessionType.replace('_', ' ').toUpperCase()}</span>
                        <span 
                          className={styles.status}
                          style={{ color: getStatusColor(session.status) }}
                        >
                          {session.status}
                        </span>
                      </div>
                    </div>
                    <button
                      className={styles.detailsBtn}
                      onClick={() => openSessionDetails(session)}
                    >
                      Details
                    </button>
                  </div>

                  <p className={styles.description}>{session.description}</p>

                  <div className={styles.sessionInfo}>
                    <div className={styles.infoItem}>
                      <strong>Master:</strong> {session.masterCharacter.name} {session.masterCharacter.surname}
                    </div>
                    <div className={styles.infoItem}>
                      <strong>Date:</strong> {formatDateTime(session.scheduledDate)}
                    </div>
                    {session.location && (
                      <div className={styles.infoItem}>
                        <strong>Location:</strong> {session.location.name}
                      </div>
                    )}
                    <div className={styles.infoItem}>
                      <strong>Participants:</strong> {session.currentParticipants}
                      {session.maxParticipants && ` / ${session.maxParticipants}`}
                    </div>
                  </div>

                  {session.tags.length > 0 && (
                    <div className={styles.tags}>
                      {session.tags.map((tag, index) => (
                        <span key={index} className={styles.tag}>{tag}</span>
                      ))}
                    </div>
                  )}

                  <div className={styles.sessionActions}>
                    <button
                      className={styles.joinBtn}
                      onClick={() => handleJoinSession(session.id)}
                      disabled={!!(session.maxParticipants && session.currentParticipants >= session.maxParticipants)}
                    >
                      {session.maxParticipants && session.currentParticipants >= session.maxParticipants 
                        ? 'Session Full' 
                        : 'Join Session'
                      }
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* My Sessions Tab */}
        {activeTab === 'my-sessions' && (
          <div className={styles.sessionsList}>
            {activeSessions.length === 0 ? (
              <div className={styles.emptyState}>
                <h3>No active sessions</h3>
                <p>Join some sessions to see them here.</p>
              </div>
            ) : (
              activeSessions.map((mySession) => (
                <div key={mySession.id} className={styles.sessionCard}>
                  <div className={styles.sessionHeader}>
                    <div>
                      <h4>{mySession.session.name}</h4>
                      <div className={styles.sessionMeta}>
                        <span className={styles.type}>{mySession.session.sessionType.replace('_', ' ').toUpperCase()}</span>
                        <span 
                          className={styles.status}
                          style={{ color: getStatusColor(mySession.session.status) }}
                        >
                          {mySession.session.status}
                        </span>
                      </div>
                    </div>
                    <button
                      className={styles.detailsBtn}
                      onClick={() => openSessionDetails(mySession.session)}
                    >
                      Details
                    </button>
                  </div>

                  <p className={styles.description}>{mySession.session.description}</p>

                  <div className={styles.sessionInfo}>
                    <div className={styles.infoItem}>
                      <strong>Master:</strong> {mySession.session.masterCharacter.name} {mySession.session.masterCharacter.surname}
                    </div>
                    <div className={styles.infoItem}>
                      <strong>Date:</strong> {formatDateTime(mySession.session.scheduledDate)}
                    </div>
                    <div className={styles.infoItem}>
                      <strong>Joined:</strong> {formatDateTime(mySession.joinedAt)}
                    </div>
                    {mySession.session.location && (
                      <div className={styles.infoItem}>
                        <strong>Location:</strong> {mySession.session.location.name}
                      </div>
                    )}
                  </div>

                  {mySession.notes && (
                    <div className={styles.notes}>
                      <strong>Notes:</strong> {mySession.notes}
                    </div>
                  )}

                  <div className={styles.sessionActions}>
                    <button
                      className={styles.leaveBtn}
                      onClick={() => handleLeaveSession(mySession.session.id)}
                    >
                      Leave Session
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Past Sessions Tab */}
        {activeTab === 'past-sessions' && (
          <div className={styles.sessionsList}>
            {pastSessions.length === 0 ? (
              <div className={styles.emptyState}>
                <h3>No past sessions</h3>
                <p>Your completed sessions will appear here.</p>
              </div>
            ) : (
              pastSessions.map((mySession) => (
                <div key={mySession.id} className={`${styles.sessionCard} ${styles.pastSession}`}>
                  <div className={styles.sessionHeader}>
                    <div>
                      <h4>{mySession.session.name}</h4>
                      <div className={styles.sessionMeta}>
                        <span className={styles.type}>{mySession.session.sessionType.replace('_', ' ').toUpperCase()}</span>
                        <span 
                          className={styles.status}
                          style={{ color: getStatusColor(mySession.session.status) }}
                        >
                          {mySession.session.status}
                        </span>
                      </div>
                    </div>
                    <button
                      className={styles.detailsBtn}
                      onClick={() => openSessionDetails(mySession.session)}
                    >
                      Details
                    </button>
                  </div>

                  <p className={styles.description}>{mySession.session.description}</p>

                  <div className={styles.sessionInfo}>
                    <div className={styles.infoItem}>
                      <strong>Master:</strong> {mySession.session.masterCharacter.name} {mySession.session.masterCharacter.surname}
                    </div>
                    <div className={styles.infoItem}>
                      <strong>Date:</strong> {formatDateTime(mySession.session.scheduledDate)}
                    </div>
                    <div className={styles.infoItem}>
                      <strong>Duration:</strong> {mySession.joinedAt && mySession.leftAt 
                        ? `${Math.round((new Date(mySession.leftAt).getTime() - new Date(mySession.joinedAt).getTime()) / (1000 * 60 * 60))}h`
                        : 'N/A'
                      }
                    </div>
                  </div>

                  {mySession.notes && (
                    <div className={styles.notes}>
                      <strong>Notes:</strong> {mySession.notes}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Session Details Modal */}
        {selectedSession && (
          <div className={styles.modal} onClick={closeSessionDetails}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h2>{selectedSession.name}</h2>
                <button onClick={closeSessionDetails} className={styles.closeBtn}>×</button>
              </div>
              
              <div className={styles.modalBody}>
                <div className={styles.sessionDetails}>
                  <div className={styles.detailSection}>
                    <h3>Session Information</h3>
                    <p><strong>Type:</strong> {selectedSession.sessionType.replace('_', ' ').toUpperCase()}</p>
                    <p><strong>Status:</strong> <span style={{ color: getStatusColor(selectedSession.status) }}>{selectedSession.status}</span></p>
                    <p><strong>Master:</strong> {selectedSession.masterCharacter.name} {selectedSession.masterCharacter.surname}</p>
                    <p><strong>Scheduled:</strong> {formatDateTime(selectedSession.scheduledDate)}</p>
                    {selectedSession.startTime && (
                      <p><strong>Start Time:</strong> {formatDateTime(selectedSession.startTime)}</p>
                    )}
                    {selectedSession.endTime && (
                      <p><strong>End Time:</strong> {formatDateTime(selectedSession.endTime)}</p>
                    )}
                    {selectedSession.location && (
                      <p><strong>Location:</strong> {selectedSession.location.name} ({selectedSession.location.type})</p>
                    )}
                    <p><strong>Participants:</strong> {selectedSession.currentParticipants}
                      {selectedSession.maxParticipants && ` / ${selectedSession.maxParticipants}`}
                    </p>
                    <p><strong>Visibility:</strong> {selectedSession.isPublic ? 'Public' : 'Private'}</p>
                  </div>

                  <div className={styles.detailSection}>
                    <h3>Description</h3>
                    <p>{selectedSession.description}</p>
                  </div>

                  {selectedSession.requirements && (
                    <div className={styles.detailSection}>
                      <h3>Requirements</h3>
                      <p>{selectedSession.requirements}</p>
                    </div>
                  )}

                  {selectedSession.tags.length > 0 && (
                    <div className={styles.detailSection}>
                      <h3>Tags</h3>
                      <div className={styles.tags}>
                        {selectedSession.tags.map((tag, index) => (
                          <span key={index} className={styles.tag}>{tag}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedSession.participants.length > 0 && (
                    <div className={styles.detailSection}>
                      <h3>Participants</h3>
                      <ul className={styles.participantsList}>
                        {selectedSession.participants.map((participant, index) => (
                          <li key={index}>
                            {participant.characterName} {participant.characterSurname}
                            <span className={styles.participantStatus}>({participant.status})</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </GameLayout>
  );
};

export default SessionsPage; 
