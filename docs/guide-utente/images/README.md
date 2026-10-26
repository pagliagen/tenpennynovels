# Screenshots Guida Iscrizione

Screenshot per [iscrizione.md](../iscrizione.md). Formato standard: **800×600**.

| File | Cosa mostra | Come è stato ottenuto |
|---|---|---|
| `01-homepage-registrati.png` | Homepage | landing locale |
| `02-form-registrazione.png` | Form vuoto | landing locale |
| `02a-username-check.png` | Nome utente già in uso: campo rosso | flusso reale (`admin` esiste nel seed) |
| `02b-email-duplicata.png` | Email già registrata: campo rosso | flusso reale (`test@tenpennynovels.com` del seed) |
| `02c-password-validation.png` | Password troppo corta: banner in alto | flusso reale, `Registrati` con `abc` |
| `02d-password-mismatch.png` | «Le password non coincidono» | flusso reale |
| `02e-termini-checkbox.png` | Checkbox con i due link | flusso reale |
| `03-submit-button.png` | Pulsante Registrati | landing locale |
| `03a-success-message.png` | Banner verde di successo | **risposta del server simulata** (vedi sotto) |
| `04-login-page.png` | Login | landing locale |
| `04a-character-modal.png` | «Selezione personaggio» | login reale con un utente a due personaggi (uno temporaneo, poi eliminato) |

Gli screenshot descrivono la UI **com'è**: non c'è un segno di spunta per lo username libero, né un indicatore dei requisiti della password, e gli errori di validazione vanno nel banner in alto (i campi si limitano a colorarsi di rosso). Se la UI cambia, rifarli.

## Come rigenerarli

Servono landing (`cd apps/landing && npm run dev`), api-gateway e backend locali. Lo script usa Puppeteer a 800×600, accetta il banner cookie e nasconde l'indicatore di sviluppo di Next (`nextjs-portal`), altrimenti coprono il form.

- **Registrazione riuscita (`03a`)**: in locale la registrazione fallisce perché il Mongo del `docker-compose` è standalone e il backend scrive con retry/transazioni (`startTransaction` in `RegistrationController`). Lo scatto quindi intercetta `POST /auth/register` e risponde `{ success: true }`: il banner mostrato è quello reale della pagina, il server no. Con un Mongo a replica set si può fare il flusso vero (e poi eliminare l'utente di prova).
- **Modal personaggi (`04a`)**: compare solo se l'utente ha **più di un personaggio**; con uno solo il login porta direttamente al gioco. Nel seed nessun utente ne ha due: serve aggiungerne uno a mano e rimuoverlo dopo.
- Non usare email reali negli scatti: `test@tenpennynovels.com` e gli `@example.com` bastano.

_Ultimo aggiornamento: 2026-10-26_
