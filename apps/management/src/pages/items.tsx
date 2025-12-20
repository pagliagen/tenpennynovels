import React, { useState, useEffect } from 'react';
import { NextPage } from 'next';
import { useNotification } from '@/contexts/NotificationContext';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'http://localhost:8000';

// Types
interface Item {
  _id: string;
  name: string;
  description: string;
  category: string;
  subcategory?: string;
  basePrice: number;
  rarity: string;
  isPublic: boolean;
  isAdminOnly: boolean;
  availableLocations: Array<{
    _id: string;
    name: string;
    type: string;
  }>;
  properties: {
    isStackable: boolean;
    isConsumable: boolean;
    maxQuantity?: number;
    weight?: number;
    durability?: number;
  };
  shopSettings: {
    canBePurchased: boolean;
    canBeSold: boolean;
    hasLimitedStock: boolean;
  };
  financialSettings: {
    eligibleForCredit: boolean;
  };
  createdBy: {
    username: string;
  };
  createdAt: string;
  updatedAt: string;
  hasPrerequisites: boolean;
  prerequisiteCount: number;
}

interface ItemStats {
  total: number;
  publicItems: number;
  adminOnlyItems: number;
  consumableItems: number;
  stackableItems: number;
  withPrerequisites: number;
  byCategory: Array<{ name: string; count: number }>;
  byRarity: Array<{ name: string; count: number }>;
  priceStats: {
    average: number;
    minimum: number;
    maximum: number;
  } | null;
  shopStats: {
    canBePurchased: number;
    canBeSold: number;
    hasLimitedStock: number;
  };
}

const CATEGORIES = [
  'clothing', 'accessories', 'tools', 'weapons', 'books', 'documents',
  'medical', 'food_drink', 'household', 'luxury', 'professional',
  'transport', 'curiosities', 'occult', 'consumables', 'services'
];

const RARITIES = ['common', 'uncommon', 'rare', 'very_rare', 'legendary', 'unique'];

