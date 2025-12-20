import React, { useState, useEffect } from 'react';
import { NextPage } from 'next';
import { useRouter } from 'next/router';
import { useNotification } from '@/contexts/NotificationContext';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'http://localhost:8000';

// Types
interface HousingProperty {
  _id: string;
  locationId: {
    _id: string;
    name: string;
    description?: string;
  };
  propertyType: 'basic_room' | 'furnished_room' | 'luxury_suite' | 'small_house' | 'large_house' | 'mansion';
  district: string;
  address?: string;
  ownershipType: 'rental' | 'owned' | 'available';
  monthlyRent?: number;
  purchasePrice?: number;
  monthlyMaintenance: number;
  deposit?: number;
  currentTenantId?: string;
  currentTenant?: {
    _id: string;
    name: string;
  };
  ownerId?: string;
  owner?: {
    _id: string;
    name: string;
  };
  features: {
    furnished: boolean;
    hasKitchen: boolean;
    hasPrivateBathroom: boolean;
    hasGarden: boolean;
    hasBalcony: boolean;
    fireplace: boolean;
    gaslighting: boolean;
    waterSupply: 'none' | 'shared' | 'private';
    roomCount: number;
  };
  condition: 'poor' | 'fair' | 'good' | 'excellent';
  isAvailable: boolean;
  rentPaidUntil?: string;
  lastRentPayment?: string;
  leaseStart?: string;
  leaseEnd?: string;
  createdAt: string;
  updatedAt: string;
}

interface HousingStats {
  totalProperties: number;
  availableRentals: number;
  availablePurchases: number;
  totalRented: number;
  totalOwned: number;
  overdueRent: number;
  totalMonthlyRent: number;
  averageRentByDistrict: Record<string, number>;
}

interface CreatePropertyData {
  locationName: string;
  locationDescription: string;
  propertyType: string;
  district: string;
  address: string;
  ownershipType: string;
  monthlyRent: number;
  purchasePrice: number;
  monthlyMaintenance: number;
  deposit: number;
  features: {
    furnished: boolean;
    hasKitchen: boolean;
    hasPrivateBathroom: boolean;
    hasGarden: boolean;
    hasBalcony: boolean;
    fireplace: boolean;
    gaslighting: boolean;
    waterSupply: string;
    roomCount: number;
  };
  condition: string;
}

