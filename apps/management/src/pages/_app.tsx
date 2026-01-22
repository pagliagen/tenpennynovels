import type { AppProps } from 'next/app';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Head from 'next/head';
import { AuthContext } from '@/lib/auth';
import { AuthProvider } from '@/contexts/AuthContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { PromptModal } from '@/components/PromptModal';
import '@/styles/globals.scss';

const API_GATEWAY_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'https://api.tenpennynovels.com';

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const [authContext, setAuthContext] = useState<AuthContext>({
    isAuthenticated: false,
    user: null,
    character: null,
    availableCharacters: [],
    isLoading: true,
  });
  const [isClient, setIsClient] = useState(false);

  // Set client flag after hydration
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Update auth context when component mounts or route changes
  useEffect(() => {
    // Skip if we're on the server or before client hydration
    if (typeof window === 'undefined' || !isClient) {
      return;
    }

    // console.log('🔄 Auth useEffect triggered, pathname:', router.pathname);

    const updateAuthContext = async () => {
      try {
        // console.log('🌐 Making API call to /admin/me (cookies are HttpOnly, skipping JS parsing)...');

        // Check for characterId in URL params
        const urlParams = new URLSearchParams(window.location.search);
        const characterId = urlParams.get('characterId');
        
        // Build the API endpoint with characterId if present
        const endpoint = characterId ? `/admin/me?characterId=${characterId}` : '/admin/me';

        // Skip cookie parsing - cookies are HttpOnly, go straight to API call
        const response = await fetch(`${API_GATEWAY_URL}${endpoint}`, {
          credentials: 'include'
        });

        // console.log('📡 API response:', response.status, response.statusText);

        if (response.ok) {
          const data = await response.json();
          // console.log('✅ API success:', data);
          if (data.success && data.data) {
            const newAuthContext = {
              ...data.data,
              isLoading: false
            };
            // console.log('🔄 Setting authContext to:', newAuthContext);
            // console.log('🔑 canAccessAdminPanel:', newAuthContext.user?.canAccessAdminPanel);
            // console.log('👤 userRoles:', newAuthContext.user?.userRoles);
            // console.log('👤 characterRoles:', newAuthContext.user?.characterRoles);
            setAuthContext(newAuthContext);
            return;
          }
        }

        // Se l'API risponde con 403 (access denied), vai ad access-denied
        if (response.status === 403) {
          // console.log('🚫 Management access denied by server');
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

        // console.log('❌ API failed or returned invalid data');
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
  }, [router.pathname, router.query, isClient]); // Add isClient to dependencies

  // Check for authentication on protected routes
  useEffect(() => {
    // Skip if not on client yet
    if (!isClient) {
      return;
    }

    // console.log('🔐 Auth check triggered');
    // console.log('📍 Current pathname:', router.pathname);
    // console.log('⏳ Is loading:', authContext.isLoading);
    // console.log('🔑 Is authenticated:', authContext.isAuthenticated);
    // console.log('👤 Has user:', !!authContext.user);
    // console.log('🚪 Can access admin panel:', authContext.user?.canAccessAdminPanel);

    if (authContext.isLoading) {
      // console.log('⏳ Still loading, skipping auth check');
      return;
    }

    const isProtectedRoute = !router.pathname.includes('/access-denied');
    // console.log('🛡️ Is protected route:', isProtectedRoute);

    if (isProtectedRoute) {
      // Se l'utente non è autenticato per niente, vai a landing
      if (!authContext.isAuthenticated) {
        // console.log('🚨 REDIRECT TO ACCESS-DENIED FROM: _app.tsx line 126 (not authenticated)');
        router.push('/access-denied');
        return;
      }

      // Se è autenticato ma non ha l'user object (quindi access denied), vai ad access-denied
      if (!authContext.user) {
        // console.log('🚫 User authenticated but no access, redirecting to access-denied');
        // console.log('🚨 REDIRECT TO ACCESS-DENIED FROM: _app.tsx line 134 (no user object)');
        router.push('/access-denied');
        return;
      }

      // console.log('✅ User has access to management panel');
    } else {
      // Se sei su access-denied ma hai l'user object (quindi hai accesso), vai alla dashboard
      if (router.pathname === '/access-denied' &&
        authContext.isAuthenticated &&
        authContext.user) {
        // console.log('🔄 User is on access-denied but has access, redirecting to dashboard');
        // console.log('🚨 REDIRECT TO DASHBOARD FROM: _app.tsx line 144 (access-denied logic)');
        router.push('/');
        return;
      }
    }
  }, [router.pathname, authContext, isClient]);

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

  return (
    <>
      <Head>
        <title>TenpennyNovels Gestione - Amministrazione GDR Londra Vittoriana</title>
        <meta name="description" content="Pannello amministrativo per il GDR TenpennyNovels ambientato nella Londra Vittoriana. Gestisci personaggi, utenti, contenuti e operazioni di sistema." />
        <meta name="keywords" content="Londra Vittoriana, GDR, Gestione, Amministrazione, TenpennyNovels, Call of Cthulhu" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex,nofollow" />

        {/* Open Graph */}
        <meta property="og:title" content="TenpennyNovels Gestione" />
        <meta property="og:description" content="Pannello amministrativo per GDR Londra Vittoriana" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="TenpennyNovels" />

        {/* Favicon */}
        <link rel="icon" href="/favicon/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/favicon/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon/favicon-16x16.png" />

        {/* Security headers */}
        <meta httpEquiv="X-Frame-Options" content={process.env.NODE_ENV === 'development' ? 'SAMEORIGIN' : 'DENY'} />
        <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
        <meta httpEquiv="Referrer-Policy" content="strict-origin-when-cross-origin" />
      </Head>

      <NotificationProvider>
        <PromptModal />
        <AuthProvider authContext={authContext}>
          <Component {...pageProps} authContext={authContext} />
        </AuthProvider>
      </NotificationProvider>
    </>
  );
}