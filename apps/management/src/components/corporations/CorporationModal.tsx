import React, { useState, useEffect } from 'react';
import { Modal } from '../shared/Modal';
import { FormField } from '../shared/FormComponents';
import { Corporation, CreateCorporationData, UpdateCorporationData, corporationAPI, handleApiError } from '../../lib/api';

interface CorporationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (corporation: Corporation) => void;
  corporation?: Corporation | null; // null for create, Corporation for edit
}

const CorporationModal: React.FC<CorporationModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  corporation = null
}) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'guild' as const,
    membershipType: 'manual' as const,
    isRecruiting: true,
    maxMembers: 50
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const isEditMode = corporation !== null;
  const modalTitle = isEditMode ? 'Edit Corporation' : 'Create New Corporation';

  // Initialize form data when corporation changes
  useEffect(() => {
    if (corporation) {
      setFormData({
        name: corporation.name || '',
        description: corporation.description || '',
        type: (corporation.type as any) || 'guild',
        membershipType: 'manual', // Default since it might not be in the response
        isRecruiting: true, // Default since it might not be in the response
        maxMembers: 50 // Default since it might not be in the response
      });
    } else {
      setFormData({
        name: '',
        description: '',
        type: 'guild',
        membershipType: 'manual',
        isRecruiting: true,
        maxMembers: 50
      });
    }
    setError(null);
    setValidationErrors({});
  }, [corporation]);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = 'Corporation name is required';
    } else if (formData.name.length < 3) {
      errors.name = 'Corporation name must be at least 3 characters';
    } else if (formData.name.length > 100) {
      errors.name = 'Corporation name must not exceed 100 characters';
    }

    if (!formData.description.trim()) {
      errors.description = 'Description is required';
    } else if (formData.description.length < 10) {
      errors.description = 'Description must be at least 10 characters';
    } else if (formData.description.length > 1000) {
      errors.description = 'Description must not exceed 1000 characters';
    }

    if (formData.maxMembers < 1) {
      errors.maxMembers = 'Maximum members must be at least 1';
    } else if (formData.maxMembers > 1000) {
      errors.maxMembers = 'Maximum members cannot exceed 1000';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      let result;
      if (isEditMode && corporation) {
        const updateData: UpdateCorporationData = {
          name: formData.name,
          description: formData.description,
          // Note: In edit mode, we typically don't change type, membershipType, etc.
          // Add these fields if needed based on your requirements
        };
        result = await corporationAPI.updateCorporation(corporation.id, updateData);
        
        if (result.success) {
          // Return updated corporation data
          const updatedCorporation: Corporation = {
            ...corporation,
            name: formData.name,
            description: formData.description
          };
          onSuccess(updatedCorporation);
        }
      } else {
        const createData: CreateCorporationData = formData;
        result = await corporationAPI.createCorporation(createData);
        
        if (result.success && result.data) {
          // For create, we need to construct the corporation object
          // In a real scenario, you might want to fetch the created corporation
          const newCorporation: Corporation = {
            id: result.data.corporationId,
            name: formData.name,
            description: formData.description,
            type: formData.type,
            status: 'active',
            ownerId: '', // Would be filled by backend
            ownerName: '', // Would be filled by backend  
            memberCount: 0,
            officerCount: 0,
            treasury: 0,
            createdAt: new Date().toISOString()
          };
          onSuccess(newCorporation);
        }
      }

      if (!result.success) {
        setError(handleApiError(result, 'Failed to save corporation'));
      } else {
        onClose();
      }
    } catch (error) {
      console.error('Error saving corporation:', error);
      setError(handleApiError(error, 'Failed to save corporation'));
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear validation error for this field
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const modalActions = [
    {
      label: 'Cancel',
      onClick: onClose,
      variant: 'secondary' as const,
      disabled: loading
    },
    {
      label: loading ? 'Saving...' : (isEditMode ? 'Update Corporation' : 'Create Corporation'),
      onClick: handleSubmit,
      variant: 'primary' as const,
      disabled: loading,
      loading: loading
    }
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={modalTitle}
      size="medium"
      actions={modalActions}
    >
      <div className="corporation-modal">
        {error && (
          <div className="error-message">
            <i className="icon-alert-circle"></i>
            {error}
          </div>
        )}

        <div className="form-section">
          <h4 className="form-section-title">Basic Information</h4>
          
          <FormField
            label="Corporation Name"
            required
            error={validationErrors.name}
          >
            <input
              type="text"
              className="form-input"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="Enter corporation name"
              disabled={loading}
            />
          </FormField>

          <FormField
            label="Description"
            required
            error={validationErrors.description}
          >
            <textarea
              className="form-textarea"
              rows={4}
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Describe the corporation's purpose and activities"
              disabled={loading}
            />
          </FormField>

          {!isEditMode && (
            <>
              <FormField label="Corporation Type" required>
                <select
                  className="form-select"
                  value={formData.type}
                  onChange={(e) => handleInputChange('type', e.target.value)}
                  disabled={loading}
                >
                  <option value="guild">Guild</option>
                  <option value="professional_association">Professional Association</option>
                  <option value="social_club">Social Club</option>
                  <option value="government_body">Government Body</option>
                  <option value="criminal_organization">Criminal Organization</option>
                </select>
              </FormField>

              <FormField label="Membership Type" required>
                <select
                  className="form-select"
                  value={formData.membershipType}
                  onChange={(e) => handleInputChange('membershipType', e.target.value)}
                  disabled={loading}
                >
                  <option value="manual">Manual Approval</option>
                  <option value="automatic">Automatic</option>
                  <option value="mixed">Mixed</option>
                </select>
              </FormField>

              <div className="form-row">
                <FormField
                  label="Maximum Members"
                  required
                  error={validationErrors.maxMembers}
                >
                  <input
                    type="number"
                    className="form-input"
                    min="1"
                    max="1000"
                    value={formData.maxMembers}
                    onChange={(e) => handleInputChange('maxMembers', parseInt(e.target.value) || 0)}
                    disabled={loading}
                  />
                </FormField>

                <FormField label="Recruiting Status">
                  <label className="checkbox-wrapper">
                    <input
                      type="checkbox"
                      checked={formData.isRecruiting}
                      onChange={(e) => handleInputChange('isRecruiting', e.target.checked)}
                      disabled={loading}
                    />
                    <span className="checkbox-label">Currently recruiting new members</span>
                  </label>
                </FormField>
              </div>
            </>
          )}
        </div>

        {isEditMode && (
          <div className="form-note">
            <i className="icon-info"></i>
            <span>Corporation type, membership settings, and member limits can only be changed through advanced settings.</span>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default CorporationModal;