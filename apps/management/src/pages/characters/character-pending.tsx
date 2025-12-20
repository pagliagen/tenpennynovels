import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { ManagementLayout } from '@/components/ManagementLayout';
import { ConfigurableDataTable } from '@/components/shared/ConfigurableDataTable';
import { CharacterReviewPanel } from '@/components/character/CharacterReviewPanel';
import { AuthContext } from '@/lib/auth';
import { characterAPI } from '@/lib/api';
import { logCharacterAction } from '@/lib/auditLogger';
import { useTableConfig } from '@/hooks/useTableConfig';
import styles from '@/styles/pages/UserManagement.module.scss';

// Character pending approval interface
interface PendingCharacter {
  id: string;
  characterName: string;
  characterSurname: string;
  userId: string;
  username: string;
  email: string;
  occupation: string;
  socialClass: string;
  status: string;
  createdAt: string;
  submittedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  gameplayRoles: string[];
  stats?: any;
  skills?: any;
  equipment?: any[];
}

interface CharacterPendingProps {
  authContext: AuthContext;
}

export default function CharacterPending({ authContext }: CharacterPendingProps) {
  const router = useRouter();
  const [characters, setCharacters] = useState<PendingCharacter[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentCharacterId, setCurrentCharacterId] = useState<string | null>(null);
  const [reviewPanelOpen, setReviewPanelOpen] = useState(false);
  const [panelLoading, setPanelLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCharacters, setSelectedCharacters] = useState<PendingCharacter[]>([]);

  // Pagination state
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 25,
    total: 0
  });

  // Table configuration
  const { 
    config: tableConfig, 
    getNestedValue, 
    columnVisibility,
    toggleColumnVisibility,
    resetColumnVisibility,
    resolveConditionalValue,
    interpolateTemplate
  } = useTableConfig('character-pending-approval-list');

  // Check if current user can access this page (canAccessAdminPanel + master/amministratore/gestore roles)
  const canAccessAdminPanel = authContext?.user?.canAccessAdminPanel;
  const userRoles = authContext?.user?.userRoles || [];
  const characterRoles = authContext?.user?.characterRoles || [];
  
  // Can access if: has admin panel access AND (is gestore OR has master/amministratore character role)
  const canAccessPage = canAccessAdminPanel && (
    userRoles.includes('gestore') ||
    characterRoles.includes('master') ||
    characterRoles.includes('amministratore')
  );

  useEffect(() => { 
    // Don't do anything if auth is still loading
    if (authContext?.isLoading) {
      return;
    }
    
    if (!canAccessPage) {
      router.push('/access-denied');
      return;
    }
    loadCharacters();
  }, [canAccessPage, authContext?.isLoading]);

  // Status badge renderer (same as character-list.tsx)
  const getStatusBadge = (status: string) => {
    const statusConfig = {
      DRAFT: { label: 'Bozza', className: styles.statusDraft },
      PENDING_APPROVAL: { label: 'In Attesa', className: styles.statusPending },
      APPROVED: { label: 'Approvato', className: styles.statusApproved },
      REJECTED: { label: 'Respinto', className: styles.statusRejected },
      DELETED: { label: 'Eliminato', className: styles.statusDeleted }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.DRAFT;
    
    return (
      <span className={`${styles.statusBadge} ${config.className}`}>
        {config.label}
      </span>
    );
  };

  const loadCharacters = async () => {
    try {
      setLoading(true);
      
      const response = await characterAPI.getCharactersPendingApproval({
        page: 1,
        pageSize: 100,
        sortBy: 'submittedAt',
        sortOrder: 'desc'
      });
      
      if (response.success && response.data) {
        setCharacters((response.data as any).characters || []);
      } else {
        setError('Failed to load pending characters');
      }
    } catch (err) {
      console.error('Exception loading pending characters:', err);
      setError('Error loading pending characters');
    } finally {
      setLoading(false);
    }
  };

  // Open character review panel
  const openReviewPanel = (character: PendingCharacter) => {
    setCurrentCharacterId(character.id);
    setReviewPanelOpen(true);
  };

  // Handle table actions from configuration
  const handleAction = (actionKey: string, character: PendingCharacter) => {
    switch (actionKey) {
      case 'view_character':
        openReviewPanel(character);
        break;
      default:
        console.warn(`Unknown action: ${actionKey}`);
    }
  };

  // Handle bulk actions
  const handleBulkAction = (actionKey: string, characters: PendingCharacter[]) => {
    switch (actionKey) {
      default:
        console.warn(`Unknown bulk action: ${actionKey}`);
    }
  };

  // Handle cell clicks
  const handleCellClick = (character: PendingCharacter, columnKey: string, value: any) => {
    // Handle cell click interactions if needed
  };

  // Pagination handlers
  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
    // In a real implementation, you would fetch data for the new page
  };

  const handlePageSizeChange = (newSize: number) => {
    setPagination(prev => ({ ...prev, pageSize: newSize, page: 1 }));
    // In a real implementation, you would fetch data with new page size
  };

  // Custom renderers for ConfigurableDataTable (same pattern as character-list.tsx)
  const customRenderers = {
    characterInfo: (_: any, character: PendingCharacter) => (
      <div className={styles.characterInfo}>
        <div className={styles.characterName}>
          {character.characterName} {character.characterSurname}
        </div>
        <div className={styles.characterMeta}>
          {character.occupation} - {character.socialClass}
        </div>
      </div>
    ),
    statusBadge: (value: any) => getStatusBadge(value),
    dateInfo: (value: any) => {
      if (!value) return '-';
      const dateObj = typeof value === 'string' ? new Date(value) : value;
      return dateObj.toLocaleDateString('it-IT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  };

  // Send off-game notification message after successful review
  const sendReviewNotificationMessage = async (characterId: string, action: 'approve' | 'reject', note: string) => {
    try {
      const character = characters.find(c => c.id === characterId);
      if (!character) return;

      const messageContent = action === 'approve' 
        ? `🎉 **PERSONAGGIO APPROVATO** 🎉

Caro giocatore,

abbiamo verificato il tuo personaggio **"${character.characterName}"** ed è stato ufficialmente **APPROVATO**!

✅ Ora puoi iniziare a giocare e divertirti nella Londra vittoriana
✅ Il tuo personaggio è pronto per le avventure
✅ Benvenuto/a nel mondo di TenpennyNovels!

${note ? `**Nota dello Staff:**\n${note}\n\n` : ''}Buon gioco! 🎭`
        : `📝 **PERSONAGGIO DA RIVEDERE** 📝

Caro giocatore,

abbiamo esaminato il tuo personaggio **"${character.characterName}"** ma purtroppo deve essere rivisto prima dell'approvazione.

**Motivo del rifiuto:**
${note}

**Cosa fare ora:**
• Accedi al tuo account e modifica il personaggio
• Correggi i punti indicati sopra
• Sottoponi nuovamente il personaggio per l'approvazione

💬 Se hai domande o dubbi, rispondi pure a questo messaggio - siamo qui per aiutarti!

Grazie per la comprensione! 🎭`;

      const API_GATEWAY_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'https://api.tenpennynovels.com';

      // Create direct chat first
      const chatResponse = await fetch(`${API_GATEWAY_URL}/game/offgame-chats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Include cookies for authentication
        body: JSON.stringify({
          type: 'direct',
          participants: [characterId]
        })
      });

      if (!chatResponse.ok) {
        throw new Error('Failed to create chat');
      }

      const chatResult = await chatResponse.json();
      if (!chatResult.success) {
        throw new Error(`Chat creation failed: ${chatResult.error}`);
      }

      // Send the message
      const messageResponse = await fetch(`${API_GATEWAY_URL}/game/offgame-chats/${chatResult.data._id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Include cookies for authentication
        body: JSON.stringify({
          content: messageContent
        })
      });

      if (!messageResponse.ok) {
        throw new Error('Failed to send message');
      }

      const messageResult = await messageResponse.json();
      if (!messageResult.success) {
        throw new Error(`Message send failed: ${messageResult.error}`);
      }

      console.log('Review notification sent successfully');
    } catch (error) {
      console.error('Failed to send review notification:', error);
      // Don't block the UI for notification failures
    }
  };

  // Handle character review panel actions
  const handlePanelAction = async (actionKey: string, formData: Record<string, any> = {}) => {
    if (!currentCharacterId) return;

    try {
      setPanelLoading(true);
      
      switch (actionKey) {
        case 'approve_character':
          const approveResponse = await characterAPI.submitCharacterReview(currentCharacterId, {
            action: 'approve',
            note: formData.feedback || 'Character approved'
          });
          
          if (approveResponse.success) {
            logCharacterAction.approve({
              targetCharacterId: currentCharacterId,
              targetCharacterName: characters.find(c => c.id === currentCharacterId)?.characterName || 'Unknown',
              feedback: formData.feedback || 'Character approved'
            });

            // Send off-game notification message
            await sendReviewNotificationMessage(currentCharacterId, 'approve', formData.feedback || '');

            // Remove from local state since it's no longer pending
            setCharacters(prev => prev.filter(char => char.id !== currentCharacterId));
            setReviewPanelOpen(false);
            setCurrentCharacterId(null);
          } else {
            setError(approveResponse.error || 'Failed to approve character');
          }
          break;

        case 'reject_character':
          if (!formData.feedback || formData.feedback.trim().length === 0) {
            setError('Feedback is required when rejecting a character');
            return;
          }

          const rejectResponse = await characterAPI.submitCharacterReview(currentCharacterId, {
            action: 'reject',
            note: formData.feedback
          });
          
          if (rejectResponse.success) {
            logCharacterAction.reject({
              targetCharacterId: currentCharacterId,
              targetCharacterName: characters.find(c => c.id === currentCharacterId)?.characterName || 'Unknown',
              feedback: formData.feedback
            });

            // Send off-game notification message
            await sendReviewNotificationMessage(currentCharacterId, 'reject', formData.feedback);

            // Remove from local state since it's no longer pending
            setCharacters(prev => prev.filter(char => char.id !== currentCharacterId));
            setReviewPanelOpen(false);
            setCurrentCharacterId(null);
          } else {
            setError(rejectResponse.error || 'Failed to reject character');
          }
          break;

        case 'cancel':
          setReviewPanelOpen(false);
          setCurrentCharacterId(null);
          break;
        default:
          console.warn(`Unknown panel action: ${actionKey}`);
      }
    } catch (err) {
      setError('Error processing character review');
      console.error('Error processing character review:', err);
    } finally {
      setPanelLoading(false);
    }
  };

  if (!canAccessPage) {
    return null; // Will redirect in useEffect
  }

  return (
    <>
      <Head>
        <title>TenpennyNovels Management - Character Pending Approval</title>
      </Head>

      <ManagementLayout authContext={authContext}>
        <div className={styles.pageContainer}>
          <div className={styles.pageHeader}>
            <h1>Personaggi in Attesa di Approvazione</h1>
            <p>Revisiona e approva o respingi le proposte di personaggio</p>
          </div>

          {error && (
            <div className={styles.errorAlert}>
              {error}
              <button onClick={() => setError(null)}>×</button>
            </div>
          )}

          <ConfigurableDataTable
            tableName="character-pending-approval-list"
            data={characters}
            loading={loading}
            selectedItems={selectedCharacters}
            onSelectionChange={setSelectedCharacters}
            onAction={handleAction}
            onBulkAction={handleBulkAction}
            onCellClick={handleCellClick}
            pagination={pagination ? {
              page: pagination.page,
              pageSize: pagination.pageSize,
              total: pagination.total,
              onPageChange: handlePageChange,
              onPageSizeChange: handlePageSizeChange
            } : undefined}
            className={styles.usersTable}
            externalConfig={tableConfig ? {
              config: tableConfig,
              loading: false,
              error: null,
              visibleColumns: tableConfig.columns.filter(col => {
                if (col.alwaysVisible) return true;
                return columnVisibility[col.key] ?? col.defaultVisible;
              }),
              getNestedValue,
              resolveConditionalValue,
              interpolateTemplate,
              customRenderers
            } : undefined}
          />
        </div>

        {/* Character Review Panel */}
        <CharacterReviewPanel
          characterId={currentCharacterId || ''}
          profile="character-pending"
          isOpen={reviewPanelOpen}
          onClose={() => {
            setReviewPanelOpen(false);
            setCurrentCharacterId(null);
          }}
          onAction={handlePanelAction}
          loading={panelLoading}
          error={error}
        />
      </ManagementLayout>
    </>
  );
}

