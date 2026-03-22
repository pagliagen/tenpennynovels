/**
 * Pagina restrizione completa sul personaggio (ban full / legacy game_only con blocco land).
 * Il giocatore resta autenticato; può usare i ticket dalla TopBar se lo desidera.
 */

'use client';

import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

import { GameLayout } from '@/components/layout/GameLayout';
import { useAuthStore } from '@/store/authStore';

export default function CharacterBannedPage(): JSX.Element {
  const router = useRouter();
  const characterBan = useAuthStore((s) => s.characterBan);
  const selectedCharacter = useAuthStore((s) => s.selectedCharacter);

  useEffect(() => {
    if (!characterBan?.active || !characterBan.blocksLandAccess) {
      void router.replace('/');
    }
  }, [characterBan, router]);

  const until = characterBan?.bannedUntil
    ? new Date(characterBan.bannedUntil).toLocaleString('it-IT')
    : null;

  return (
    <>
      <Head>
        <title>Restrizione attiva | Ten Penny Novels</title>
      </Head>
      <GameLayout>
        <div
          style={{
            maxWidth: '36rem',
            margin: '2rem auto',
            padding: '1.5rem',
            background: 'rgba(15, 12, 10, 0.92)',
            border: '1px solid rgba(212, 175, 55, 0.35)',
            borderRadius: '8px',
            color: '#e8dcc8',
            fontFamily: 'Georgia, serif',
            lineHeight: 1.6,
          }}
        >
          <h1 style={{ margin: '0 0 1rem', fontSize: '1.35rem', color: '#d4af37' }}>
            Restrizione sul personaggio
          </h1>
          {selectedCharacter && (
            <p style={{ margin: '0 0 1rem', opacity: 0.9 }}>
              Personaggio: <strong>{selectedCharacter.name}</strong>
              {selectedCharacter.surname ? ` ${selectedCharacter.surname}` : ''}
            </p>
          )}
          <p style={{ margin: '0 0 1rem' }}>
            Non puoi accedere al mondo di gioco (mappa, location, chat in-game) con questo personaggio finché la
            restrizione è attiva.
          </p>
          {characterBan?.reason && (
            <div style={{ margin: '0 0 1rem' }}>
              <p style={{ margin: '0 0 0.35rem', fontSize: '0.85rem', opacity: 0.75 }}>Motivazione indicata dallo staff</p>
              <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{characterBan.reason}</p>
            </div>
          )}
          {until && (
            <p style={{ margin: '0 0 1rem', fontSize: '0.95rem', opacity: 0.85 }}>
              Fine prevista (se applicabile): <strong>{until}</strong>
            </p>
          )}
          <p style={{ margin: 0, fontSize: '0.95rem', opacity: 0.88 }}>
            Ti abbiamo inviato un&apos;email all&apos;indirizzo associato all&apos;account con i dettagli. Se vuoi
            contattare lo staff, puoi aprire un ticket dal menu e scegliere la categoria{' '}
            <strong>Sanzione / contestazione</strong>.
          </p>
        </div>
      </GameLayout>
    </>
  );
}
