/**
 * Privacy Policy Page
 *
 * GDPR-compliant privacy policy for TenpennyNovels.
 *
 * **Content**: Data collection, usage, GDPR rights, contact information
 * **Reduced from**: 189 lines → 180 lines (5% reduction)
 *
 * @module pages/privacy
 */

import React from 'react';
import { useRouter } from 'next/router';

import { PageLayout } from '@/components/layouts/PageLayout';
import { Button } from '@/components/Button';
import { privacyBreadcrumb } from '@/utils/schemas';

/**
 * Privacy Policy Page Component
 *
 * Displays GDPR-compliant privacy policy.
 *
 * @returns {JSX.Element} Privacy page
 */
export default function PrivacyPage() {
  const router = useRouter();

  return (
    <PageLayout
      title="Privacy Policy - TenpennyNovels | Protezione Dati GDPR"
      description="Informativa sulla privacy di TenpennyNovels. Come trattiamo i tuoi dati personali in conformità al GDPR. Leggi la nostra politica sulla protezione dei dati."
      canonical="https://tenpennynovels.com/privacy/"
      schema={privacyBreadcrumb}
    >
      <div className="loginForm">
        <div className="formFields">
          <div className="termsContent">
            <h1 style={{ color: '#d4af37', marginBottom: '2rem', fontSize: '2.5rem' }}>
              Privacy Policy
            </h1>
            <h2>1. Informazioni che Raccogliamo</h2>

            <h3>Informazioni dell'Account</h3>
            <p>
              Raccogliamo le informazioni fornite durante la registrazione: username, email, password (criptata).
            </p>

            <h3>Dati di Gioco</h3>
            <p>
              Memorizziamo i dati relativi ai tuoi personaggi, messaggi di chat, progressi di gioco
              e interazioni con altri giocatori per fornire l'esperienza di gioco.
            </p>

            <h3>Dati Tecnici</h3>
            <p>
              Raccogliamo automaticamente informazioni tecniche come indirizzo IP, tipo di browser,
              e dati di utilizzo per migliorare il servizio e garantire la sicurezza.
            </p>

            <h2>2. Come Utilizziamo le Tue Informazioni</h2>
            <ul>
              <li>Fornire e mantenere il servizio di gioco</li>
              <li>Gestire il tuo account e l'autenticazione</li>
              <li>Facilitare le interazioni con altri giocatori</li>
              <li>Migliorare l'esperienza utente e le funzionalità</li>
              <li>Comunicare aggiornamenti importanti sul servizio</li>
              <li>Prevenire abusi e garantire la sicurezza della piattaforma</li>
            </ul>

            <h2>3. Condivisione delle Informazioni</h2>
            <p>
              Non vendiamo né condividiamo le tue informazioni personali con terze parti,
              eccetto nei seguenti casi:
            </p>
            <ul>
              <li>Con il tuo consenso esplicito</li>
              <li>Per rispettare obblighi legali</li>
              <li>Per proteggere i diritti e la sicurezza di TenpennyNovels e degli utenti</li>
              <li>Con fornitori di servizi tecnici che operano per nostro conto (server, sicurezza)</li>
            </ul>

            <h2>4. Conservazione dei Dati</h2>
            <p>
              Conserviamo le tue informazioni per il tempo necessario a fornire il servizio
              e rispettare gli obblighi legali. I dati di gioco possono essere conservati
              più a lungo per mantenere la continuità narrativa.
            </p>

            <h2>5. Sicurezza</h2>
            <p>
              Implementiamo misure di sicurezza appropriate per proteggere le tue informazioni
              da accesso non autorizzato, alterazione, divulgazione o distruzione.
              Tuttavia, nessuna trasmissione su Internet è completamente sicura.
            </p>

            <h2>6. Cookie e Tecnologie Simili</h2>
            <p>
              Utilizziamo cookie essenziali per il funzionamento del servizio (sessioni,
              autenticazione). Non utilizziamo cookie di tracciamento pubblicitario.
            </p>

            <h2>7. I Tuoi Diritti GDPR</h2>
            <p>In conformità con il Regolamento Generale sulla Protezione dei Dati (GDPR), hai il diritto di:</p>
            <ul>
              <li><strong>Accesso</strong>: Accedere alle tue informazioni personali</li>
              <li><strong>Rettifica</strong>: Correggere informazioni inesatte o incomplete</li>
              <li><strong>Cancellazione</strong>: Richiedere la cancellazione del tuo account ("diritto all'oblio")</li>
              <li><strong>Portabilità</strong>: Esportare i tuoi dati di gioco in formato JSON</li>
              <li><strong>Opposizione</strong>: Opporti al trattamento dei tuoi dati in specifiche circostanze</li>
              <li><strong>Limitazione</strong>: Richiedere la limitazione del trattamento dei tuoi dati</li>
            </ul>

            <h3>Come Esercitare i Tuoi Diritti</h3>
            <p>
              Puoi esercitare i tuoi diritti GDPR direttamente dalla piattaforma o contattandoci:
            </p>
            <ul>
              <li>
                <strong>Esportare i tuoi dati</strong>: Accedi al pannello "Utilità" nella game app
                (icona ingranaggio in alto a destra), vai alla sezione "Account", e clicca su "Esporta Dati".
                Riceverai un file JSON completo con tutti i tuoi dati.
              </li>
              <li>
                <strong>Eliminare il tuo account</strong>: Nel pannello "Utilità" della game app,
                sezione "Account", puoi richiedere l'eliminazione permanente. Riceverai un'email di conferma
                con un link valido per 24 ore. L'eliminazione comporta l'anonimizzazione completa dei tuoi dati
                personali e l'eliminazione definitiva dei tuoi personaggi.
              </li>
              <li>
                <strong>Modificare le preferenze email</strong>: Nel pannello "Utilità", sezione "Impostazioni",
                puoi gestire le tue preferenze di ricezione email e notifiche.
              </li>
              <li>
                <strong>Altre richieste</strong>: Per accesso, rettifica, opposizione o limitazione,
                contatta <strong>privacy@tenpennynovels.com</strong> specificando chiaramente la tua richiesta.
              </li>
            </ul>

            <h3>Tempi di Risposta</h3>
            <p>
              Risponderemo alle tue richieste GDPR entro 30 giorni dal ricevimento.
              In casi complessi, potremmo richiedere un'estensione di ulteriori 30 giorni,
              di cui ti informeremo tempestivamente.
            </p>

            <h2>8. Minori</h2>
            <p>
              TenpennyNovels non è destinato a minori di 18 anni. Non raccogliamo
              consapevolmente informazioni personali da minori.
            </p>

            <h2>9. Modifiche alla Privacy Policy</h2>
            <p>
              Potremmo aggiornare questa privacy policy. Le modifiche significative
              saranno comunicate tramite email o notifica sulla piattaforma.
            </p>

            <h2>10. Contatti</h2>
            <p>
              Per domande sulla privacy o per esercitare i tuoi diritti, contattaci a:
              privacy@tenpennynovels.com
            </p>

            <h2>11. Trasferimenti Internazionali</h2>
            <p>
              I tuoi dati potrebbero essere trasferiti e elaborati in paesi diversi da quello di residenza.
              Garantiamo adeguate misure di protezione per tali trasferimenti.
            </p>

            <p><small>Ultimo aggiornamento: Dicembre 2025</small></p>
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
                onClick={() => router.push('/terms')}
                className="secondaryButton"
              >
                Termini e Condizioni
              </Button>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
