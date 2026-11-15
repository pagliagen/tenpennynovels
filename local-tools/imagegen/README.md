# imagegen — generazione artifact grafici (locale, nessuna API cloud)

Legge `scripts/seeders/data/{tipo}.csv` e genera un'icona/scena WebP per ogni riga in
`apps/game/public/artifacts/{tipo}/`. Tutto gira sulla tua macchina: **nessuna chiave API,
nessun costo cloud**.

Un solo backend, **Ollama**, per tutti i tipi (`TYPE_CONFIG` in `generate_artifacts.py`):

| Tipo | Backend | Modello | Dimensione |
|---|---|---|---|
| `items` | **Ollama** | `x/z-image-turbo` | 512 → 400×400 |
| `occupations` | **Ollama** | `x/z-image-turbo` | 512 → 100×100 |
| `locations` | **Ollama** | `x/z-image-turbo` | 1152×768 → 1536×1024 |

Non c'è nessun server da avviare: basta Ollama acceso (stesso approccio
di `bot-telegram-gdr`). Aggiungere un nuovo tipo = una entry in `TYPE_CONFIG`.

Vive fuori da `scripts/` (codice Node/TS versionato ed eseguito in CI) perché è uno strumento
Python, pesante e lanciato a mano, non parte della pipeline di seeding.

## Setup (una volta sola)

```bash
ollama pull x/z-image-turbo      # circa 12 GB; richiede macOS con Apple Silicon e Ollama >= 0.14
cd local-tools/imagegen
python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
```

## Uso

```bash
bash run_pipeline.sh --type items --dry-run          # elenca cosa verrebbe generato, senza generare
bash run_pipeline.sh --type items --test             # 1 sola icona (la prima mancante)
bash run_pipeline.sh --type items                    # tutte le mancanti (~30 s l'una su M5 Pro)
bash run_pipeline.sh --type items --only "Stetoscopio" --overwrite   # rifà una sola immagine
bash run_pipeline.sh --type items --out-dir /tmp/prova --limit 5     # giro di prova fuori dal repo
bash run_pipeline.sh --type occupations
bash run_pipeline.sh --type locations                # le location mancanti (~30 s l'una)
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

## Locations: stile di riferimento

`--type locations` legge `scripts/seeders/data/locations.csv` e genera **solo** le location il cui
file non esiste ancora in `apps/game/public/artifacts/locations/`. I file esistenti (le 13 immagini
di riferimento dello stile) **non vengono mai sovrascritti**, nemmeno con `--overwrite`. Il soggetto
si prende da `location_prompts.json` (chiave = `filename`, frasi concrete di 25-35 parole), con
fallback sul `prompt` del CSV, che è troppo corto per reggere lo stile.

```bash
bash run_pipeline.sh --type locations --only "borough-market.webp" --out-dir /tmp/prova   # prova fuori dal repo
bash run_pipeline.sh --type locations --limit 5                                           # le prime 5 mancanti
```

Stile estratto dalle 13 immagini esistenti — `LOCATION_STYLE`: illustrazione 2D a serigrafia/noir,
forme piatte e silhouette scure, palette teal-verde scurissimo + nero, **unica** luce calda ambra
(lampioni a gas, finestre accese) riflessa sul selciato, grana, prospettiva centrale, scena deserta,
mai persone né testo. Una location nuova = riga nel CSV + un soggetto in `location_prompts.json`.
Se una scena esce con figure o scritte, rigenerala: cancella il file e rilancia con `--only`.

Il modello a volte «incornicia» la scena con un bordo sottile, chiaro o scuro, e nominare bordi o angoli
nel prompt peggiora le cose: per questo non se ne parla nel prompt e il codice ritaglia i margini chiari
(`trim_light_margins`) e il 5% per lato (`crop_frac`) prima di riportare a 1536×1024.

**Limite noto:** nelle scene molto «vissute» (stazioni, mercati) il modello può aggiungere figurine
lontane nonostante «nobody in sight»; z-image-turbo non ha prompt negativo.

## Modello

`x/z-image-turbo` via Ollama: veloce (9 step), buon controllo dello stile con il solo prompt
positivo. Sostituisce SD1.5/Qwen-Image su server diffusers (rimosso: `server.py`, `run.sh`).

## Note tecniche

- **Retry**: 3 tentativi su 5xx e immagini nere (il runner di Ollama ogni tanto cade).
- **Scrittura atomica** (file `.tmp` poi rename): un Ctrl-C non lascia file a metà.
