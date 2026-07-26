#!/usr/bin/env python3
"""
generate-item-image-columns.py

One-off: aggiunge le colonne "filename" e "prompt" a data/items.csv.

- filename = slug(name) + ".png"                    → va a DB (Item.image)
- prompt   = prompt inglese generato via Ollama locale → NON va a DB, serve solo
             a local-tools/imagegen/generate_items.py per generare le icone.

Preserva riga per riga il file originale (commenti "# SEZIONE", righe vuote,
quoting) — appende solo le due colonne in coda a ogni riga dati.

Uso:
  python3 scripts/seeders/generate-item-image-columns.py [--force] [--ollama-url URL] [--model NAME]

--force: rigenera anche le righe che hanno già un "prompt" non vuoto
Default Ollama: http://localhost:11434, modello qwen3:8b
"""

import argparse
import csv
import io
import json
import os
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.request

CSV_PATH = os.path.join(os.path.dirname(__file__), 'data', 'items.csv')
DEFAULT_OLLAMA_URL = 'http://localhost:11434'
DEFAULT_MODEL = 'qwen3:8b'

CATEGORY_HINT = {
    'tools': 'tool / instrument',
    'consumables': 'consumable item',
    'books': 'book',
    'weapons': 'weapon',
    'clothing': 'piece of clothing',
    'accessories': 'personal accessory',
    'documents': 'paper document',
}


def slugify(text: str) -> str:
    normalized = unicodedata.normalize('NFKD', text)
    ascii_text = normalized.encode('ascii', 'ignore').decode('ascii')
    slug = re.sub(r'[^a-zA-Z0-9]+', '-', ascii_text).strip('-').lower()
    return slug


def csv_quote(value: str) -> str:
    """Quota un valore per il formato items.csv: doppie virgolette, escape raddoppiando."""
    return '"' + value.replace('"', '""') + '"'


def parse_data_line(line: str):
    """Split di una riga dati rispettando le virgolette."""
    reader = csv.reader(io.StringIO(line), delimiter=';', quotechar='"')
    return next(reader)


def normalize_fields(fields: list, expected_len: int) -> list:
    """~31 righe di items.csv hanno un campo vuoto di troppo tra 'consumptionType' e
    'rarity' (bug pre-esistente nei dati, non introdotto da questo script) — questo
    sfasa il mapping posizionale nome-colonna sia qui che in ItemSeeder.ts
    (relax_column_count tollera il conteggio diverso ma NON lo riallinea). Le prime
    8 colonne (name..consumptionType) e l'ultima (rarity) sono sempre affidabili;
    l'anomalia è sempre nella zona centrale (consumesItems/providesSkillBonus),
    sempre come campi vuoti extra — li rimuoviamo per tornare a `expected_len`."""
    if len(fields) == expected_len:
        return fields
    head, middle, tail = fields[:8], fields[8:-1], [fields[-1]]
    if len(fields) > expected_len:
        extra = len(fields) - expected_len
        removed = 0
        new_middle = []
        for v in middle:
            if v == '' and removed < extra:
                removed += 1
                continue
            new_middle.append(v)
        return head + new_middle + tail
    # meno campi del previsto: mai osservato nei dati attuali, ma per sicurezza
    # riempiamo con stringhe vuote invece di far esplodere lo script
    pad = [''] * (expected_len - len(fields))
    return head + middle + pad + tail


