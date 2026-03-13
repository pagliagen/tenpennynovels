/**
 * Bacheca (Forum) Catch-All Page
 *
 * Handles all /bacheca/* routes.
 * The forum UI is rendered as a fullscreen modal overlay via ForumModal,
 * which auto-opens when this page is active.
 *
 * @module pages/bacheca/[[...slug]]
 * @since 2.0.0
 */

'use client';

import { useEffect } from 'react';
import Head from 'next/head';
import { GameLayout } from '@/components/layout/GameLayout';
import { useForumStore } from '@/store/forumStore';

export default function BachecaPage(): JSX.Element {
  const openForum = useForumStore((s) => s.openForum);
  const syncWithUrl = useForumStore((s) => s.syncWithUrl);

  useEffect(() => {
    syncWithUrl();
    if (!useForumStore.getState().isOpen) openForum();
  }, [syncWithUrl, openForum]);

  return (
    <>
      <Head>
        <title>Bacheca - Ten Penny Novels</title>
        <meta name="description" content="La bacheca della community di Ten Penny Novels" />
      </Head>
      <GameLayout>
        <div />
      </GameLayout>
    </>
  );
}
