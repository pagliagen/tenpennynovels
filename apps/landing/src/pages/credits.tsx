import React from 'react';
import Head from 'next/head';
import { VictorianLayout } from '@/components/VictorianLayout';


export default function CreditsPage() {
  return (
    <>
      <Head>
        <title>TenpennyNovels Londra vittoriana - Crediti</title>
        <meta name="description" content="Crediti e riconoscimenti per TenpennyNovels" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon/favicon.ico" />
      </Head>

      <VictorianLayout subtitle="Crediti">
        <div className="loginForm">
          <div className="formFields">
            <div style={{ textAlign: 'left', lineHeight: '1.6' }}>
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
                <strong>Frontend:</strong> React, Next.js, TypeScript, Tailwind CSS
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
      </VictorianLayout>
    </>
  );
}