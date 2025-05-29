#!/usr/bin/env python3
import os
import sys
import argparse
import hashlib
import json
import zipfile

"""
Generate asset-map.json by matching game-art files to dat.
Reports duplicate zip entries and missing local files.
"""

def hash_bytes(data: bytes) -> str:
    """Return a SHA-256 hex digest for the given bytes."""
    return hashlib.sha256(data).hexdigest()


def build_local_hash_map(game_art_dir: str, exts: list[str]) -> dict[str, str]:
    """
    Walk the local game-art directory, hash each file, and map hash->rel-path.
    """
    local_map: dict[str, str] = {}
    for root, _, files in os.walk(game_art_dir):
        for fname in files:
            if not any(fname.lower().endswith(ext) for ext in exts):
                continue
            full_path = os.path.join(root, fname)
            rel_path = os.path.relpath(full_path, game_art_dir).replace('\\', '/')
            with open(full_path, 'rb') as f:
                data = f.read()
            h = hash_bytes(data)
            if h in local_map:
                print(f"[WARN] Duplicate local file content: {rel_path} and {local_map[h]}")
            local_map[h] = rel_path
    return local_map


def build_remote_hash_map(dat_path: str, exts: list[str]) -> dict[str, list[str]]:
    """
    Walk the dat archive, hash each member, and map hash->list of members.
    """
    remote_map: dict[str, list[str]] = {}
    with zipfile.ZipFile(dat_path, 'r') as zf:
        for member in zf.namelist():
            if not any(member.lower().endswith(ext) for ext in exts):
                continue
            data = zf.read(member)
            h = hash_bytes(data)
            remote_map.setdefault(h, []).append(member)
    return remote_map


def main():
    parser = argparse.ArgumentParser(
        description="Generate asset-map.json with diagnostics"
    )
    parser.add_argument('--dat',  required=True, help='Path to data_001.dat')
    parser.add_argument('--game-art', required=True, help='Directory of game-art')
    parser.add_argument('--out',  default='asset-map.json', help='Output JSON mapping')
    parser.add_argument('--ext', nargs='+', default=['.png','.brush','.gfx'], help='Extensions')
    args = parser.parse_args()

    if not os.path.isfile(args.dat):
        print(f"Error: dat file not found: {args.dat}")
        sys.exit(1)
    if not os.path.isdir(args.game_art):
        print(f"Error: game-art directory not found: {args.game_art}")
        sys.exit(1)

    local_map = build_local_hash_map(args.game_art, args.ext)
    remote_map = build_remote_hash_map(args.dat, args.ext)

    mapping: dict[str, str] = {}
    duplicates: dict[str, list[str]] = {}

    # Match hashes
    for h, local_path in local_map.items():
        members = remote_map.get(h)
        if not members:
            continue
        if len(members) == 1:
            mapping[members[0]] = local_path
        else:
            # multiple zip entries for same local file
            duplicates[local_path] = members
            # pick first for mapping
            mapping[members[0]] = local_path
            for dup in members[1:]:
                print(f"[DUPLICATE] {dup} has same content hash as {members[0]}")

    # Write mapping JSON
    with open(args.out, 'w', encoding='utf-8') as out_f:
        json.dump(mapping, out_f, indent=4)

    total_local = len(local_map)
    total_mapped = len({v for v in mapping.values()})
    print(f"\nMapped {total_mapped}/{total_local} local files into {len(mapping)} zip entries.")

    # Report missing local files
    missing_local = set(local_map.values()) - set(mapping.values())
    if missing_local:
        print(f"\nMissing local files ({len(missing_local)}):")
        for p in sorted(missing_local): print(f"  {p}")
    else:
        print("\nAll local files were matched.")

    # Report duplicates
    if duplicates:
        print(f"\nDuplicate mappings ({len(duplicates)}):")
        for local_path, members in duplicates.items():
            print(f"  {local_path} matched by:")
            for m in members: print(f"    - {m}")
    else:
        print("\nNo duplicate zip entries found.")

if __name__ == '__main__':
    main()
