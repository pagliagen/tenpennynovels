import React, { useState, useEffect } from 'react';
import { NextPage } from 'next';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'http://localhost:8000';

// Types
interface Location {
  _id: string;
  name: string;
  slug: string;
  description: string;
  district: string;
  locationLevel: 'root' | 'district' | 'location';
  parentLocation?: {
    _id: string;
    name: string;
  };
  settings: {
    visible: boolean;
    chat: boolean;
    shop: boolean;
    private: boolean;
  };
  currentOccupancy: number;
  maxOccupants: number | 'Unlimited';
  totalVisits: number;
  lastActivity?: string;
  accessControlCount: {
    characters: number;
    corporations: number;
  };
  createdBy: {
    username: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface LocationStats {
  totalLocations: number;
  visibleLocations: number;
  privateLocations: number;
  locationsWithChat: number;
  totalOccupants: number;
}

const LocationsPage: NextPage = () => {
  // State
  const [locations, setLocations] = useState<Location[]>([]);
  const [stats, setStats] = useState<LocationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters and pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [districtFilter, setDistrictFilter] = useState('all');
  const [levelFilter, setLevelFilter] = useState('all');
  const [visibilityFilter, setVisibilityFilter] = useState('all');
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  
  // Create/Edit form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    district: '',
    locationLevel: 'location',
    parentLocationId: '',
    maxOccupants: '',
    imageUrl: '',
    sortOrder: '0',
    settings: {
      visible: true,
      chat: true,
      shop: false,
      private: false
    }
  });

