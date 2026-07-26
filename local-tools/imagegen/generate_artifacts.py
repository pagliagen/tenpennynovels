#!/usr/bin/env python3
"""
Genera artifact grafici (item, location, ...) di TenpennyNovels con un SINGOLO
passo txt2img. Sostituisce generate_items.py, generalizzato per tipo.

Storia breve (vedi git log): prompt lunghi/discorsivi → soggetto irriconoscibile
o composizioni confuse. Un secondo passo img2img "atmosfera" → artefatti di
duplicazione. La causa vera era il prompt sovraccarico: con un prompt CORTO
(soggetto + 4-5 parole di stile) un solo txt2img basta. Anche SDXL è stato
scartato (vedi server.py): su MPS produce artefatti a strisce/griglia
intermittenti — si usa SD1.5, stabile.

Legge scripts/seeders/data/{tipo}.csv (stesso formato usato dai seeder TS via
csv-parse: delimitatore ";", righe commento con "#") e per ogni riga con un
campo "prompt" non vuoto genera apps/game/public/artifacts/{tipo}/{filename}.

Uso:
  python generate_artifacts.py --type items                    # tutti gli item (400x400)
  python generate_artifacts.py --type locations                # tutte le location (1024x1024)
  python generate_artifacts.py --type items --test              # 1 solo, giro completo di prova
  python generate_artifacts.py --type items --limit 5
  python generate_artifacts.py --type items --skip-existing     # riprende un run interrotto

Il modello si sceglie all'avvio del server (env IMAGEGEN_MODEL, default SD1.5 —
vedi server.py). Avviare prima il server con: bash run.sh
"""

import argparse
import csv
import hashlib
import io
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

API_BASE = "http://127.0.0.1:8791"

ROOT = Path(__file__).resolve().parent.parent.parent
DATA_DIR = ROOT / "scripts" / "seeders" / "data"
ARTIFACTS_DIR = ROOT / "apps" / "game" / "public" / "artifacts"

# Config per tipo: csv sorgente, cartella output, dimensione icona di default.
# Aggiungere qui nuovi tipi (es. "characters") quando servirà.
TYPE_CONFIG = {
    "items": {
        "csv": DATA_DIR / "items.csv",
        "output_dir": ARTIFACTS_DIR / "items",
        "size": 400,
    },
    "locations": {
        "csv": DATA_DIR / "locations.csv",
        "output_dir": ARTIFACTS_DIR / "locations",
        "size": 1024,
    },
    "occupations": {
        "csv": DATA_DIR / "occupations.csv",
        "output_dir": ARTIFACTS_DIR / "occupations",
        "size": 100,
    },
}

# Suffisso di stile fisso, appeso a ogni prompt. CORTO DI PROPOSITO: un prompt
# lungo e impilato di aggettivi diluisce l'attenzione del modello sul soggetto
# (verificato empiricamente). Stile allineato a
# apps/game/public/locations/london_boroughs.png.
STYLE_SUFFIX = "oil painting, moody dramatic lighting, muted colors"

# Anche qui, corto di proposito (vedi server.py per il perché). Ridondante col
# default del server (DEFAULT_NEG) ma esplicito qui per chiarezza/override facile.
NEGATIVE_PROMPT = ("cartoon, flat colors, vector art, anime, comic, sticker, "
                    "text, watermark, frame, border, blurry, low quality, deformed")


def stable_seed(filename, salt=0):
    h = hashlib.md5(f"{salt}:{filename}".encode()).hexdigest()
    return int(h[:8], 16)


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


def _looks_black(img_bytes):
    """True se l'immagine è (quasi) tutta nera — sintomo di NaN nel VAE su MPS."""
    if not HAS_PIL:
        return False
    try:
        img = Image.open(io.BytesIO(img_bytes)).convert("L").resize((64, 64))
        return ImageStat.Stat(img).mean[0] < 4.0
    except Exception:  # noqa: BLE001
        return False


