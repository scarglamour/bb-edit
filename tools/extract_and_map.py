#!/usr/bin/env python3
import os
import json
import argparse
import zipfile

"""
Extract files listed in asset-map.json. If --all is provided, also
fall back to pattern-based extraction for unmapped entries and report them.
"""

# Define fallback patterns: archive path substring -> output subfolder
PATTERN_MAP = {
    'gfx/ui/items/accessory/':      'accessory',
    'gfx/ui/items/ammo/':           'ammo',
    'gfx/ui/items/armor/':          'armor',
    'gfx/ui/items/armor_upgrades/': 'armor-upgrades',
    'gfx/ui/backgrounds/':          'backgrounds',
    'gfx/ui/items/consumables/':    'consumables',
    'gfx/ui/items/helmets/':        'helmets',
    'gfx/ui/injury/':               'injury',
    'gfx/ui/items/loot/':           'loot',
    'gfx/ui/items/misc/':           'misc',
    'gfx/ui/perks/':                'perks',
    'gfx/ui/items/shields/':        'shields',
    'gfx/skills/':                  'skills',
    'gfx/ui/items/supplies/':       'supplies',
    'gfx/ui/items/tools/':          'tools',
    'gfx/ui/items/trade/':          'trade',
    'gfx/ui/traits/':               'traits',
    'gfx/ui/items/weapons/':        'weapons'
}

EXTENSIONS = ['.png']


def extract_mapped(zf, out_dir, file_map):
    mapped = {}
    for src, dst in file_map.items():
        if src in zf.namelist():
            data = zf.read(src)
            target = os.path.join(out_dir, dst)
            os.makedirs(os.path.dirname(target), exist_ok=True)
            with open(target, 'wb') as f:
                f.write(data)
            print(f"Mapped {src} → {dst}")
            mapped[src] = dst
        else:
            print(f"[WARN] Archive missing: {src}")
    return mapped


def extract_fallback(zf, out_dir, already_mapped):
    fallback_extracted = []
    for member in zf.namelist():
        if member in already_mapped:
            continue
        if not any(member.lower().endswith(ext) for ext in EXTENSIONS):
            continue
        for prefix, sub in PATTERN_MAP.items():
            if prefix in member:
                data = zf.read(member)
                name = os.path.basename(member)
                target = os.path.join(out_dir, sub, name)
                os.makedirs(os.path.dirname(target), exist_ok=True)
                with open(target, 'wb') as f:
                    f.write(data)
                print(f"Fallback extract {member} → {sub}/{name}")
                fallback_extracted.append(member)
                break
    return fallback_extracted


def main():
    parser = argparse.ArgumentParser(
        description="Extract assets with optional fallback for unmapped entries"
    )
    parser.add_argument('--dat',  required=True, help='Path to data_001.dat')
    parser.add_argument('--out',  default='game-art', help='Output directory')
    parser.add_argument('--map',  default='asset-map.json', help='Mapping JSON')
    parser.add_argument('--all',  action='store_true', help='Include fallback extraction')
    args = parser.parse_args()

    if not os.path.isfile(args.dat):
        print(f"Error: dat file not found: {args.dat}")
        return
    if not os.path.isfile(args.map):
        print(f"Error: mapping file not found: {args.map}")
        return

    with open(args.map, 'r', encoding='utf-8') as mf:
        file_map = json.load(mf)

    os.makedirs(args.out, exist_ok=True)
    with zipfile.ZipFile(args.dat, 'r') as zf:
        # 1) extract mapped entries
        mapped = extract_mapped(zf, args.out, file_map)

        # 2) optional fallback
        fallback = []
        if args.all:
            fallback = extract_fallback(zf, args.out, set(mapped.keys()))

    total = len(file_map)
    matched = len(mapped)
    missing = set(file_map.keys()) - set(mapped.keys())

    print(f"\nTotal mapped {matched}/{total} entries.")
    if missing:
        print(f"Missing {len(missing)} JSON entries:")
        for k in sorted(missing): print(f"  {k}")
    else:
        print("All JSON entries were successfully mapped!")

    if args.all:
        print(f"\nFallback extracted {len(fallback)} additional files.")
        if fallback:
            print("List of fallback-extracted files:")
            for m in sorted(fallback): print(f"  {m}")

if __name__ == '__main__':
    main()
