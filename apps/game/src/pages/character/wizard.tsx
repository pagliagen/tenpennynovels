/**
 * Character Wizard Page
 *
 * Full-page character creation wizard (6 steps).
 * Accessible only with game:character:wizard (draft characters).
 * Non-draft characters use character sheet (handled in Sidebar).
 *
 * **Flow**:
 * 1. Basic Info (name, age, appearance, etc.)
 * 2. Occupation (choose occupation, select skills)
 * 3. Stats (allocate 400 points)
 * 4. Skills (allocate 200+INT/2 points)
 * 5. Background (9 structured questions)
 * 6. Review (summary + submit for approval)
 *
 * **No Persistence**: Wizard state is session-only (lost on refresh).
 * Expected completion time: 15-30 minutes.
 *
 * @module pages/character/wizard
 * @since 2.0.0
 */

import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useAuthStore } from '@/store/authStore';
import { WizardContainer } from '@/components/character/wizard/WizardContainer';
import { GameLayout } from '@/components/layout/GameLayout';

/**
 * Character Wizard Page Component
 *
 * Renders the full character creation wizard.
 * Redirects if no game:character:wizard permission (draft only).
 *
 * @returns Character wizard page
 */
export default function CharacterWizardPage() {
  const router = useRouter();
  const { selectedCharacter, isAuthenticated, hasGamePermission } = useAuthStore();

  /**
   * Guard: Redirect if not authenticated, no character, or no wizard permission
   */
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/login');
      return;
    }

    if (!selectedCharacter) {
      router.push('/characters');
      return;
    }

    if (!hasGamePermission('game:character:wizard')) {
      router.push('/game');
      return;
    }
  }, [isAuthenticated, selectedCharacter, hasGamePermission, router]);

  // Show loading while checking auth/character/permission
  if (!isAuthenticated || !selectedCharacter || !hasGamePermission('game:character:wizard')) {
    return (
      <>
        <Head>
          <title>Creazione Personaggio - TenPennyNovels</title>
          <meta name="description" content="Crea il tuo personaggio vittoriano per TenPennyNovels. Sistema Call of Cthulhu con background dettagliato e skills personalizzabili." />
        </Head>
        <GameLayout>
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#e8d4a0',
              fontFamily: '"Playfair Display", serif',
              fontSize: '1.2rem',
            }}
          >
            Caricamento wizard...
          </div>
        </GameLayout>
      </>
    );
  }

  // Wizard page
  return (
    <>
      <Head>
        <title>Creazione Personaggio - TenPennyNovels</title>
        <meta name="description" content="Crea il tuo personaggio vittoriano per TenPennyNovels. Sistema Call of Cthulhu con background dettagliato e skills personalizzabili." />
      </Head>
      <GameLayout>
        <WizardContainer characterId={selectedCharacter._id} />
      </GameLayout>
    </>
  );
}
