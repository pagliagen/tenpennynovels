import React, { useState, useEffect } from 'react';
import { NextPage } from 'next';
import { useGame } from '../contexts/GameContext';
import { GameLayout } from '../components/GameLayout';
import styles from '../styles/pages/Items.module.scss';

interface Item {
  id: string;
  name: string;
  description: string;
  category: string;
  subcategory?: string;
  imageUrl?: string;
  basePrice: number;
  priceFormatted: string;
  isPublic: boolean;
  availableLocations: Array<{
    id: string;
    name: string;
    type: string;
  }>;
  rarity: string;
  weight?: number;
  isStackable: boolean;
  maxStack: number;
  canPurchase: boolean;
  eligibilityReasons: string[];
  missingPrerequisites?: any[];
}

interface ItemCategory {
  category: string;
  count: number;
  priceRange: {
    min: number;
    max: number;
    average: number;
    formatted: {
      min: string;
      max: string;
      average: string;
    };
  };
  subcategories: string[];
  description: string;
}

const ItemsPage: NextPage = () => {
  const { gameData, character } = useGame();
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<ItemCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [priceFilter, setPriceFilter] = useState({ min: '', max: '' });
  const [sortBy, setSortBy] = useState<'name' | 'basePrice' | 'category'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [activeTab, setActiveTab] = useState<'browse' | 'categories' | 'search'>('browse');

  const ITEMS_PER_PAGE = 20;

  useEffect(() => {
    if (character && gameData) {
      loadCategories();
      loadItems();
    }
  }, [character, gameData]);

  useEffect(() => {
    if (character && gameData) {
      loadItems();
    }
  }, [selectedCategory, searchQuery, priceFilter, sortBy, sortOrder, currentPage]);

  const loadItems = async () => {
    if (!character || !gameData) return;
    
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: ITEMS_PER_PAGE.toString(),
        sortBy,
        sortOrder
      });
      
      if (selectedCategory) params.append('category', selectedCategory);
      if (searchQuery) params.append('search', searchQuery);
      if (priceFilter.min) params.append('minPrice', priceFilter.min);
      if (priceFilter.max) params.append('maxPrice', priceFilter.max);

      const response = await fetch(`/api/game/items?${params.toString()}`, {
        credentials: 'include'
      });
      
      const data = await response.json();
      if (data.success) {
        setItems(data.data.items);
        setTotalPages(data.data.pagination.pages);
      }
    } catch (error) {
      console.error('Error loading items:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await fetch('/api/game/items/categories', {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setCategories(data.data.categories);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const handleSearch = async () => {
    if (searchQuery.length < 2) {
      alert('Search query must be at least 2 characters long');
      return;
    }
    
    setActiveTab('search');
    setCurrentPage(1);
    loadItems();
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity.toLowerCase()) {
      case 'common': return '#6b7280';
      case 'uncommon': return '#10b981';
      case 'rare': return '#3b82f6';
      case 'epic': return '#8b5cf6';
      case 'legendary': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  const openItemDetails = (item: Item) => {
    setSelectedItem(item);
  };

  const closeItemDetails = () => {
    setSelectedItem(null);
  };

  if (!gameData) {
    return <div className={styles.loading}>Loading items catalog...</div>;
  }

  if (!character) {
    return (
      <GameLayout gameData={gameData}>
        <div className={styles.error}>Please select a character to browse items</div>
      </GameLayout>
    );
  }

  return (
    <GameLayout gameData={gameData}>
      <div className={styles.itemsPage}>
        <div className={styles.header}>
          <h1>Items Catalog</h1>
          <p className={styles.subtitle}>
            Browse the finest goods available in Victorian London
          </p>
        </div>

        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === 'browse' ? styles.active : ''}`}
            onClick={() => setActiveTab('browse')}
          >
            Browse Items
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'categories' ? styles.active : ''}`}
            onClick={() => setActiveTab('categories')}
          >
            Categories
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'search' ? styles.active : ''}`}
            onClick={() => setActiveTab('search')}
          >
            Advanced Search
          </button>
        </div>

        {/* Filters */}
        <div className={styles.filters}>
          <div className={styles.filterGroup}>
            <label>Category:</label>
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setCurrentPage(1);
              }}
              className={styles.select}
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.category} value={cat.category}>
                  {cat.category.replace('_', ' ').toUpperCase()} ({cat.count})
                </option>
              ))}
            </select>
          </div>

          <div className={styles.filterGroup}>
            <label>Price Range:</label>
            <div className={styles.priceInputs}>
              <input
                type="number"
                placeholder="Min"
                value={priceFilter.min}
                onChange={(e) => setPriceFilter({...priceFilter, min: e.target.value})}
                className={styles.priceInput}
              />
              <span>to</span>
              <input
                type="number"
                placeholder="Max"
                value={priceFilter.max}
                onChange={(e) => setPriceFilter({...priceFilter, max: e.target.value})}
                className={styles.priceInput}
              />
              <span>pence</span>
            </div>
          </div>

          <div className={styles.filterGroup}>
            <label>Sort by:</label>
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [field, order] = e.target.value.split('-');
                setSortBy(field as any);
                setSortOrder(order as any);
              }}
              className={styles.select}
            >
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
              <option value="basePrice-asc">Price (Low to High)</option>
              <option value="basePrice-desc">Price (High to Low)</option>
              <option value="category-asc">Category</option>
            </select>
          </div>
        </div>

        {/* Search Bar */}
        <div className={styles.searchBar}>
          <input
            type="text"
            placeholder="Search items by name or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            className={styles.searchInput}
          />
          <button onClick={handleSearch} className={styles.searchBtn}>
            Search
          </button>
        </div>

        {/* Browse Items Tab */}
        {activeTab === 'browse' && (
          <div className={styles.itemsGrid}>
            {loading ? (
              <div className={styles.loading}>Loading items...</div>
            ) : items.length === 0 ? (
              <div className={styles.emptyState}>
                <h3>No items found</h3>
                <p>Try adjusting your filters or search query.</p>
              </div>
            ) : (
              <>
                <div className={styles.itemsList}>
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className={`${styles.itemCard} ${!item.canPurchase ? styles.unavailable : ''}`}
                      onClick={() => openItemDetails(item)}
                    >
                      <div className={styles.itemImage}>
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.name} />
                        ) : (
                          <div className={styles.imagePlaceholder}>
                            <span>{item.category.charAt(0).toUpperCase()}</span>
                          </div>
                        )}
                      </div>

                      <div className={styles.itemInfo}>
                        <h4>{item.name}</h4>
                        <p className={styles.category}>
                          {item.category.replace('_', ' ').toUpperCase()}
                          {item.subcategory && ` - ${item.subcategory}`}
                        </p>
                        <p className={styles.description}>
                          {item.description.substring(0, 100)}
                          {item.description.length > 100 && '...'}
                        </p>
                        
                        <div className={styles.itemMeta}>
                          <span
                            className={styles.rarity}
                            style={{ color: getRarityColor(item.rarity) }}
                          >
                            {item.rarity.toUpperCase()}
                          </span>
                          <span className={styles.price}>
                            {item.priceFormatted}
                          </span>
                        </div>

                        <div className={styles.availability}>
                          {item.canPurchase ? (
                            <span className={styles.available}>✓ Available</span>
                          ) : (
                            <span className={styles.unavailable}>
                              ✗ {item.eligibilityReasons[0]}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className={styles.pagination}>
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className={styles.pageBtn}
                    >
                      Previous
                    </button>
                    
                    <span className={styles.pageInfo}>
                      Page {currentPage} of {totalPages}
                    </span>
                    
                    <button
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className={styles.pageBtn}
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Categories Tab */}
        {activeTab === 'categories' && (
          <div className={styles.categoriesGrid}>
            {categories.map((category) => (
              <div
                key={category.category}
                className={styles.categoryCard}
                onClick={() => {
                  setSelectedCategory(category.category);
                  setActiveTab('browse');
                  setCurrentPage(1);
                }}
              >
                <h3>{category.category.replace('_', ' ').toUpperCase()}</h3>
                <p className={styles.description}>{category.description}</p>
                
                <div className={styles.categoryStats}>
                  <div className={styles.stat}>
                    <span className={styles.label}>Items:</span>
                    <span className={styles.value}>{category.count}</span>
                  </div>
                  
                  <div className={styles.stat}>
                    <span className={styles.label}>Price Range:</span>
                    <span className={styles.value}>
                      {category.priceRange.formatted.min} - {category.priceRange.formatted.max}
                    </span>
                  </div>
                  
                  <div className={styles.stat}>
                    <span className={styles.label}>Average:</span>
                    <span className={styles.value}>{category.priceRange.formatted.average}</span>
                  </div>
                </div>

                {category.subcategories.length > 0 && (
                  <div className={styles.subcategories}>
                    <strong>Subcategories:</strong> {category.subcategories.join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Item Details Modal */}
        {selectedItem && (
          <div className={styles.modal} onClick={closeItemDetails}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h2>{selectedItem.name}</h2>
                <button onClick={closeItemDetails} className={styles.closeBtn}>×</button>
              </div>
              
              <div className={styles.modalBody}>
                <div className={styles.itemDetails}>
                  {selectedItem.imageUrl && (
                    <img src={selectedItem.imageUrl} alt={selectedItem.name} className={styles.detailImage} />
                  )}
                  
                  <div className={styles.detailInfo}>
                    <p><strong>Category:</strong> {selectedItem.category.replace('_', ' ').toUpperCase()}</p>
                    {selectedItem.subcategory && (
                      <p><strong>Subcategory:</strong> {selectedItem.subcategory}</p>
                    )}
                    <p><strong>Description:</strong> {selectedItem.description}</p>
                    <p><strong>Price:</strong> {selectedItem.priceFormatted}</p>
                    <p><strong>Rarity:</strong> <span style={{ color: getRarityColor(selectedItem.rarity) }}>{selectedItem.rarity.toUpperCase()}</span></p>
                    
                    {selectedItem.weight && (
                      <p><strong>Weight:</strong> {selectedItem.weight} lbs</p>
                    )}
                    
                    <p><strong>Stackable:</strong> {selectedItem.isStackable ? `Yes (max ${selectedItem.maxStack})` : 'No'}</p>
                    
                    <div className={styles.availability}>
                      <strong>Availability:</strong>
                      {selectedItem.canPurchase ? (
                        <span className={styles.available}> ✓ You can purchase this item</span>
                      ) : (
                        <div className={styles.unavailable}>
                          <span> ✗ Cannot purchase</span>
                          <ul>
                            {selectedItem.eligibilityReasons.map((reason, index) => (
                              <li key={index}>{reason}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {selectedItem.availableLocations.length > 0 && (
                      <div className={styles.locations}>
                        <strong>Available at:</strong>
                        <ul>
                          {selectedItem.availableLocations.map((location) => (
                            <li key={location.id}>{location.name} ({location.type})</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </GameLayout>
  );
};

export default ItemsPage;
 