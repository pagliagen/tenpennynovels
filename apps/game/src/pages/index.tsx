/**
 * Home Page
 *
 * - Development: pannello DebugPage (auth status, WS events live feed).
 * - Production: redirect immediato a /locations (mappa interattiva di Londra).
 *
 * @module pages/index
 */

'use client';

import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

import { DebugPage } from '@/components/debug/DebugPage';
import { GameLayout } from '@/components/layout/GameLayout';

const IS_DEV = process.env.NODE_ENV === 'development';

export default function HomePage(): JSX.Element {
  const router = useRouter();

  useEffect(() => {
    if (!IS_DEV) {
      router.replace('/locations');
    }
  }, [router]);

  return (
    <>
      <Head>
        <title>Ten Penny Novels | Gioco di Ruolo Vittoriano Online</title>
        <meta
          name="description"
          content="Gioca a Ten Penny Novels, GDR online ambientato nella Londra Vittoriana del 1890. Sistema Call of Cthulhu con narrazione investigativa in tempo reale."
        />
      </Head>

      <GameLayout>
        {IS_DEV ? <DebugPage /> : null}
      </GameLayout>
    </>
  );
}
