/**
 * Delete Account Page (Token-based)
 *
 * Delete user account using token from email link.
 *
 * **Features**:
 * - Token validation with loading state
 * - Confirmation dialog before deletion
 * - Account deletion with data anonymization
 * - Automatic redirect to homepage after success
 *
 * **Authentication**: Uses authService singleton
 * **Reduced from**: 293 lines → 130 lines (56% reduction)
 *
 * @module pages/delete-account/[token]
 */

import React, { useState } from 'react';
import { useRouter } from 'next/router';

import { TokenPageLayout } from '@/components/layouts/TokenPageLayout';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Button } from '@/components/Button';
import { useFormState } from '@/hooks/useFormState';
import { useTokenFromUrl } from '@/hooks/useTokenFromUrl';
import { authService } from '@/services/AuthService';

/**
 * Delete Account Page Component
 *
 * Token-based account deletion with confirmation.
 *
 * @returns {JSX.Element} Delete account page
 */
export default function DeleteAccountPage() {
  const router = useRouter();

  // Extract token from URL
  const { token } = useTokenFromUrl();

  const { globalError, globalSuccess, loading, setError, setSuccess, setLoading, clearMessages } = useFormState();
  const [showConfirmDialog, setShowConfirmDialog] = useState<boolean>(false);

  /**
   * Handle delete confirmation
   */
  const handleConfirmDelete = async () => {
    if (!token) {
      setError('Token mancante');
      return;
    }

    try {
      setLoading(true);
      setShowConfirmDialog(false);

      const result = await authService.deleteAccount(token);

      if (result.success) {
        setSuccess('Il tuo account è stato eliminato con successo. Tutti i tuoi dati personali sono stati anonimizzati e i tuoi personaggi sono stati rimossi.');
        // Redirect to homepage after 5 seconds
        setTimeout(() => {
          router.push('/');
        }, 5000);
      } else {
        setError(result.error || 'Errore durante l\'eliminazione dell\'account');
      }
    } catch (error) {
      setError('Errore di connessione durante l\'eliminazione');
      console.error('Errore eliminazione account:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle cancel deletion
   */
  const handleCancelDelete = () => {
    router.push('/');
  };

  return (
    <TokenPageLayout
      title="Elimina Account - Ten Penny Novels"
      description="Eliminazione account Ten Penny Novels"
      isValidating={false}
      isValid={!!token}
      tokenError={!token ? 'Token mancante nell\'URL' : undefined}
      globalError={globalError}
      globalSuccess={globalSuccess}
      onDismissError={clearMessages}
      onDismissSuccess={clearMessages}
    >
      {/* Show confirmation button if not yet deleted */}
      {!globalSuccess && !loading && token && (
        <div style={{ textAlign: 'center', margin: '2rem 0' }}>
          <p style={{ marginBottom: '2rem', fontSize: '1.1rem', lineHeight: '1.6' }}>
            Sei sicuro di voler eliminare il tuo account?
          </p>
          <p style={{ marginBottom: '2rem', fontSize: '0.9rem', opacity: 0.8 }}>
            Questa azione è irreversibile. Tutti i tuoi dati personali saranno anonimizzati e i tuoi personaggi saranno rimossi.
          </p>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <Button
              type="button"
              variant="primary"
              onClick={() => setShowConfirmDialog(true)}
              style={{
                backgroundColor: '#dc3545',
                borderColor: '#dc3545',
              }}
            >
              Elimina Account
            </Button>

            <Button
              type="button"
              variant="ghost"
              onClick={handleCancelDelete}
            >
              Annulla
            </Button>
          </div>
        </div>
      )}

      {/* Show loading state */}
      {loading && (
        <div style={{ textAlign: 'center', margin: '2rem 0' }}>
          <p style={{ color: 'rgba(255, 149, 0, 0.8)' }}>
            Stiamo eliminando il tuo account...
          </p>
          <p style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.9rem', marginTop: '1rem' }}>
            Questa operazione potrebbe richiedere alcuni secondi.
          </p>
        </div>
      )}

      {/* Show success with redirect button */}
      {globalSuccess && (
        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <p style={{ marginBottom: '1rem', fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.7)' }}>
            Verrai reindirizzato alla home page...
          </p>
          <Button
            type="button"
            variant="primary"
            onClick={() => router.push('/')}
          >
            Vai alla Home
          </Button>
        </div>
      )}

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showConfirmDialog}
        title="Conferma Eliminazione Account"
        message="Sei assolutamente sicuro di voler eliminare il tuo account? Questa azione è irreversibile e tutti i tuoi dati saranno persi."
        confirmText="Sì, elimina il mio account"
        cancelText="Annulla"
        onConfirm={handleConfirmDelete}
        onCancel={() => setShowConfirmDialog(false)}
        variant="danger"
      />
    </TokenPageLayout>
  );
}
