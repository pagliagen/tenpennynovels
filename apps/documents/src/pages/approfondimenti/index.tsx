/**
 * Approfondimenti Section Index Page
 *
 * Lists all approfondimenti documents with grouping.
 * Uses ISR for performance and SEO.
 *
 * @module pages/approfondimenti/index
 * @since 1.0.0
 */

import { GetStaticProps } from 'next';
import Link from 'next/link';
import { SEO } from '@/components/SEO';
import { documentsApi } from '@/lib/api/documents';
import { useSimpleDocumentGroups } from '@/hooks/useDocumentGroups';
import type { Document } from '@/types/document';
import styles from '@/styles/pages/DocumentList.module.scss';

interface ApprofondimentiIndexProps {
  documents: Document[];
}

export default function ApprofondimentiIndex({ documents }: ApprofondimentiIndexProps) {
  const groups = useSimpleDocumentGroups(documents);

  return (
    <>
      <SEO
        title="Approfondimenti"
        description="Guide dettagliate e approfondimenti su specifici argomenti del mondo di Ten Penny Novels - medicina vittoriana, armi, criminalità e società."
        ogType="website"
      />

      <div className={styles.page}>
        <header className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>📚 Approfondimenti</h1>
          <p className={styles.pageDescription}>
            Guide dettagliate e approfondimenti su argomenti specifici: medicina, armi, tecnologie e
            società vittoriana.
          </p>
        </header>

        {groups.length === 0 ? (
          <div className={styles.emptyState}>
            <p>Nessun approfondimento disponibile al momento.</p>
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
                      href={`/approfondimenti/${doc.path}`}
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
    const documents = await documentsApi.list({ type: 'approfondimenti' });

    return {
      props: {
        documents,
      },
      revalidate: 3600, // Revalidate every hour
    };
  } catch (error) {
    console.error('[Approfondimenti Index] Error fetching documents:', error);

    return {
      props: {
        documents: [],
      },
      revalidate: 60, // Retry after 1 minute on error
    };
  }
};
