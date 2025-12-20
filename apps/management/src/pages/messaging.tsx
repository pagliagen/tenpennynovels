import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import dynamic from 'next/dynamic';

// Dynamically import chart component for performance
const MessagingChart = dynamic(() => import('../components/charts/MessagingChart'), {
  ssr: false
});

interface Chat {
  _id: string;
  type: 'direct' | 'group';
  name?: string;
  participants: Array<{
    _id: string;
    name: string;
    surname: string;
  }>;
  lastMessage?: {
    content: string;
    sentAt: string;
    senderName: string;
  };
  lastActivity: string;
  messageCount: number;
  isActive: boolean;
  participantCount: number;
}

interface MessagingStats {
  totalChats: number;
  totalMessages: number;
  activeChats: number;
  directChats: number;
  groupChats: number;
  messagesLast24h: number;
  averageMessagesPerChat: number;
  recentActivity: Array<{
    date: string;
    messages: number;
    chats: number;
  }>;
  topUsers: Array<{
    characterId: string;
    characterName: string;
    messageCount: number;
  }>;
}

interface CleanupRecommendation {
  type: 'inactive_chat' | 'old_messages' | 'orphaned_participants';
  severity: 'low' | 'medium' | 'high';
  description: string;
  chatId?: string;
  count?: number;
  affectedIds?: string[];
}

