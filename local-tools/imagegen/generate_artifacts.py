#!/usr/bin/env python3
"""
Genera artifact grafici (item, occupazioni, location) di TenpennyNovels con un SINGOLO
passo txt2img. Sostituisce generate_items.py, generalizzato per tipo.

DUE BACKEND (per tipo, vedi TYPE_CONFIG):
  - "ollama" (items, occupations): modello di immagini di Ollama (default x/z-image-turbo,
    stesso approccio di bot-telegram-gdr). Niente server Python: basta Ollama acceso e
    `ollama pull x/z-image-turbo` (circa 12 GB). ~30 s a immagine su Apple Silicon.
  - "local" (locations): il server diffusers di server.py (Qwen-Image 2.1 / SDXL / SD1.5),
    con le immagini di riferimento di stile. Va avviato con run.sh / run_pipeline.sh.

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
import base64
import csv
import hashlib
import io
import json
import os
import re
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
    "Victorian London 1889, night. Flat 2D graphic illustration, noir graphic-novel poster style, "
    "bold dark silhouettes, minimal texture, subtle film grain and vignette. Strictly limited palette: "
    "deep teal-green and near-black, with warm amber-yellow glow from gas lamps and lit windows as the "
    "only light, softly reflected on the ground in the foreground (wet cobblestones, planks, pavement) so the "
    "lower part of the image is not pitch black. One-point perspective, wide cinematic composition, foggy "
    "distance, completely empty of people, no text"
)
LOCATION_NEGATIVE = ("photo, photorealistic, oil painting, 3d render, people, person, crowd, face, "
                      "text, letters, watermark, frame, border, blurry, low quality, deformed, "
                      "bright colors, daylight, multiple copies")

# Stile delle icone item/occupazione con z-image-turbo. Il modello NON ha prompt negativo
# (turbo, senza CFG): i divieti vanno nel prompt positivo. Sfondo scuro e neutro, per stare
# bene sullo scaffale del Mercato e nelle card; oggetto singolo e centrato, mai mani o persone.
ICON_STYLE = ("single object centered, isolated on a plain dark charcoal background, Victorian 1895 "
              "museum catalogue illustration, detailed, soft studio lighting, muted warm colors, "
              "dark background filling the entire frame edge to edge, no border, no frame, "
              "no text, no watermark, no people, no hands")

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
        # Le immagini esistenti sono 1536x1024 (3:2). SD1.5 regge bene ~768x512
        # (oltre duplica i soggetti): si genera piccolo e si porta a 1536x1024
        # in uscita. Con FLUX/SDXL si può generare nativo (--width/--height).
        "size": (768, 512),
        "output_size": (1536, 1024),
        "source": "db",
        "style": LOCATION_STYLE,
        "negative": LOCATION_NEGATIVE,
    },
    "occupations": {
        "csv": DATA_DIR / "occupations.csv",
        "output_dir": ARTIFACTS_DIR / "occupations",
        "backend": "ollama",
        "size": 512,
        "output_size": (100, 100),
        "style": ICON_STYLE,
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


# Parole che nel soggetto spingono il modello a popolare la scena (verificato su
# Borough Market: "crowded" → folla di sagome, battendo "empty of people").
_PEOPLE_WORDS = re.compile(r"\b(crowded|busy|bustling|packed|crowd|people|merchants|shoppers)\b,?\s*", re.I)


def clean_subject(prompt):
    return _PEOPLE_WORDS.sub("", prompt).strip(" ,")


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


# Prompt del soggetto scritti a mano (15-25 parole concrete) per location: quelli del
# CSV (3-6 parole) vengono sovrastati dallo stile. Chiave = filename. Fallback: CSV.
RICH_PROMPTS_FILE = Path(__file__).resolve().parent / "location_prompts.json"

# Immagini esistenti usate come riferimento di stile (solo Qwen). Una esterna, una interna.
REFERENCE_IMAGES = ["wapping-docks.webp", "british-museum.webp"]
REFERENCE_STYLE = (
    "Create a new scene in exactly the same illustration style, color palette, amber lighting, "
    "film grain and flat graphic look as the reference images, but showing a different place: "
)
REFERENCE_SUFFIX = ". Wide cinematic composition, no people, no text"


def load_reference_images(max_side=768):
    out = []
    for name in REFERENCE_IMAGES:
        img = Image.open(ARTIFACTS_DIR / "locations" / name).convert("RGB")
        img.thumbnail((max_side, max_side))
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        out.append(base64.b64encode(buf.getvalue()).decode())
    return out


def read_location_rows_from_db(csv_path):
    """Elenco location dal DB (fonte di verità), prompt dal CSV.

    Il DB ha name/image ma non il prompt (esiste solo per pilotare la
    generazione, vedi README): lo si recupera dal CSV via `filename`, con
    fallback sul nome della location se la riga non c'è (location create da
    gestionale). Nessuna scrittura sul DB: solo lettura.
    """
    try:
        from pymongo import MongoClient
    except ImportError:
        print("❌ manca pymongo: cd local-tools/imagegen && .venv/bin/pip install -r requirements.txt")
        sys.exit(1)

    uri = os.environ.get(
        "MONGODB_URI", "mongodb://admin:admin123@localhost:27017/tenpennynovels?authSource=admin")
    db = MongoClient(uri, serverSelectionTimeoutMS=5000).get_default_database()
    docs = list(db.locations.find(
        {"deletedAt": None, "image": {"$nin": [None, ""]}},
        {"name": 1, "image": 1, "parentLocationId": 1}).sort("_id", 1))
    names = {d["_id"]: d["name"] for d in db.locations.find({}, {"name": 1})}

    rich = json.loads(RICH_PROMPTS_FILE.read_text(encoding="utf-8")) if RICH_PROMPTS_FILE.exists() else {}
    csv_prompts = {(r.get("filename") or "").strip(): (r.get("prompt") or "").strip()
                   for r in read_rows(csv_path)}
    rows = []
    for d in docs:
        filename = d["image"].strip()
        prompt = rich.get(filename) or csv_prompts.get(filename) or d["name"]
        rows.append({"name": d["name"], "filename": filename, "prompt": prompt,
                     "parent": names.get(d.get("parentLocationId"), "")})
    return rows


def _looks_black(img_bytes):
    """True se l'immagine è (quasi) tutta nera — sintomo di NaN nel VAE su MPS."""
    if not HAS_PIL:
        return False
    try:
        img = Image.open(io.BytesIO(img_bytes)).convert("L").resize((64, 64))
        return ImageStat.Stat(img).mean[0] < 1.5
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


