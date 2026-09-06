#!/usr/bin/env python3
"""
generate-seed-descriptions.py

Legge tutti i file {name}.content dalla cartella documents seeds,
estrae il testo dal TipTap JSON, chiama il gateway SEO per ogni documento
e scrive la description generata in {name}.description.

Uso:
  python3 scripts/seeders/generate-seed-descriptions.py [--gateway-url URL] [--api-key KEY] [--force]

Default gateway: https://onomatopoeically-unforgeable-ozie.ngrok-free.dev
Default api-key:  f4af240c291f57bcc23384bff9abcc4ce89f8257974b80e6179f88edd5f4a2f9
--force:          sovrascrive anche i .description già esistenti
"""

import json
import sys
import os
import argparse
import urllib.request
import urllib.error
import urllib.parse
import time

SEEDS_DIR = os.path.join(os.path.dirname(__file__), 'data', 'documents')
DEFAULT_GATEWAY = 'https://onomatopoeically-unforgeable-ozie.ngrok-free.dev'
DEFAULT_API_KEY = 'f4af240c291f57bcc23384bff9abcc4ce89f8257974b80e6179f88edd5f4a2f9'


def extract_text(node: dict, depth: int = 0) -> str:
    """Recursive TipTap JSON → plain text extractor."""
    parts = []
    node_type = node.get('type', '')

    if node_type == 'text':
        parts.append(node.get('text', ''))
    
    for child in node.get('content', []):
        parts.append(extract_text(child, depth + 1))
    
    text = ' '.join(p for p in parts if p.strip())

    # Add spacing after block-level nodes
    if node_type in ('heading', 'paragraph', 'bulletList', 'orderedList', 'listItem', 'blockquote'):
        text = text + ' '

    return text


def call_seo_endpoint(title: str, content: str, gateway_url: str, api_key: str) -> str | None:
    payload = json.dumps({'title': title, 'content': content}).encode('utf-8')
    req = urllib.request.Request(
        f'{gateway_url}/seo/generate-description',
        data=payload,
        headers={
            'Content-Type': 'application/json',
            'X-Api-Key': api_key,
            'ngrok-skip-browser-warning': 'true',
        },
        method='POST',
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            if data.get('success') and data.get('description'):
                return data['description']
            print(f'    ⚠ Gateway returned: {data}')
            return None
    except urllib.error.HTTPError as e:
        print(f'    ✗ HTTP {e.code}: {e.read().decode()}')
        return None
    except Exception as e:
        print(f'    ✗ Error: {e}')
        return None


def title_from_filename(filename: str) -> str:
    """abbigliamento → Abbigliamento, basic-role-playing → Basic Role Playing"""
    return ' '.join(word.capitalize() for word in filename.replace('-', ' ').split())


def main():
    parser = argparse.ArgumentParser(description='Generate SEO descriptions for document seeds')
    parser.add_argument('--gateway-url', default=DEFAULT_GATEWAY)
    parser.add_argument('--api-key', default=DEFAULT_API_KEY)
    parser.add_argument('--force', action='store_true', help='Overwrite existing .description files')
    args = parser.parse_args()

    # Valida l'URL prima di usarlo in richieste di rete (pythonsecurity:S8703):
    # solo http/https con host esplicito.
    parsed_url = urllib.parse.urlparse(args.gateway_url)
    if parsed_url.scheme not in ('http', 'https') or not parsed_url.netloc:
        sys.exit(f'Gateway URL non valido: {args.gateway_url!r} (atteso http(s)://host)')

    content_files = sorted(f for f in os.listdir(SEEDS_DIR) if f.endswith('.content'))
    total = len(content_files)
    print(f'Found {total} .content files in {SEEDS_DIR}')
    print(f'Gateway: {args.gateway_url}')
    print(f'Force overwrite: {args.force}')
    print()

    ok = 0
    skipped = 0
    failed = 0

    for i, filename in enumerate(content_files, 1):
        name = filename[:-len('.content')]
        content_path = os.path.join(SEEDS_DIR, filename)
        desc_path = os.path.join(SEEDS_DIR, f'{name}.description')
        title = title_from_filename(name)

        print(f'[{i:02d}/{total}] {name}', end='  ', flush=True)

        # Skip if description already exists and --force not set
        if os.path.exists(desc_path) and not args.force:
            existing = open(desc_path).read().strip()
            if existing:
                print(f'→ skip (already has description)')
                skipped += 1
                continue

        # Parse TipTap JSON and extract text
        try:
            with open(content_path, 'r', encoding='utf-8') as f:
                tiptap = json.load(f)
            text = extract_text(tiptap).strip()
            text = ' '.join(text.split())  # normalize whitespace
        except Exception as e:
            print(f'→ ✗ Failed to parse: {e}')
            failed += 1
            continue

        # Call SEO endpoint
        description = call_seo_endpoint(title, text[:800], args.gateway_url, args.api_key)

        if description:
            with open(desc_path, 'w', encoding='utf-8') as f:
                f.write(description)
            print(f'→ ✓ [{len(description)} chars] {description}')
            ok += 1
        else:
            print(f'→ ✗ No description generated')
            failed += 1

        # Small delay to avoid hammering Ollama
        if i < total:
            time.sleep(0.5)

    print()
    print(f'Done: {ok} generated, {skipped} skipped, {failed} failed')


if __name__ == '__main__':
    main()
