/**
 * Credits Page
 *
 * Credits and acknowledgments for TenpennyNovels.
 *
 * **Content**: Development team, technologies, resources, acknowledgments
 * **Reduced from**: 101 lines → 95 lines (6% reduction)
 *
 * @module pages/credits
 */

import React from 'react';

import { PageLayout } from '@/components/layouts/PageLayout';
import { creditsBreadcrumb } from '@/utils/schemas';

/**
 * Credits Page Component
 *
 * Displays development credits and acknowledgments.
 *
 * @returns {JSX.Element} Credits page
 */
export default function CreditsPage() {
  return (
    <PageLayout
      title="Crediti e Ringraziamenti - TenpennyNovels"
      description="Crediti e ringraziamenti di TenpennyNovels. Scopri il team di sviluppo e le fonti di ispirazione per il nostro gioco di ruolo vittoriano."
      canonical="https://tenpennynovels.com/credits/"
      schema={creditsBreadcrumb}
    >
      <div className="loginForm">
        <div className="formFields">
          <div style={{ textAlign: 'left', lineHeight: '1.6' }}>
            <h1 style={{ color: '#d4af37', marginBottom: '2rem', fontSize: '2.5rem' }}>
              Crediti
            </h1>
            <h3 style={{ color: '#d4af37', marginBottom: '1rem' }}>Sviluppo</h3>
            <p style={{ marginBottom: '0.5rem', color: 'rgba(255, 255, 255, 0.9)' }}>
              <strong>Game Design & Development:</strong> TenpennyNovels Team
            </p>
            <p style={{ marginBottom: '1.5rem', color: 'rgba(255, 255, 255, 0.9)' }}>
              <strong>Engine:</strong> Next.js, Node.js, MongoDB, Redis
            </p>

            <h3 style={{ color: '#d4af37', marginBottom: '1rem' }}>Sistema di Gioco</h3>
            <p style={{ marginBottom: '0.5rem', color: 'rgba(255, 255, 255, 0.9)' }}>
              <strong>Regolamento Base:</strong> Call of Cthulhu RPG System
            </p>
            <p style={{ marginBottom: '1.5rem', color: 'rgba(255, 255, 255, 0.9)' }}>
              <strong>Ambientazione:</strong> Londra Vittoriana (1890s)
            </p>

            <h3 style={{ color: '#d4af37', marginBottom: '1rem' }}>Tecnologie</h3>
            <p style={{ marginBottom: '0.5rem', color: 'rgba(255, 255, 255, 0.9)' }}>
              <strong>Frontend:</strong> React, Next.js, TypeScript, SCSS
            </p>
            <p style={{ marginBottom: '0.5rem', color: 'rgba(255, 255, 255, 0.9)' }}>
              <strong>Backend:</strong> Node.js, Express, MongoDB, Redis
            </p>
            <p style={{ marginBottom: '0.5rem', color: 'rgba(255, 255, 255, 0.9)' }}>
              <strong>Real-time:</strong> Socket.io WebSockets
            </p>

            <h3 style={{ color: '#d4af37', marginBottom: '1rem' }}>Risorse</h3>
            <p style={{ marginBottom: '0.5rem', color: 'rgba(255, 255, 255, 0.9)' }}>
              <strong>Immagini di Background:</strong> Victorian Era Historical Archives
            </p>
            <p style={{ marginBottom: '0.5rem', color: 'rgba(255, 255, 255, 0.9)' }}>
              <strong>Fonts:</strong> Google Fonts, Victorian Typography
            </p>
            <p style={{ marginBottom: '1.5rem', color: 'rgba(255, 255, 255, 0.9)' }}>
              <strong>Icone:</strong> Lucide React Icons
            </p>

            <h3 style={{ color: '#d4af37', marginBottom: '1rem' }}>Ringraziamenti Speciali</h3>
            <p style={{ marginBottom: '0.5rem', color: 'rgba(255, 255, 255, 0.9)' }}>
              Chaosium Inc. per il sistema Call of Cthulhu
            </p>
            <p style={{ marginBottom: '0.5rem', color: 'rgba(255, 255, 255, 0.9)' }}>
              H.P. Lovecraft per l'universo narrativo
            </p>
            <p style={{ marginBottom: '1.5rem', color: 'rgba(255, 255, 255, 0.9)' }}>
              La comunità di sviluppatori open source
            </p>

            <div style={{
              textAlign: 'center',
              marginTop: '2rem',
              paddingTop: '1rem',
              borderTop: '1px solid rgba(255, 149, 0, 0.3)'
            }}>
              <p style={{
                fontSize: '0.9rem',
                color: 'rgba(255, 149, 0, 0.8)',
                fontStyle: 'italic'
              }}>
                "In his house at R'lyeh, dead Cthulhu waits dreaming..."
              </p>
              <p style={{
                fontSize: '0.8rem',
                color: 'rgba(255, 255, 255, 0.6)',
                marginTop: '0.5rem'
              }}>
                © 2024 TenpennyNovels - Piattaforma GDR Londra Vittoriana
              </p>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
