#!/usr/bin/env python3
"""
Genera artifact grafici (item, occupazioni, location) di TenpennyNovels con un SINGOLO
passo txt2img su un modello di immagini di Ollama (default x/z-image-turbo, stesso approccio
di bot-telegram-gdr). Niente server Python: basta Ollama acceso e
`ollama pull x/z-image-turbo` (circa 12 GB). ~30 s a immagine su Apple Silicon.

Legge scripts/seeders/data/{tipo}.csv (stesso formato usato dai seeder TS via
csv-parse: delimitatore ";", righe commento con "#") e per ogni riga con un
campo "prompt" non vuoto genera apps/game/public/artifacts/{tipo}/{filename}.

Uso:
  python generate_artifacts.py --type items                    # tutti gli item (400x400)
  python generate_artifacts.py --type locations                # le location mancanti (1536x1024)
  python generate_artifacts.py --type items --test              # 1 solo, giro completo di prova
  python generate_artifacts.py --type items --limit 5
  python generate_artifacts.py --type items --skip-existing     # riprende un run interrotto
"""

import argparse
import base64
import csv
import io
import json
import os
import sys
import time
from pathlib import Path

import requests

try:
    from PIL import Image, ImageStat
    HAS_PIL = True
except ImportError:
    HAS_PIL = False

# Qualità WebP di export: 85 è il punto in cui non si vede differenza a occhio
# su queste illustrazioni pittoriche, ma il file pesa una frazione del PNG
# sorgente (verificato: location da ~2MB PNG a ~250-400KB WebP). method=6 è il
# livello di compressione più lento/migliore di libwebp: qui va benissimo,
# la generazione è comunque un'operazione batch offline, non real-time.
WEBP_QUALITY = 85
WEBP_METHOD = 6

# Backend Ollama (items, occupations). Override via env.
OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://localhost:11434").rstrip("/")
if not OLLAMA_HOST.startswith("http"):  # OLLAMA_HOST puo' essere "host:porta" senza schema
    OLLAMA_HOST = f"http://{OLLAMA_HOST}"
OLLAMA_IMAGE_MODEL = os.environ.get("IMAGEGEN_OLLAMA_MODEL", "x/z-image-turbo")
OLLAMA_STEPS = 9  # valore consigliato per z-image-turbo (modello a pochi step, senza CFG)

ROOT = Path(__file__).resolve().parent.parent.parent
DATA_DIR = ROOT / "scripts" / "seeders" / "data"
ARTIFACTS_DIR = ROOT / "apps" / "game" / "public" / "artifacts"

# Stile delle scene location, estratto dalle 13 immagini già presenti in
# apps/game/public/artifacts/locations/ (NON toccarle: sono il riferimento).
# Tratti ricorrenti: illustrazione 2D grafica/noir (non pittura a olio, non foto),
# forme piatte e silhouette scure, palette teal-verde scurissimo + nero con
# UNICA fonte di luce calda ambra (lampioni a gas, finestre accese), grana da
# stampa, prospettiva centrale, inquadratura ampia 3:2, mai persone né testo.
LOCATION_STYLE = (
    "flat 2D screen-print poster illustration, noir graphic-novel style, large flat shapes of solid color, "
    "bold black silhouettes, no soft gradients, no painterly rendering, visible paper grain and vignette. "
    "Strictly limited palette: deep teal-green and near-black, with warm amber-yellow glow from gas lamps and "
    "lit windows as the only light, softly reflected on the ground in the foreground. One-point perspective, "
    "wide cinematic composition, foggy distance, Victorian London at night. "
    "Deserted and uninhabited, nobody in sight, no people, no figures, no text, no letters"
)

# Stile delle icone item/occupazione con z-image-turbo. Il modello NON ha prompt negativo
# (turbo, senza CFG): i divieti vanno nel prompt positivo. Sfondo scuro e neutro, per stare
# bene sullo scaffale del Mercato e nelle card; oggetto singolo e centrato, mai mani o persone.
ICON_STYLE = ("single object centered, isolated on a plain dark charcoal background, Victorian 1895 "
              "museum catalogue illustration, detailed, soft studio lighting, muted warm colors, "
              "dark background filling the entire frame edge to edge, no border, no frame, "
              "no text, no watermark, no people, no hands")