def _post(endpoint, payload, timeout, retries=2):
    """POST con retry anti-nero: se l'output è nero (NaN su MPS), rigenera con altro seed."""
    for attempt in range(retries + 1):
        r = requests.post(f"{API_BASE}/{endpoint}", json=payload, timeout=timeout)
        r.raise_for_status()
        if not _looks_black(r.content):
            return r.content
        payload = {**payload, "seed": int(payload.get("seed", 0)) + 9973 * (attempt + 1)}
        print("↻", end="", flush=True)  # ritento (nero)
    return r.content  # ultima chance anche se nera


def post_txt2img(payload, timeout, retries=2):
    return _post("txt2img", payload, timeout, retries)


def save_as_webp(png_bytes, out_path):
    """Il server risponde sempre in PNG (vedi server.py); qui si converte e
    si salva in WebP, che per queste illustrazioni pesa 60-80% in meno a
    parità di qualità percepita. Niente canale alpha: sono scene/icone
    opache in stile pittorico, RGB piatto risparmia ulteriore spazio."""
    img = Image.open(io.BytesIO(png_bytes)).convert("RGB")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(out_path, "WEBP", quality=WEBP_QUALITY, method=WEBP_METHOD)


def run_row(row, output_dir, width, height, args):
    """Genera l'artifact per una riga di CSV. Ritorna 'ok' | 'skip' | motivo."""
    filename = (row.get("filename") or "").strip()
    prompt = (row.get("prompt") or "").strip()

    if not filename:
        return "no-filename"
    if not prompt:
        return "no-prompt"

    out_path = output_dir / filename
    if args.skip_existing and out_path.exists():
        return "skip"

    full_prompt = f"{prompt}, {STYLE_SUFFIX}"
    data = post_txt2img({
        "prompt": full_prompt,
        "negative_prompt": NEGATIVE_PROMPT,
        "steps": args.steps,
        "guidance": args.guidance,
        "seed": stable_seed(filename),
        "width": width,
        "height": height,
    }, args.timeout)

    save_as_webp(data, out_path)
    return "ok"


def generate_type(artifact_type, args):
    """Genera tutti gli elementi di un tipo. Ritorna (ok, skipped, failed)."""
    config = TYPE_CONFIG[artifact_type]
    width = args.width if args.width is not None else config["size"]
    height = args.height if args.height is not None else config["size"]

    rows = read_rows(config["csv"])
    if args.test:
        rows = rows[:1]
    elif args.limit:
        rows = rows[:args.limit]
    if not rows:
        print(f"Nessun elemento trovato in {config['csv']}.")
        return 0, 0, 0

    total = len(rows)
    print(f"🎨 [{artifact_type}] {total} elementi · steps={args.steps} "
          f"size={width}x{height} guidance={args.guidance}\n")

    ok = failed = skipped = 0
    t0 = time.time()
    for i, row in enumerate(rows, 1):
        name = row.get("name", "?")
        print(f"[{i}/{total}] {name} …", end=" ", flush=True)
        tc = time.time()
        try:
            res = run_row(row, config["output_dir"], width, height, args)
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
    ap.add_argument("--skip-existing", action="store_true", help="Salta elementi il cui file esiste già")
    ap.add_argument("--steps", type=int, default=30, help="Step di inferenza (test: 8-10)")
    ap.add_argument("--guidance", type=float, default=7.5)
    ap.add_argument("--width", type=int, help="Larghezza (default: dipende dal tipo)")
    ap.add_argument("--height", type=int, help="Altezza (default: dipende dal tipo)")
    ap.add_argument("--timeout", type=int, default=3600, help="Timeout HTTP per richiesta (s)")
    args = ap.parse_args()

    try:
        h = requests.get(f"{API_BASE}/health", timeout=10).json()
        print(f"✅ Server: {h}\n")
    except Exception as e:  # noqa: BLE001
        print(f"❌ Server non raggiungibile: {e}\n   Avvia: cd local-tools/imagegen && bash run.sh")
        sys.exit(1)

    # Ordine: dal più veloce al più lento (items ~7s, occupations ~4s, locations
    # ~121s/immagine) — così si vede subito qualcosa mentre gira il resto.
    types = ["items", "occupations", "locations"] if args.type == "all" else [args.type]

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