export default function MessagingManagement() {
  const { user } = useAuth();
  const router = useRouter();
  
  const [chats, setChats] = useState<Chat[]>([]);
  const [stats, setStats] = useState<MessagingStats | null>(null);
  const [cleanupRecommendations, setCleanupRecommendations] = useState<CleanupRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'chats' | 'analytics' | 'cleanup'>('chats');
  
  // Filter states
  const [chatTypeFilter, setChatTypeFilter] = useState<'all' | 'direct' | 'group'>('all');
  const [isActiveFilter, setIsActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<'lastActivity' | 'messageCount' | 'createdAt'>('lastActivity');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // Bulk operation states
  const [selectedChats, setSelectedChats] = useState<string[]>([]);
  const [bulkOperation, setBulkOperation] = useState<'delete' | 'archive' | ''>('');

  // Load data
  useEffect(() => {
    if (!user?.effectivePermissions?.messaging?.view) {
      router.push('/');
      return;
    }
    
    loadData();
  }, [user, page, chatTypeFilter, isActiveFilter, searchTerm, sortBy, sortOrder]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(chatTypeFilter !== 'all' && { type: chatTypeFilter }),
        ...(isActiveFilter !== 'all' && { isActive: (isActiveFilter === 'active').toString() }),
        ...(searchTerm && { search: searchTerm }),
        sortBy,
        sortOrder
      });

      // Load chats
      const chatsResponse = await fetch(`/api/admin/messaging?${params}`, {
        credentials: 'include'
      });
      
      if (chatsResponse.ok) {
        const chatsData = await chatsResponse.json();
        setChats(chatsData.data.chats);
      }

      // Load stats (only on first load)
      if (page === 1) {
        const [statsResponse, cleanupResponse] = await Promise.all([
          fetch('/api/admin/messaging/stats', { credentials: 'include' }),
          fetch('/api/admin/messaging/cleanup', { credentials: 'include' })
        ]);

        if (statsResponse.ok) {
          const statsData = await statsResponse.json();
          setStats(statsData.data);
        }

        if (cleanupResponse.ok) {
          const cleanupData = await cleanupResponse.json();
          setCleanupRecommendations(cleanupData.data);
        }
      }
      
    } catch (error) {
      console.error('Error loading messaging data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChatDelete = async (chatId: string) => {
    if (!user?.effectivePermissions?.messaging?.delete) {
      alert('Non hai i permessi per eliminare chat');
      return;
    }
    
    if (!confirm('Sei sicuro di voler eliminare questa chat? Questa azione è irreversibile.')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/messaging/chat/${chatId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        setChats(chats.filter(chat => chat._id !== chatId));
      } else {
        const errorData = await response.json();
        alert(`Errore: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error deleting chat:', error);
      alert('Errore durante l\'eliminazione della chat');
    }
  };

  const handleBulkOperation = async () => {
    if (!bulkOperation || selectedChats.length === 0) return;
    
    if (!user?.effectivePermissions?.messaging?.delete && bulkOperation === 'delete') {
      alert('Non hai i permessi per eliminare chat');
      return;
    }

    if (!confirm(`Sei sicuro di voler ${bulkOperation === 'delete' ? 'eliminare' : 'archiviare'} ${selectedChats.length} chat selezionate?`)) {
      return;
    }

    try {
      const response = await fetch('/api/admin/messaging/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          operation: bulkOperation,
          chatIds: selectedChats
        })
      });

      if (response.ok) {
        setSelectedChats([]);
        setBulkOperation('');
        loadData();
      } else {
        const errorData = await response.json();
        alert(`Errore: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error performing bulk operation:', error);
      alert('Errore durante l\'operazione');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 24) {
      return `${diffInHours}h fa`;
    } else if (diffInHours < 24 * 7) {
      return `${Math.floor(diffInHours / 24)}g fa`;
    } else {
      return date.toLocaleDateString('it-IT');
    }
  };

  const getSeverityBadge = (severity: CleanupRecommendation['severity']) => {
    const classes = {
      low: 'badge-success',
      medium: 'badge-warning', 
      high: 'badge-danger'
    };
    
    return (
      <span className={`badge ${classes[severity]}`}>
        {severity.toUpperCase()}
      </span>
    );
  };

  if (loading && page === 1) {
    return (
      <div className="content-wrapper">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Caricamento sistema messaggistica...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="content-wrapper">
      <div className="content-header">
        <div className="header-left">
          <h1 className="page-title">
            <i className="icon-chat-bubbles"></i>
            Sistema Messaggistica
          </h1>
          <p className="page-description">
            Gestione chat OOC dirette e di gruppo
          </p>
        </div>
        
        {stats && (
          <div className="header-stats">
            <div className="stat-card">
              <span className="stat-value">{stats.totalChats.toLocaleString()}</span>
              <span className="stat-label">Chat Totali</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{stats.totalMessages.toLocaleString()}</span>
              <span className="stat-label">Messaggi</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{stats.messagesLast24h}</span>
              <span className="stat-label">Oggi</span>
            </div>
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button
          className={`tab-button ${activeTab === 'chats' ? 'active' : ''}`}
          onClick={() => setActiveTab('chats')}
        >
          <i className="icon-chat"></i>
          Gestione Chat
        </button>
        <button
          className={`tab-button ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          <i className="icon-chart"></i>
          Analytics
        </button>
        <button
          className={`tab-button ${activeTab === 'cleanup' ? 'active' : ''}`}
          onClick={() => setActiveTab('cleanup')}
        >
          <i className="icon-tools"></i>
          Manutenzione
          {cleanupRecommendations.length > 0 && (
            <span className="notification-badge">{cleanupRecommendations.length}</span>
          )}
        </button>
      </div>

      {/* Chat Management Tab */}
      {activeTab === 'chats' && (
        <>
          {/* Filters */}
          <div className="filters-section">
            <div className="filter-row">
              <div className="filter-group">
                <label>Tipo Chat:</label>
                <select 
                  value={chatTypeFilter} 
                  onChange={(e) => setChatTypeFilter(e.target.value as any)}
                  className="form-select"
                >
                  <option value="all">Tutte</option>
                  <option value="direct">Dirette</option>
                  <option value="group">Gruppo</option>
                </select>
              </div>

              <div className="filter-group">
                <label>Stato:</label>
                <select 
                  value={isActiveFilter} 
                  onChange={(e) => setIsActiveFilter(e.target.value as any)}
                  className="form-select"
                >
                  <option value="all">Tutti</option>
                  <option value="active">Attive</option>
                  <option value="inactive">Inattive</option>
                </select>
              </div>

              <div className="filter-group">
                <label>Ordina per:</label>
                <select 
                  value={sortBy} 
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="form-select"
                >
                  <option value="lastActivity">Ultima Attività</option>
                  <option value="messageCount">Numero Messaggi</option>
                  <option value="createdAt">Data Creazione</option>
                </select>
              </div>

              <div className="filter-group">
                <input
                  type="text"
                  placeholder="Cerca chat..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="form-input search-input"
                />
              </div>
            </div>

            {/* Bulk Operations */}
            {selectedChats.length > 0 && (
              <div className="bulk-operations">
                <span className="selected-count">{selectedChats.length} chat selezionate</span>
                <div className="bulk-actions">
                  <select
                    value={bulkOperation}
                    onChange={(e) => setBulkOperation(e.target.value as any)}
                    className="form-select"
                  >
                    <option value="">Seleziona azione...</option>
                    <option value="delete">Elimina</option>
                    <option value="archive">Archivia</option>
                  </select>
                  <button
                    onClick={handleBulkOperation}
                    disabled={!bulkOperation}
                    className="btn btn-primary"
                  >
                    Esegui
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Chat List */}
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedChats(chats.map(chat => chat._id));
                        } else {
                          setSelectedChats([]);
                        }
                      }}
                      checked={selectedChats.length === chats.length && chats.length > 0}
                    />
                  </th>
                  <th>Tipo</th>
                  <th>Nome/Partecipanti</th>
                  <th>Messaggi</th>
                  <th>Ultimo Messaggio</th>
                  <th>Ultima Attività</th>
                  <th>Stato</th>
                  <th>Azioni</th>
                </tr>
              </thead>
              <tbody>
                {chats.map((chat) => (
                  <tr key={chat._id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedChats.includes(chat._id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedChats([...selectedChats, chat._id]);
                          } else {
                            setSelectedChats(selectedChats.filter(id => id !== chat._id));
                          }
                        }}
                      />
                    </td>
                    <td>
                      <span className={`badge ${chat.type === 'direct' ? 'badge-info' : 'badge-success'}`}>
                        {chat.type === 'direct' ? 'Diretta' : 'Gruppo'}
                      </span>
                    </td>
                    <td>
                      {chat.type === 'group' ? (
                        <div>
                          <div className="chat-name">{chat.name}</div>
                          <small className="text-muted">{chat.participantCount} partecipanti</small>
                        </div>
                      ) : (
                        <div className="participants">
                          {chat.participants.slice(0, 2).map((p, i) => (
                            <span key={p._id}>
                              {i > 0 && ', '}
                              {p.name} {p.surname}
                            </span>
                          ))}
                          {chat.participants.length > 2 && (
                            <span className="text-muted"> +{chat.participants.length - 2}</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="message-count">{chat.messageCount}</span>
                    </td>
                    <td>
                      {chat.lastMessage ? (
                        <div className="last-message">
                          <div className="message-preview">
                            {chat.lastMessage.content.length > 50
                              ? chat.lastMessage.content.substring(0, 50) + '...'
                              : chat.lastMessage.content}
                          </div>
                          <small className="sender-name">{chat.lastMessage.senderName}</small>
                        </div>
                      ) : (
                        <span className="text-muted">Nessun messaggio</span>
                      )}
                    </td>
                    <td>
                      <span className="activity-time">
                        {formatDate(chat.lastActivity)}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${chat.isActive ? 'active' : 'inactive'}`}>
                        {chat.isActive ? 'Attiva' : 'Inattiva'}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button
                          onClick={() => router.push(`/messaging/${chat._id}`)}
                          className="btn btn-sm btn-outline"
                          title="Visualizza dettagli"
                        >
                          <i className="icon-eye"></i>
                        </button>
                        {user?.effectivePermissions?.messaging?.delete && (
                          <button
                            onClick={() => handleChatDelete(chat._id)}
                            className="btn btn-sm btn-danger"
                            title="Elimina chat"
                          >
                            <i className="icon-trash"></i>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && stats && (
        <div className="analytics-section">
          <div className="stats-grid">
            <div className="stat-block">
              <h3>Panoramica Chat</h3>
              <div className="stat-items">
                <div className="stat-item">
                  <span className="label">Chat Totali:</span>
                  <span className="value">{stats.totalChats}</span>
                </div>
                <div className="stat-item">
                  <span className="label">Chat Attive:</span>
                  <span className="value">{stats.activeChats}</span>
                </div>
                <div className="stat-item">
                  <span className="label">Chat Dirette:</span>
                  <span className="value">{stats.directChats}</span>
                </div>
                <div className="stat-item">
                  <span className="label">Chat di Gruppo:</span>
                  <span className="value">{stats.groupChats}</span>
                </div>
              </div>
            </div>

            <div className="stat-block">
              <h3>Messaggi</h3>
              <div className="stat-items">
                <div className="stat-item">
                  <span className="label">Messaggi Totali:</span>
                  <span className="value">{stats.totalMessages.toLocaleString()}</span>
                </div>
                <div className="stat-item">
                  <span className="label">Ultime 24h:</span>
                  <span className="value">{stats.messagesLast24h}</span>
                </div>
                <div className="stat-item">
                  <span className="label">Media per Chat:</span>
                  <span className="value">{stats.averageMessagesPerChat.toFixed(1)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Activity Chart */}
          <div className="chart-section">
            <h3>Attività Recente</h3>
            <MessagingChart 
              data={stats.recentActivity}
              type="activity"
            />
          </div>

          {/* Top Users */}
          <div className="top-users-section">
            <h3>Utenti Più Attivi</h3>
            <div className="top-users-list">
              {stats.topUsers.map((user, index) => (
                <div key={user.characterId} className="user-item">
                  <span className="rank">#{index + 1}</span>
                  <span className="username">{user.characterName}</span>
                  <span className="message-count">{user.messageCount} messaggi</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Cleanup Tab */}
      {activeTab === 'cleanup' && (
        <div className="cleanup-section">
          <div className="section-header">
            <h3>Raccomandazioni Manutenzione</h3>
            <p>Suggerimenti per ottimizzare il sistema di messaggistica</p>
          </div>

          {cleanupRecommendations.length === 0 ? (
            <div className="no-recommendations">
              <i className="icon-check-circle"></i>
              <h4>Sistema Ottimizzato</h4>
              <p>Non ci sono raccomandazioni di manutenzione al momento.</p>
            </div>
          ) : (
            <div className="recommendations-list">
              {cleanupRecommendations.map((recommendation, index) => (
                <div key={index} className={`recommendation-card severity-${recommendation.severity}`}>
                  <div className="recommendation-header">
                    {getSeverityBadge(recommendation.severity)}
                    <h4>{recommendation.description}</h4>
                  </div>
                  
                  {recommendation.count && (
                    <div className="recommendation-details">
                      <p><strong>Elementi coinvolti:</strong> {recommendation.count}</p>
                    </div>
                  )}
                  
                  <div className="recommendation-actions">
                    <button 
                      className="btn btn-sm btn-outline"
                      onClick={() => {
                        // Implementation for handling cleanup action
                        console.log('Cleanup action:', recommendation);
                      }}
                    >
                      Visualizza Dettagli
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}