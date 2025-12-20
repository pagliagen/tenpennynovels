import { useEffect, useCallback } from 'react';
import { GameApiService } from '@/lib/gameApi';

/**
 * Global authentication check hook
 * Handles periodic auth validation for all game pages
 */
export const useAuthCheck = () => {
  const checkAuth = useCallback(async () => {
    try {
      const result = await GameApiService.ping();
      
      if (!result.success || !result.valid) {
        console.warn('🔐 Global auth check failed, redirecting to landing');
        if (result.redirectTo) {
          window.location.href = result.redirectTo;
        } else {
          window.location.href = process.env.NEXT_PUBLIC_LANDING_URL || 'https://tenpennynovels.com';
        }
      }
    } catch (error) {
      console.error('🔐 Global ping check failed:', error);
    }
  }, []);

  useEffect(() => {
    console.log('🔐 Setting up global auth check - ping every 5 seconds');
    
    // Create a stable reference to avoid dependency issues
    const pingFunction = async () => {
      try {
        console.log('🔐 Sending ping request...');
        const result = await GameApiService.ping();
        console.log('🔐 Ping response:', result);
        
        if (!result.success || !result.valid) {
          console.warn('🔐 Global auth check failed, redirecting to landing');
          if (result.redirectTo) {
            window.location.href = result.redirectTo;
          } else {
            window.location.href = process.env.NEXT_PUBLIC_LANDING_URL || 'https://tenpennynovels.com';
          }
        } else {
          console.log('🔐 Ping successful, expecting WebSocket globalPresence update...');
        }
      } catch (error) {
        console.error('🔐 Global ping check failed:', error);
      }
    };
    
    // Set up ping interval every 60 seconds
    const pingInterval = setInterval(pingFunction, 15000);
    
    return () => {
      console.log('🔐 Cleaning up global auth check');
      clearInterval(pingInterval);
    };
  }, []); // Empty dependency array - only run once per component mount

  return { checkAuth };
};