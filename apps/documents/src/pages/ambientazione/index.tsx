/**
 * Ambientazione Section Index Page
 *
 * Lists all ambientazione documents with grouping.
 * Uses ISR for performance and SEO.
 *
 * @module pages/ambientazione/index
 * @since 1.0.0
 */

import { GetStaticProps } from 'next';
import Link from 'next/link';
import { SEO } from '@/components/SEO';
import { documentsApi } from '@/lib/api/documents';
import { useSimpleDocumentGroups } from '@/hooks/useDocumentGroups';
import type { Document } from '@/types/document';
import styles from '@/styles/pages/DocumentList.module.scss';

interface AmbientazioneIndexProps {
  documents: Document[];
}

export default function AmbientazioneIndex({ documents }: AmbientazioneIndexProps) {
  const groups = useSimpleDocumentGroups(documents);

  return (
    <>
      <SEO
        title="Ambientazione"
        description="Documenti di ambientazione per TenpennyNovels - Londra vittoriana, personaggi, luoghi e storie. Esplora il mondo vittoriano del 1890."
        ogType="website"
      />

      <div className={styles.page}>
        <header className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>🌍 Ambientazione</h1>
          <p className={styles.pageDescription}>
            Esplora il mondo di TenpennyNovels: la Londra vittoriana del 1890, i suoi luoghi, personaggi e
            storie.
          </p>
        </header>

        {groups.length === 0 ? (
          <div className={styles.emptyState}>
            <p>Nessun documento di ambientazione disponibile al momento.</p>
          </div>
        ) : (
          <div className={styles.groups}>
            {groups.map((group) => (
              <section key={group.name} className={styles.group}>
                <h2 className={styles.groupTitle}>{group.name}</h2>
                <div className={styles.documentGrid}>
                  {group.documents.map((doc) => (
                    <Link
                      key={doc._id}
                      href={`/ambientazione/${doc.path}`}
                      className={styles.documentCard}
                    >
                      <h3 className={styles.documentTitle}>{doc.title}</h3>
                      {doc.description && (
                        <p className={styles.documentDescription}>{doc.description}</p>
                      )}
                      {!doc.isPublic && (
                        <span className={styles.privateBadge}>🔒 Privato</span>
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
    // Fetch documents server-side (no auth, returns only public docs)
    const documents = await documentsApi.list({ type: 'ambientazione' });

    return {
      props: {
        documents,
      },
      revalidate: 3600, // Revalidate every hour
    };
  } catch (error) {
    console.error('[Ambientazione Index] Error fetching documents:', error);

    return {
      props: {
        documents: [],
      },
      revalidate: 60, // Retry after 1 minute on error
    };
  }
};