def call_ollama(system_prompt: str, user_message: str, ollama_url: str, model: str) -> str | None:
    payload = json.dumps({
        'model': model,
        'messages': [
            {'role': 'system', 'content': system_prompt},
            {'role': 'user', 'content': user_message},
        ],
        'options': {'temperature': 0.4, 'num_predict': 120},
        'stream': False,
        'think': False,  # qwen3 è un modello reasoning: senza questo, "thinking" mangia
                          # tutto num_predict e "content" resta vuoto (vedi debug)
    }).encode('utf-8')
    req = urllib.request.Request(
        f'{ollama_url}/api/chat',
        data=payload,
        headers={'Content-Type': 'application/json'},
        method='POST',
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            text = data.get('message', {}).get('content', '').strip()
            # Rimuove eventuale ragionamento <think>...</think> di modelli reasoning
            text = re.sub(r'<think>.*?</think>', '', text, flags=re.DOTALL).strip()
            # Una riga sola, senza virgolette superflue attorno
            text = text.splitlines()[0].strip().strip('"').strip() if text else ''
            return text or None
    except urllib.error.URLError as e:
        print(f'    ✗ Ollama non raggiungibile: {e}')
        return None
    except Exception as e:  # noqa: BLE001
        print(f'    ✗ Errore: {e}')
        return None


def build_prompt(name: str, description: str, category: str, subcategory: str, ollama_url: str, model: str) -> str:
    hint = CATEGORY_HINT.get(category, 'object')
    # SHORT DI PROPOSITO (max ~12 parole, stile virgola, non frase discorsiva):
    # verificato empiricamente che prompt lunghi/discorsivi ("featuring...",
    # "designed for...") mandano in crisi sia SDXL (cornici ornamentali/collage)
    # sia SD1.5 (soggetto sbagliato). Poche parole concrete battono la prosa.
    system = (
        "You write SHORT prompts (max 12 words) for an AI image generator, for "
        "Victorian-era (1888 London) RPG game item icons. Given an item's Italian "
        "name, reply with ONLY a comma-separated list of concrete visual "
        "descriptors (material, color, shape) — NOT a sentence. No 'featuring', "
        "no 'designed for', no storytelling, no commentary, no quotes.\n\n"
        "Good: \"brass stethoscope, leather tube, worn metal\"\n"
        "Bad: \"A brass stethoscope featuring a leather strap, designed for "
        "19th-century medical use in Victorian London.\""
    )
    user = (
        f'Item name (Italian): "{name}"\n'
        f'Category: {category} ({hint}), subcategory: {subcategory}\n'
        f'Short comma-separated visual descriptors:'
    )
    result = call_ollama(system, user, ollama_url, model)
    if result:
        return result
    # Fallback se Ollama non risponde: prompt minimo ma utilizzabile
    return f'{name}, a Victorian era {hint}, {subcategory}'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--force', action='store_true', help='Rigenera anche righe con prompt già presente')
    ap.add_argument('--ollama-url', default=DEFAULT_OLLAMA_URL)
    ap.add_argument('--model', default=DEFAULT_MODEL)
    args = ap.parse_args()

    if not os.path.exists(CSV_PATH):
        print(f'❌ CSV non trovato: {CSV_PATH}')
        sys.exit(1)

    with open(CSV_PATH, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    if not lines:
        print('❌ CSV vuoto')
        sys.exit(1)

    header_fields = parse_data_line(lines[0].rstrip('\n'))
    already_has_columns = 'filename' in header_fields and 'prompt' in header_fields
    if already_has_columns and not args.force:
        print('⚠️  Il CSV ha già le colonne filename/prompt. Uso --force per rigenerare.')

    name_idx = header_fields.index('name')
    desc_idx = header_fields.index('description')
    cat_idx = header_fields.index('category')
    subcat_idx = header_fields.index('subcategory')

    out_lines = []
    data_row_count = sum(
        1 for l in lines[1:] if l.strip() and not l.strip().startswith('#')
    )
    print(f'📋 {data_row_count} item da processare · Ollama: {args.ollama_url} ({args.model})\n')

    processed = i_data = 0
    for line in lines:
        stripped = line.rstrip('\n')

        if not stripped.strip():
            out_lines.append(line)
            continue
        if stripped.strip().startswith('#'):
            out_lines.append(line)
            continue
        if stripped.strip().startswith('"name"'):  # header
            out_lines.append(stripped + ';"filename";"prompt"\n')
            continue

        i_data += 1
        fields = parse_data_line(stripped)
        if len(fields) != len(header_fields):
            fields = normalize_fields(fields, len(header_fields))
        name = fields[name_idx] if len(fields) > name_idx else ''
        description = fields[desc_idx] if len(fields) > desc_idx else ''
        category = fields[cat_idx] if len(fields) > cat_idx else ''
        subcategory = fields[subcat_idx] if len(fields) > subcat_idx else ''

        filename = f'{slugify(name)}.png'

        print(f'[{i_data:02d}/{data_row_count}] {name} …', end=' ', flush=True)
        prompt = build_prompt(name, description, category, subcategory, args.ollama_url, args.model)
        print(f'→ {prompt}')

        new_row = fields + [filename, prompt]
        out_lines.append(';'.join(csv_quote(v) for v in new_row) + '\n')
        processed += 1

        time.sleep(0.2)  # non martellare Ollama

    with open(CSV_PATH, 'w', encoding='utf-8') as f:
        f.writelines(out_lines)

    print(f'\n✨ Fatto: {processed} righe aggiornate. Scritto in {CSV_PATH}')


if __name__ == '__main__':
    main()
