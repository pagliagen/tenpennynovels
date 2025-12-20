import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { ManagementLayout } from '@/components/ManagementLayout';
import { DataTable, Column } from '@/components/shared/DataTable';
import { Modal } from '@/components/shared/Modal';
import { Input, Textarea } from '@/components/shared/FormComponents';
import { AuthContext } from '@/lib/auth';
import { useAuditLogger } from '@/hooks/useAuditLogger';
import styles from '@/styles/pages/CharacterApproval.module.scss';

const API_GATEWAY_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'https://api.tenpennynovels.com';
 
interface Character {
  id: string;
  characterName: string;
  characterSurname: string;
  userId: string;
  username: string;
  occupation: string;
  socialClass: string;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  submittedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  rejectionReason?: string;
  stats: {
    str: number;
    dex: number;
    int: number;
    con: number;
    app: number;
    pow: number;
    siz: number;
    edu: number;
  };
  skills: Record<string, number>;
  backstory: string;
  notes?: string;
}

interface CharacterApprovalProps {
  authContext: AuthContext;
}

export default function CharacterApproval({ authContext }: CharacterApprovalProps) {
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [approvalModal, setApprovalModal] = useState(false);
  const [rejectionModal, setRejectionModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [charactersData, setCharactersData] = useState<Character[]>([]);
  
  // Audit logging hook
  const auditLogger = useAuditLogger();

  // Mock data - in real implementation, fetch from API
  useEffect(() => {
    const mockCharacters: Character[] = [
      {
        id: '1',
        characterName: 'Margaret',
        characterSurname: 'Whitmore',
        userId: 'user1',
        username: 'PlayerOne',
        occupation: 'Antiquaria',
        socialClass: 'Media Borghesia',
        status: 'PENDING_APPROVAL',
        submittedAt: new Date('2025-01-08'),
        stats: { str: 50, dex: 65, int: 80, con: 55, app: 70, pow: 60, siz: 45, edu: 75 },
        skills: { Library: 60, History: 55, Occult: 40 },
        backstory: 'Margaret Whitmore è cresciuta in una famiglia di antiquari...'
      },
      {
        id: '2', 
        characterName: 'Theodore',
        characterSurname: 'Blackwood',
        userId: 'user2',
        username: 'VictorianGent',
        occupation: 'Medico',
        socialClass: 'Alta Borghesia',
        status: 'APPROVED',
        submittedAt: new Date('2025-01-07'),
        reviewedAt: new Date('2025-01-07'),
        reviewedBy: 'master1',
        stats: { str: 55, dex: 60, int: 85, con: 65, app: 60, pow: 55, siz: 70, edu: 90 },
        skills: { Medicine: 80, Biology: 65, Psychology: 50 },
        backstory: 'Theodore è un medico rispettato di Harley Street...',
        notes: 'Personaggio ben costruito, approvato senza modifiche.'
      }
    ];
    setCharactersData(mockCharacters);
    
    // Log page access
    auditLogger.logPageAccess('characters/approval', {
      totalPendingCharacters: mockCharacters.filter(c => c.status === 'PENDING_APPROVAL').length
    });
  }, [auditLogger]);

  const handleApprove = async (character: Character) => {
    setSelectedCharacter(character);
    setApprovalModal(true);
  };

  const handleReject = async (character: Character) => {
    setSelectedCharacter(character);
    setRejectionModal(true);
  };

  const confirmApproval = async () => {
    if (!selectedCharacter) return;
    
    setLoading(true);
    try {
      const response = await fetch(`${API_GATEWAY_URL}/admin/characters/${selectedCharacter.id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          notes: reviewNotes
        })
      });

      if (response.ok) {
        // Log successful approval
        auditLogger.logCharacterApproval(
          selectedCharacter.id,
          `${selectedCharacter.characterName} ${selectedCharacter.characterSurname}`,
          'approve',
          reviewNotes
        );

        // Update local state
        setCharactersData(prev => 
          prev.map(char => 
            char.id === selectedCharacter.id 
              ? { ...char, status: 'APPROVED', reviewedAt: new Date(), notes: reviewNotes }
              : char
          )
        );
        
        // Close modal
        setApprovalModal(false);
        setSelectedCharacter(null);
        setReviewNotes('');
      } else {
        // Log failed approval
        auditLogger.logError(
          'character.approve', 
          'characters', 
          {
            characterId: selectedCharacter.id,
            characterName: `${selectedCharacter.characterName} ${selectedCharacter.characterSurname}`,
            notes: reviewNotes
          },
          `HTTP ${response.status}: ${response.statusText}`
        );
        console.error('Failed to approve character');
      }
    } catch (error) {
      // Log network/system error
      auditLogger.logError(
        'character.approve',
        'characters',
        {
          characterId: selectedCharacter.id,
          characterName: `${selectedCharacter.characterName} ${selectedCharacter.characterSurname}`,
          notes: reviewNotes
        },
        error instanceof Error ? error.message : 'Network error'
      );
      console.error('Error approving character:', error);
    } finally {
      setLoading(false);
    }
  };

  const confirmRejection = async () => {
    if (!selectedCharacter || !rejectionReason.trim()) return;
    
    setLoading(true);
    try {
      const response = await fetch(`${API_GATEWAY_URL}/admin/characters/${selectedCharacter.id}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          reason: rejectionReason,
          notes: reviewNotes
        })
      });

      if (response.ok) {
        // Log successful rejection
        auditLogger.logCharacterApproval(
          selectedCharacter.id,
          `${selectedCharacter.characterName} ${selectedCharacter.characterSurname}`,
          'reject',
          `${rejectionReason} | ${reviewNotes}`
        );

        // Update local state
        setCharactersData(prev => 
          prev.map(char => 
            char.id === selectedCharacter.id 
              ? { 
                  ...char, 
                  status: 'REJECTED', 
                  reviewedAt: new Date(), 
                  rejectionReason,
                  notes: reviewNotes 
                }
              : char
          )
        );
        
        // Close modal
        setRejectionModal(false);
        setSelectedCharacter(null);
        setRejectionReason('');
        setReviewNotes('');
      } else {
        // Log failed rejection
        auditLogger.logError(
          'character.reject',
          'characters',
          {
            characterId: selectedCharacter.id,
            characterName: `${selectedCharacter.characterName} ${selectedCharacter.characterSurname}`,
            reason: rejectionReason,
            notes: reviewNotes
          },
          `HTTP ${response.status}: ${response.statusText}`
        );
        console.error('Failed to reject character');
      }
    } catch (error) {
      // Log network/system error
      auditLogger.logError(
        'character.reject',
        'characters',
        {
          characterId: selectedCharacter.id,
          characterName: `${selectedCharacter.characterName} ${selectedCharacter.characterSurname}`,
          reason: rejectionReason,
          notes: reviewNotes
        },
        error instanceof Error ? error.message : 'Network error'
      );
      console.error('Error rejecting character:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      DRAFT: { label: 'Bozza', className: styles.statusDraft },
      PENDING_APPROVAL: { label: 'In Attesa', className: styles.statusPending },
      APPROVED: { label: 'Approvato', className: styles.statusApproved },
      REJECTED: { label: 'Respinto', className: styles.statusRejected }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.DRAFT;
    
    return (
      <span className={`${styles.statusBadge} ${config.className}`}>
        {config.label}
      </span>
    );
  };

  const formatDate = (date: Date | string | undefined) => {
    if (!date) return '-';
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const calculateTotalStats = (stats: Character['stats']) => {
    return Object.values(stats).reduce((sum, stat) => sum + stat, 0);
  };

  const columns: Column<Character>[] = [
    {
      key: 'characterName',
      label: 'Personaggio',
      sortable: true,
      filterable: true,
      render: (_, character) => (
        <div className={styles.characterInfo}>
          <div className={styles.characterName}>
            {character.characterName} {character.characterSurname}
          </div>
          <div className={styles.characterMeta}>
            {character.occupation} - {character.socialClass}
          </div>
        </div>
      )
    },
    {
      key: 'username',
      label: 'Giocatore',
      sortable: true,
      filterable: true,
      render: (value) => (
        <div className={styles.playerName}>{value}</div>
      )
    },
    {
      key: 'status',
      label: 'Stato',
      sortable: true,
      render: (value) => getStatusBadge(value)
    },
    {
      key: 'submittedAt',
      label: 'Inviato',
      sortable: true,
      render: (value) => formatDate(value)
    },
    {
      key: 'stats',
      label: 'Statistiche',
      render: (_, character) => (
        <div className={styles.statsPreview}>
          <span className={styles.statTotal}>
            Tot: {calculateTotalStats(character.stats)}
          </span>
          <div className={styles.statBreakdown}>
            STR:{character.stats.str} DEX:{character.stats.dex} INT:{character.stats.int}
          </div>
        </div>
      )
    }
  ];

  const actions = [
    {
      label: 'Visualizza',
      icon: '👁️',
      onClick: (character: Character) => setSelectedCharacter(character),
      visible: () => true,
      className: styles.viewAction
    },
    {
      label: 'Approva',
      icon: '✅',
      onClick: handleApprove,
      visible: (character: Character) => character.status === 'PENDING_APPROVAL',
      className: styles.approveAction
    },
    {
      label: 'Respingi',
      icon: '❌',
      onClick: handleReject,
      visible: (character: Character) => character.status === 'PENDING_APPROVAL',
      className: styles.rejectAction
    }
  ];

  const pendingCharacters = charactersData.filter(char => char.status === 'PENDING_APPROVAL');

  return (
    <ManagementLayout authContext={authContext}>
      <Head>
        <title>TenpennyNovels Management - Approvazione Personaggi</title>
      </Head>
      
      <div className={styles.approvalPage}>
        <div className={styles.pageHeader}>
          <div className={styles.headerContent}>
            <h1 className={styles.pageTitle}>
              <span className={styles.titleIcon}>✅</span>
              Approvazione Personaggi
            </h1>
            <p className={styles.pageDescription}>
              Revisiona e approva le schede personaggio inviate dai giocatori
            </p>
          </div>
          
          {pendingCharacters.length > 0 && (
            <div className={styles.pendingAlert}>
              <span className={styles.alertIcon}>⚠️</span>
              {pendingCharacters.length} personaggio{pendingCharacters.length !== 1 ? 'i' : ''} in attesa di approvazione
            </div>
          )}
        </div>

        <div className={styles.tableContainer}>
          <DataTable
            data={charactersData}
            columns={columns}
            actions={actions}
            searchable
            pagination={{
              page: 1,
              pageSize: 25,
              total: charactersData.length,
              onPageChange: () => {},
              onPageSizeChange: () => {}
            }}
          />
        </div>

        {/* Character Detail Modal */}
        {selectedCharacter && !approvalModal && !rejectionModal && (
          <Modal
            isOpen={true}
            onClose={() => setSelectedCharacter(null)}
            title={`${selectedCharacter.characterName} ${selectedCharacter.characterSurname}`}
            size="large"
          >
            <div className={styles.characterDetail}>
              <div className={styles.detailSection}>
                <h3>Informazioni Base</h3>
                <div className={styles.infoGrid}>
                  <div><strong>Nome:</strong> {selectedCharacter.characterName}</div>
                  <div><strong>Cognome:</strong> {selectedCharacter.characterSurname}</div>
                  <div><strong>Giocatore:</strong> {selectedCharacter.username}</div>
                  <div><strong>Occupazione:</strong> {selectedCharacter.occupation}</div>
                  <div><strong>Classe Sociale:</strong> {selectedCharacter.socialClass}</div>
                  <div><strong>Stato:</strong> {getStatusBadge(selectedCharacter.status)}</div>
                </div>
              </div>

              <div className={styles.detailSection}>
                <h3>Statistiche</h3>
                <div className={styles.statsGrid}>
                  <div className={styles.statItem}>
                    <span className={styles.statLabel}>STR:</span>
                    <span className={styles.statValue}>{selectedCharacter.stats.str}</span>
                  </div>
                  <div className={styles.statItem}>
                    <span className={styles.statLabel}>DEX:</span>
                    <span className={styles.statValue}>{selectedCharacter.stats.dex}</span>
                  </div>
                  <div className={styles.statItem}>
                    <span className={styles.statLabel}>INT:</span>
                    <span className={styles.statValue}>{selectedCharacter.stats.int}</span>
                  </div>
                  <div className={styles.statItem}>
                    <span className={styles.statLabel}>CON:</span>
                    <span className={styles.statValue}>{selectedCharacter.stats.con}</span>
                  </div>
                  <div className={styles.statItem}>
                    <span className={styles.statLabel}>APP:</span>
                    <span className={styles.statValue}>{selectedCharacter.stats.app}</span>
                  </div>
                  <div className={styles.statItem}>
                    <span className={styles.statLabel}>POW:</span>
                    <span className={styles.statValue}>{selectedCharacter.stats.pow}</span>
                  </div>
                  <div className={styles.statItem}>
                    <span className={styles.statLabel}>SIZ:</span>
                    <span className={styles.statValue}>{selectedCharacter.stats.siz}</span>
                  </div>
                  <div className={styles.statItem}>
                    <span className={styles.statLabel}>EDU:</span>
                    <span className={styles.statValue}>{selectedCharacter.stats.edu}</span>
                  </div>
                </div>
                <div className={styles.statTotal}>
                  <strong>Totale: {calculateTotalStats(selectedCharacter.stats)} / 400</strong>
                </div>
              </div>

              <div className={styles.detailSection}>
                <h3>Background</h3>
                <div className={styles.backstory}>
                  {selectedCharacter.backstory || 'Nessun background fornito'}
                </div>
              </div>

              {selectedCharacter.notes && (
                <div className={styles.detailSection}>
                  <h3>Note di Revisione</h3>
                  <div className={styles.notes}>
                    {selectedCharacter.notes}
                  </div>
                </div>
              )}

              {selectedCharacter.rejectionReason && (
                <div className={styles.detailSection}>
                  <h3>Motivo Respinta</h3>
                  <div className={styles.rejectionReason}>
                    {selectedCharacter.rejectionReason}
                  </div>
                </div>
              )}
            </div>
          </Modal>
        )}

        {/* Approval Modal */}
        <Modal
          isOpen={approvalModal}
          onClose={() => setApprovalModal(false)}
          title="Approva Personaggio"
          actions={[
            {
              label: 'Annulla',
              onClick: () => setApprovalModal(false),
              variant: 'secondary'
            },
            {
              label: 'Approva',
              onClick: confirmApproval,
              variant: 'primary',
              loading,
              disabled: loading
            }
          ]}
        >
          <div className={styles.approvalForm}>
            <p>
              Stai per approvare il personaggio <strong>{selectedCharacter?.characterName} {selectedCharacter?.characterSurname}</strong>.
            </p>
            <p>
              Una volta approvato, il giocatore potrà iniziare a giocare con questo personaggio.
            </p>
            
            <Textarea
              label="Note per il giocatore (opzionale)"
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder="Aggiungi eventuali note o commenti per il giocatore..."
              rows={4}
              fullWidth
            />
          </div>
        </Modal>

        {/* Rejection Modal */}
        <Modal
          isOpen={rejectionModal}
          onClose={() => setRejectionModal(false)}
          title="Respingi Personaggio"
          actions={[
            {
              label: 'Annulla',
              onClick: () => setRejectionModal(false),
              variant: 'secondary'
            },
            {
              label: 'Respingi',
              onClick: confirmRejection,
              variant: 'danger',
              loading,
              disabled: loading || !rejectionReason.trim()
            }
          ]}
        >
          <div className={styles.rejectionForm}>
            <p>
              Stai per respingere il personaggio <strong>{selectedCharacter?.characterName} {selectedCharacter?.characterSurname}</strong>.
            </p>
            
            <Textarea
              label="Motivo della respinta *"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Spiega al giocatore perché il personaggio è stato respinto..."
              rows={4}
              required
              fullWidth
              error={!rejectionReason.trim() ? 'Campo obbligatorio' : undefined}
            />
            
            <Textarea
              label="Note aggiuntive (opzionale)"
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder="Suggerimenti per migliorare il personaggio..."
              rows={3}
              fullWidth
            />
          </div>
        </Modal>
      </div>
    </ManagementLayout>
  );
}

// Note: Authentication is now handled client-side via the ManagementLayout component
// No server-side props needed since we use API-based auth checking