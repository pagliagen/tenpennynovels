import React from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { Button } from '@/components/Button';


export default function TermsPage() {
  const router = useRouter();

  return (
    <>
      <Head>
        <title>TenpennyNovels Londra vittoriana - Termini e Condizioni</title>
        <meta name="description" content="Termini e condizioni d'uso della piattaforma TenpennyNovels" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon/favicon.ico" />
      </Head>

      <div className="loginContainer">
        <div className="loginCard">
          <div className="ornateFrame">
            <div className="logoSection">
              <h1 className="gameTitle">
                Termini e
                <br />
                Condizioni
              </h1>
            </div>

            <div className="termsContent">
              <h2>1. Accettazione dei Termini</h2>
              <p>
                Accedendo e utilizzando TenpennyNovels, accetti di essere vincolato da questi termini e condizioni d'uso.
              </p>

              <h2>2. Descrizione del Servizio</h2>
              <p>
                TenpennyNovels è una piattaforma di gioco di ruolo online ambientata nella Londra vittoriana, 
                basata sul sistema di regole Call of Cthulhu. Il servizio include chat in tempo reale, 
                gestione dei personaggi e contenuti narrativi collaborativi.
              </p>

              <h2>3. Registrazione e Account</h2>
              <p>
                Per utilizzare il servizio devi registrare un account fornendo informazioni accurate e complete. 
                Sei responsabile della sicurezza del tuo account e password.
              </p>

              <h2>4. Condotta dell'Utente</h2>
              <p>Ti impegni a:</p>
              <ul>
                <li>Rispettare gli altri giocatori e mantenere un comportamento civile</li>
                <li>Non utilizzare linguaggio offensivo, discriminatorio o inappropriato</li>
                <li>Rimanere in personaggio durante le sessioni di gioco</li>
                <li>Rispettare le ambientazioni e le regole del gioco</li>
                <li>Non condividere contenuti illegali o inappropriati</li>
              </ul>

              <h2>5. Contenuti Generati dagli Utenti</h2>
              <p>
                I contenuti che crei (personaggi, storie, messaggi) rimangono di tua proprietà, 
                ma concedi a TenpennyNovels il diritto di utilizzarli per il funzionamento del servizio.
              </p>

              <h2>6. Contenuti del Gioco</h2>
              <p>
                TenpennyNovels può contenere temi horror, violenza fittizia e elementi soprannaturali 
                appropriati per l'ambientazione Call of Cthulhu. Il servizio è rivolto a utenti maggiorenni.
              </p>

              <h2>7. Moderazione</h2>
              <p>
                Ci riserviamo il diritto di moderare i contenuti, sospendere o terminare account 
                che violano questi termini o compromettono l'esperienza di gioco di altri utenti.
              </p>

              <h2>8. Limitazioni di Responsabilità</h2>
              <p>
                TenpennyNovels è fornito "così com'è". Non garantiamo la disponibilità continua 
                del servizio e non siamo responsabili per perdite di dati o interruzioni.
              </p>

              <h2>9. Modifiche ai Termini</h2>
              <p>
                Ci riserviamo il diritto di modificare questi termini. Le modifiche significative 
                saranno comunicate agli utenti registrati.
              </p>

              <h2>10. Contatti</h2>
              <p>
                Per domande sui termini di servizio, contattaci all'indirizzo: support@tenpennynovels.com
              </p>

              <p><small>Ultimo aggiornamento: Agosto 2025</small></p>
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
          </div>
        </div>
      </div>
    </>
  );
}