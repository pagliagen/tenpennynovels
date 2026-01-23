// Import local Victorian theme styles
import '@/styles/globals.scss';
import type { AppProps } from 'next/app';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Head from 'next/head';
import { ForumLayout } from '@/components/ForumLayout';
import { parseAuthTokens, buildAuthContext, AuthContext } from '@/lib/auth';
 
const API_GATEWAY_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'https://api.tenpennynovels.com';

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const [authContext, setAuthContext] = useState<AuthContext>({
    isAuthenticated: false,
    tokens: {},
  });

  // Update auth context when component mounts or route changes
  useEffect(() => {
    const updateAuthContext = async () => {
      try {
        const response = await fetch(`${API_GATEWAY_URL}/forum/init`, { credentials: 'include' });
        const data = await response.json();
        
        if (data.result && data.data.authContext) {
          setAuthContext({
            ...data.data.authContext,
            tokens: parseAuthTokens() // Still include tokens for any direct API calls
          });
        } else {
          // Fallback to manual parsing if API fails
          const tokens = parseAuthTokens();
          const context = buildAuthContext(tokens);
          setAuthContext(context);
        }
      } catch (error) {
        console.error('Failed to fetch auth context from API:', error);
        // Fallback to manual parsing
        const tokens = parseAuthTokens();
        const context = buildAuthContext(tokens);
        setAuthContext(context);
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
  }, [router.pathname]);

  // Check for authentication on protected routes
  useEffect(() => {
    const isPrivateRoute = router.pathname.startsWith('/private/') || 
                          router.pathname.startsWith('/moderation/') ||
                          router.pathname.startsWith('/admin/');

    if (isPrivateRoute && !authContext.isAuthenticated) {
      // Redirect to landing page for authentication
      window.location.href = process.env.NEXT_PUBLIC_LANDING_URL || 'https://tenpennynovels.com';
      return;
    }

    // Check character requirement for private character areas
    const requiresCharacter = router.pathname.startsWith('/private/');
    if (requiresCharacter && (!authContext.character?.isApproved)) {
      router.push('/access-denied?reason=character-required');
      return;
    }

    // Check admin permissions for admin routes
    const requiresAdmin = router.pathname.startsWith('/admin/');
    if (requiresAdmin && !authContext.user?.canAccessAdminPanel) {
      router.push('/access-denied?reason=admin-required');
      return;
    }
  }, [router.pathname, authContext]);

  return (
    <>
      <Head>
        <title>TenpennyNovels Forum - Comunità GDR Londra Vittoriana</title>
        <meta name="description" content="Comunità forum per il GDR TenpennyNovels ambientato nella Londra Vittoriana. Discuti gameplay, gioco di ruolo e connettiti con altri giocatori." />
        <meta name="keywords" content="Londra Vittoriana, GDR, Call of Cthulhu, Forum, Gioco di Ruolo, TenpennyNovels" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        
        {/* Open Graph */}
        <meta property="og:title" content="TenpennyNovels Forum" />
        <meta property="og:description" content="Comunità Forum GDR Londra Vittoriana" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="TenpennyNovels" />
        
        {/* Favicon */}
        <link rel="icon" href="/favicon/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/favicon/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon/favicon-16x16.png" />
        
        {/* SEO for public topics */}
        {router.pathname === '/' && (
          <>
            <meta name="robots" content="index,follow" />
            <meta name="googlebot" content="index,follow" />
          </>
        )}
        
        {/* Block indexing for private areas */}
        {(router.pathname.startsWith('/private/') || 
          router.pathname.startsWith('/moderation/') || 
          router.pathname.startsWith('/admin/')) && (
          <>
            <meta name="robots" content="noindex,nofollow" />
            <meta name="googlebot" content="noindex,nofollow" />
          </>
        )}
      </Head>

      <ForumLayout authContext={authContext}>
        <Component {...pageProps} authContext={authContext} />
      </ForumLayout>
    </>
  );
}