const HousingPage: NextPage = () => {
  const router = useRouter();
  const { showPrompt, showToast } = useNotification();

  // State
  const [properties, setProperties] = useState<HousingProperty[]>([]);
  const [stats, setStats] = useState<HousingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [districtFilter, setDistrictFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showEvictionModal, setShowEvictionModal] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<HousingProperty | null>(null);
  const [createData, setCreateData] = useState<CreatePropertyData>({
    locationName: '',
    locationDescription: '',
    propertyType: 'basic_room',
    district: '',
    address: '',
    ownershipType: 'available',
    monthlyRent: 0,
    purchasePrice: 0,
    monthlyMaintenance: 0,
    deposit: 0,
    features: {
      furnished: false,
      hasKitchen: false,
      hasPrivateBathroom: false,
      hasGarden: false,
      hasBalcony: false,
      fireplace: false,
      gaslighting: false,
      waterSupply: 'none',
      roomCount: 1
    },
    condition: 'fair'
  });

  // Fetch properties and stats
  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch properties
      let propertiesUrl = `${API_BASE_URL}/admin/housing/properties?page=${currentPage}`;
      if (statusFilter !== 'all') {
        propertiesUrl += `&ownershipType=${statusFilter}`;
      }
      if (districtFilter !== 'all') {
        propertiesUrl += `&district=${encodeURIComponent(districtFilter)}`;
      }

      const propertiesResponse = await fetch(propertiesUrl, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });
      
      // Fetch stats
      const statsResponse = await fetch(`${API_BASE_URL}/admin/housing/stats`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });

      if (propertiesResponse.ok && statsResponse.ok) {
        const propertiesData = await propertiesResponse.json();
        const statsData = await statsResponse.json();
        
        if (propertiesData.success) {
          setProperties(propertiesData.data?.properties || []);
        }
        
        if (statsData.success) {
          setStats(statsData.data);
        }
        
        setError(null);
      } else {
        setError('Failed to fetch housing data');
      }
    } catch (error) {
      console.error('Error fetching housing data:', error);
      setError('Network error while fetching data');
    } finally {
      setLoading(false);
    }
  };

  // Create property
  const handleCreateProperty = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/housing/properties`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createData)
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        await fetchData();
        setShowCreateModal(false);
        setCreateData({
          locationName: '',
          locationDescription: '',
          propertyType: 'basic_room',
          district: '',
          address: '',
          ownershipType: 'available',
          monthlyRent: 0,
          purchasePrice: 0,
          monthlyMaintenance: 0,
          deposit: 0,
          features: {
            furnished: false,
            hasKitchen: false,
            hasPrivateBathroom: false,
            hasGarden: false,
            hasBalcony: false,
            fireplace: false,
            gaslighting: false,
            waterSupply: 'none',
            roomCount: 1
          },
          condition: 'fair'
        });
        showToast('Property created successfully!', 'success');
      } else {
        showToast(`Error: ${data.error || 'Failed to create property'}`, 'error');
      }
    } catch (error) {
      console.error('Error creating property:', error);
      showToast('Network error while creating property', 'error');
    }
  };

  // Delete property
  const handleDeleteProperty = async (propertyId: string) => {
    if (!confirm('Are you sure you want to delete this property?')) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/admin/housing/properties/${propertyId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();

      if (response.ok && data.success) {
        await fetchData();
        showToast('Property deleted successfully!', 'success');
      } else {
        showToast(`Error: ${data.error || 'Failed to delete property'}`, 'error');
      }
    } catch (error) {
      console.error('Error deleting property:', error);
      showToast('Network error while deleting property', 'error');
    }
  };

  // Process eviction
  const handleEviction = async (propertyId: string) => {
    if (!confirm('Are you sure you want to evict the current tenant?')) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/admin/housing/properties/${propertyId}/evict`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        await fetchData();
        setShowEvictionModal(false);
        setSelectedProperty(null);
        showToast('Eviction processed successfully!', 'success');
      } else {
        showToast(`Error: ${data.error || 'Failed to process eviction'}`, 'error');
      }
    } catch (error) {
      console.error('Error processing eviction:', error);
      showToast('Network error while processing eviction', 'error');
    }
  };

  // Bulk evictions
  const handleBulkEvictions = async () => {
    if (!confirm('Process all overdue evictions? This will evict all tenants with overdue rent.')) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/admin/housing/evictions/process`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();

      if (response.ok && data.success) {
        await fetchData();
        showToast(`Processed ${data.data?.evictedCount || 0} evictions successfully!`, 'success');
      } else {
        showToast(`Error: ${data.error || 'Failed to process evictions'}`, 'error');
      }
    } catch (error) {
      console.error('Error processing bulk evictions:', error);
      showToast('Network error while processing evictions', 'error');
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentPage, statusFilter, districtFilter]);

  // Helper functions
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-GB');
  };

  const formatCurrency = (amount: number) => {
    return `${amount} pence`;
  };

  const getPropertyTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'basic_room': 'Basic Room',
      'furnished_room': 'Furnished Room',
      'luxury_suite': 'Luxury Suite',
      'small_house': 'Small House',
      'large_house': 'Large House',
      'mansion': 'Mansion'
    };
    return labels[type] || type;
  };

  const getConditionLabel = (condition: string) => {
    const labels: Record<string, string> = {
      'poor': 'Poor',
      'fair': 'Fair',
      'good': 'Good',
      'excellent': 'Excellent'
    };
    return labels[condition] || condition;
  };

  const getRentStatus = (property: HousingProperty) => {
    if (property.ownershipType === 'owned') return 'Owned';
    if (property.ownershipType === 'available') return 'Available';
    
    if (!property.rentPaidUntil) return 'No Data';
    
    const rentDueDate = new Date(property.rentPaidUntil);
    const today = new Date();
    const daysUntilDue = Math.ceil((rentDueDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
    
    if (daysUntilDue < 0) return 'Overdue';
    if (daysUntilDue <= 3) return 'Due Soon';
    return 'Current';
  };

  const districts = Array.from(new Set(properties.map(p => p.district))).filter(Boolean);

  if (loading) {
    return (
      <div className="container" style={{ padding: '20px' }}>
        <div style={{ textAlign: 'center' }}>Loading housing data...</div>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: '20px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1>Housing Management</h1>
        <p>Manage all properties, rentals, and housing-related operations.</p>
      </div>

      {/* Stats Dashboard */}
      {stats && (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '15px', 
          marginBottom: '20px' 
        }}>
          <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#6c757d' }}>Total Properties</h4>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#007bff' }}>
              {stats.totalProperties}
            </div>
          </div>
          <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#6c757d' }}>Available for Rent</h4>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#28a745' }}>
              {stats.availableRentals}
            </div>
          </div>
          <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#6c757d' }}>Currently Rented</h4>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#17a2b8' }}>
              {stats.totalRented}
            </div>
          </div>
          <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#6c757d' }}>Overdue Rent</h4>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#dc3545' }}>
              {stats.overdueRent}
            </div>
          </div>
          <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#6c757d' }}>Monthly Revenue</h4>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#6f42c1' }}>
              {formatCurrency(stats.totalMonthlyRent)}
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
          Create Property
        </button>
        <button 
          onClick={handleBulkEvictions}
          style={{ 
            padding: '8px 16px', 
            backgroundColor: '#dc3545', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px',
            cursor: 'pointer'
          }}
          disabled={!stats || stats.overdueRent === 0}
        >
          Process All Evictions ({stats?.overdueRent || 0})
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
          <label>Status: </label>
          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ padding: '4px 8px', marginLeft: '5px' }}
          >
            <option value="all">All Properties</option>
            <option value="available">Available</option>
            <option value="rental">Rented</option>
            <option value="owned">Owned</option>
          </select>
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

      {/* Properties Table */}
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
                Property
              </th>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>
                Type & District
              </th>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>
                Status
              </th>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>
                Tenant/Owner
              </th>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>
                Financial
              </th>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>
                Rent Status
              </th>
              <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {properties.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '20px', textAlign: 'center', color: '#6c757d' }}>
                  No properties found
                </td>
              </tr>
            ) : (
              properties.map((property) => {
                const rentStatus = getRentStatus(property);
                return (
                  <tr key={property._id} style={{ borderBottom: '1px solid #dee2e6' }}>
                    <td style={{ padding: '12px' }}>
                      <div style={{ fontWeight: 'bold' }}>{property.locationId.name}</div>
                      <div style={{ fontSize: '0.9rem', color: '#6c757d' }}>
                        {property.address}
                      </div>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <div>{getPropertyTypeLabel(property.propertyType)}</div>
                      <div style={{ fontSize: '0.9rem', color: '#6c757d' }}>
                        {property.district}
                      </div>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '0.8rem',
                        fontWeight: 'bold',
                        backgroundColor: 
                          property.ownershipType === 'available' ? '#d4edda' :
                          property.ownershipType === 'rental' ? '#d1ecf1' : '#fff3cd',
                        color:
                          property.ownershipType === 'available' ? '#155724' :
                          property.ownershipType === 'rental' ? '#0c5460' : '#856404'
                      }}>
                        {property.ownershipType.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '12px' }}>
                      {property.currentTenant && (
                        <div style={{ fontSize: '0.9rem' }}>
                          <strong>Tenant:</strong> {property.currentTenant.name}
                        </div>
                      )}
                      {property.owner && (
                        <div style={{ fontSize: '0.9rem' }}>
                          <strong>Owner:</strong> {property.owner.name}
                        </div>
                      )}
                      {!property.currentTenant && !property.owner && (
                        <span style={{ color: '#6c757d' }}>No occupant</span>
                      )}
                    </td>
                    <td style={{ padding: '12px', fontSize: '0.9rem' }}>
                      {property.monthlyRent && (
                        <div>Rent: {formatCurrency(property.monthlyRent)}/mo</div>
                      )}
                      {property.purchasePrice && (
                        <div>Price: {formatCurrency(property.purchasePrice)}</div>
                      )}
                      <div>Maintenance: {formatCurrency(property.monthlyMaintenance)}/mo</div>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '0.8rem',
                        fontWeight: 'bold',
                        backgroundColor:
                          rentStatus === 'Current' ? '#d4edda' :
                          rentStatus === 'Due Soon' ? '#fff3cd' :
                          rentStatus === 'Overdue' ? '#f8d7da' : '#e9ecef',
                        color:
                          rentStatus === 'Current' ? '#155724' :
                          rentStatus === 'Due Soon' ? '#856404' :
                          rentStatus === 'Overdue' ? '#721c24' : '#495057'
                      }}>
                        {rentStatus}
                      </span>
                      {property.rentPaidUntil && (
                        <div style={{ fontSize: '0.8rem', color: '#6c757d', marginTop: '2px' }}>
                          Until: {formatDate(property.rentPaidUntil)}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', justifyContent: 'center' }}>
                        {property.currentTenant && rentStatus === 'Overdue' && (
                          <button
                            onClick={() => {
                              setSelectedProperty(property);
                              setShowEvictionModal(true);
                            }}
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
                            Evict
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteProperty(property._id)}
                          style={{
                            padding: '4px 8px',
                            backgroundColor: '#6c757d',
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
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Create Property Modal */}
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
              <h3 style={{ margin: 0 }}>Create New Property</h3>
              <button 
                onClick={() => setShowCreateModal(false)}
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
                  value={createData.locationName}
                  onChange={(e) => setCreateData({ ...createData, locationName: e.target.value })}
                  style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                />
              </div>
              
              <div>
                <label>Location Description:</label>
                <textarea
                  value={createData.locationDescription}
                  onChange={(e) => setCreateData({ ...createData, locationDescription: e.target.value })}
                  style={{ width: '100%', padding: '8px', marginTop: '5px', minHeight: '60px' }}
                />
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div>
                  <label>Property Type:</label>
                  <select
                    value={createData.propertyType}
                    onChange={(e) => setCreateData({ ...createData, propertyType: e.target.value })}
                    style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                  >
                    <option value="basic_room">Basic Room</option>
                    <option value="furnished_room">Furnished Room</option>
                    <option value="luxury_suite">Luxury Suite</option>
                    <option value="small_house">Small House</option>
                    <option value="large_house">Large House</option>
                    <option value="mansion">Mansion</option>
                  </select>
                </div>
                
                <div>
                  <label>District:</label>
                  <input
                    type="text"
                    value={createData.district}
                    onChange={(e) => setCreateData({ ...createData, district: e.target.value })}
                    style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                  />
                </div>
              </div>
              
              <div>
                <label>Address:</label>
                <input
                  type="text"
                  value={createData.address}
                  onChange={(e) => setCreateData({ ...createData, address: e.target.value })}
                  style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                />
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
                <div>
                  <label>Ownership Type:</label>
                  <select
                    value={createData.ownershipType}
                    onChange={(e) => setCreateData({ ...createData, ownershipType: e.target.value })}
                    style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                  >
                    <option value="available">Available</option>
                    <option value="rental">For Rent</option>
                  </select>
                </div>
                
                <div>
                  <label>Monthly Rent (pence):</label>
                  <input
                    type="number"
                    value={createData.monthlyRent}
                    onChange={(e) => setCreateData({ ...createData, monthlyRent: parseInt(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                  />
                </div>
                
                <div>
                  <label>Purchase Price (pence):</label>
                  <input
                    type="number"
                    value={createData.purchasePrice}
                    onChange={(e) => setCreateData({ ...createData, purchasePrice: parseInt(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
                <div>
                  <label>Monthly Maintenance (pence):</label>
                  <input
                    type="number"
                    value={createData.monthlyMaintenance}
                    onChange={(e) => setCreateData({ ...createData, monthlyMaintenance: parseInt(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                  />
                </div>
                
                <div>
                  <label>Deposit (pence):</label>
                  <input
                    type="number"
                    value={createData.deposit}
                    onChange={(e) => setCreateData({ ...createData, deposit: parseInt(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                  />
                </div>
                
                <div>
                  <label>Room Count:</label>
                  <input
                    type="number"
                    min="1"
                    value={createData.features.roomCount}
                    onChange={(e) => setCreateData({ 
                      ...createData, 
                      features: { ...createData.features, roomCount: parseInt(e.target.value) || 1 }
                    })}
                    style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div>
                  <label>Condition:</label>
                  <select
                    value={createData.condition}
                    onChange={(e) => setCreateData({ ...createData, condition: e.target.value })}
                    style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                  >
                    <option value="poor">Poor</option>
                    <option value="fair">Fair</option>
                    <option value="good">Good</option>
                    <option value="excellent">Excellent</option>
                  </select>
                </div>
                
                <div>
                  <label>Water Supply:</label>
                  <select
                    value={createData.features.waterSupply}
                    onChange={(e) => setCreateData({ 
                      ...createData, 
                      features: { ...createData.features, waterSupply: e.target.value }
                    })}
                    style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                  >
                    <option value="none">None</option>
                    <option value="shared">Shared</option>
                    <option value="private">Private</option>
                  </select>
                </div>
              </div>

              <div>
                <label>Features:</label>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
                  gap: '10px', 
                  marginTop: '10px' 
                }}>
                  {Object.entries(createData.features).map(([key, value]) => {
                    if (key === 'waterSupply' || key === 'roomCount') return null;
                    return (
                      <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <input
                          type="checkbox"
                          checked={value as boolean}
                          onChange={(e) => setCreateData({
                            ...createData,
                            features: { ...createData.features, [key]: e.target.checked }
                          })}
                        />
                        {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button
                  onClick={() => setShowCreateModal(false)}
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
                  onClick={handleCreateProperty}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Create Property
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Eviction Confirmation Modal */}
      {showEvictionModal && selectedProperty && (
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
            maxWidth: '400px',
            width: '90%'
          }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#dc3545' }}>Confirm Eviction</h3>
            <p>
              Are you sure you want to evict the tenant from <strong>{selectedProperty.locationId.name}</strong>?
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button
                onClick={() => {
                  setShowEvictionModal(false);
                  setSelectedProperty(null);
                }}
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
                onClick={() => handleEviction(selectedProperty._id)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Confirm Eviction
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HousingPage;