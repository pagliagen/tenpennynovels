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
import styles from '@/styles/pages/CharacterBannedPage.module.scss';

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
        <div className={styles.card}>
          <h1 className={styles.title}>
            Restrizione sul personaggio
          </h1>
          {selectedCharacter && (
            <p className={styles.paragraphMuted}>
              Personaggio: <strong>{selectedCharacter.name}</strong>
            </p>
          )}
          <p className={styles.paragraph}>
            Non puoi accedere al mondo di gioco (mappa, location, chat in-game) con questo personaggio finché la
            restrizione è attiva.
          </p>
          {characterBan?.reason && (
            <div className={styles.reasonBlock}>
              <p className={styles.reasonLabel}>Motivazione indicata dallo staff</p>
              <p className={styles.reasonText}>{characterBan.reason}</p>
            </div>
          )}
          {until && (
            <p className={styles.until}>
              Fine prevista (se applicabile): <strong>{until}</strong>
            </p>
          )}
          <p className={styles.footerNote}>
            Ti abbiamo inviato un&apos;email all&apos;indirizzo associato all&apos;account con i dettagli. Se vuoi
            contattare lo staff, puoi aprire un ticket dal menu e scegliere la categoria{' '}
            <strong>Sanzione / contestazione</strong>.
          </p>
        </div>
      </GameLayout>
    </>
  );
}
