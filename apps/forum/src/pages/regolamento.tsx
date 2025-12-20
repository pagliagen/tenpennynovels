import React from 'react';
import Head from 'next/head';
import { AuthContext, parseAuthTokens, buildAuthContext } from '@/lib/auth';
import styles from '@/styles/pages/Rules.module.scss';

interface RulesPageProps {
  authContext: AuthContext;
}

export default function RegolamentoPage({ authContext }: RulesPageProps) {
  return (
    <>
      <Head>
        <title>TenpennyNovels Forum - Regolamento</title>
        <meta name="description" content="Regolamento e linee guida per il forum di TenpennyNovels" />
        <meta name="robots" content="index,follow" />
      </Head>

      <div className="layout">
        <div className="paper">
          <h1>♦ REGOLAMENTO DEL FORUM ♦</h1>
          <p style={{textAlign: 'center', fontStyle: 'italic', marginBottom: '2rem'}}>
            Benvenuto nel forum di TenpennyNovels! Per mantenere un ambiente rispettoso e coinvolgente per tutti,
            ti chiediamo di seguire queste semplici regole.
          </p>

          <h2>Regole Generali del Forum</h2>

          <h3>1. Rispetto Reciproco</h3>
          <p>
            Tratta tutti i membri della comunità con rispetto e cortesia. Non sono tollerati insulti,
            attacchi personali, linguaggio offensivo o comportamenti discriminatori di qualsiasi tipo.
          </p>

          <h3>2. Contenuti Appropriati</h3>
          <p>
            Mantieni tutti i contenuti appropriati per un ambiente di gioco di ruolo. Evita linguaggio
            volgare eccessivo, contenuti esplicitamente sessuali o violenti non pertinenti al gioco.
          </p>

          <h3>3. Niente Spam o Flood</h3>
          <p>
            Non pubblicare messaggi ripetitivi, spam o contenuti irrilevanti. Ogni post deve contribuire
            alla discussione in modo costruttivo.
          </p>

          <h3>4. Rispetta la Privacy</h3>
          <p>
            Non condividere informazioni private di altri utenti senza il loro consenso. Mantieni
            separate le questioni personali dal gioco di ruolo.
          </p>
        </div>

        <div className="paper">

          <h2>Regole per il Roleplay</h2>

          <h3>5. Rimani nel Personaggio</h3>
          <p>
            Quando scrivi nei panni del tuo personaggio, mantieni l'atmosfera vittoriana del 1890.
            Usa le sezioni OOC (Out of Character) per discussioni non relative al gioco.
          </p>

          <h3>6. Accuratezza Storica</h3>
          <p>
            Sforzati di mantenere l'accuratezza storica quando possibile. I tuoi personaggi devono
            agire secondo i valori, conoscenze e limitazioni dell'epoca vittoriana.
          </p>

          <h3>7. Rispetta le Classi Sociali</h3>
          <p>
            Il sistema delle classi sociali vittoriane è parte integrante del gioco. Rispetta le
            dinamiche sociali dell'epoca e le limitazioni del tuo personaggio.
          </p>

          <h3>8. Niente Metagaming</h3>
          <p>
            Il tuo personaggio non può conoscere informazioni che ha appreso il giocatore ma non il
            personaggio stesso. Mantieni separate le conoscenze OOC da quelle IC (In Character).
          </p>
        </div>

        <div className="paper">

          <h2>Spoiler e Contenuti della Trama</h2>

          <h3>9. Usa i Tag Spoiler</h3>
          <p>
            Utilizza sempre i tag spoiler quando discuti elementi della trama, rivelazioni importanti
            o eventi di sessioni private che potrebbero rovinare l'esperienza ad altri giocatori.
          </p>

          <h3>10. Rispetta le Scoperte Altrui</h3>
          <p>
            Se il tuo personaggio fa una scoperta importante, condividila solo con i personaggi che
            dovrebbero logicamente venirne a conoscenza secondo la trama.
          </p>
        </div>

        <div className="paper">

          <h2>Moderazione e Conseguenze</h2>

          <h3>11. Rispetta lo Staff</h3>
          <p>
            Collabora con master, moderatori e amministratori. Le loro decisioni sono definitive.
            Se non sei d'accordo, discutine privatamente in modo costruttivo.
          </p>

          <h3>12. Segnalazioni</h3>
          <p>
            Se noti comportamenti che violano il regolamento, segnalali al team di moderazione
            utilizzando i canali appropriati invece di creare conflitti pubblici.
          </p>

          <h3>13. Conseguenze delle Violazioni</h3>
          <p>
            Le violazioni del regolamento possono comportare avvertimenti, sospensioni temporanee o,
            nei casi più gravi, l'esclusione permanente dalla comunità.
          </p>
        </div>

        <div className="paper">

          <h2>Linee Guida per una Buona Esperienza</h2>

          <h3>14. Collaborazione e Spirito di Squadra</h3>
          <p>
            Il gioco di ruolo è un'esperienza collaborativa. Lavora con gli altri giocatori per
            creare storie interessanti e coinvolgenti per tutti.
          </p>

          <h3>15. Pazienza con i Nuovi Giocatori</h3>
          <p>
            Aiuta i nuovi membri della comunità ad ambientarsi. Tutti abbiamo iniziato da qualche parte,
            e un ambiente accogliente migliora l'esperienza di tutti.
          </p>

          <h3>16. Divertimento Prima di Tutto</h3>
          <p>
            Ricorda che siamo qui per divertirci e vivere avventure nella nebbiosa Londra vittoriana.
            Se qualcosa non ti diverte, parlane con il team di moderazione.
          </p>
        </div>

        <div className="paper">

          <h2>Note Finali</h2>
          <p>
            Questo regolamento può essere aggiornato periodicamente per migliorare l'esperienza della comunità.
            I cambiamenti significativi verranno annunciati nel forum.
          </p>
          <p>
            Per domande specifiche sul regolamento o per segnalazioni, contatta il team di moderazione
            tramite i canali ufficiali.
          </p>
          <p style={{textAlign: 'center', fontStyle: 'italic'}}>
            <em>Ultimo aggiornamento: Gennaio 2025</em>
          </p>
        </div>
      </div>
    </>
  );
}