  // Fetch locations and stats
  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Build query parameters
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '25'
      });
      
      if (searchTerm) params.append('search', searchTerm);
      if (districtFilter !== 'all') params.append('district', districtFilter);
      if (levelFilter !== 'all') params.append('locationLevel', levelFilter);
      if (visibilityFilter !== 'all') params.append('visible', visibilityFilter === 'visible' ? 'true' : 'false');

      // Fetch locations and stats in parallel
      const [locationsResponse, statsResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/admin/locations?${params}`, {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' }
        }),
        fetch(`${API_BASE_URL}/admin/locations/stats`, {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' }
        })
      ]);

      if (locationsResponse.ok && statsResponse.ok) {
        const locationsData = await locationsResponse.json();
        const statsData = await statsResponse.json();
        
        if (locationsData.success) {
          setLocations(locationsData.data.locations);
          setTotalPages(locationsData.data.pagination.totalPages);
        }
        
        if (statsData.success) {
          setStats(statsData.data.overview);
        }
        
        setError(null);
      } else {
        setError('Failed to fetch locations data');
      }
    } catch (error) {
      console.error('Error fetching locations:', error);
      setError('Network error while fetching data');
    } finally {
      setLoading(false);
    }
  };

  // Create location
  const handleCreateLocation = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/locations`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          maxOccupants: formData.maxOccupants ? parseInt(formData.maxOccupants) : undefined,
          sortOrder: parseInt(formData.sortOrder)
        })
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        await fetchData();
        setShowCreateModal(false);
        resetForm();
        alert('Location created successfully!');
      } else {
        alert(`Error: ${data.error || 'Failed to create location'}`);
      }
    } catch (error) {
      console.error('Error creating location:', error);
      alert('Network error while creating location');
    }
  };

  // Update location
  const handleUpdateLocation = async () => {
    if (!selectedLocation) return;

    try {
      const response = await fetch(`${API_BASE_URL}/admin/locations/${selectedLocation._id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          maxOccupants: formData.maxOccupants ? parseInt(formData.maxOccupants) : undefined,
          sortOrder: parseInt(formData.sortOrder)
        })
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        await fetchData();
        setShowEditModal(false);
        setSelectedLocation(null);
        resetForm();
        alert('Location updated successfully!');
      } else {
        alert(`Error: ${data.error || 'Failed to update location'}`);
      }
    } catch (error) {
      console.error('Error updating location:', error);
      alert('Network error while updating location');
    }
  };

  // Delete location
  const handleDeleteLocation = async (locationId: string, locationName: string) => {
    if (!confirm(`Are you sure you want to delete "${locationName}"?`)) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/admin/locations/${locationId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        await fetchData();
        alert('Location deleted successfully!');
      } else {
        alert(`Error: ${data.error || 'Failed to delete location'}`);
      }
    } catch (error) {
      console.error('Error deleting location:', error);
      alert('Network error while deleting location');
    }
  };

  // Toggle location visibility
  const toggleLocationVisibility = async (locationId: string, currentVisibility: boolean) => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/locations/${locationId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: {
            visible: !currentVisibility
          }
        })
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        await fetchData();
      } else {
        alert(`Error: ${data.error || 'Failed to toggle visibility'}`);
      }
    } catch (error) {
      console.error('Error toggling visibility:', error);
      alert('Network error while toggling visibility');
    }
  };

  // Form helpers
  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      district: '',
      locationLevel: 'location',
      parentLocationId: '',
      maxOccupants: '',
      imageUrl: '',
      sortOrder: '0',
      settings: {
        visible: true,
        chat: true,
        shop: false,
        private: false
      }
    });
  };

  const openEditModal = (location: Location) => {
    setSelectedLocation(location);
    setFormData({
      name: location.name,
      description: location.description,
      district: location.district,
      locationLevel: location.locationLevel,
      parentLocationId: location.parentLocation?._id || '',
      maxOccupants: location.maxOccupants === 'Unlimited' ? '' : location.maxOccupants.toString(),
      imageUrl: '',
      sortOrder: '0',
      settings: { ...location.settings }
    });
    setShowEditModal(true);
  };

  useEffect(() => {
    fetchData();
  }, [currentPage, searchTerm, districtFilter, levelFilter, visibilityFilter]);

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

  const getLocationLevelBadge = (level: string) => {
    const colors = {
      root: '#dc3545',
      district: '#007bff',
      location: '#28a745'
    };
    return (
      <span style={{
        padding: '2px 8px',
        borderRadius: '4px',
        fontSize: '0.8rem',
        fontWeight: 'bold',
        backgroundColor: colors[level as keyof typeof colors] || '#6c757d',
        color: 'white'
      }}>
        {level.toUpperCase()}
      </span>
    );
  };

  const getOccupancyColor = (current: number, max: number | 'Unlimited') => {
    if (max === 'Unlimited') return '#28a745';
    const percentage = (current / max) * 100;
    if (percentage >= 90) return '#dc3545';
    if (percentage >= 70) return '#ffc107';
    return '#28a745';
  };

  if (loading) {
    return (
      <div className="container" style={{ padding: '20px' }}>
        <div style={{ textAlign: 'center' }}>Loading locations data...</div>
      </div>
    );
  }

  // Get unique districts for filter
  const districts = Array.from(new Set(locations.map(l => l.district))).filter(Boolean);

  return (
    <div className="container" style={{ padding: '20px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1>Location Management</h1>
        <p>Manage all game locations, access controls, and world building.</p>
      </div>

      {/* Stats Dashboard */}
      {stats && (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
          gap: '15px', 
          marginBottom: '20px' 
        }}>
          <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#6c757d' }}>Total Locations</h4>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#007bff' }}>
              {stats.totalLocations}
            </div>
          </div>
          <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#6c757d' }}>Visible</h4>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#28a745' }}>
              {stats.visibleLocations}
            </div>
          </div>
          <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#6c757d' }}>Private</h4>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ffc107' }}>
              {stats.privateLocations}
            </div>
          </div>
          <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#6c757d' }}>With Chat</h4>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#17a2b8' }}>
              {stats.locationsWithChat}
            </div>
          </div>
          <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#6c757d' }}>Current Occupants</h4>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#6f42c1' }}>
              {stats.totalOccupants}
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ 
        display: 'flex', 
        gap: '10px', 
        marginBottom: '20px',
        flexWrap: 'wrap'
      }}>
        <button 
          onClick={() => setShowCreateModal(true)}
          style={{ 
            padding: '8px 16px', 
            backgroundColor: '#007bff', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Create Location
        </button>
        <button 
          onClick={fetchData}
          style={{ 
            padding: '8px 16px', 
            backgroundColor: '#6c757d', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Refresh Data
        </button>
      </div>

      {/* Filters */}
      <div style={{ 
        display: 'flex', 
        gap: '15px', 
        marginBottom: '20px',
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>
        <div>
          <input
            type="text"
            placeholder="Search locations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ 
              padding: '8px 12px', 
              borderRadius: '4px',
              border: '1px solid #ddd',
              width: '200px'
            }}
          />
        </div>
        <div>
          <label>District: </label>
          <select 
            value={districtFilter} 
            onChange={(e) => setDistrictFilter(e.target.value)}
            style={{ padding: '4px 8px', marginLeft: '5px' }}
          >
            <option value="all">All Districts</option>
            {districts.map(district => (
              <option key={district} value={district}>{district}</option>
            ))}
          </select>
        </div>
        <div>
          <label>Level: </label>
          <select 
            value={levelFilter} 
            onChange={(e) => setLevelFilter(e.target.value)}
            style={{ padding: '4px 8px', marginLeft: '5px' }}
          >
            <option value="all">All Levels</option>
            <option value="root">Root</option>
            <option value="district">District</option>
            <option value="location">Location</option>
          </select>
        </div>
        <div>
          <label>Visibility: </label>
          <select 
            value={visibilityFilter} 
            onChange={(e) => setVisibilityFilter(e.target.value)}
            style={{ padding: '4px 8px', marginLeft: '5px' }}
          >
            <option value="all">All</option>
            <option value="visible">Visible Only</option>
            <option value="hidden">Hidden Only</option>
          </select>
        </div>
      </div>

      {error && (
        <div style={{ 
          color: '#dc3545', 
          backgroundColor: '#f8d7da', 
          padding: '10px', 
          borderRadius: '4px', 
          marginBottom: '20px' 
        }}>
          {error}
        </div>
      )}

      {/* Locations Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ 
          width: '100%', 
          borderCollapse: 'collapse',
          backgroundColor: 'white',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <thead>
            <tr style={{ backgroundColor: '#f8f9fa' }}>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>
                Location
              </th>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>
                District & Level
              </th>
              <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>
                Settings
              </th>
              <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>
                Occupancy
              </th>
              <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>
                Activity
              </th>
              <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>
                Access Control
              </th>
              <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {locations.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '20px', textAlign: 'center', color: '#6c757d' }}>
                  No locations found
                </td>
              </tr>
            ) : (
              locations.map((location) => (
                <tr key={location._id} style={{ borderBottom: '1px solid #dee2e6' }}>
                  <td style={{ padding: '12px' }}>
                    <div style={{ fontWeight: 'bold' }}>{location.name}</div>
                    <div style={{ fontSize: '0.9rem', color: '#6c757d' }}>
                      {location.description.substring(0, 50)}...
                    </div>
                    {location.parentLocation && (
                      <div style={{ fontSize: '0.8rem', color: '#007bff' }}>
                        Parent: {location.parentLocation.name}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '12px' }}>
                    <div style={{ marginBottom: '4px' }}>
                      <strong>{location.district}</strong>
                    </div>
                    {getLocationLevelBadge(location.locationLevel)}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center' }}>
                      <span style={{ 
                        color: location.settings.visible ? '#28a745' : '#6c757d',
                        fontSize: '0.8rem'
                      }}>
                        {location.settings.visible ? '👁️ Visible' : '🔒 Hidden'}
                      </span>
                      {location.settings.chat && <span style={{ fontSize: '0.8rem', color: '#17a2b8' }}>💬 Chat</span>}
                      {location.settings.shop && <span style={{ fontSize: '0.8rem', color: '#ffc107' }}>🛒 Shop</span>}
                      {location.settings.private && <span style={{ fontSize: '0.8rem', color: '#dc3545' }}>🔐 Private</span>}
                    </div>
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <div style={{ 
                      color: getOccupancyColor(location.currentOccupancy, location.maxOccupants),
                      fontWeight: 'bold'
                    }}>
                      {location.currentOccupancy}/{location.maxOccupants}
                    </div>
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center', fontSize: '0.9rem' }}>
                    <div>{location.totalVisits} visits</div>
                    {location.lastActivity && (
                      <div style={{ fontSize: '0.8rem', color: '#6c757d' }}>
                        Last: {formatDate(location.lastActivity)}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.9rem' }}>
                      <div>{location.accessControlCount.characters} chars</div>
                      <div>{location.accessControlCount.corporations} corps</div>
                    </div>
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', justifyContent: 'center' }}>
                      <button
                        onClick={() => openEditModal(location)}
                        style={{
                          padding: '4px 8px',
                          backgroundColor: '#007bff',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '0.8rem',
                          cursor: 'pointer'
                        }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => toggleLocationVisibility(location._id, location.settings.visible)}
                        style={{
                          padding: '4px 8px',
                          backgroundColor: location.settings.visible ? '#ffc107' : '#28a745',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '0.8rem',
                          cursor: 'pointer'
                        }}
                      >
                        {location.settings.visible ? 'Hide' : 'Show'}
                      </button>
                      <button
                        onClick={() => handleDeleteLocation(location._id, location.name)}
                        style={{
                          padding: '4px 8px',
                          backgroundColor: '#dc3545',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '0.8rem',
                          cursor: 'pointer'
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          gap: '10px', 
          marginTop: '20px' 
        }}>
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            style={{
              padding: '8px 12px',
              backgroundColor: currentPage === 1 ? '#6c757d' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
            }}
          >
            Previous
          </button>
          <span style={{ 
            padding: '8px 12px', 
            backgroundColor: '#f8f9fa', 
            borderRadius: '4px' 
          }}>
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            style={{
              padding: '8px 12px',
              backgroundColor: currentPage === totalPages ? '#6c757d' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
            }}
          >
            Next
          </button>
        </div>
      )}

      {/* Create Location Modal */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            maxWidth: '600px',
            width: '90%',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0 }}>Create New Location</h3>
              <button 
                onClick={() => { setShowCreateModal(false); resetForm(); }}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  fontSize: '24px', 
                  cursor: 'pointer' 
                }}
              >
                ×
              </button>
            </div>
            
            <div style={{ display: 'grid', gap: '15px' }}>
              <div>
                <label>Location Name:</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                  required
                />
              </div>
              
              <div>
                <label>Description:</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  style={{ width: '100%', padding: '8px', marginTop: '5px', minHeight: '80px' }}
                  required
                />
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div>
                  <label>District:</label>
                  <input
                    type="text"
                    value={formData.district}
                    onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                    style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                    required
                  />
                </div>
                
                <div>
                  <label>Location Level:</label>
                  <select
                    value={formData.locationLevel}
                    onChange={(e) => setFormData({ ...formData, locationLevel: e.target.value })}
                    style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                  >
                    <option value="location">Location</option>
                    <option value="district">District</option>
                    <option value="root">Root</option>
                  </select>
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div>
                  <label>Max Occupants (optional):</label>
                  <input
                    type="number"
                    value={formData.maxOccupants}
                    onChange={(e) => setFormData({ ...formData, maxOccupants: e.target.value })}
                    style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                    placeholder="Leave empty for unlimited"
                  />
                </div>
                
                <div>
                  <label>Sort Order:</label>
                  <input
                    type="number"
                    value={formData.sortOrder}
                    onChange={(e) => setFormData({ ...formData, sortOrder: e.target.value })}
                    style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                  />
                </div>
              </div>

              <div>
                <label>Settings:</label>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(2, 1fr)', 
                  gap: '10px', 
                  marginTop: '10px',
                  padding: '10px',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '4px'
                }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <input
                      type="checkbox"
                      checked={formData.settings.visible}
                      onChange={(e) => setFormData({
                        ...formData,
                        settings: { ...formData.settings, visible: e.target.checked }
                      })}
                    />
                    Visible
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <input
                      type="checkbox"
                      checked={formData.settings.chat}
                      onChange={(e) => setFormData({
                        ...formData,
                        settings: { ...formData.settings, chat: e.target.checked }
                      })}
                    />
                    Chat Enabled
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <input
                      type="checkbox"
                      checked={formData.settings.shop}
                      onChange={(e) => setFormData({
                        ...formData,
                        settings: { ...formData.settings, shop: e.target.checked }
                      })}
                    />
                    Shop Enabled
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <input
                      type="checkbox"
                      checked={formData.settings.private}
                      onChange={(e) => setFormData({
                        ...formData,
                        settings: { ...formData.settings, private: e.target.checked }
                      })}
                    />
                    Private
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button
                  onClick={() => { setShowCreateModal(false); resetForm(); }}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateLocation}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Create Location
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Location Modal - Similar structure to Create Modal */}
      {showEditModal && selectedLocation && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            maxWidth: '600px',
            width: '90%',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0 }}>Edit Location: {selectedLocation.name}</h3>
              <button 
                onClick={() => { setShowEditModal(false); setSelectedLocation(null); resetForm(); }}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  fontSize: '24px', 
                  cursor: 'pointer' 
                }}
              >
                ×
              </button>
            </div>
            
            {/* Same form structure as Create Modal */}
            <div style={{ display: 'grid', gap: '15px' }}>
              <div>
                <label>Location Name:</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                  required
                />
              </div>
              
              <div>
                <label>Description:</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  style={{ width: '100%', padding: '8px', marginTop: '5px', minHeight: '80px' }}
                  required
                />
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div>
                  <label>District:</label>
                  <input
                    type="text"
                    value={formData.district}
                    onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                    style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                    required
                  />
                </div>
                
                <div>
                  <label>Location Level:</label>
                  <select
                    value={formData.locationLevel}
                    onChange={(e) => setFormData({ ...formData, locationLevel: e.target.value })}
                    style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                  >
                    <option value="location">Location</option>
                    <option value="district">District</option>
                    <option value="root">Root</option>
                  </select>
                </div>
              </div>

              <div>
                <label>Settings:</label>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(2, 1fr)', 
                  gap: '10px', 
                  marginTop: '10px',
                  padding: '10px',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '4px'
                }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <input
                      type="checkbox"
                      checked={formData.settings.visible}
                      onChange={(e) => setFormData({
                        ...formData,
                        settings: { ...formData.settings, visible: e.target.checked }
                      })}
                    />
                    Visible
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <input
                      type="checkbox"
                      checked={formData.settings.chat}
                      onChange={(e) => setFormData({
                        ...formData,
                        settings: { ...formData.settings, chat: e.target.checked }
                      })}
                    />
                    Chat Enabled
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <input
                      type="checkbox"
                      checked={formData.settings.shop}
                      onChange={(e) => setFormData({
                        ...formData,
                        settings: { ...formData.settings, shop: e.target.checked }
                      })}
                    />
                    Shop Enabled
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <input
                      type="checkbox"
                      checked={formData.settings.private}
                      onChange={(e) => setFormData({
                        ...formData,
                        settings: { ...formData.settings, private: e.target.checked }
                      })}
                    />
                    Private
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button
                  onClick={() => { setShowEditModal(false); setSelectedLocation(null); resetForm(); }}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateLocation}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Update Location
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LocationsPage;