# Occupazioni: riferimento = apps/game/public/images/occupations/default-image.png (24x35 px):
# campo rosso mattone piatto (#963224) con un pittogramma crema (#cfd4bb) a linea unica. Nel gioco
# compaiono a 28-32 px: un solo simbolo, tratto spesso, nessun dettaglio.
OCCUPATION_STYLE = (
    "minimalist flat vector icon, a single simple pictogram drawn with thick uniform cream-colored outlines "
    "(color #cfd4bb), centered, on a solid flat brick red background (color #963224) filling the whole picture, "
    "no shading, no gradients, no texture, no shadow, very simple, readable at a very small size. "
    "No people, no hands, no text, no letters, no border"
)

# Config per tipo: csv sorgente, cartella output, dimensione icona di default.
# Aggiungere qui nuovi tipi (es. "characters") quando servirà.
TYPE_CONFIG = {
    "items": {
        "csv": DATA_DIR / "items.csv",
        "output_dir": ARTIFACTS_DIR / "items",
        "backend": "ollama",
        # Si genera a 512 (multiplo comodo per il modello) e si porta a 400x400 in uscita.
        "size": 512,
        "output_size": (400, 400),
        "style": ICON_STYLE,
    },
    "locations": {
        "csv": DATA_DIR / "locations.csv",
        "output_dir": ARTIFACTS_DIR / "locations",
        "backend": "ollama",
        # Le immagini esistenti sono 1536x1024 (3:2). Si genera a 1152x768 (multipli di 16,
        # stesso rapporto) e si porta a 1536x1024 in uscita.
        "size": (1152, 768),
        "output_size": (1536, 1024),
        # Le 13 immagini già presenti sono il riferimento di stile: mai sovrascritte, nemmeno con --overwrite.
        "protect_existing": True,
        "prompts_file": Path(__file__).resolve().parent / "location_prompts.json",
        # Il modello a volte incornicia la scena con un bordo sottile (chiaro o più scuro): si ritaglia
        # sempre il 5% per lato prima di riportare a 1536x1024.
        "crop_frac": 0.05,
        "style": LOCATION_STYLE,
    },
    "occupations": {
        "csv": DATA_DIR / "occupations.csv",
        "output_dir": ARTIFACTS_DIR / "occupations",
        "backend": "ollama",
        "size": 512,
        "output_size": (256, 256),
        "prompts_file": Path(__file__).resolve().parent / "occupation_prompts.json",
        # sfondo e simbolo esatti di images/occupations/default-image.png
        "duotone": ((0x96, 0x32, 0x24), (0xcf, 0xd4, 0xbb)),
        "style": OCCUPATION_STYLE,
    },
}

def read_rows(csv_path):
    """Legge un CSV saltando righe vuote e commenti (#...), come i seeder TS."""
    if not csv_path.exists():
        print(f"❌ CSV non trovato: {csv_path}")
        sys.exit(1)

    lines = []
    with csv_path.open(encoding="utf-8") as f:
        for line in f:
            stripped = line.strip()
            if not stripped or stripped.startswith("#"):
                continue
            lines.append(line)

    reader = csv.DictReader(lines, delimiter=";")
    return list(reader)


# Prompt del soggetto scritti a mano (15-25 parole concrete) per location: quelli del
# CSV (3-6 parole) vengono sovrastati dallo stile. Chiave = filename. Fallback: CSV.

def _looks_black(img_bytes):
    """True se l'immagine è (quasi) tutta nera — sintomo di NaN nel VAE su MPS."""
    if not HAS_PIL:
        return False
    try:
        img = Image.open(io.BytesIO(img_bytes)).convert("L").resize((64, 64))
        return ImageStat.Stat(img).mean[0] < 1.5
    except Exception:  # noqa: BLE001
        return False


class _OllamaServerError(RuntimeError):
    """Errore 5xx di Ollama: il runner delle immagini ogni tanto cade, vale la pena riprovare."""


