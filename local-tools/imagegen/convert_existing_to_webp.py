#!/usr/bin/env python3
"""
Conversione una tantum degli artifact PNG già generati (items, locations,
occupations) in WebP. Da lanciare una sola volta per smaltire il backlog
prodotto prima che generate_artifacts.py salvasse direttamente in WebP.

Uso:
  python convert_existing_to_webp.py                # converte tutto, cancella i PNG originali
  python convert_existing_to_webp.py --dry-run       # mostra solo cosa farebbe
  python convert_existing_to_webp.py --keep-png      # tiene anche l'originale (debug)
"""

import argparse
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent.parent
ARTIFACTS_DIR = ROOT / "apps" / "game" / "public" / "artifacts"
SUBDIRS = ["items", "locations", "occupations"]

WEBP_QUALITY = 85
WEBP_METHOD = 6


def convert_one(png_path, keep_png, dry_run):
    webp_path = png_path.with_suffix(".webp")
    before = png_path.stat().st_size

    if dry_run:
        print(f"  [dry-run] {png_path.name} → {webp_path.name}")
        return before, None

    img = Image.open(png_path).convert("RGB")
    img.save(webp_path, "WEBP", quality=WEBP_QUALITY, method=WEBP_METHOD)
    after = webp_path.stat().st_size

    if not keep_png:
        png_path.unlink()

    return before, after


def main():
    ap = argparse.ArgumentParser(description="Converte in WebP gli artifact PNG già generati")
    ap.add_argument("--dry-run", action="store_true", help="Non scrive/cancella nulla, mostra solo cosa farebbe")
    ap.add_argument("--keep-png", action="store_true", help="Tiene anche il PNG originale invece di cancellarlo")
    args = ap.parse_args()

    total_before = 0
    total_after = 0
    total_files = 0

    for sub in SUBDIRS:
        d = ARTIFACTS_DIR / sub
        pngs = sorted(d.glob("*.png"))
        if not pngs:
            print(f"📂 {sub}: nessun PNG da convertire\n")
            continue

        print(f"📂 {sub}: {len(pngs)} file")
        sub_before = sub_after = 0
        for p in pngs:
            before, after = convert_one(p, args.keep_png, args.dry_run)
            sub_before += before
            if after is not None:
                sub_after += after
            total_files += 1

        total_before += sub_before
        if not args.dry_run:
            total_after += sub_after
            pct = 100 * (1 - sub_after / sub_before) if sub_before else 0
            print(f"   {sub_before/1e6:.1f}MB → {sub_after/1e6:.1f}MB  (-{pct:.0f}%)\n")
        else:
            print()

    if args.dry_run:
        print(f"✨ [dry-run] {total_files} file, {total_before/1e6:.1f}MB totali da convertire")
    else:
        pct = 100 * (1 - total_after / total_before) if total_before else 0
        print(f"✨ Fatto: {total_files} file, {total_before/1e6:.1f}MB → {total_after/1e6:.1f}MB totali (-{pct:.0f}%)")
        if not args.keep_png:
            print("   PNG originali cancellati.")


if __name__ == "__main__":
    main()
