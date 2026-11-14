# imagegen — generazione artifact grafici (locale, nessuna API cloud)

Legge `scripts/seeders/data/{tipo}.csv` e genera un'icona/scena WebP per ogni riga in
`apps/game/public/artifacts/{tipo}/`. Tutto gira sulla tua macchina: **nessuna chiave API,
nessun costo cloud**.

Due backend, scelti per tipo (`TYPE_CONFIG` in `generate_artifacts.py`):

| Tipo | Backend | Modello | Dimensione |
|---|---|---|---|
| `items` | **Ollama** | `x/z-image-turbo` | 512 → 400×400 |
| `occupations` | **Ollama** | `x/z-image-turbo` | 512 → 100×100 |
| `locations` | server diffusers (`server.py`) | Qwen-Image 2.1 (o SDXL/SD1.5) | 1536×1024 |

Per items e occupazioni non c'è nessun server da avviare: basta Ollama acceso (stesso approccio
di `bot-telegram-gdr`). Aggiungere un nuovo tipo = una entry in `TYPE_CONFIG`.

Vive fuori da `scripts/` (codice Node/TS versionato ed eseguito in CI) perché è uno strumento
Python, pesante e lanciato a mano, non parte della pipeline di seeding.

## Setup (una volta sola)

```bash
ollama pull x/z-image-turbo      # circa 12 GB; richiede macOS con Apple Silicon e Ollama >= 0.14
cd local-tools/imagegen
python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
```

Per le sole location serve anche il server diffusers (`bash run.sh`, vedi più sotto).

## Uso

```bash
bash run_pipeline.sh --type items --dry-run          # elenca cosa verrebbe generato, senza generare
bash run_pipeline.sh --type items --test             # 1 sola icona (la prima mancante)
bash run_pipeline.sh --type items                    # tutte le mancanti (~30 s l'una su M5 Pro)
bash run_pipeline.sh --type items --only "Stetoscopio" --overwrite   # rifà una sola immagine
bash run_pipeline.sh --type items --out-dir /tmp/prova --limit 5     # giro di prova fuori dal repo
bash run_pipeline.sh --type occupations
bash run_pipeline.sh --type locations                # avvia il server diffusers (vedi sotto)
```

- **Si può interrompere e rilanciare**: i file già presenti vengono saltati (e mai sovrascritti
  senza `--overwrite`); la scrittura è atomica, quindi un Ctrl-C non lascia file a metà.
- Mentre genera, Ollama usa GPU e memoria: i modelli di testo rallentano. Lascialo girare da solo.
- Variabili: `OLLAMA_HOST` (default `http://localhost:11434`), `IMAGEGEN_OLLAMA_MODEL`
  (default `x/z-image-turbo`), `--steps` (default 9).

## Input: `scripts/seeders/data/{items,locations}.csv`

Lo script legge le colonne `filename` (nome del file WebP di output, es.
`stetoscopio.webp` / `london.webp`) e `prompt` (il prompt inglese per l'AI —
**non va a DB**, esiste solo per pilotare la generazione). Righe senza
`prompt` vengono saltate.

Ad ogni prompt viene appeso uno stile fisso: `ICON_STYLE` per items/occupazioni (oggetto singolo
centrato su sfondo scuro neutro, illustrazione da catalogo vittoriano), `LOCATION_STYLE` per le
location. Modificalo in `generate_artifacts.py` per cambiare lo stile globale. z-image-turbo non
ha prompt negativo (senza CFG): i divieti stanno nel prompt positivo.

**Importante — tieni i prompt CORTI**: `prompt` deve essere una lista di 3-6
descrittori concreti separati da virgola (es. `"brass compass, magnetic
needle, wooden case"` oppure `"gothic cathedral, tall spires, stone facade"`),
NON una frase discorsiva. Verificato empiricamente: prompt lunghi e narrativi
("A brass compass featuring intricate engravings, designed for...") diluiscono
l'attenzione del modello sul soggetto e producono composizioni sbagliate/
confuse.

## Output

`apps/game/public/artifacts/{tipo}/{filename}` — WebP (qualità 85, RGB senza alpha). Il modello
genera in PNG; la conversione a WebP e il ridimensionamento (items 400×400, occupations 100×100,
locations 1536×1024) avvengono in `generate_artifacts.py` prima del salvataggio.

**Limite noto:** per soggetti con scritte (biglietti, lettere, registri, timbri) il modello
inventa testo anche se il prompt dice «no text». Se una icona esce con parole sbagliate,
rigenerala con `--only ... --overwrite` o semplifica il `prompt` nel CSV (niente nomi di luoghi).

## Modelli

- **Items e occupazioni: `x/z-image-turbo` via Ollama.** Veloce (8-9 step), buon realismo e luce
  morbida a 512 px; sostituisce SD1.5 (2022), le cui icone erano pittura a olio con inquadrature
  tagliate e soggetti illeggibili.
- **Location: server diffusers** (`server.py`). Default storico SD1.5; per le location si usa
  **Qwen-Image 2.1** (`IMAGEGEN_MODEL=Qwen/Qwen-Image-2.1`, transformer GGUF opzionale con
  `IMAGEGEN_GGUF`) con le immagini di riferimento di stile. SDXL resta sconsigliato su MPS
  (artefatti a strisce intermittenti con bf16).

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

## Locations: fonte DB, stile di riferimento

`--type locations` legge l'elenco dal **DB** (collection `locations`, solo lettura,
`MONGODB_URI` o default del compose locale) e genera **solo** le location il cui
file `image` non esiste ancora in `apps/game/public/artifacts/locations/`. I file
esistenti non vengono mai sovrascritti (guardia anche in `save_as_webp`). Il
`prompt` del soggetto arriva dal CSV (match su `filename`), fallback sul nome.

```bash
bash run_pipeline.sh --type locations --only "Borough Market" --out-dir /tmp/prova   # giro di prova fuori dal repo
bash run_pipeline.sh --type locations --limit 5                                      # le prime 5 mancanti
```

Stile estratto dalle 13 immagini esistenti (1536x1024, 3:2) — `LOCATION_STYLE` in
`generate_artifacts.py`: illustrazione 2D grafica/noir (non olio, non foto), forme
piatte e silhouette scure, palette teal-verde scurissimo + nero, **unica** luce
calda ambra (lampioni a gas, finestre accese), grana da stampa, prospettiva
centrale, mai persone né testo. Prompt completo per altri generatori:

> Flat 2D graphic illustration of {soggetto}, Victorian London 1889, night. Noir
> graphic-novel poster style, bold dark silhouettes, minimal texture, subtle film
> grain and vignette. Strictly limited palette: deep teal-green and near-black,
> with warm amber-yellow glow from gas lamps and lit windows as the only light.
> One-point perspective, wide cinematic 3:2, foggy distance, empty of people, no text.
