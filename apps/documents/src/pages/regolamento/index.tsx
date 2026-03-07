/**
 * Regolamento Section Index Page
 *
 * Lists all regolamento documents grouped by subtype.
 * Uses ISR for performance and SEO.
 *
 * @module pages/regolamento/index
 * @since 2.0.0
 */

import { GetStaticProps } from 'next';
import Link from 'next/link';
import { SEO } from '@/components/SEO';
import { documentsApi } from '@/lib/api/documents';
import type { DocumentSubtype } from '@/types/document';
import styles from '@/styles/pages/DocumentList.module.scss';

interface RegolamentoIndexProps {
  subtypes: DocumentSubtype[];
}

export default function RegolamentoIndex({ subtypes }: RegolamentoIndexProps) {
  return (
    <>
      <SEO
        title="Regolamento"
        description="Regolamento di gioco per Ten Penny Novels - Regole Call of Cthulhu, meccaniche e linee guida per il roleplay vittoriano."
        ogType="website"
      />

      <div className={styles.page}>
        <header className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Regolamento</h1>
          <p className={styles.pageDescription}>
            Consulta il regolamento di Ten Penny Novels: regole di gioco, meccaniche e linee guida per una
            corretta esperienza di roleplay.
          </p>
        </header>

        {subtypes.length === 0 ? (
          <div className={styles.emptyState}>
            <p>Nessun documento di regolamento disponibile al momento.</p>
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
                      href={`/regolamento/${doc.path}`}
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
    const subtypes = hierarchical.regolamento || [];

    return {
      props: { subtypes },
      revalidate: 3600,
    };
  } catch (error) {
    console.error('[Regolamento Index] Error fetching documents:', error);
    return {
      props: { subtypes: [] },
      revalidate: 60,
    };
  }
};
