import { LoginCredentials } from '@/types/index';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL;

export interface AuthResponse {
  result: boolean;
  user?: {
    id: string;
    username: string;
    email: string;
    canAccessAdminPanel: boolean;
    multipleCharactersAllowed?: boolean;
    characters: Array<{
      id: string;
      name: string;
      status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'DELETED';
    }>;
  };
  error?: string;
  code?: string;
  details?: Record<string, string>; // Per errori di validazione dettagliati
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  agreeToTerms: boolean;
}

export interface RegisterResponse {
  result: boolean;
  message?: string;
  error?: string;
}

export class AuthService {
  /**
   * Login utente
   */
  static async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies
        body: JSON.stringify(credentials),
      });

      const data = await response.json();

      if (!response.ok || !data.result) {
        return {
          result: false,
          error: data.error || 'Errore durante il login',
          code: data.code
        };
      }

      return {
        result: true,
        user: data.data.user
      };
    } catch (error) {
      console.error('Errore login:', error);
      return {
        result: false,
        error: 'Errore di connessione'
      };
    }
  }

  /**
   * Registrazione utente
   */
  static async register(userData: RegisterData): Promise<RegisterResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(userData),
      });

      const data = await response.json();

      if (!response.ok || !data.result) {
        return {
          result: false,
          error: data.error || 'Errore durante la registrazione'
        };
      }

      return {
        result: true,
        message: data.message || 'Registrazione completata'
      };
    } catch (error) {
      console.error('Errore registrazione:', error);
      return {
        result: false,
        error: 'Errore di connessione'
      };
    }
  }

  /**
   * Logout utente
   */
  static async logout(): Promise<void> {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          logoutAllDevices: false,
          reason: 'user_logout'
        }),
      });
    } catch (error) {
      console.error('Errore logout:', error);
    }
  }

  /**
   * Verifica disponibilità username/email
   */
  static async checkAvailability(field: 'username' | 'email', value: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/register/check-availability`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ [field]: value }),
      });

      const data = await response.json();
      
      // Handle the nested response structure from the API
      if (data.result && data.data && data.data.availability) {
        return data.data.availability[field]?.available || false;
      }
      
      // Fallback for direct boolean response
      return data.available || false;
    } catch (error) {
      console.error('Errore verifica disponibilità:', error);
      return false;
    }
  }

  /**
   * Ottieni profilo utente corrente
   */
  static async getProfile(): Promise<AuthResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/profile`, {
        method: 'GET',
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok || !data.result) {
        return {
          result: false,
          error: data.error || 'Errore durante il recupero del profilo'
        };
      }

      return {
        result: true,
        user: data.data.user
      };
    } catch (error) {
      console.error('Errore profilo:', error);
      return {
        result: false,
        error: 'Errore di connessione'
      };
    }
  }

  /**
   * Reinvia email di verifica
   */
  static async resendVerification(username: string): Promise<RegisterResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/resend-verification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ username }),
      });

      const data = await response.json();

      if (!response.ok || !data.result) {
        return {
          result: false,
          error: data.error || 'Errore durante il reinvio della verifica'
        };
      }

      return {
        result: true,
        message: data.message || 'Email di verifica inviata'
      };
    } catch (error) {
      console.error('Errore resend verification:', error);
      return {
        result: false,
        error: 'Errore di connessione'
      };
    }
  }

  /**
   * Password dimenticata
   */
  static async forgotPassword(identifier: string): Promise<RegisterResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ identifier }),
      });

      const data = await response.json();

      if (!response.ok || !data.result) {
        return {
          result: false,
          error: data.error || 'Errore durante il reset password'
        };
      }

      return {
        result: true,
        message: data.message || 'Email di reset inviata'
      };
    } catch (error) {
      console.error('Errore reset password:', error);
      return {
        result: false,
        error: 'Errore di connessione'
      };
    }
  }

  /**
   * Ottieni sessioni attive
   */
  static async getSessions(): Promise<any[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/security/sessions`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return data.list || [];
    } catch (error) {
      console.error('Errore sessioni:', error);
      return [];
    }
  }

  /**
   * Termina sessione specifica
   */
  static async terminateSession(sessionId: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/security/sessions/${sessionId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      return response.ok;
    } catch (error) {
      console.error('Errore terminazione sessione:', error);
      return false;
    }
  }

  /**
   * Creazione personaggio
   */
  static async createCharacter(characterData: {
    name: string;
    occupation?: string;
    age?: number;
    description?: string;
    background?: string;
  }): Promise<AuthResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/create-character`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(characterData),
      });

      const data = await response.json();

      if (!response.ok || !data.result) {
        return {
          result: false,
          error: data.error || 'Errore durante la creazione del personaggio',
          code: data.code,
          details: data.details // ← Passa i dettagli di validazione
        };
      }

      return {
        result: true,
        user: data.data.character
      };
    } catch (error) {
      console.error('Errore creazione personaggio:', error);
      return {
        result: false,
        error: 'Errore di connessione'
      };
    }
  }

  /**
   * Selezione personaggio
   */
  static async selectCharacter(characterId: string): Promise<AuthResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/select-character`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ characterId }),
      });

      const data = await response.json();

      if (!response.ok || !data.result) {
        return {
          result: false,
          error: data.error || 'Errore durante la selezione del personaggio'
        };
      }

      return {
        result: true,
        user: data.data.character
      };
    } catch (error) {
      console.error('Errore selezione personaggio:', error);
      return {
        result: false,
        error: 'Errore di connessione'
      };
    }
  }
}