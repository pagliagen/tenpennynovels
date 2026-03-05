/**
 * Terms and Conditions Page
 *
 * Legal terms of service for TenpennyNovels.
 *
 * **Content**: Terms of use, user conduct rules, content policies
 * **Reduced from**: 123 lines → 115 lines (7% reduction)
 *
 * @module pages/terms
 */

import React from 'react';
import { useRouter } from 'next/router';

import { PageLayout } from '@/components/layouts/PageLayout';
import { Button } from '@/components/Button';
import { termsBreadcrumb } from '@/utils/schemas';

/**
 * Terms and Conditions Page Component
 *
 * Displays terms of service and user conduct rules.
 *
 * @returns {JSX.Element} Terms page
 */
export default function TermsPage() {
  const router = useRouter();

  return (
    <PageLayout
      title="Termini e Condizioni - TenpennyNovels | Regolamento Servizio"
      description="Termini e condizioni d'uso di TenpennyNovels. Leggi le regole del gioco di ruolo e i diritti degli utenti. Accettazione necessaria per la registrazione."
      canonical="https://tenpennynovels.com/terms/"
      schema={termsBreadcrumb}
    >
      <div className="termsPage">
        <h2>Termini e Condizioni</h2>
        <h3>1. Accettazione dei Termini</h3>
        <p>
          Accedendo e utilizzando TenpennyNovels, accetti di essere vincolato da questi termini e condizioni d'uso.
        </p>

        <h3>2. Descrizione del Servizio</h3>
        <p>
          TenpennyNovels è una piattaforma di gioco di ruolo online ambientata nella Londra vittoriana,
          basata sul sistema di regole Call of Cthulhu. Il servizio include chat in tempo reale,
          gestione dei personaggi e contenuti narrativi collaborativi.
        </p>

        <h3>3. Registrazione e Account</h3>
        <p>
          Per utilizzare il servizio devi registrare un account fornendo informazioni accurate e complete.
          Sei responsabile della sicurezza del tuo account e password.
        </p>

        <h3>4. Condotta dell'Utente</h3>
        <p>Ti impegni a:</p>
        <ul>
          <li>Rispettare gli altri giocatori e mantenere un comportamento civile</li>
          <li>Non utilizzare linguaggio offensivo, discriminatorio o inappropriato</li>
          <li>Rimanere in personaggio durante le sessioni di gioco</li>
          <li>Rispettare le ambientazioni e le regole del gioco</li>
          <li>Non condividere contenuti illegali o inappropriati</li>
        </ul>

        <h3>5. Contenuti Generati dagli Utenti</h3>
        <p>
          I contenuti che crei (personaggi, storie, messaggi) rimangono di tua proprietà,
          ma concedi a TenpennyNovels il diritto di utilizzarli per il funzionamento del servizio.
        </p>

        <h3>6. Contenuti del Gioco</h3>
        <p>
          TenpennyNovels può contenere temi horror, violenza fittizia e elementi soprannaturali
          appropriati per l'ambientazione Call of Cthulhu. Il servizio è rivolto a utenti maggiorenni.
        </p>

        <h3>7. Moderazione</h3>
        <p>
          Ci riserviamo il diritto di moderare i contenuti, sospendere o terminare account
          che violano questi termini o compromettono l'esperienza di gioco di altri utenti.
        </p>

        <h3>8. Limitazioni di Responsabilità</h3>
        <p>
          TenpennyNovels è fornito "così com'è". Non garantiamo la disponibilità continua
          del servizio e non siamo responsabili per perdite di dati o interruzioni.
        </p>

        <h3>9. Modifiche ai Termini</h3>
        <p>
          Ci riserviamo il diritto di modificare questi termini. Le modifiche significative
          saranno comunicate agli utenti registrati.
        </p>

        <h3>10. Contatti</h3>
        <p>
          Per domande sui termini di servizio, contattaci all'indirizzo: support@tenpennynovels.com
        </p>

        <p><small>Ultimo aggiornamento: Marzo 2026</small></p>
      </div>

      <div className="actionsRow">
        <Button
          type="button"
          variant="primary"
          onClick={() => window.close()}
          className="loginButton"
        >
          Chiudi
        </Button>

        <div className="secondaryActions">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push('/privacy')}
            className="secondaryButton"
          >
            Privacy Policy
          </Button>
        </div>
      </div>
    </PageLayout>
  );
}
