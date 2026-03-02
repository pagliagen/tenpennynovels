/**
 * Step 5: Background Component
 *
 * Complete character background with structured fields matching backend schema.
 *
 * @module components/character/wizard/steps/Step5Background
 * @since 2.0.0
 */

'use client';

import { useWizardStore } from '@/store/wizardStore';
import styles from '@/styles/components/character/wizard.module.scss';

/**
 * Step 5: Background Component
 *
 * @returns {JSX.Element} Step 5 form
 */
export function Step5Background(): JSX.Element {
  const { basicInfo, background, updateBasicInfo, updateBackground, stepErrors } = useWizardStore();
  const errors = stepErrors[5] || {};

  /**
   * Handle basic info field change (publicDescription, privateDescription, physicalDescription)
   */
  const handleBasicChange = (field: string, value: string) => {
    updateBasicInfo(field as any, value);
  };

  /**
   * Handle background field change (nested background object)
   */
  const handleBackgroundChange = (field: string, value: string) => {
    updateBackground({
      [field]: value,
    });
  };

  return (
    <div className={styles.stepContent} data-step="background">
      <h2 className={styles.stepTitle}>Background e Storia del Personaggio</h2>
      <p className={styles.stepDescription}>
        Sviluppa la storia e la personalità del tuo personaggio attraverso domande guidate.
        I campi contrassegnati con * sono obbligatori.
      </p>

      {/* SECTION 1: Descrizioni Base (Required) */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Descrizioni Base</h3>
        <p className={styles.sectionDescription}>
          Questi campi definiscono come il tuo personaggio appare e viene percepito dagli altri.
        </p>

        {/* Descrizione Pubblica */}
        <div className={styles.formGroup}>
          <label htmlFor="publicDescription" className={styles.label}>
            Descrizione Pubblica <span className={styles.required}>*</span>
          </label>
          <p className={styles.helpText}>
            Come appare il tuo personaggio agli altri? Aspetto, vestiario, portamento, prima impressione...
          </p>
          <textarea
            id="publicDescription"
            value={(basicInfo as any).publicDescription || ''}
            onChange={(e) => handleBasicChange('publicDescription', e.target.value)}
            className={`${styles.textarea} ${errors.publicDescription ? styles.inputError : ''}`}
            rows={4}
            maxLength={4000}
            placeholder="es. Un uomo sulla quarantina, dall'aspetto distinto ma austero. Porta sempre un completo scuro impeccabile e un bastone da passeggio con pomello d'argento. Lo sguardo è penetrante, quasi inquietante, e raramente sorride. Il suo portamento rigido e formale suggerisce un'educazione militare o aristocratica..."
          />
          <small className={styles.helpText}>
            Minimo 50 caratteri, massimo 4000
            {(basicInfo as any).publicDescription && (basicInfo as any).publicDescription.length < 50 && (
              <span className={styles.error}> - {(basicInfo as any).publicDescription.length}/50 caratteri</span>
            )}
          </small>
          {errors.publicDescription && <span className={styles.error}>{errors.publicDescription}</span>}
        </div>

        {/* Descrizione Privata */}
        <div className={styles.formGroup}>
          <label htmlFor="privateDescription" className={styles.label}>
            Descrizione Privata <span className={styles.required}>*</span>
          </label>
          <p className={styles.helpText}>
            Aspetti del personaggio che non sono immediatamente visibili: segreti, traumi, pensieri nascosti, doppia vita...
          </p>
          <textarea
            id="privateDescription"
            value={(basicInfo as any).privateDescription || ''}
            onChange={(e) => handleBasicChange('privateDescription', e.target.value)}
            className={`${styles.textarea} ${errors.privateDescription ? styles.inputError : ''}`}
            rows={4}
            maxLength={4000}
            placeholder="es. Dietro la facciata impeccabile si nasconde un uomo tormentato da visioni notturne e incubi ricorrenti. Ha assistito a eventi inspiegabili durante una spedizione in Egitto nel 1889 che hanno scosso le sue certezze razionaliste. Conserva gelosamente un diario cifrato dove annota simboli arcani e teorie proibite..."
          />
          <small className={styles.helpText}>
            Minimo 50 caratteri, massimo 4000
            {(basicInfo as any).privateDescription && (basicInfo as any).privateDescription.length < 50 && (
              <span className={styles.error}> - {(basicInfo as any).privateDescription.length}/50 caratteri</span>
            )}
          </small>
          {errors.privateDescription && <span className={styles.error}>{errors.privateDescription}</span>}
        </div>

        {/* Descrizione Fisica (Optional) */}
        <div className={styles.formGroup}>
          <label htmlFor="physicalDescription" className={styles.label}>
            Descrizione Fisica
          </label>
          <p className={styles.helpText}>
            Dettagli fisici specifici: altezza, corporatura, colore occhi e capelli, cicatrici, segni distintivi...
          </p>
          <textarea
            id="physicalDescription"
            value={(basicInfo as any).physicalDescription || ''}
            onChange={(e) => handleBasicChange('physicalDescription', e.target.value)}
            className={styles.textarea}
            rows={3}
            maxLength={4000}
            placeholder="es. Alto 1,78 m, corporatura asciutta ma atletica. Capelli neri con tempie brizzolate, sempre pettinati all'indietro con brillantina. Occhi grigio-azzurri penetranti. Una sottile cicatrice sulla guancia destra, ricordo di un duello giovanile. Mani curate ma con calli da scherma..."
          />
          <small className={styles.helpText}>Opzionale, massimo 4000 caratteri</small>
        </div>
      </div>

      {/* SECTION 2: Background Strutturato */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Background Strutturato</h3>
        <p className={styles.sectionDescription}>
          Rispondi a queste domande per sviluppare la storia completa del personaggio.
        </p>

        {/* 1. Storia in breve (REQUIRED) */}
        <div className={styles.formGroup}>
          <label htmlFor="briefHistory" className={styles.label}>
            1. Storia in breve <span className={styles.required}>*</span>
          </label>
          <p className={styles.helpText}>
            Raccontare in modo sintetico origine, educazione, momenti di svolta, scelte di vita, eventi traumatici o formativi.
          </p>
          <textarea
            id="briefHistory"
            value={background.briefHistory || ''}
            onChange={(e) => handleBackgroundChange('briefHistory', e.target.value)}
            className={`${styles.textarea} ${errors.briefHistory ? styles.inputError : ''}`}
            rows={6}
            maxLength={4000}
            placeholder="es. Nato nel 1855 in una famiglia di mercanti tessili a Manchester. Educazione classica alla Harrow School, poi laurea in Filosofia a Oxford. Durante il Grand Tour del 1878 rimase affascinato dall'archeologia egizia. Tornato in Inghilterra, ruppe con la famiglia per dedicarsi agli studi occulti invece che agli affari di famiglia. Nel 1889 partecipò a una disastrosa spedizione archeologica in cui morirono tre membri. Da allora vive a Londra come antiquario specializzato in reperti orientali..."
          />
          <small className={styles.helpText}>
            Minimo 100 caratteri, massimo 4000
            {background.briefHistory && background.briefHistory.length < 100 && (
              <span className={styles.error}> - {background.briefHistory.length}/100 caratteri</span>
            )}
          </small>
          {errors.briefHistory && <span className={styles.error}>{errors.briefHistory}</span>}
        </div>

        {/* 2. Fatti salienti (Optional) */}
        <div className={styles.formGroup}>
          <label htmlFor="significantEvents" className={styles.label}>
            2. Fatti salienti
          </label>
          <p className={styles.helpText}>
            Successi, fallimenti, lutti, incontri, cambi di città, carriere, scandali. Devono essere i momenti chiave che hanno segnato la vita del personaggio o il suo modo di pensare.
          </p>
          <textarea
            id="significantEvents"
            value={background.significantEvents || ''}
            onChange={(e) => handleBackgroundChange('significantEvents', e.target.value)}
            className={styles.textarea}
            rows={5}
            maxLength={2500}
            placeholder="es. 1878: Incontro con Lord Pembroke durante il Grand Tour, che lo introdusse ai circoli massonici. 1882: Rottura definitiva con il padre dopo aver rifiutato il matrimonio combinato con Eleanor Hartfield. 1889: Spedizione archeologica in Egitto - morte misteriosa di tre colleghi. 1892: Acquisto del negozio di antiquariato 'The Eastern Curio' a Bloomsbury con eredità della zia. 1894: Primo contatto con la Loggia dell'Alba Dorata..."
          />
          <small className={styles.helpText}>Opzionale ma consigliato, massimo 2500 caratteri</small>
        </div>

        {/* 3. Relazioni importanti (Optional) */}
        <div className={styles.formGroup}>
          <label htmlFor="importantRelationships" className={styles.label}>
            3. Relazioni importanti
          </label>
          <p className={styles.helpText}>
            Famiglia, amori, amici, mentori, rivali, colleghi, nemici. Spiegare brevemente la natura del legame e che impatto ha avuto sul personaggio.
          </p>
          <textarea
            id="importantRelationships"
            value={background.importantRelationships || ''}
            onChange={(e) => handleBackgroundChange('importantRelationships', e.target.value)}
            className={styles.textarea}
            rows={5}
            maxLength={2500}
            placeholder="es. Padre (Thomas Blackwood): rapporto conflittuale, non si parlano dal 1882. Madre morta di tubercolosi nel 1870. Lord Pembroke (mentore): lo ha introdotto all'occultismo, scomparso misteriosamente nel 1890. Dr. Helena Ashford (collega): unica persona di cui si fida veramente, condivide i suoi studi proibiti. Inspector Graves di Scotland Yard (nemico): lo considera un ciarlatano pericoloso dopo un caso di omicidio rituale nel 1893..."
          />
          <small className={styles.helpText}>Opzionale ma consigliato, massimo 2500 caratteri</small>
        </div>

        {/* 4. Personalità (REQUIRED) */}
        <div className={styles.formGroup}>
          <label htmlFor="personality" className={styles.label}>
            4. Personalità <span className={styles.required}>*</span>
          </label>
          <p className={styles.helpText}>
            Tratti dominanti, atteggiamento verso gli altri, abitudini, contraddizioni, ossessioni, modi di parlare o reagire.
          </p>
          <textarea
            id="personality"
            value={background.personality || ''}
            onChange={(e) => handleBackgroundChange('personality', e.target.value)}
            className={`${styles.textarea} ${errors.personality ? styles.inputError : ''}`}
            rows={5}
            maxLength={2500}
            placeholder="es. Intellettualmente curioso ma socialmente distante. Parla in modo formale e pedante, usando spesso termini tecnici e citazioni latine. Ossessionato dalla ricerca della verità nascosta dietro i fenomeni occulti. Tende all'arroganza quando discute argomenti che padroneggia. Contraddittoriamente, è superstizioso nonostante la formazione scientifica. Soffre di insonnia cronica e abusa di laudano. Detesta la superficialità e le convenzioni sociali vittoriane..."
          />
          <small className={styles.helpText}>
            Minimo 50 caratteri, massimo 2500
            {background.personality && background.personality.length < 50 && (
              <span className={styles.error}> - {background.personality.length}/50 caratteri</span>
            )}
          </small>
          {errors.personality && <span className={styles.error}>{errors.personality}</span>}
        </div>

        {/* 5. Ideologia/Credo (Optional) */}
        <div className={styles.formGroup}>
          <label htmlFor="ideology" className={styles.label}>
            5. Ideologia/Credo
          </label>
          <p className={styles.helpText}>
            Valori morali, religione, filosofia, visione del mondo o mancanza di essa. Deve includere anche il rapporto con la scienza, la società e la fede.
          </p>
          <textarea
            id="ideology"
            value={background.ideology || ''}
            onChange={(e) => handleBackgroundChange('ideology', e.target.value)}
            className={styles.textarea}
            rows={4}
            maxLength={2500}
            placeholder="es. Cresciuto nell'anglicanesimo tradizionale ma ora agnostico. Crede che l'universo sia governato da leggi occulte comprensibili solo attraverso lo studio esoterico. Convinto che scienza e magia siano due facce della stessa medaglia. Disprezza l'ipocrisia morale vittoriana ma rispetta le gerarchie sociali per convenienza. Ritiene che la conoscenza proibita sia l'unico vero potere. Teme e rispetta le forze soprannaturali più di quanto le comprenda..."
          />
          <small className={styles.helpText}>Opzionale ma consigliato, massimo 2500 caratteri</small>
        </div>

        {/* 6. Luoghi significativi (Optional) */}
        <div className={styles.formGroup}>
          <label htmlFor="significantPlaces" className={styles.label}>
            6. Luoghi significativi
          </label>
          <p className={styles.helpText}>
            I posti che il personaggio possiede o gestisce, oppure dove è possibile trovarlo quasi sempre. Possono essere un negozio, un laboratorio, un ufficio, un locale, un magazzino, eventuali proprietà ereditate o luoghi legati al suo nome, che non frequenta più, ma che fanno comunque parte della sua storia.
          </p>
          <textarea
            id="significantPlaces"
            value={background.significantPlaces || ''}
            onChange={(e) => handleBackgroundChange('significantPlaces', e.target.value)}
            className={styles.textarea}
            rows={4}
            maxLength={2500}
            placeholder="es. The Eastern Curio (negozio di antiquariato a Bloomsbury): gestito personalmente, serve come copertura per gli studi occulti. Appartamento al piano superiore ricolmo di libri proibiti e artefatti inquietanti. British Museum Reading Room: passa intere giornate consultando testi rari. The Atlantis Club (Pall Mall): circolo privato dove incontra altri studiosi dell'occulto. Villa di famiglia a Manchester: ereditata ma mai visitata dal 1882, custodita da amministratori..."
          />
          <small className={styles.helpText}>Opzionale ma consigliato, massimo 2500 caratteri</small>
        </div>

        {/* 7. Paure e fobie (Optional) */}
        <div className={styles.formGroup}>
          <label htmlFor="fearsAndPhobias" className={styles.label}>
            7. Paure e fobie
          </label>
          <p className={styles.helpText}>
            Ciò che il personaggio teme o lo mette profondamente a disagio. Possono essere paure razionali o irrazionali.
          </p>
          <textarea
            id="fearsAndPhobias"
            value={background.fearsAndPhobias || ''}
            onChange={(e) => handleBackgroundChange('fearsAndPhobias', e.target.value)}
            className={styles.textarea}
            rows={4}
            maxLength={2500}
            placeholder="es. Terrore delle sabbie mobili dopo l'esperienza in Egitto. Paura irrazionale degli specchi coperti di panni neri - li evita sempre. Teme di impazzire come suo zio materno, morto in manicomio. Ansia profonda quando sente suoni di flauto o canti in lingue sconosciute. Claustrofobia in ambienti sotterranei o cripte. Paura di essere sepolto vivo - dorme sempre con una candela accesa..."
          />
          <small className={styles.helpText}>Opzionale ma importante, massimo 2500 caratteri</small>
        </div>

        {/* 8. Segreti (Optional) */}
        <div className={styles.formGroup}>
          <label htmlFor="secrets" className={styles.label}>
            8. Segreti
          </label>
          <p className={styles.helpText}>
            Colpe, crimini, bugie, traumi, identità nascoste, patti, ossessioni, doppie vite. Devono essere coerenti con il background e potenzialmente rilevanti nel gioco.
          </p>
          <textarea
            id="secrets"
            value={background.secrets || ''}
            onChange={(e) => handleBackgroundChange('secrets', e.target.value)}
            className={styles.textarea}
            rows={5}
            maxLength={2500}
            placeholder="es. Responsabile indiretto della morte dei tre colleghi in Egitto - aprì un sarcofago sigillato contro gli avvertimenti locali. Possiede un grimorio rubato dalla biblioteca della Loggia dell'Alba Dorata, ricercato da mezza Londra occulta. Ha un figlio illegittimo con una medium londinese, mai riconosciuto pubblicamente. Pratica rituali di necromanzia nel seminterrato del negozio. Deve favori pericolosi a un usuraio del East End dopo una perdita catastrofica al gioco d'azzardo..."
          />
          <small className={styles.helpText}>Opzionale ma consigliato, massimo 2500 caratteri</small>
        </div>

        {/* 9. Obiettivi e motivazioni (REQUIRED) */}
        <div className={styles.formGroup}>
          <label htmlFor="goalsAndMotivations" className={styles.label}>
            9. Obiettivi e motivazioni <span className={styles.required}>*</span>
          </label>
          <p className={styles.helpText}>
            Cosa spinge il personaggio nel presente, cosa sta cercando, cosa vuole ottenere o cambiare, e quali sono le sue priorità reali. Può trattarsi di un obiettivo concreto, di una necessità, o anche solo di qualcosa da cui sta cercando di fuggire.
          </p>
          <textarea
            id="goalsAndMotivations"
            value={background.goalsAndMotivations || ''}
            onChange={(e) => handleBackgroundChange('goalsAndMotivations', e.target.value)}
            className={`${styles.textarea} ${errors.goalsAndMotivations ? styles.inputError : ''}`}
            rows={5}
            maxLength={2500}
            placeholder="es. Ossessionato dal trovare una spiegazione razionale agli eventi inspiegabili della spedizione egiziana del 1889. Vuole completare la traduzione di un papiro maledetto acquisito illegalmente, convinto contenga la chiave per controllare entità soprannaturali. A breve termine: deve saldare un debito di 500 sterline entro marzo 1895 o perdere il negozio. Cerca disperatamente un modo per redimere la propria colpa per le morti dei colleghi. Vuole essere accettato dalla comunità scientifica ufficiale nonostante i suoi studi eterodossi..."
          />
          <small className={styles.helpText}>
            Minimo 50 caratteri, massimo 2500
            {background.goalsAndMotivations && background.goalsAndMotivations.length < 50 && (
              <span className={styles.error}> - {background.goalsAndMotivations.length}/50 caratteri</span>
            )}
          </small>
          {errors.goalsAndMotivations && <span className={styles.error}>{errors.goalsAndMotivations}</span>}
        </div>
      </div>

      {/* Info Panel */}
      <div className={styles.infoPanel}>
        <h4>💡 Suggerimenti per un Background Efficace</h4>
        <ul>
          <li>
            <strong>Sii Specifico:</strong> Dettagli concreti rendono il personaggio realistico e memorabile
          </li>
          <li>
            <strong>Collega alla Storia:</strong> Usa eventi della Londra vittoriana (1880s-1890s) per autenticità
          </li>
          <li>
            <strong>Pensa alle Connessioni:</strong> Crea legami con altri personaggi potenziali
          </li>
          <li>
            <strong>Considera la Classe Sociale:</strong> Come ha influenzato opportunità e prospettive?
          </li>
          <li>
            <strong>Lascia Spazi Aperti:</strong> Permetti al master di aggiungere elementi alla storia
          </li>
          <li>
            <strong>Bilancia Punti di Forza e Debolezza:</strong> Personaggi perfetti sono noiosi
          </li>
        </ul>
      </div>

      {/* Validation Errors Summary */}
      {Object.keys(errors).length > 0 && (
        <div className={styles.errorSummary}>
          <h4>Errori di Validazione:</h4>
          <ul>
            {Object.entries(errors).map(([field, error]) => (
              <li key={field}>{error}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
