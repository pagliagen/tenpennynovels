import { useRouter } from 'next/router';
import { useEffect, useState, ReactNode } from 'react';
import { AuthContext } from '@/lib/auth';

const API_GATEWAY_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'https://api.tenpennynovels.com';

interface AuthProviderProps {
  children: (authContext: AuthContext) => ReactNode;
}

export default function AuthProvider({ children }: AuthProviderProps) {
  const router = useRouter();
  const [authContext, setAuthContext] = useState<AuthContext>({
    isAuthenticated: false,
    user: null,
    character: null,
    availableCharacters: [],
    isLoading: true,
  });

  // Update auth context when component mounts or route changes
  useEffect(() => {
    const updateAuthContext = async () => {
      try {
        // Check for characterId in URL params
        const urlParams = new URLSearchParams(window.location.search);
        const characterId = urlParams.get('characterId');

        // Build the API endpoint with characterId if present
        const endpoint = characterId ? `/admin/me?characterId=${characterId}` : '/admin/me';

        // Skip cookie parsing - cookies are HttpOnly, go straight to API call
        const response = await fetch(`${API_GATEWAY_URL}${endpoint}`, {
          credentials: 'include'
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            const newAuthContext = {
              ...data.data,
              isLoading: false
            };
            setAuthContext(newAuthContext);
            return;
          }
        }

        // Se l'API risponde con 403 (access denied), vai ad access-denied
        if (response.status === 403) {
          setAuthContext({
            isAuthenticated: true,
            user: null,
            character: null,
            availableCharacters: [],
            isLoading: false
          });
          router.push('/access-denied');
          return;
        }

        // Se è un 401, l'utente non è autenticato -> redirect a landing
        if (response.status === 401) {
          router.push('/access-denied');
          return;
        }

        // Altre failure -> imposta come non autenticato
        setAuthContext({
          isAuthenticated: false,
          user: null,
          character: null,
          availableCharacters: [],
          isLoading: false
        });

      } catch (error) {
        console.error('❌ Failed to fetch auth context:', error);

        // Set unauthenticated on error
        setAuthContext({
          isAuthenticated: false,
          user: null,
          character: null,
          availableCharacters: [],
          isLoading: false
        });
      }
    };

    updateAuthContext();

    // Listen for custom auth events from other apps
    const handleAuthUpdate = () => {
      updateAuthContext();
    };

    window.addEventListener('authContextUpdate', handleAuthUpdate);

    return () => {
      window.removeEventListener('authContextUpdate', handleAuthUpdate);
    };
  }, [router.pathname, router.query]);

  // Check for authentication on protected routes
  useEffect(() => {
    if (authContext.isLoading) {
      return;
    }

    const isProtectedRoute = !router.pathname.includes('/access-denied');

    if (isProtectedRoute) {
      // Se l'utente non è autenticato per niente, vai a landing
      if (!authContext.isAuthenticated) {
        router.push('/access-denied');
        return;
      }

      // Se è autenticato ma non ha l'user object (quindi access denied), vai ad access-denied
      if (!authContext.user) {
        router.push('/access-denied');
        return;
      }
    } else {
      // Se sei su access-denied ma hai l'user object (quindi hai accesso), vai alla dashboard
      if (router.pathname === '/access-denied' &&
        authContext.isAuthenticated &&
        authContext.user) {
        router.push('/');
        return;
      }
    }
  }, [router.pathname, authContext]);

  // Show loading screen while checking authentication
  if (authContext.isLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#1a1a1a',
        color: '#e8e8e8'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid rgba(212, 175, 55, 0.3)',
            borderLeft: '4px solid #d4af37',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }}></div>
          <p>Verifica autorizzazioni...</p>
        </div>
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return <>{children(authContext)}</>;
}