def ollama_txt2img(prompt, width, height, steps, timeout, attempts=3):
    """Genera un'immagine con un modello di immagini di Ollama (POST /api/generate).

    Sugli errori 5xx e sulle immagini nere riprova (come bot-telegram-gdr). Solleva RuntimeError
    con un messaggio leggibile se Ollama non risponde o il modello non produce un'immagine.
    """
    last = None
    for n in range(attempts):
        try:
            r = requests.post(f"{OLLAMA_HOST}/api/generate", json={
                "model": OLLAMA_IMAGE_MODEL, "prompt": prompt, "stream": False,
                "width": width, "height": height, "steps": steps,
            }, timeout=timeout)
            if r.status_code >= 500:
                raise _OllamaServerError(f"Ollama ha risposto {r.status_code}: {r.text[:200]}")
            if r.status_code >= 400:
                raise RuntimeError(f"Ollama ha risposto {r.status_code}: {r.text[:200]}")
            data = r.json()
            b64 = data.get("image") or (data.get("images") or [None])[0]
            if not b64:
                raise RuntimeError(data.get("error") or f"'{OLLAMA_IMAGE_MODEL}' non ha restituito un'immagine")
            png = base64.b64decode(b64)
            if _looks_black(png):
                raise _OllamaServerError("immagine nera")
            return png
        except _OllamaServerError as e:
            last = e
            time.sleep(3)
        except requests.exceptions.RequestException as e:
            raise RuntimeError(f"Ollama non raggiungibile: {e}") from e
    raise RuntimeError(str(last))


