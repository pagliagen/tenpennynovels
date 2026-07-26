---
description: Converte file Markdown in PDF usando pandoc
tags: [docs, pdf, conversion, pandoc]
---

# Markdown to PDF Converter

Converte file Markdown in PDF usando pandoc, gestendo automaticamente emoji e immagini.

## Uso

```bash
/md-to-pdf {path-to-file.md}
# Esempi:
/md-to-pdf docs/guide-utente/iscrizione.md
/md-to-pdf docs/guide-utente/creazione-personaggio.md
```

## Cosa Fa Questa Skill

### 1. Validazione Input
- Verifica che il file .md esista
- Controlla che pandoc sia installato (`which pandoc`)
- Se pandoc non è installato → errore con istruzioni installazione

### 2. Pre-processing Markdown

Crea una versione temporanea del file pulita per PDF:

**Rimozione Emoji**:
```bash
sed -E 's/[🎩✨💡⚠️❌✓📖🔒📧✅ℹ️🎮🔗📋📚🛠️👤💬🗺️]//g' {file}.md > {file}-temp.md
```

Lista emoji comuni da rimuovere:
- 💡 ⚠️ ❌ ✓ ✅ (status/alert)
- 📖 📚 📋 📧 (documenti)
- 🔒 🔗 (sicurezza/link)
- 🎩 ✨ 🎮 (decorativi)
- 👤 💬 🗺️ (gameplay)
- 🛠️ (tools)

**Gestione Immagini Mancanti**:
- Pandoc genera warning per immagini placeholder → OK
- Le sostituisce con testo alt automaticamente

### 3. Generazione PDF

Comando pandoc ottimizzato:

```bash
pandoc {file}-temp.md \
  -o {file}.pdf \
  --toc \
  --toc-depth=3 \
  -V geometry:margin=1in \
  -V colorlinks=true \
  -V linkcolor=blue \
  -V urlcolor=blue \
  -V toccolor=gray
```

**Parametri**:
- `--toc`: Table of Contents automatico
- `--toc-depth=3`: Include h1, h2, h3
- `-V geometry:margin=1in`: Margini 1 pollice
- `-V colorlinks=true`: Link colorati (no box)
- `-V linkcolor=blue`: Link interni blu
- `-V urlcolor=blue`: Link esterni blu

**Engine**: Usa il default di pandoc (pdflatex), che funziona senza font speciali

### 4. Generazione HTML (Opzionale)

Se l'utente richiede anche HTML:

```bash
pandoc {file}.md \
  -o {file}.html \
  --standalone \
  --toc \
  -c style.css  # se esiste un CSS custom
```

### 5. Cleanup

```bash
rm {file}-temp.md  # Rimuove file temporaneo
```

### 6. Output Finale

Fornire summary dettagliato:

```
✅ PDF Generato: {path}/{file}.pdf

Dimensione: XXX KB
Pagine: ~YY (stima)
TOC: Sì (depth 3)

Warning:
- Z immagini placeholder (sostituiti con alt text)
- Emoji rimossi automaticamente

File generati:
- {file}.pdf (XXX KB)
- {file}.html (YY KB) [se richiesto]

Note:
- Rigenera il PDF dopo aver aggiunto screenshot
- Usa pandoc direttamente per opzioni avanzate
```

## Gestione Errori

### Pandoc Non Installato
```
❌ Errore: pandoc non trovato

Installazione:
- macOS: brew install pandoc
- Ubuntu: sudo apt-get install pandoc texlive-latex-base
- Windows: https://pandoc.org/installing.html

Dopo installazione, riprova: /md-to-pdf {file}.md
```

### File Non Trovato
```
❌ Errore: File non trovato: {path}

Verifica il path e riprova.
Esempi validi:
- docs/guide-utente/iscrizione.md
- /absolute/path/to/file.md
```

### LaTeX Error (Unicode)
Se fallisce con errore Unicode nonostante rimozione emoji:
- Aggiungi altri caratteri Unicode alla regex sed
- Oppure usa: `--pdf-engine=xelatex` (richiede più dipendenze)

## Opzioni Avanzate

### PDF con Immagini Embedded
Se l'utente vuole immagini embedded (non solo placeholder):

```bash
# Converti PNG → base64 inline nel markdown prima
# Oppure usa path assoluti per le immagini
```

### Custom CSS per HTML
Creare `/docs/guide-utente/style.css`:

```css
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  max-width: 800px;
  margin: 40px auto;
  line-height: 1.6;
}
code { background: #f4f4f4; padding: 2px 6px; }
```

### Batch Conversion
Per convertire tutti i manuali:

```bash
for file in docs/guide-utente/*.md; do
  /md-to-pdf "$file"
done
```

## Performance

- File ~13KB MD → ~900KB PDF (con immagini)
- Tempo: ~3-5 secondi
- Warning: Normali per immagini placeholder

## Troubleshooting

**PDF troppo grande**:
- Comprimi immagini PNG prima (risoluzione 800x600 max)
- Usa formato JPEG invece di PNG

**Formattazione rotta**:
- Verifica sintassi Markdown
- Controlla heading hierarchy (h1 → h2 → h3, no salti)
- Blockquote e liste devono avere riga vuota prima/dopo

**Link non funzionanti nel PDF**:
- Link relativi non funzionano bene in PDF
- Usa URL assoluti per link esterni
- Link interni (#section) funzionano con TOC

## Riferimenti

- Pandoc Manual: https://pandoc.org/MANUAL.html
- LaTeX geometry: https://ctan.org/pkg/geometry
- Markdown syntax: https://commonmark.org/
