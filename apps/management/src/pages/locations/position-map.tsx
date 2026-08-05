/**
 * Position Map Page
 *
 * Editor drag & drop per posizionare i marker di distretti e sottoquartieri
 * sopra l'immagine della mappa di Londra. Le posizioni vengono lette/scritte
 * da Location.mapPosition su DB (niente più coordinate hardcodate lato game).
 */

import Head from 'next/head';
import { ManagementLayout } from '@/components/layout/ManagementLayout';
import { LocationMapEditor } from '@/components/locations/LocationMapEditor';
import { useLocationHierarchy } from '@/hooks/api/useLocations';
import styles from '@/styles/pages/LocationList.module.scss';

export default function PositionMapPage() {
  const { data: hierarchy, isLoading, error } = useLocationHierarchy();

  if (error) {
    return (
      <ManagementLayout>
        <div className={styles.errorContainer}>
          <h2>Errore nel caricamento location</h2>
          <p>{error instanceof Error ? error.message : 'Errore sconosciuto'}</p>
          <button onClick={() => window.location.reload()}>Riprova</button>
        </div>
      </ManagementLayout>
    );
  }

  return (
    <ManagementLayout>
      <Head>
        <title>Ten Penny Novels | Posiziona Mappa</title>
      </Head>

      <div className={styles.locationList}>
        <header className={styles.header}>
          <div>
            <h1>Posiziona Mappa</h1>
            <p>Trascina i marker dei distretti e dei sottoquartieri sopra la mappa di Londra</p>
          </div>
        </header>

        {isLoading ? (
          <div className={styles.loading}>Caricamento...</div>
        ) : (
          <LocationMapEditor tree={hierarchy?.tree ?? []} />
        )}
      </div>
    </ManagementLayout>
  );
}
