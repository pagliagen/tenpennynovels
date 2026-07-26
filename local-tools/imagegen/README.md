# imagegen — generazione artifact grafici (locale, nessuna API cloud)

Fork adattato di `cthulhucardgame/tools/imagegen`: un server locale di inferenza
Stable Diffusion (via HuggingFace `diffusers`, girato su GPU/MPS/CPU della tua
macchina — **nessuna chiave API, nessun costo cloud**) più uno script che legge
`scripts/seeders/data/{tipo}.csv` e genera un'icona/scena PNG per ogni riga in
`apps/game/public/artifacts/{tipo}/`.

Tipi supportati oggi: `items` (icone oggetto, 400×400) e `locations` (scene
ambientazione, 1024×1024). Aggiungere un nuovo tipo = una entry in
`TYPE_CONFIG` dentro `generate_artifacts.py`.

A differenza dell'originale (pipeline a 3 step per illustrazioni di carte in
bianco e nero), qui la pipeline è un **singolo passo txt2img a colori** — vedi
"Note tecniche" più sotto sul perché.

Vive fuori da `scripts/` (che è codice Node/TS versionato ed eseguito in CI)
perché è uno strumento Python, pesante (richiede modelli ML multi-GB scaricati
da HuggingFace al primo avvio) e lanciato manualmente, non come parte della
pipeline di seeding automatica.

## Setup (una volta sola)

```bash
cd local-tools/imagegen
bash run.sh        # crea la venv, installa le dipendenze, avvia il server su :8791
# attendi "[imagegen] pronto.", poi Ctrl-C
```

## Uso

**Un solo comando** (avvia il server, genera, lo spegne alla fine):

```bash
bash run_pipeline.sh --type items --test                          # 1 sola icona, giro di prova
bash run_pipeline.sh --type items                                 # tutti gli item (400x400)
bash run_pipeline.sh --type locations                              # tutte le location (1024x1024)
bash run_pipeline.sh --type occupations                            # tutte le professioni (100x100)
bash run_pipeline.sh --type all --skip-existing                    # tutto in sequenza (items → occupations → locations, dal più veloce), salta quelli già generati
bash run_pipeline.sh --type items --limit 10                      # solo i primi 10
```

Oppure manuale (due terminali, utile per iterare senza il costo di riavviare il
server ad ogni prova):

```bash
# Terminale 1
bash run.sh

# Terminale 2 (con .venv attiva: source .venv/bin/activate)
python generate_artifacts.py --type items --test
python generate_artifacts.py --type locations --limit 5
python generate_artifacts.py --type items --skip-existing
```

## Input: `scripts/seeders/data/{items,locations}.csv`

Lo script legge le colonne `filename` (nome del file PNG di output, es.
`stetoscopio.png` / `london.png`) e `prompt` (il prompt inglese per l'AI —
**non va a DB**, esiste solo per pilotare la generazione). Righe senza
`prompt` vengono saltate.

Ad ogni prompt viene appeso un suffisso di stile fisso (vedi `STYLE_SUFFIX` in
`generate_artifacts.py`) per coerenza visiva. Modificalo lì se vuoi cambiare
lo stile globale.

**Importante — tieni i prompt CORTI**: `prompt` deve essere una lista di 3-6
descrittori concreti separati da virgola (es. `"brass compass, magnetic
needle, wooden case"` oppure `"gothic cathedral, tall spires, stone facade"`),
NON una frase discorsiva. Verificato empiricamente: prompt lunghi e narrativi
("A brass compass featuring intricate engravings, designed for...") diluiscono
l'attenzione del modello sul soggetto e producono composizioni sbagliate/
confuse.

## Output

`apps/game/public/artifacts/{tipo}/{filename}` — PNG alla dimensione di
default del tipo (items: 400×400, locations: 1024×1024, override con
`--width`/`--height`), stile pittorico realistico coerente con
`apps/game/public/locations/london_boroughs.png` (non cartoon/flat/vettoriale).

## Modello

Default **SD1.5** (`runwayml/stable-diffusion-v1-5`, già in cache locale se hai
usato `cthulhucardgame`). **Non SDXL**, deliberatamente: SDXL su MPS (bf16 +
upcast VAE + tiling) produce artefatti di corruzione a strisce/griglia in modo
intermittente e dipendente dal seed — capita anche con hardware potente (M5 Pro
24GB), non è un problema di risorse. SD1.5 in fp32 puro, senza VAE tiling
(rimossa da questo fork), è stabile — stessa configurazione usata con successo
in `thekeeperarchive/poc/imagegen`. Override con `IMAGEGEN_MODEL=...` se vuoi
comunque provare SDXL o FLUX, sapendo che potresti rivedere artefatti.

## Note tecniche ereditate dall'originale

- **Retry anti-nero**: il client rileva un'immagine (quasi) nera e rigenera con
  un altro seed (fino a 2 tentativi). Copre il caso classico "NaN nel VAE", ma
  **non** rileva la corruzione a strisce osservata con SDXL (non è nera, è
  rumorosa) — un motivo in più per restare su SD1.5.
- **Seed stabile per riga**: rilanciare lo script sullo stesso `filename`
  produce la stessa immagine di base (seed derivato da hash del filename),
  utile per rigenerazioni mirate. Se un elemento esce male, genera a mano con
  un seed diverso (vedi `stable_seed(filename, salt)` in
  `generate_artifacts.py` — cambia `salt`).
- Vedi `server.py` per il contratto HTTP completo (`/health`, `/txt2img`,
  `/img2img` — quest'ultimo non usato dalla pipeline attuale, tenuto per
  eventuali raffinamenti futuri).