def save_as_webp(png_bytes, out_path, output_size=None, overwrite=False):
    """Il server risponde sempre in PNG (vedi server.py); qui si converte e
    si salva in WebP, che per queste illustrazioni pesa 60-80% in meno a
    parità di qualità percepita. Niente canale alpha: sono scene/icone
    opache in stile pittorico, RGB piatto risparmia ulteriore spazio."""
    img = Image.open(io.BytesIO(png_bytes)).convert("RGB")
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
    overwrite = getattr(args, "overwrite", False) and config.get("source") != "db"
    if out_path.exists() and not overwrite:
        return "skip"

    if config.get("backend") == "ollama":
        png = ollama_txt2img(f"{prompt}, {config.get('style', ICON_STYLE)}", width, height,
                             args.ollama_steps, args.timeout)
        save_as_webp(png, out_path, config.get("output_size"), overwrite=overwrite)
        return "ok"

    refs = getattr(args, "references", None)
    if config.get("source") == "db":
        prompt = clean_subject(prompt)
    if refs:
        full_prompt = f"{REFERENCE_STYLE}{prompt}{REFERENCE_SUFFIX}"
    elif config.get("source") == "db":
        full_prompt = f"{prompt}. {config.get('style', STYLE_SUFFIX)}"
    else:
        full_prompt = f"{prompt}, {config.get('style', STYLE_SUFFIX)}"
    data = post_txt2img({
        **({"images": refs} if refs else {}),
        "prompt": full_prompt,
        "negative_prompt": config.get("negative", NEGATIVE_PROMPT),
        "steps": args.steps,
        "guidance": args.guidance,
        "seed": stable_seed(filename),
        "width": width,
        "height": height,
    }, args.timeout)

    save_as_webp(data, out_path, config.get("output_size"), overwrite=overwrite)
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

    if config.get("source") == "db":
        rows = read_location_rows_from_db(config["csv"])
        # Solo quelle senza file su disco: le esistenti non rientrano nemmeno nel conteggio.
        rows = [r for r in rows if not (config["output_dir"] / r["filename"]).exists()]
    else:
        rows = read_rows(config["csv"])
        # Le immagini esistenti non si sovrascrivono mai (vedi save_as_webp): si scartano subito,
        # PRIMA di --only/--test/--limit, altrimenti si spende GPU per un file che poi non si salva
        # e `--test` pesca proprio la prima riga, già presente.
        present = [] if args.overwrite else [r for r in rows if (r.get("filename") or "").strip()
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
    if config.get("backend") == "ollama":
        print(f"🎨 [{artifact_type}] {total} elementi · {OLLAMA_IMAGE_MODEL} · steps={args.ollama_steps} "
              f"size={width}x{height} → {'x'.join(map(str, config.get('output_size', (width, height))))}\n")
    else:
        print(f"🎨 [{artifact_type}] {total} elementi · steps={args.steps} "
              f"size={width}x{height} guidance={args.guidance}\n")

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
    ap.add_argument("--no-reference", action="store_true", help="Qwen: non usare le immagini di riferimento di stile")
    ap.add_argument("--skip-existing", action="store_true",
                     help="(compatibilità) ora è sempre attivo: i file esistenti non vengono mai rigenerati né sovrascritti")
    ap.add_argument("--overwrite", action="store_true",
                     help="Rigenera anche i file già presenti (items/occupations; mai le location). Da usare con --only o --limit")
    ap.add_argument("--dry-run", action="store_true",
                     help="Elenca cosa verrebbe generato, senza avviare il server né il modello")
    ap.add_argument("--steps", type=int, default=None, help="Step di inferenza (default: 30, 20 con Qwen)")
    ap.add_argument("--guidance", type=float, default=None, help="Guidance (default: 7.5, 1.0 con Qwen = senza CFG)")
    ap.add_argument("--width", type=int, help="Larghezza (default: dipende dal tipo)")
    ap.add_argument("--height", type=int, help="Altezza (default: dipende dal tipo)")
    ap.add_argument("--timeout", type=int, default=3600, help="Timeout HTTP per richiesta (s)")
    args = ap.parse_args()

    # Ordine: dal più veloce al più lento (vedi sotto); qui si decide quali backend servono.
    types = ["items", "occupations", "locations"] if args.type == "all" else [args.type]
    needs_local = any(TYPE_CONFIG[t].get("backend", "local") == "local" for t in types)
    needs_ollama = any(TYPE_CONFIG[t].get("backend") == "ollama" for t in types)
    args.ollama_steps = args.steps if args.steps is not None else OLLAMA_STEPS

    if not args.dry_run and needs_ollama:
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

    if not args.dry_run and needs_local:
        try:
            h = requests.get(f"{API_BASE}/health", timeout=10).json()
            print(f"✅ Server: {h}\n")
            is_qwen = h.get("type") == "qwen"
            if args.steps is None:
                args.steps = 20 if is_qwen else 30
            if args.guidance is None:
                args.guidance = 1.0 if is_qwen else 7.5
            # Qwen regge una risoluzione di generazione più alta di SD1.5; si porta comunque a 1536x1024.
            if is_qwen and args.width is None and args.height is None:
                args.width, args.height = 1152, 768
            args.references = load_reference_images() if is_qwen and not args.no_reference else None
        except Exception as e:  # noqa: BLE001
            print(f"❌ Server non raggiungibile: {e}\n   Avvia: cd local-tools/imagegen && bash run.sh")
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
