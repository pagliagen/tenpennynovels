import React, { useState, useEffect } from 'react';
import { NextPage } from 'next';
import { useNotification } from '@/contexts/NotificationContext';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'http://localhost:8000';

// Types
interface Message {
  _id: string;
  messageType: string;
  subject: string;
  content: string;
  from: string;
  to: string[];
  sentAt: string;
  scheduledDelivery?: string;
  deliveredAt?: string;
  sentFromLocation: string;
  postageCharged: number;
  isExpress: boolean;
  sealed: boolean;
  status: string;
  conversationId?: string;
}

interface MessageStats {
  total: number;
  byType: Array<{ name: string; count: number }>;
  byStatus: Array<{ name: string; count: number }>;
  recentActivity: Array<{ date: string; count: number }>;
  topSenders: Array<{ name: string; count: number }>;
  deliveryPerformance: {
    averageDelay: number;
    onTimeRate: number;
  };
}

interface DeliveryQueue {
  pending: Array<Message & { minutesUntilDelivery: number }>;
  failed: Array<Message & { minutesOverdue: number }>;
}

const MESSAGE_TYPES = [
  'note', 'telegram', 'letter', 'express_letter', 
  'postcard', 'invitation', 'official_document', 'diary'
];

const MESSAGE_STATUSES = ['all', 'pending', 'delivered', 'failed'];

