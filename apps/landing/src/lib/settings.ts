const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface DeleteAccountData {
  password: string;
  confirmText: string;
  reason?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  code?: string;
  timestamp: string;
}

export class SettingsService {
  /**
   * Export all user data as JSON file download
   */
  static async exportData(): Promise<void> {
    try {
      const response = await fetch(`${API_URL}/auth/profile/export`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Export failed');
      }

      // Get the JSON data
      const blob = await response.blob();

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tenpennynovels-data-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();

      // Cleanup
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Data export error:', error);
      throw error;
    }
  }

  /**
   * Delete user account with anonymization
   */
  static async deleteAccount(data: DeleteAccountData): Promise<ApiResponse> {
    try {
      const response = await fetch(`${API_URL}/auth/profile/delete`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Delete account error:', error);
      throw error;
    }
  }
}
