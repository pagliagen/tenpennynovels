/**
 * Ambientazione Section Index Page
 *
 * Lists all ambientazione documents grouped by subtype.
 * Uses ISR for performance and SEO.
 *
 * @module pages/ambientazione/index
 * @since 2.0.0
 */

import { GetStaticProps } from 'next';
import Link from 'next/link';
import { SEO } from '@/components/SEO';
import { documentsApi } from '@/lib/api/documents';
import type { DocumentSubtype } from '@/types/document';
import styles from '@/styles/pages/DocumentList.module.scss';

interface AmbientazioneIndexProps {
  subtypes: DocumentSubtype[];
}

export default function AmbientazioneIndex({ subtypes }: AmbientazioneIndexProps) {
  return (
    <>
      <SEO
        title="Ambientazione"
        description="Documenti di ambientazione per Ten Penny Novels - Londra vittoriana, personaggi, luoghi e storie. Esplora il mondo vittoriano del 1890."
        ogType="website"
      />

      <div className={styles.page}>
        <header className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Ambientazione</h1>
          <p className={styles.pageDescription}>
            Esplora il mondo di Ten Penny Novels: la Londra vittoriana del 1890, i suoi luoghi, personaggi e
            storie.
          </p>
        </header>

        {subtypes.length === 0 ? (
          <div className={styles.emptyState}>
            <p>Nessun documento di ambientazione disponibile al momento.</p>
          </div>
        ) : (
          <div className={styles.groups}>
            {subtypes.map((subtype) => (
              <section key={subtype._id} className={styles.group}>
                <h2 className={styles.groupTitle}>{subtype.title}</h2>
                <div className={styles.documentGrid}>
                  {subtype.documents.map((doc) => (
                    <Link
                      key={doc._id}
                      href={`/ambientazione/${doc.path}`}
                      className={styles.documentCard}
                    >
                      <h3 className={styles.documentTitle}>{doc.title}</h3>
                      {!doc.isPublic && (
                        <span className={styles.privateBadge}>Privato</span>
                      )}
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export const getStaticProps: GetStaticProps = async () => {
  try {
    const hierarchical = await documentsApi.listHierarchical();
    const subtypes = hierarchical.ambientazione || [];

    return {
      props: { subtypes },
      revalidate: 3600,
    };
  } catch (error) {
    console.error('[Ambientazione Index] Error fetching documents:', error);
    return {
      props: { subtypes: [] },
      revalidate: 60,
    };
  }
};