const ForumPage: NextPage = () => {
  const { showPrompt, showToast } = useNotification();

  // State
  const [messages, setMessages] = useState<Message[]>([]);
  const [stats, setStats] = useState<MessageStats | null>(null);
  const [deliveryQueue, setDeliveryQueue] = useState<DeliveryQueue | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('messages');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [messageTypeFilter, setMessageTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Modal states
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState<string[]>([]);

  // Fetch data
  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Build query parameters
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '25'
      });
      
      if (searchTerm) params.append('search', searchTerm);
      if (messageTypeFilter !== 'all') params.append('messageType', messageTypeFilter);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);

      const [messagesResponse, statsResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/admin/forum?${params}`, {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' }
        }),
        fetch(`${API_BASE_URL}/admin/forum/stats`, {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' }
        })
      ]);

      if (messagesResponse.ok && statsResponse.ok) {
        const messagesData = await messagesResponse.json();
        const statsData = await statsResponse.json();
        
        if (messagesData.success) {
          setMessages(messagesData.data.messages);
          setTotalPages(messagesData.data.pagination.totalPages);
        }
        
        if (statsData.success) {
          setStats(statsData.data);
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDeliveryQueue = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/forum/delivery/queue`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setDeliveryQueue(data.data);
        }
      }
    } catch (error) {
      console.error('Error fetching delivery queue:', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentPage, searchTerm, messageTypeFilter, statusFilter, dateFrom, dateTo]);

  useEffect(() => {
    if (activeTab === 'delivery') {
      fetchDeliveryQueue();
    }
  }, [activeTab]);

  // Handle message deletion
  const handleDeleteMessage = async () => {
    if (!selectedMessage) return;

    const reason = await showPrompt('Motivo dell\'eliminazione:', 'Aggiornamento Manutenzione');
    if (!reason) return;

    try {
      const response = await fetch(`${API_BASE_URL}/admin/forum/${selectedMessage._id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      });

      if (response.ok) {
        setShowDeleteModal(false);
        setSelectedMessage(null);
        fetchData();
        showToast('Messaggio eliminato con successo', 'success');
      } else {
        const errorData = await response.json();
        showToast(errorData.error || 'Errore nell\'eliminazione del messaggio', 'error');
      }
    } catch (error) {
      console.error('Error deleting message:', error);
      showToast('Errore di connessione', 'error');
    }
  };

  // Handle bulk operations
  const handleBulkOperation = async (operation: string) => {
    if (selectedMessages.length === 0) return;

    let reason = '';
    if (operation === 'delete') {
      reason = await showPrompt('Motivo dell\'eliminazione:', 'Aggiornamento Manutenzione') || '';
      if (!reason) return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/admin/forum/bulk`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation,
          messageIds: selectedMessages,
          reason
        })
      });

      if (response.ok) {
        setSelectedMessages([]);
        setShowBulkModal(false);
        fetchData();
        if (activeTab === 'delivery') {
          fetchDeliveryQueue();
        }
        showToast('Operazione bulk completata con successo', 'success');
      } else {
        const errorData = await response.json();
        showToast(errorData.error || `Errore nell'operazione ${operation}`, 'error');
      }
    } catch (error) {
      console.error('Error in bulk operation:', error);
      showToast('Errore di connessione', 'error');
    }
  };

  // Handle manual delivery
  const handleManualDelivery = async (messageIds: string[]) => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/forum/delivery/manual`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageIds })
      });

      if (response.ok) {
        fetchDeliveryQueue();
        showToast('Consegna manuale completata con successo', 'success');
      } else {
        const errorData = await response.json();
        showToast(errorData.error || 'Errore nella consegna manuale', 'error');
      }
    } catch (error) {
      console.error('Error in manual delivery:', error);
      showToast('Errore di connessione', 'error');
    }
  };

  // Format price in Victorian currency
  const formatPrice = (pence: number) => {
    const pounds = Math.floor(pence / 240);
    const shillings = Math.floor((pence % 240) / 12);
    const remainingPence = pence % 12;
    
    if (pounds > 0) {
      return `£${pounds}.${shillings}.${remainingPence}`;
    } else if (shillings > 0) {
      return `${shillings}s ${remainingPence}d`;
    } else {
      return `${remainingPence}d`;
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading && messages.length === 0) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '60vh',
        flexDirection: 'column'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '4px solid #f3f3f3',
          borderTop: '4px solid #8b4513',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <p style={{ marginTop: '20px', color: '#666' }}>Caricamento sistema postale...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #8b4513 0%, #a0522d 100%)',
        borderRadius: '12px',
        padding: '30px',
        marginBottom: '30px',
        color: 'white',
        textAlign: 'center'
      }}>
        <h1 style={{ 
          fontSize: '2.5rem', 
          marginBottom: '10px',
          textShadow: '2px 2px 4px rgba(0,0,0,0.3)'
        }}>
          📮 Gestione Sistema Postale
        </h1>
        <p style={{ fontSize: '1.1rem', opacity: 0.9 }}>
          Amministrazione messaggi OnGame - Sistema postale vittoriano
        </p>

        {/* Stats Cards */}
        {stats && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '20px',
            marginTop: '30px'
          }}>
            <div style={{
              background: 'rgba(255,255,255,0.15)',
              padding: '20px',
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '2rem', marginBottom: '5px' }}>📬</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>{stats.total}</div>
              <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>Messaggi Totali</div>
            </div>
            <div style={{
              background: 'rgba(255,255,255,0.15)',
              padding: '20px',
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '2rem', marginBottom: '5px' }}>⚡</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>{stats.deliveryPerformance.onTimeRate}%</div>
              <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>Consegne Puntuali</div>
            </div>
            <div style={{
              background: 'rgba(255,255,255,0.15)',
              padding: '20px',
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '2rem', marginBottom: '5px' }}>⏱️</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>{stats.deliveryPerformance.averageDelay}min</div>
              <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>Ritardo Medio</div>
            </div>
            {stats.byStatus.find(s => s.name === 'failed') && (
              <div style={{
                background: 'rgba(255,255,255,0.15)',
                padding: '20px',
                borderRadius: '8px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '2rem', marginBottom: '5px' }}>❌</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>
                  {stats.byStatus.find(s => s.name === 'failed')?.count || 0}
                </div>
                <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>Consegne Fallite</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div style={{
        display: 'flex',
        borderBottom: '2px solid #8b4513',
        marginBottom: '20px'
      }}>
        {[
          { key: 'messages', label: '📬 Messaggi', icon: '📬' },
          { key: 'delivery', label: '🚚 Coda Consegne', icon: '🚚' },
          { key: 'analytics', label: '📊 Analytics', icon: '📊' }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '12px 24px',
              background: activeTab === tab.key ? '#8b4513' : 'transparent',
              color: activeTab === tab.key ? 'white' : '#8b4513',
              border: 'none',
              borderRadius: '8px 8px 0 0',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: 'bold',
              marginRight: '5px'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Messages Tab */}
      {activeTab === 'messages' && (
        <>
          {/* Filters */}
          <div style={{
            background: '#f8f9fa',
            border: '2px solid #8b4513',
            borderRadius: '10px',
            padding: '20px',
            marginBottom: '20px'
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '15px',
              alignItems: 'end'
            }}>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
                  Cerca messaggi
                </label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Oggetto, contenuto..."
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '2px solid #8b4513',
                    borderRadius: '6px',
                    fontSize: '1rem'
                  }}
                />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
                  Tipo Messaggio
                </label>
                <select
                  value={messageTypeFilter}
                  onChange={(e) => setMessageTypeFilter(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '2px solid #8b4513',
                    borderRadius: '6px',
                    fontSize: '1rem'
                  }}
                >
                  <option value="all">Tutti i tipi</option>
                  {MESSAGE_TYPES.map(type => (
                    <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
                  Stato
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '2px solid #8b4513',
                    borderRadius: '6px',
                    fontSize: '1rem'
                  }}
                >
                  {MESSAGE_STATUSES.map(status => (
                    <option key={status} value={status}>
                      {status === 'all' ? 'Tutti gli stati' : status.charAt(0).toUpperCase() + status.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
                  Dal
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '2px solid #8b4513',
                    borderRadius: '6px',
                    fontSize: '1rem'
                  }}
                />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
                  Al
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '2px solid #8b4513',
                    borderRadius: '6px',
                    fontSize: '1rem'
                  }}
                />
              </div>

              {selectedMessages.length > 0 && (
                <button
                  onClick={() => setShowBulkModal(true)}
                  style={{
                    padding: '10px 20px',
                    background: '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '1rem'
                  }}
                >
                  ⚙️ Azioni Bulk ({selectedMessages.length})
                </button>
              )}
            </div>
          </div>

          {/* Messages Table */}
          <div style={{
            background: 'white',
            border: '2px solid #8b4513',
            borderRadius: '10px',
            overflow: 'hidden'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#8b4513', color: 'white' }}>
                  <th style={{ padding: '15px', textAlign: 'left' }}>
                    <input
                      type="checkbox"
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedMessages(messages.map(m => m._id));
                        } else {
                          setSelectedMessages([]);
                        }
                      }}
                      checked={selectedMessages.length === messages.length && messages.length > 0}
                    />
                  </th>
                  <th style={{ padding: '15px', textAlign: 'left' }}>Oggetto</th>
                  <th style={{ padding: '15px', textAlign: 'left' }}>Tipo</th>
                  <th style={{ padding: '15px', textAlign: 'left' }}>Da/A</th>
                  <th style={{ padding: '15px', textAlign: 'left' }}>Data</th>
                  <th style={{ padding: '15px', textAlign: 'left' }}>Stato</th>
                  <th style={{ padding: '15px', textAlign: 'left' }}>Costo</th>
                  <th style={{ padding: '15px', textAlign: 'center' }}>Azioni</th>
                </tr>
              </thead>
              <tbody>
                {messages.map((message, index) => (
                  <tr key={message._id} style={{
                    borderBottom: '1px solid #eee',
                    background: index % 2 === 0 ? '#f9f9f9' : 'white'
                  }}>
                    <td style={{ padding: '15px' }}>
                      <input
                        type="checkbox"
                        checked={selectedMessages.includes(message._id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedMessages(prev => [...prev, message._id]);
                          } else {
                            setSelectedMessages(prev => prev.filter(id => id !== message._id));
                          }
                        }}
                      />
                    </td>
                    <td style={{ padding: '15px' }}>
                      <div>
                        <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{message.subject}</div>
                        <div style={{ fontSize: '0.85rem', color: '#666' }}>
                          {message.content.substring(0, 100)}
                          {message.content.length > 100 && '...'}
                        </div>
                        {message.sealed && (
                          <div style={{ fontSize: '0.8rem', color: '#8b4513', marginTop: '2px' }}>
                            🔒 Sigillato
                          </div>
                        )}
                        {message.isExpress && (
                          <div style={{ fontSize: '0.8rem', color: '#dc3545', marginTop: '2px' }}>
                            ⚡ Express
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '15px' }}>
                      <span style={{
                        background: '#f0f0f0',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '0.8rem'
                      }}>
                        {message.messageType}
                      </span>
                    </td>
                    <td style={{ padding: '15px' }}>
                      <div>
                        <div style={{ fontSize: '0.9rem', marginBottom: '2px' }}>
                          <strong>Da:</strong> {message.from}
                        </div>
                        <div style={{ fontSize: '0.9rem' }}>
                          <strong>A:</strong> {message.to.join(', ')}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '2px' }}>
                          📍 {message.sentFromLocation}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '15px' }}>
                      <div>
                        <div style={{ fontSize: '0.9rem', marginBottom: '2px' }}>
                          {formatDate(message.sentAt)}
                        </div>
                        {message.scheduledDelivery && (
                          <div style={{ fontSize: '0.8rem', color: '#666' }}>
                            🕐 {formatDate(message.scheduledDelivery)}
                          </div>
                        )}
                        {message.deliveredAt && (
                          <div style={{ fontSize: '0.8rem', color: '#28a745' }}>
                            ✅ {formatDate(message.deliveredAt)}
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '15px' }}>
                      <span style={{
                        background: message.status === 'delivered' ? '#28a745' :
                                   message.status === 'pending' ? '#ffc107' :
                                   message.status === 'failed' ? '#dc3545' : '#6c757d',
                        color: 'white',
                        padding: '3px 8px',
                        borderRadius: '12px',
                        fontSize: '0.8rem'
                      }}>
                        {message.status}
                      </span>
                    </td>
                    <td style={{ padding: '15px', fontWeight: 'bold' }}>
                      {formatPrice(message.postageCharged)}
                    </td>
                    <td style={{ padding: '15px', textAlign: 'center' }}>
                      <button
                        onClick={() => {
                          setSelectedMessage(message);
                          setShowDetailsModal(true);
                        }}
                        style={{
                          padding: '5px 10px',
                          background: '#17a2b8',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          marginRight: '5px',
                          fontSize: '0.8rem'
                        }}
                      >
                        👁️ Dettagli
                      </button>
                      <button
                        onClick={() => {
                          setSelectedMessage(message);
                          setShowDeleteModal(true);
                        }}
                        style={{
                          padding: '5px 10px',
                          background: '#dc3545',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.8rem'
                        }}
                      >
                        🗑️ Elimina
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {messages.length === 0 && !loading && (
              <div style={{
                padding: '40px',
                textAlign: 'center',
                color: '#666'
              }}>
                📪 Nessun messaggio trovato con i filtri selezionati
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '10px',
              marginTop: '20px'
            }}>
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                style={{
                  padding: '8px 16px',
                  background: currentPage === 1 ? '#ccc' : '#8b4513',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                }}
              >
                ← Precedente
              </button>
              
              <span style={{ padding: '8px 16px' }}>
                Pagina {currentPage} di {totalPages}
              </span>
              
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                style={{
                  padding: '8px 16px',
                  background: currentPage === totalPages ? '#ccc' : '#8b4513',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
                }}
              >
                Successiva →
              </button>
            </div>
          )}
        </>
      )}

      {/* Delivery Queue Tab */}
      {activeTab === 'delivery' && deliveryQueue && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {/* Pending Messages */}
          <div style={{
            background: 'white',
            border: '2px solid #ffc107',
            borderRadius: '10px',
            overflow: 'hidden'
          }}>
            <div style={{
              background: '#ffc107',
              color: '#856404',
              padding: '15px',
              fontWeight: 'bold',
              fontSize: '1.1rem'
            }}>
              ⏳ Consegne in Attesa ({deliveryQueue.pending.length})
            </div>
            <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
              {deliveryQueue.pending.map(message => (
                <div key={message._id} style={{
                  padding: '15px',
                  borderBottom: '1px solid #eee'
                }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
                    {message.subject}
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '5px' }}>
                    Da {message.from} a {message.to.join(', ')}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#28a745' }}>
                    📅 Consegna tra {message.minutesUntilDelivery} minuti
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Failed Messages */}
          <div style={{
            background: 'white',
            border: '2px solid #dc3545',
            borderRadius: '10px',
            overflow: 'hidden'
          }}>
            <div style={{
              background: '#dc3545',
              color: 'white',
              padding: '15px',
              fontWeight: 'bold',
              fontSize: '1.1rem'
            }}>
              ❌ Consegne Fallite ({deliveryQueue.failed.length})
              {deliveryQueue.failed.length > 0 && (
                <button
                  onClick={() => handleManualDelivery(deliveryQueue.failed.map(m => m._id))}
                  style={{
                    float: 'right',
                    padding: '5px 10px',
                    background: 'white',
                    color: '#dc3545',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.8rem'
                  }}
                >
                  🚚 Consegna Tutto
                </button>
              )}
            </div>
            <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
              {deliveryQueue.failed.map(message => (
                <div key={message._id} style={{
                  padding: '15px',
                  borderBottom: '1px solid #eee'
                }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
                    {message.subject}
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '5px' }}>
                    Da {message.from} a {message.to.join(', ')}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#dc3545', marginBottom: '5px' }}>
                    🕐 In ritardo di {message.minutesOverdue} minuti
                  </div>
                  <button
                    onClick={() => handleManualDelivery([message._id])}
                    style={{
                      padding: '5px 10px',
                      background: '#28a745',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.8rem'
                    }}
                  >
                    🚚 Consegna Manualmente
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
          {/* Messages by Type */}
          <div style={{
            background: 'white',
            border: '2px solid #8b4513',
            borderRadius: '10px',
            padding: '20px'
          }}>
            <h3 style={{ marginBottom: '15px' }}>📝 Messaggi per Tipo</h3>
            {stats.byType.map(item => (
              <div key={item.name} style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '8px 0',
                borderBottom: '1px solid #eee'
              }}>
                <span>{item.name}</span>
                <span style={{ fontWeight: 'bold' }}>{item.count}</span>
              </div>
            ))}
          </div>

          {/* Messages by Status */}
          <div style={{
            background: 'white',
            border: '2px solid #8b4513',
            borderRadius: '10px',
            padding: '20px'
          }}>
            <h3 style={{ marginBottom: '15px' }}>📊 Messaggi per Stato</h3>
            {stats.byStatus.map(item => (
              <div key={item.name} style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '8px 0',
                borderBottom: '1px solid #eee'
              }}>
                <span style={{
                  color: item.name === 'delivered' ? '#28a745' :
                         item.name === 'pending' ? '#ffc107' :
                         item.name === 'failed' ? '#dc3545' : '#6c757d'
                }}>
                  {item.name}
                </span>
                <span style={{ fontWeight: 'bold' }}>{item.count}</span>
              </div>
            ))}
          </div>

          {/* Top Senders */}
          <div style={{
            background: 'white',
            border: '2px solid #8b4513',
            borderRadius: '10px',
            padding: '20px'
          }}>
            <h3 style={{ marginBottom: '15px' }}>👥 Top Mittenti (30gg)</h3>
            {stats.topSenders.slice(0, 10).map((sender, index) => (
              <div key={index} style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '8px 0',
                borderBottom: '1px solid #eee'
              }}>
                <span>{sender.name}</span>
                <span style={{ fontWeight: 'bold' }}>{sender.count}</span>
              </div>
            ))}
          </div>

          {/* Recent Activity */}
          <div style={{
            background: 'white',
            border: '2px solid #8b4513',
            borderRadius: '10px',
            padding: '20px'
          }}>
            <h3 style={{ marginBottom: '15px' }}>📈 Attività Recente (7gg)</h3>
            {stats.recentActivity.map(item => (
              <div key={item.date} style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '8px 0',
                borderBottom: '1px solid #eee'
              }}>
                <span>{new Date(item.date).toLocaleDateString('it-IT')}</span>
                <span style={{ fontWeight: 'bold' }}>{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedMessage && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            padding: '30px',
            borderRadius: '10px',
            maxWidth: '500px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '15px' }}>⚠️</div>
            <h2 style={{ marginBottom: '15px' }}>Elimina Messaggio</h2>
            <p style={{ marginBottom: '20px' }}>
              Sei sicuro di voler eliminare il messaggio <strong>"{selectedMessage.subject}"</strong>?
              <br /><br />
              Questa azione eliminerà permanentemente il messaggio e tutte le sue visualizzazioni.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setSelectedMessage(null);
                }}
                style={{
                  padding: '10px 20px',
                  background: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Annulla
              </button>
              <button
                onClick={handleDeleteMessage}
                style={{
                  padding: '10px 20px',
                  background: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Elimina
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Operations Modal */}
      {showBulkModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            padding: '30px',
            borderRadius: '10px',
            maxWidth: '500px',
            textAlign: 'center'
          }}>
            <h2 style={{ marginBottom: '20px' }}>Operazioni Bulk</h2>
            <p style={{ marginBottom: '20px' }}>
              Hai selezionato {selectedMessages.length} messaggi. Quale operazione vuoi eseguire?
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={() => handleBulkOperation('delete')}
                style={{
                  padding: '10px 20px',
                  background: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                🗑️ Elimina
              </button>
              <button
                onClick={() => handleBulkOperation('mark_delivered')}
                style={{
                  padding: '10px 20px',
                  background: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                ✅ Segna Consegnati
              </button>
              <button
                onClick={() => handleBulkOperation('retry_delivery')}
                style={{
                  padding: '10px 20px',
                  background: '#ffc107',
                  color: '#856404',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                🔄 Riprova Consegna
              </button>
              <button
                onClick={() => {
                  setShowBulkModal(false);
                  setSelectedMessages([]);
                }}
                style={{
                  padding: '10px 20px',
                  background: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ForumPage;