def trim_light_margins(img, light=150, max_frac=0.15):
    """Il modello a volte «incornicia» la scena con un margine bianco/crema (anche se il prompt lo vieta).
    Si ritagliano le righe/colonne di bordo chiare, al massimo max_frac per lato, poi si ridimensiona."""
    g = img.convert("L")
    w, h = g.size
    def edge_mean(box):
        return ImageStat.Stat(g.crop(box)).mean[0]
    l, t, r, b = 0, 0, w, h
    while t < h * max_frac and edge_mean((l, t, r, t + 1)) > light: t += 1
    while (h - b) < h * max_frac and edge_mean((l, b - 1, r, b)) > light: b -= 1
    while l < w * max_frac and edge_mean((l, t, l + 1, b)) > light: l += 1
    while (w - r) < w * max_frac and edge_mean((r - 1, t, r, b)) > light: r -= 1
    if (l, t, r, b) == (0, 0, w, h):
        return img
    # qualche pixel in più: il bordo ha spesso un'ombra sfumata verso l'interno
    pad = 4
    return img.crop((min(l + pad if l else 0, w // 2), min(t + pad if t else 0, h // 2),
                     max(r - pad if r < w else w, w // 2), max(b - pad if b < h else h, h // 2)))


def to_duotone(img, bg, fg):
    """Il modello non rispetta i codici colore: si riporta l'immagine a due colori esatti (sfondo, simbolo).
    Lo sfondo è la luminanza mediana dei bordi, il simbolo il 99° percentile; in mezzo si interpola."""
    g = img.convert("L")
    w, h = g.size
    edge = sorted(list(g.crop((0, 0, w, 6)).getdata()) + list(g.crop((0, h - 6, w, h)).getdata())
                  + list(g.crop((0, 0, 6, h)).getdata()) + list(g.crop((w - 6, 0, w, h)).getdata()))
    lo = edge[len(edge) // 2]
    px = sorted(g.getdata())
    hi = px[int(len(px) * 0.99)]
    if hi - lo < 40:  # simbolo assente o sfondo non uniforme: meglio non inventare
        raise RuntimeError("duotone: contrasto insufficiente")
    mask = g.point(lambda v: max(0, min(255, round((v - lo) * 255 / (hi - lo)))))
    return Image.composite(Image.new("RGB", img.size, fg), Image.new("RGB", img.size, bg), mask)


def save_as_webp(png_bytes, out_path, output_size=None, overwrite=False, crop_frac=0.0, duotone=None):
    """Il server risponde sempre in PNG (vedi server.py); qui si converte e
    si salva in WebP, che per queste illustrazioni pesa 60-80% in meno a
    parità di qualità percepita. Niente canale alpha: sono scene/icone
    opache in stile pittorico, RGB piatto risparmia ulteriore spazio."""
    img = trim_light_margins(Image.open(io.BytesIO(png_bytes)).convert("RGB"))
    if duotone:
        img = to_duotone(img, *duotone)
    if crop_frac:
        w, h = img.size
        dx, dy = round(w * crop_frac), round(h * crop_frac)
        img = img.crop((dx, dy, w - dx, h - dy))
    if output_size and img.size != tuple(output_size):
        img = img.resize(tuple(output_size), Image.LANCZOS)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    # Rete di sicurezza: le immagini esistenti non si sovrascrivono, salvo --overwrite esplicito.
    if out_path.exists() and not overwrite:
        raise FileExistsError(f"{out_path.name} esiste già, non lo sovrascrivo")
    # Scrittura atomica: un'interruzione (Ctrl-C, crash) non lascia mai un file a metà.
    tmp = out_path.with_name(out_path.name + ".tmp")
    img.save(tmp, "WEBP", quality=WEBP_QUALITY, method=WEBP_METHOD)
    tmp.replace(out_path)


def run_row(row, config, width, height, args):
    """Genera l'artifact per una riga di CSV. Ritorna 'ok' | 'skip' | motivo."""
    filename = (row.get("filename") or "").strip()
    prompt = (row.get("prompt") or "").strip()

    if not filename:
        return "no-filename"
    if not prompt:
        return "no-prompt"

    out_path = config["output_dir"] / filename
    # Le immagini esistenti non si rigenerano (a meno di --overwrite); le location mai.
    overwrite = getattr(args, "overwrite", False) and not config.get("protect_existing")
    if out_path.exists() and not overwrite:
        return "skip"

    png = ollama_txt2img(f"{prompt}, {config.get('style', ICON_STYLE)}", width, height,
                         args.ollama_steps, args.timeout)
    save_as_webp(png, out_path, config.get("output_size"), overwrite=overwrite,
                 crop_frac=config.get("crop_frac", 0.0), duotone=config.get("duotone"))
    return "ok"


def generate_type(artifact_type, args):
    """Genera tutti gli elementi di un tipo. Ritorna (ok, skipped, failed)."""
    config = TYPE_CONFIG[artifact_type]
    if args.out_dir:
        config = {**config, "output_dir": Path(args.out_dir)}
    size = config["size"]
    default_w, default_h = size if isinstance(size, tuple) else (size, size)
    width = args.width if args.width is not None else default_w
    height = args.height if args.height is not None else default_h

    rows = read_rows(config["csv"])
    pf = config.get("prompts_file")
    if pf:
        # prompt scritti a mano (15-30 parole concrete) al posto di quelli, troppo corti, del CSV
        rich = json.loads(pf.read_text(encoding="utf-8")) if pf.exists() else {}
        rows = [{**r, "prompt": rich.get((r.get("filename") or "").strip()) or r.get("prompt")} for r in rows]
    # Le immagini esistenti non si sovrascrivono mai (vedi save_as_webp): si scartano subito,
    # PRIMA di --only/--test/--limit, altrimenti si spende GPU per un file che poi non si salva
    # e `--test` pesca proprio la prima riga, già presente.
    present = [] if (args.overwrite and not config.get("protect_existing")) else [r for r in rows if (r.get("filename") or "").strip()
               and (config["output_dir"] / (r.get("filename") or "").strip()).exists()]
    if present:
        rows = [r for r in rows if r not in present]
        print(f"⏭️  [{artifact_type}] {len(present)} già presenti in {config['output_dir'].name}/, saltati")
    if args.only:
        # più nomi separati da "|" (i nomi item contengono virgole, mai "|")
        wanted = {w.strip().lower() for w in args.only.split("|") if w.strip()}
        rows = [r for r in rows if (r.get("name") or "").lower() in wanted or (r.get("filename") or "").lower() in wanted]
    if args.test:
        rows = rows[:1]
    elif args.limit:
        rows = rows[:args.limit]
    if not rows:
        print(f"Nessun elemento trovato in {config['csv']}.")
        return 0, 0, 0

    if args.dry_run:
        print(f"📝 [{artifact_type}] DRY RUN: {len(rows)} da generare in {config['output_dir']}")
        for r in rows:
            problem = ("" if (r.get("filename") or "").strip() and (r.get("prompt") or "").strip()
                       else "  ⚠️  manca filename o prompt (verrebbe saltato)")
            print(f"   {(r.get('filename') or '?'):52} {(r.get('prompt') or '')[:60]}{problem}")
        return 0, 0, 0

    total = len(rows)
    print(f"🎨 [{artifact_type}] {total} elementi · {OLLAMA_IMAGE_MODEL} · steps={args.ollama_steps} "
          f"size={width}x{height} → {'x'.join(map(str, config.get('output_size', (width, height))))}\n")

    ok = failed = skipped = 0
    t0 = time.time()
    for i, row in enumerate(rows, 1):
        name = row.get("name", "?")
        print(f"[{i}/{total}] {name} …", end=" ", flush=True)
        tc = time.time()
        try:
            res = run_row(row, config, width, height, args)
            dt = time.time() - tc
            if res == "ok":
                print(f"✅ ({dt:.0f}s)"); ok += 1
            elif res == "skip":
                print("⏭️"); skipped += 1
            else:
                print(f"⚠️  {res}"); failed += 1
        except Exception as e:  # noqa: BLE001
            print(f"❌ {e}"); failed += 1

    dt = time.time() - t0
    print(f"\n✨ [{artifact_type}] Fatto in {dt:.0f}s — ✅ {ok}  ⏭️ {skipped}  ❌ {failed}")
    print(f"  📂 Output: {config['output_dir']}\n")
    return ok, skipped, failed


def main():
    ap = argparse.ArgumentParser(description="Genera artifact grafici (item, location, ...) con un singolo passo txt2img")
    ap.add_argument("--type", required=True, choices=sorted(TYPE_CONFIG.keys()) + ["all"],
                     help="Tipo di artifact da generare, o 'all' per farli tutti in sequenza")
    ap.add_argument("--test", action="store_true", help="Solo 1 elemento (per tipo, se --type all)")
    ap.add_argument("--limit", type=int, help="Massimo N elementi (per tipo, se --type all)")
    ap.add_argument("--only", help="Solo la location/item con questo name o filename; più valori separati da | (es. \"Borough Market\")")
    ap.add_argument("--out-dir", help="Scrivi qui invece che in apps/game/public/artifacts/<tipo> (per i giri di prova)")
    ap.add_argument("--skip-existing", action="store_true",
                     help="(compatibilità) ora è sempre attivo: i file esistenti non vengono mai rigenerati né sovrascritti")
    ap.add_argument("--overwrite", action="store_true",
                     help="Rigenera anche i file già presenti (items/occupations; mai le location). Da usare con --only o --limit")
    ap.add_argument("--dry-run", action="store_true",
                     help="Elenca cosa verrebbe generato, senza avviare il modello")
    ap.add_argument("--steps", type=int, default=None, help="Step di inferenza (default: 9, quelli di z-image-turbo)")
    ap.add_argument("--width", type=int, help="Larghezza (default: dipende dal tipo)")
    ap.add_argument("--height", type=int, help="Altezza (default: dipende dal tipo)")
    ap.add_argument("--timeout", type=int, default=3600, help="Timeout HTTP per richiesta (s)")
    args = ap.parse_args()

    # Ordine: dal più veloce al più lento (vedi sotto); qui si decide quali backend servono.
    types = ["items", "occupations", "locations"] if args.type == "all" else [args.type]
    args.ollama_steps = args.steps if args.steps is not None else OLLAMA_STEPS

    if not args.dry_run:
        try:
            tags = requests.get(f"{OLLAMA_HOST}/api/tags", timeout=10).json()
            names = {m.get("name", "") for m in tags.get("models", [])}
            if OLLAMA_IMAGE_MODEL not in names and f"{OLLAMA_IMAGE_MODEL}:latest" not in names:
                print(f"❌ Il modello '{OLLAMA_IMAGE_MODEL}' non è in Ollama. Scaricalo: ollama pull {OLLAMA_IMAGE_MODEL}")
                sys.exit(1)
            print(f"✅ Ollama: {OLLAMA_IMAGE_MODEL} · steps={args.ollama_steps}\n")
        except requests.exceptions.RequestException as e:
            print(f"❌ Ollama non raggiungibile ({OLLAMA_HOST}): {e}\n   Avvia l'app Ollama (o: ollama serve)")
            sys.exit(1)

    # Ordine: dal più veloce al più lento (items ~7s, occupations ~4s, locations
    # ~121s/immagine) — così si vede subito qualcosa mentre gira il resto.
    totals = {"ok": 0, "skipped": 0, "failed": 0}
    t0 = time.time()
    for t in types:
        ok, skipped, failed = generate_type(t, args)
        totals["ok"] += ok
        totals["skipped"] += skipped
        totals["failed"] += failed

    if len(types) > 1:
        dt = time.time() - t0
        print(f"✨✨ TUTTO completato in {dt:.0f}s — "
              f"✅ {totals['ok']}  ⏭️ {totals['skipped']}  ❌ {totals['failed']}")


if __name__ == "__main__":
    main()
