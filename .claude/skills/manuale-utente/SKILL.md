---
description: Genera manuale utente completo per un argomento specifico
tags: [docs, user-guide, markdown, screenshots]
---

# Manuale Utente Generator

Genera un manuale utente completo in formato Markdown per TenPennyNovels, seguendo lo standard della guida iscrizione.

## Uso

```bash
/manuale-utente {argomento}
# Esempi:
/manuale-utente creazione-personaggio
/manuale-utente navigazione-locations
/manuale-utente uso-chat
```

## Cosa Fa Questa Skill

Quando invocata con un argomento (es. "creazione-personaggio"), esegue questi step:

### 1. Analisi Argomento
- Identifica le feature/pagine rilevanti nel codebase
- Legge i componenti React coinvolti (se esistono)
- Analizza validation schemas e logica backend
- Esamina eventuali docs funzionali esistenti

### 2. Struttura Manuale
Crea `/docs/guide-utente/{argomento}.md` con questa struttura standard:

```markdown
# Guida {Titolo} - TenPennyNovels

> **Ultima modifica**: {Data} | **Versione guida**: 1.0

## Introduzione
- Benvenuto e cosa aspettarsi
- Tempo richiesto (~X minuti)
- Prerequisiti (se necessari)

## Passo 1: {Primo Step}
![Screenshot descrittivo](./images/{argomento}-01-xxx.png)
- Istruzioni dettagliate
- URL/percorso se applicabile

## Passo 2: {Secondo Step}
### 2.1 {Sottosezione}
**Requisiti**: ...
**Esempi validi**: ...
**Esempi NON validi**: ...
![Screenshot dettaglio](./images/{argomento}-02a-xxx.png)

## Risoluzione Problemi Comuni
1. Problema X → Soluzione
2. Problema Y → Soluzione
...

## Domande Frequenti (FAQ)
### Domanda 1?
Risposta...

### Domanda 2?
Risposta...

## Link Utili
- [Altri manuali](./README.md)
- [Docs funzionale](../funzionale/{topic}.md)
- [Supporto](https://tenpennynovels.com/support)

---

_Ultimo aggiornamento: {Data} | Versione: 1.0 | Autore: Team TenPennyNovels_
```

### 3. Regole di Scrittura

**IMPORTANTE - NO EMOJI**:
- NON usare emoji nel testo (💡, ⚠️, ✅, ecc.)
- Usare testo esplicito invece:
  - ❌ `💡 Nota:` → ✅ `**Nota**:`
  - ❌ `⚠️ Attenzione:` → ✅ `**Attenzione**:`
  - ❌ `✅ Completato` → ✅ `**Completato**`
  - ❌ `📖 Guida:` → ✅ `**Guida**:`

**Tono e Stile**:
- Italiano informale ma professionale
- User-friendly (no gergo tecnico)
- Esempi concreti e pratici
- Step-by-step numerati

**Formato Markdown**:
- Heading hierarchy corretta (h1 → h2 → h3)
- Bold per requisiti e termini chiave
- Liste puntate/numerate
- Blockquote per note/warning (senza emoji)
- Code blocks per esempi tecnici (se necessari)

### 4. Placeholder Screenshot

Inserire riferimenti immagini come:
```markdown
![Descrizione screenshot](./images/{argomento}-01-xxx.png)
```

Creare directory `/docs/guide-utente/images/` se non esiste.

**NON generare screenshot automaticamente** in questa skill (troppo complesso).
Invece, creare file `images/{argomento}-screenshots.md` con lista:

```markdown
# Screenshot da Creare - {Argomento}

## Screenshot Necessari

1. `{argomento}-01-xxx.png` (800x600)
   - Descrizione: ...
   - Come generarlo: ...

2. `{argomento}-02-xxx.png` (800x600)
   - Descrizione: ...
   - Come generarlo: ...
...
```

### 5. Aggiornamenti Docs

**`/docs/guide-utente/README.md`**:
- Aggiungere link al nuovo manuale nella sezione appropriata

**`/docs/INDEX.md`**:
- Se la sezione Guide Utente non esiste, crearla
- Aggiungere link se è un manuale importante

**`/docs/funzionale/{topic}.md`** (se esiste):
- Aggiungere link "Guida Completa" nella sezione "Per il giocatore"

### 6. Output Finale

Fornire summary con:
- Path del file creato
- Dimensione file
- Numero righe
- Lista screenshot placeholder (quanti)
- File aggiornati
- Checklist validazione per l'utente

## Esempi di Output

```
✅ Manuale Creato: docs/guide-utente/creazione-personaggio.md (18KB, 620 righe)

Screenshot placeholder: 9
- images/creazione-personaggio-01-form.png
- images/creazione-personaggio-02-occupation.png
- ...

File aggiornati:
- docs/guide-utente/README.md
- docs/INDEX.md
- docs/funzionale/personaggi.md

Checklist Validazione:
- [ ] Leggi il manuale end-to-end
- [ ] Verifica link interni funzionanti
- [ ] Testa il flow reale seguendo la guida
- [ ] Genera screenshot mancanti
- [ ] Rigenera PDF con /md-to-pdf
```

## File di Riferimento

Per capire il formato e lo stile, leggere:
- `/docs/guide-utente/iscrizione.md` - Template principale
- `/apps/landing/src/lib/validation/schemas.ts` - Validazioni
- `/apps/{app}/src/pages/{page}.tsx` - Componenti UI

## Note Importanti

1. **NON creare il manuale se non ci sono abbastanza informazioni** nel codebase
2. **CHIEDERE all'utente** dettagli mancanti se necessario
3. **Validazione requisiti**: Leggere sempre gli schema Zod se esistono
4. **Coerenza**: Mantenere lo stesso tono e struttura di iscrizione.md
5. **NO emoji**: Ripetuto per enfasi - il PDF deve funzionare senza modifiche

## Troubleshooting

- Se l'argomento è troppo generico → chiedere di essere più specifico
- Se non trovi il codice → chiedi all'utente il path o salta quella sezione
- Se ci sono troppi step → dividi in sotto-manuali
