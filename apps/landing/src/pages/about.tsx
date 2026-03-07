/**
 * About Page
 *
 * Information page about TenPennyNovels platform.
 *
 * **Content**: Platform description, game mechanics, setting, community
 * **SEO-optimized**: Rich keywords for Victorian RPG, Call of Cthulhu, online gaming
 *
 * @module pages/about
 */

import React from 'react';

import { PageLayout } from '@/components/layouts/PageLayout';
import { aboutBreadcrumb } from '@/utils/schemas';

/**
 * About Page Component
 *
 * Displays information about TenPennyNovels platform.
 *
 * @returns {JSX.Element} About page
 */
export default function AboutPage() {
  return (
    <PageLayout
      title="Chi Siamo - Ten Penny Novels | Gioco di Ruolo Londra Vittoriana"
      description="Ten Penny Novels è un gioco di ruolo online gratuito ambientato nella Londra Vittoriana del 1890. Sistema Call of Cthulhu via chat con narrazione investigativa horror lovecraftiana. Scopri come funziona il nostro GDR collaborativo!"
      canonical="https://tenpennynovels.com/about/"
      schema={aboutBreadcrumb}
    >
      <div className="creditsPage">
        <h2>Chi Siamo</h2>

        <h3>Cos'è Ten Penny Novels?</h3>
        <p>
          <strong>Ten Penny Novels</strong> è una piattaforma di <strong>gioco di ruolo online gratuito</strong> ambientata nella
          suggestiva <strong>Londra Vittoriana degli anni 1890</strong>. Basato sul celebre sistema{' '}
          <strong>Call of Cthulhu</strong>, offre un'esperienza GDR investigativa unica interamente via chat.
        </p>
        <p>
          Il nostro progetto nasce dalla passione per il <strong>gioco di ruolo narrativo</strong>, il{' '}
          <strong>genere horror lovecraftiano</strong> e l'atmosfera affascinante dell'<strong>epoca vittoriana</strong>.
          Combiniamo questi elementi per creare un'esperienza di gioco coinvolgente, accessibile e completamente gratuita.
        </p>

        <h3>Ambientazione: Londra Vittoriana 1890</h3>
        <p>
          Il gioco si svolge nella <strong>Londra del 1890</strong>, durante il culmine dell'<strong>era vittoriana</strong>.
          Le nebbiose strade di Londra nascondono misteri oscuri, creature lovecraftiane e segreti indicibili.
        </p>
        <p>
          I giocatori esplorano location storiche come <strong>Whitechapel</strong>, <strong>Westminster</strong>,{' '}
          <strong>Soho</strong> e i <strong>Docks</strong> del Tamigi, interagendo con altri personaggi e investigando
          eventi soprannaturali in stile <strong>Agatha Christie</strong> con un tocco di <strong>H.P. Lovecraft</strong>.
        </p>

        <h3>Sistema di Gioco: Call of Cthulhu</h3>
        <p>
          Ten Penny Novels utilizza il sistema di regole <strong>Call of Cthulhu</strong>, uno dei più celebri
          GDR investigativi al mondo. Il sistema enfatizza:
        </p>
        <ul>
          <li><strong>Narrazione investigativa</strong>: Risolvi misteri, raccogli indizi, interroga testimoni</li>
          <li><strong>Sanità mentale</strong>: Affronta orrori cosmici che mettono alla prova la tua lucidità</li>
          <li><strong>Competenze realistiche</strong>: Oltre 60 abilità vittoriane (Medicina, Occultismo, Persuasione, ecc.)</li>
          <li><strong>Combattimento letale</strong>: Gli scontri sono pericolosi - l'astuzia conta più della forza bruta</li>
        </ul>

        <h3>Come Funziona</h3>
        <h4>Chat in Tempo Reale</h4>
        <p>
          Il gioco si svolge interamente tramite <strong>chat testuale in tempo reale</strong>. Nessun download,
          nessun client da installare: basta un browser web moderno.
        </p>
        <p>
          Ogni <strong>location</strong> (pub, strade, edifici) ha una propria chat dove i giocatori possono
          interagire in personaggio, esplorare ambienti e scoprire segreti.
        </p>

        <h4>Creazione Personaggio</h4>
        <p>
          Crea il tuo <strong>personaggio vittoriano</strong> personalizzato: scegli professione, background,
          caratteristiche fisiche e psicologiche. Ogni personaggio ha statistiche uniche, abilità specializzate
          e una storia da raccontare.
        </p>
        <p>
          Le professioni disponibili includono: <strong>Detective</strong>, <strong>Medico</strong>,{' '}
          <strong>Giornalista</strong>, <strong>Occultista</strong>, <strong>Ladro</strong>, e molte altre.
        </p>

        <h4>Gioco Collaborativo</h4>
        <p>
          Ten Penny Novels è un'esperienza <strong>multiplayer collaborativa</strong>. Interagisci con decine di
          altri giocatori, forma alleanze, condividi informazioni, e affronta insieme minacce soprannaturali.
        </p>
        <p>
          Il <strong>Game Master</strong> (master di gioco) guida la narrazione principale, introduce eventi
          dinamici e gestisce PNG (personaggi non giocanti) che popolano la città.
        </p>

        <h3>Caratteristiche Principali</h3>
        <ul>
          <li><strong>100% Gratuito</strong>: Nessun costo, nessun abbonamento, nessun pay-to-win</li>
          <li><strong>Browser-based</strong>: Gioca direttamente dal browser, senza download</li>
          <li><strong>Chat in tempo reale</strong>: WebSocket per comunicazione istantanea</li>
          <li><strong>Persistenza del mondo</strong>: Le tue azioni hanno conseguenze permanenti</li>
          <li><strong>Sistema economico</strong>: Guadagna denaro, compra equipaggiamento, gestisci finanze</li>
          <li><strong>Progressione personaggio</strong>: Migliora abilità, guadagna esperienza, evolvi il tuo PG</li>
          <li><strong>Quest e missioni</strong>: Storyline narrative con ricompense e conseguenze</li>
          <li><strong>Moderazione attiva</strong>: Community sicura e rispettosa</li>
        </ul>

        <h3>Tecnologia</h3>
        <p>
          Ten Penny Novels è costruito con tecnologie web moderne per garantire velocità, affidabilità e scalabilità:
        </p>
        <ul>
          <li><strong>Frontend</strong>: React, Next.js, TypeScript</li>
          <li><strong>Backend</strong>: Node.js, Express, MongoDB</li>
          <li><strong>Real-time</strong>: Socket.io WebSockets</li>
          <li><strong>Caching</strong>: Redis per performance ottimali</li>
        </ul>

        <h3>Community</h3>
        <p>
          La nostra community è composta da appassionati di <strong>giochi di ruolo</strong>,{' '}
          <strong>narrativa horror</strong>, <strong>storia vittoriana</strong> e <strong>Lovecraft</strong>.
        </p>
        <p>
          Cerchiamo giocatori che apprezzino la <strong>narrazione collaborativa</strong>, il{' '}
          <strong>roleplay immersivo</strong> e il rispetto reciproco. Non è richiesta esperienza pregressa
          con GDR - i nuovi giocatori sono sempre benvenuti!
        </p>

        <h3>Chi Può Giocare</h3>
        <p>
          Ten Penny Novels è rivolto a <strong>giocatori maggiorenni</strong> (18+) per via dei temi horror,
          violenza fittizia ed elementi soprannaturali tipici dell'universo Call of Cthulhu.
        </p>
        <p>
          Requisiti: browser web moderno (Chrome, Firefox, Safari, Edge), connessione internet stabile,
          conoscenza della lingua italiana.
        </p>

        <h3>Inizia a Giocare</h3>
        <p>
          La <strong>registrazione è gratuita</strong> e richiede meno di un minuto. Crea un account,
          costruisci il tuo personaggio vittoriano e inizia la tua avventura nelle nebbiose strade di Londra!
        </p>
        <p>
          Per maggiori informazioni consulta la nostra{' '}
          <a href="https://docs.tenpennynovels.com" target="_blank" rel="noopener noreferrer">
            documentazione ufficiale
          </a>.
        </p>

        <div className="creditsPage__footer">
          <p>
            "The oldest and strongest emotion of mankind is fear, and the oldest and strongest kind of fear is fear of the unknown."
          </p>
          <p>
            — H.P. Lovecraft
          </p>
          <p style={{ marginTop: '1rem' }}>
            © 2024 Ten Penny Novels - Piattaforma GDR Londra Vittoriana
          </p>
        </div>
      </div>
    </PageLayout>
  );
}