const ItemsPage: NextPage = () => {
  // Notification hook
  const { showPrompt, showToast } = useNotification();

  // State
  const [items, setItems] = useState<Item[]>([]);
  const [stats, setStats] = useState<ItemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [rarityFilter, setRarityFilter] = useState('all');
  const [isPublicFilter, setIsPublicFilter] = useState('all');
  const [isAdminOnlyFilter, setIsAdminOnlyFilter] = useState('all');

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'clothing',
    subcategory: '',
    basePrice: 0,
    rarity: 'common',
    isPublic: true,
    isAdminOnly: false,
    properties: {
      isStackable: false,
      isConsumable: false,
      maxQuantity: 1,
      weight: 0,
      durability: 100
    },
    shopSettings: {
      canBePurchased: true,
      canBeSold: true,
      hasLimitedStock: false
    },
    financialSettings: {
      eligibleForCredit: true
    }
  });

  // Fetch items and stats
  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Build query parameters
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '25'
      });
      
      if (searchTerm) params.append('search', searchTerm);
      if (categoryFilter !== 'all') params.append('category', categoryFilter);
      if (rarityFilter !== 'all') params.append('rarity', rarityFilter);
      if (isPublicFilter !== 'all') params.append('isPublic', isPublicFilter);
      if (isAdminOnlyFilter !== 'all') params.append('isAdminOnly', isAdminOnlyFilter);

      // Fetch both items and stats
      const [itemsResponse, statsResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/admin/items?${params}`, {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' }
        }),
        fetch(`${API_BASE_URL}/admin/items/stats`, {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' }
        })
      ]);

      if (itemsResponse.ok && statsResponse.ok) {
        const itemsData = await itemsResponse.json();
        const statsData = await statsResponse.json();
        
        if (itemsData.success) {
          setItems(itemsData.data.items);
          setTotalPages(itemsData.data.pagination.totalPages);
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

  useEffect(() => {
    fetchData();
  }, [currentPage, searchTerm, categoryFilter, rarityFilter, isPublicFilter, isAdminOnlyFilter]);

  // Handle item creation
  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_BASE_URL}/admin/items`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        setShowCreateModal(false);
        resetForm();
        fetchData();
        showToast('Oggetto creato con successo', 'success');
      } else {
        const errorData = await response.json();
        showToast(errorData.error || 'Errore nella creazione dell\'oggetto', 'error');
      }
    } catch (error) {
      console.error('Error creating item:', error);
      showToast('Errore di connessione', 'error');
    }
  };

  // Handle item update
  const handleUpdateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    const reason = await showPrompt('Motivo della modifica:', 'Aggiornamento Manutenzione');
    if (!reason) return;

    try {
      const response = await fetch(`${API_BASE_URL}/admin/items/${selectedItem._id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, reason })
      });

      if (response.ok) {
        setShowEditModal(false);
        setSelectedItem(null);
        resetForm();
        fetchData();
        showToast('Oggetto aggiornato con successo', 'success');
      } else {
        const errorData = await response.json();
        showToast(errorData.error || 'Errore nell\'aggiornamento dell\'oggetto', 'error');
      }
    } catch (error) {
      console.error('Error updating item:', error);
      showToast('Errore di connessione', 'error');
    }
  };

  // Handle item deletion
  const handleDeleteItem = async () => {
    if (!selectedItem) return;

    const reason = await showPrompt('Motivo dell\'eliminazione:', 'Aggiornamento Manutenzione');
    if (!reason) return;

    try {
      const response = await fetch(`${API_BASE_URL}/admin/items/${selectedItem._id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      });

      if (response.ok) {
        setShowDeleteModal(false);
        setSelectedItem(null);
        fetchData();
        showToast('Oggetto eliminato con successo', 'success');
      } else {
        const errorData = await response.json();
        showToast(errorData.error || 'Errore nell\'eliminazione dell\'oggetto', 'error');
      }
    } catch (error) {
      console.error('Error deleting item:', error);
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

  // Reset form
  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      category: 'clothing',
      subcategory: '',
      basePrice: 0,
      rarity: 'common',
      isPublic: true,
      isAdminOnly: false,
      properties: {
        isStackable: false,
        isConsumable: false,
        maxQuantity: 1,
        weight: 0,
        durability: 100
      },
      shopSettings: {
        canBePurchased: true,
        canBeSold: true,
        hasLimitedStock: false
      },
      financialSettings: {
        eligibleForCredit: true
      }
    });
  };

  // Fill form for editing
  const openEditModal = (item: Item) => {
    setSelectedItem(item);
    setFormData({
      name: item.name,
      description: item.description,
      category: item.category,
      subcategory: item.subcategory || '',
      basePrice: item.basePrice,
      rarity: item.rarity,
      isPublic: item.isPublic,
      isAdminOnly: item.isAdminOnly,
      properties: {
        isStackable: item.properties.isStackable,
        isConsumable: item.properties.isConsumable,
        maxQuantity: item.properties.maxQuantity || 1,
        weight: item.properties.weight || 0,
        durability: item.properties.durability || 100
      },
      shopSettings: {
        canBePurchased: item.shopSettings.canBePurchased,
        canBeSold: item.shopSettings.canBeSold,
        hasLimitedStock: item.shopSettings.hasLimitedStock
      },
      financialSettings: {
        eligibleForCredit: item.financialSettings.eligibleForCredit
      }
    });
    setShowEditModal(true);
  };

  if (loading && items.length === 0) {
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
          borderTop: '4px solid #d4af37',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <p style={{ marginTop: '20px', color: '#666' }}>Caricamento oggetti...</p>
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
          🎒 Gestione Oggetti
        </h1>
        <p style={{ fontSize: '1.1rem', opacity: 0.9 }}>
          Catalogo oggetti Victorian London - Inventario, prezzi e disponibilità
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
              <div style={{ fontSize: '2rem', marginBottom: '5px' }}>📦</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>{stats.total}</div>
              <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>Oggetti Totali</div>
            </div>
            <div style={{
              background: 'rgba(255,255,255,0.15)',
              padding: '20px',
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '2rem', marginBottom: '5px' }}>🏪</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>{stats.publicItems}</div>
              <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>Pubblici</div>
            </div>
            <div style={{
              background: 'rgba(255,255,255,0.15)',
              padding: '20px',
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '2rem', marginBottom: '5px' }}>⚔️</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>{stats.adminOnlyItems}</div>
              <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>Admin Only</div>
            </div>
            <div style={{
              background: 'rgba(255,255,255,0.15)',
              padding: '20px',
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '2rem', marginBottom: '5px' }}>💰</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>
                {stats.priceStats ? formatPrice(stats.priceStats.average) : '0d'}
              </div>
              <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>Prezzo Medio</div>
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div style={{
        background: '#f8f9fa',
        border: '2px solid #d4af37',
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
              Cerca oggetti
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Nome, descrizione..."
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '2px solid #d4af37',
                borderRadius: '6px',
                fontSize: '1rem'
              }}
            />
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
              Categoria
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '2px solid #d4af37',
                borderRadius: '6px',
                fontSize: '1rem'
              }}
            >
              <option value="all">Tutte le categorie</option>
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
              Rarità
            </label>
            <select
              value={rarityFilter}
              onChange={(e) => setRarityFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '2px solid #d4af37',
                borderRadius: '6px',
                fontSize: '1rem'
              }}
            >
              <option value="all">Tutte le rarità</option>
              {RARITIES.map(rarity => (
                <option key={rarity} value={rarity}>{rarity.charAt(0).toUpperCase() + rarity.slice(1)}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
              Disponibilità
            </label>
            <select
              value={isPublicFilter}
              onChange={(e) => setIsPublicFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '2px solid #d4af37',
                borderRadius: '6px',
                fontSize: '1rem'
              }}
            >
              <option value="all">Tutti</option>
              <option value="true">Solo pubblici</option>
              <option value="false">Solo privati</option>
            </select>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              padding: '10px 20px',
              background: '#d4af37',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '1rem'
            }}
          >
            ➕ Nuovo Oggetto
          </button>
        </div>
      </div>

      {/* Items Table */}
      <div style={{
        background: 'white',
        border: '2px solid #d4af37',
        borderRadius: '10px',
        overflow: 'hidden'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#d4af37', color: 'white' }}>
              <th style={{ padding: '15px', textAlign: 'left' }}>Nome</th>
              <th style={{ padding: '15px', textAlign: 'left' }}>Categoria</th>
              <th style={{ padding: '15px', textAlign: 'left' }}>Prezzo</th>
              <th style={{ padding: '15px', textAlign: 'left' }}>Rarità</th>
              <th style={{ padding: '15px', textAlign: 'center' }}>Pubblico</th>
              <th style={{ padding: '15px', textAlign: 'center' }}>Admin Only</th>
              <th style={{ padding: '15px', textAlign: 'center' }}>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={item._id} style={{
                borderBottom: '1px solid #eee',
                background: index % 2 === 0 ? '#f9f9f9' : 'white'
              }}>
                <td style={{ padding: '15px' }}>
                  <div>
                    <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{item.name}</div>
                    <div style={{ fontSize: '0.85rem', color: '#666' }}>
                      {item.description.substring(0, 80)}
                      {item.description.length > 80 && '...'}
                    </div>
                    {item.hasPrerequisites && (
                      <div style={{ fontSize: '0.8rem', color: '#d4af37', marginTop: '2px' }}>
                        📋 {item.prerequisiteCount} prerequisiti
                      </div>
                    )}
                  </div>
                </td>
                <td style={{ padding: '15px' }}>
                  <div>
                    <span style={{
                      background: '#f0f0f0',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '0.8rem'
                    }}>
                      {item.category}
                    </span>
                    {item.subcategory && (
                      <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '2px' }}>
                        {item.subcategory}
                      </div>
                    )}
                  </div>
                </td>
                <td style={{ padding: '15px', fontWeight: 'bold' }}>
                  {formatPrice(item.basePrice)}
                </td>
                <td style={{ padding: '15px' }}>
                  <span style={{
                    background: item.rarity === 'common' ? '#28a745' :
                               item.rarity === 'uncommon' ? '#17a2b8' :
                               item.rarity === 'rare' ? '#ffc107' :
                               item.rarity === 'very_rare' ? '#fd7e14' :
                               item.rarity === 'legendary' ? '#dc3545' : '#6f42c1',
                    color: 'white',
                    padding: '3px 8px',
                    borderRadius: '12px',
                    fontSize: '0.8rem'
                  }}>
                    {item.rarity}
                  </span>
                </td>
                <td style={{ padding: '15px', textAlign: 'center' }}>
                  <span style={{
                    color: item.isPublic ? '#28a745' : '#dc3545',
                    fontSize: '1.2rem'
                  }}>
                    {item.isPublic ? '✅' : '❌'}
                  </span>
                </td>
                <td style={{ padding: '15px', textAlign: 'center' }}>
                  <span style={{
                    color: item.isAdminOnly ? '#dc3545' : '#28a745',
                    fontSize: '1.2rem'
                  }}>
                    {item.isAdminOnly ? '⚠️' : '✅'}
                  </span>
                </td>
                <td style={{ padding: '15px', textAlign: 'center' }}>
                  <button
                    onClick={() => openEditModal(item)}
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
                    ✏️ Modifica
                  </button>
                  <button
                    onClick={() => {
                      setSelectedItem(item);
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
        
        {items.length === 0 && !loading && (
          <div style={{
            padding: '40px',
            textAlign: 'center',
            color: '#666'
          }}>
            📦 Nessun oggetto trovato con i filtri selezionati
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
              background: currentPage === 1 ? '#ccc' : '#d4af37',
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
              background: currentPage === totalPages ? '#ccc' : '#d4af37',
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

      {/* Create Modal */}
      {showCreateModal && (
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
            width: '90%',
            maxWidth: '600px',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <h2 style={{ marginBottom: '20px' }}>Crea Nuovo Oggetto</h2>
            
            <form onSubmit={handleCreateItem}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>Nome *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({...prev, name: e.target.value}))}
                  required
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ddd',
                    borderRadius: '4px'
                  }}
                />
              </div>
              
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>Descrizione *</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({...prev, description: e.target.value}))}
                  required
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    resize: 'vertical'
                  }}
                />
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Categoria *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData(prev => ({...prev, category: e.target.value}))}
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #ddd',
                      borderRadius: '4px'
                    }}
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Sottocategoria</label>
                  <input
                    type="text"
                    value={formData.subcategory}
                    onChange={(e) => setFormData(prev => ({...prev, subcategory: e.target.value}))}
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #ddd',
                      borderRadius: '4px'
                    }}
                  />
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Prezzo Base (pence) *</label>
                  <input
                    type="number"
                    value={formData.basePrice}
                    onChange={(e) => setFormData(prev => ({...prev, basePrice: parseInt(e.target.value) || 0}))}
                    min="0"
                    required
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #ddd',
                      borderRadius: '4px'
                    }}
                  />
                </div>
                
                <div>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Rarità</label>
                  <select
                    value={formData.rarity}
                    onChange={(e) => setFormData(prev => ({...prev, rarity: e.target.value}))}
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #ddd',
                      borderRadius: '4px'
                    }}
                  >
                    {RARITIES.map(rarity => (
                      <option key={rarity} value={rarity}>{rarity.charAt(0).toUpperCase() + rarity.slice(1)}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <input
                      type="checkbox"
                      checked={formData.isPublic}
                      onChange={(e) => setFormData(prev => ({...prev, isPublic: e.target.checked}))}
                    />
                    Pubblico
                  </label>
                </div>
                
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <input
                      type="checkbox"
                      checked={formData.isAdminOnly}
                      onChange={(e) => setFormData(prev => ({...prev, isAdminOnly: e.target.checked}))}
                    />
                    Solo Admin
                  </label>
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    resetForm();
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
                  type="submit"
                  style={{
                    padding: '10px 20px',
                    background: '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Crea Oggetto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal (similar structure to Create Modal) */}
      {showEditModal && selectedItem && (
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
            width: '90%',
            maxWidth: '600px',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <h2 style={{ marginBottom: '20px' }}>Modifica Oggetto: {selectedItem.name}</h2>
            
            <form onSubmit={handleUpdateItem}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>Nome *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({...prev, name: e.target.value}))}
                  required
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ddd',
                    borderRadius: '4px'
                  }}
                />
              </div>
              
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>Descrizione *</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({...prev, description: e.target.value}))}
                  required
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    resize: 'vertical'
                  }}
                />
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Prezzo Base (pence) *</label>
                  <input
                    type="number"
                    value={formData.basePrice}
                    onChange={(e) => setFormData(prev => ({...prev, basePrice: parseInt(e.target.value) || 0}))}
                    min="0"
                    required
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #ddd',
                      borderRadius: '4px'
                    }}
                  />
                </div>
                
                <div>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Rarità</label>
                  <select
                    value={formData.rarity}
                    onChange={(e) => setFormData(prev => ({...prev, rarity: e.target.value}))}
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #ddd',
                      borderRadius: '4px'
                    }}
                  >
                    {RARITIES.map(rarity => (
                      <option key={rarity} value={rarity}>{rarity.charAt(0).toUpperCase() + rarity.slice(1)}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedItem(null);
                    resetForm();
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
                  type="submit"
                  style={{
                    padding: '10px 20px',
                    background: '#17a2b8',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Aggiorna Oggetto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && selectedItem && (
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
            <h2 style={{ marginBottom: '15px' }}>Elimina Oggetto</h2>
            <p style={{ marginBottom: '20px' }}>
              Sei sicuro di voler eliminare l'oggetto <strong>"{selectedItem.name}"</strong>?
              <br /><br />
              Se l'oggetto è posseduto da personaggi, verrà solo rimosso dalla disponibilità pubblica.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setSelectedItem(null);
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
                onClick={handleDeleteItem}
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
    </div>
  );
};

export default ItemsPage;