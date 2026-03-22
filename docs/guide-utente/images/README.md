# Screenshots Guida Iscrizione

Screenshot per [iscrizione.md](../iscrizione.md) - Formato standard: **800x600** (139-241KB)

## ✅ Screenshot Completati (4/11)

| File | Descrizione | Dimensione | Status |
|------|-------------|------------|--------|
| `01-homepage-registrati.png` | Homepage con pulsante Registrati | 241KB | ✅ |
| `02-form-registrazione.png` | Form registrazione vuoto | 139KB | ✅ |
| `03-submit-button.png` | Pulsante Registrati evidenziato | 139KB | ✅ |
| `04-login-page.png` | Pagina login | 241KB | ✅ |

## ⚠️ Screenshot Mancanti (7/11)

Questi screenshot richiedono interazioni specifiche con il form React e devono essere presi manualmente durante test reali:

### 02a-username-check.png
- **Cosa mostrare**: Campo username con check verde ✓ (disponibile)
- **Come generarlo**:
  1. Vai a `/register`
  2. Inserisci username valido non esistente (es. `test_user_12345`)
  3. Attendi 500ms (debounce)
  4. Screenshot quando compare il check verde

### 02b-email-duplicata.png
- **Cosa mostrare**: Errore "Email già registrata" sotto campo email
- **Come generarlo**:
  1. Vai a `/register`
  2. Inserisci email già esistente nel DB
  3. Compila password, conferma, checkbox
  4. Clicca "Registrati"
  5. Screenshot quando compare errore rosso

### 02c-password-validation.png
- **Cosa mostrare**: Campo password con indicatore requisiti (min 8 char, 1 lettera, 1 numero)
- **Come generarlo**:
  1. Vai a `/register`
  2. Focus sul campo password
  3. Screenshot con tooltip/helper text visibile

### 02d-password-mismatch.png
- **Cosa mostrare**: Errore "Le password non coincidono"
- **Come generarlo**:
  1. Vai a `/register`
  2. Password: `Test1234`
  3. Conferma Password: `Different1234`
  4. Blur dal campo conferma password
  5. Screenshot quando compare errore

### 02e-termini-checkbox.png
- **Cosa mostrare**: Checkbox "Accetto i termini e condizioni" con link
- **Come generarlo**:
  1. Vai a `/register`
  2. Scroll fino a checkbox termini
  3. Screenshot con checkbox evidenziata

### 03a-success-message.png
- **Cosa mostrare**: Banner verde "Registrazione completata con successo!"
- **Come generarlo**:
  1. Compila form con dati validi nuovi
  2. Clicca "Registrati"
  3. Screenshot immediato quando compare banner verde
  4. **NOTA**: Cancella l'account test dopo lo screenshot

### 04a-character-modal.png
- **Cosa mostrare**: Modal creazione/selezione personaggio (primo accesso)
- **Come generarlo**:
  1. Crea account di test
  2. Fai login
  3. Screenshot del modal che appare automaticamente
  4. **NOTA**: Richiede accesso al gioco (`/game`)

---

## 🛠️ Come Prendere gli Screenshot

### Metodo 1: Browser DevTools (Consigliato)
```bash
# Chrome/Edge
1. Apri DevTools (F12)
2. Cmd+Shift+P (Mac) / Ctrl+Shift+P (Win)
3. Cerca "Capture screenshot"
4. Scegli "Capture full size screenshot"
5. Crop a 800x600 con tool immagini
```

### Metodo 2: Puppeteer Script
```javascript
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  await page.setViewport({ width: 800, height: 600 });

  await page.goto('https://tenpennynovels.com/register');

  // Interazioni specifiche qui...

  await page.screenshot({
    path: '02a-username-check.png',
    fullPage: false
  });

  await browser.close();
})();
```

### Metodo 3: macOS Built-in (Quick)
```bash
# Screenshot area selezionata
Cmd + Shift + 4
# Trascina area 800x600
# Salva in images/
```

---

## 📋 Checklist Completamento

- [x] 01-homepage-registrati.png
- [x] 02-form-registrazione.png
- [ ] 02a-username-check.png
- [ ] 02b-email-duplicata.png
- [ ] 02c-password-validation.png
- [ ] 02d-password-mismatch.png
- [ ] 02e-termini-checkbox.png
- [x] 03-submit-button.png
- [ ] 03a-success-message.png
- [x] 04-login-page.png
- [ ] 04a-character-modal.png

**Progresso**: 4/11 (36%)

---

_Ultimo aggiornamento: 2026-03-22_
