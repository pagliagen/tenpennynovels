import React from 'react';
import { useRouter } from 'next/router';
import { GetStaticProps } from 'next';

import { PageLayout } from '@/components/layouts/PageLayout';
import { Button } from '@/components/Button';
import { creditsBreadcrumb } from '@/utils/schemas';

export default function CreditsPage() {
  const router = useRouter();

  return (
    <PageLayout
      title="Ten Penny Novels | Crediti e Ringraziamenti"
      description="Crediti e ringraziamenti di Ten Penny Novels. Scopri il team di sviluppo e le fonti di ispirazione per il nostro gioco di ruolo vittoriano."
      canonical="https://tenpennynovels.com/credits/"
      schema={creditsBreadcrumb}
    >
      <div className="crediti-page">
        <h2>Crediti</h2>
        <h4>Sviluppo</h4>
        <p>
          <strong>Game Design & Development:</strong> Ten Penny Novels Team
        </p>
        <p>
          <strong>Engine:</strong> Next.js, Node.js, MongoDB, Redis
        </p>

        <h4>Sistema di Gioco</h4>
        <p>
          <strong>Regolamento Base:</strong> Call of Cthulhu RPG System
        </p>
        <p>
          <strong>Ambientazione:</strong> Londra Vittoriana (1890s)
        </p>

        <h4>Tecnologie</h4>
        <p>
          <strong>Frontend:</strong> React, Next.js, TypeScript, SCSS
        </p>
        <p>
          <strong>Backend:</strong> Node.js, Express, MongoDB, Redis
        </p>
        <p>
          <strong>Real-time:</strong> Socket.io WebSockets
        </p>

        <h4>Risorse</h4>
        <p>
          <strong>Immagini di Background:</strong> Victorian Era Historical Archives
        </p>
        <p>
          <strong>Fonts:</strong> Google Fonts, Victorian Typography
        </p>
        <p>
          <strong>Icone:</strong> Lucide React Icons
        </p>

        <h4>Ringraziamenti Speciali</h4>
        <p>
          Chaosium Inc. per il sistema Call of Cthulhu
        </p>
        <p>
          H.P. Lovecraft per l'universo narrativo
        </p>
        <p>
          La comunità di sviluppatori open source
        </p>

        <div className="crediti-page__footer">
          <p>
            "In his house at R'lyeh, dead Cthulhu waits dreaming..."
          </p>
          <p>
            © 2026 Ten Penny Novels - Piattaforma GDR Londra Vittoriana
          </p>
        </div> 
      </div>
    </PageLayout>
  );
}

/**
 * Static Site Generation
 *
 * Credits page is fully static content (no dynamic data).
 * Pre-rendered at build time for optimal SEO and performance.
 */
export const getStaticProps: GetStaticProps = async () => {
  return {
    props: {},
    revalidate: false  // Truly static - no revalidation needed
  };
};
