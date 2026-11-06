#!/usr/bin/env python3
"""
Compute the save-file hex code of a Battle Brothers script, the same code
bb-edit uses as the key in dictionary.json.

The game identifies items, backgrounds, traits and perks in a save by a
32-bit hash of their script path:

    h = 0
    for each character c in the path:  h = (h * 37 + c) mod 2^32

and writes it with writeI32, i.e. little-endian. bb-edit reads those four
bytes in file order, so the dictionary key is the hash's bytes reversed:
the hash 0x11E66B27 of "scripts/items/helmets/bascinet_with_mail" is
stored and looked up as "276BE611".

Usage:
    python tools/hash_path.py scripts/items/weapons/estoc [more paths...]
    python tools/hash_path.py < paths.txt          # one path per line

Paths may be written with backslashes, end in .nut or .cnut, start at
"items/" or "skills/" (as in a decompiled tree), or be full
paths into an extracted or decompiled tree.
Each line of output also says whether the code is already in dictionary.json.
"""
import argparse
import json
import re
import sys
from pathlib import Path

DEFAULT_DICT = Path(__file__).resolve().parent.parent / "src" / "renderer" / "js" / "dictionary.json"

# codes confirmed against the game's own ClassNameHash; checked on every run
CONTROLS = {
    "scripts/items/helmets/bascinet_with_mail": "276BE611",
    "scripts/items/weapons/warbrand": "1D4A54A0",
    "scripts/items/weapons/named/named_warbrand": "2DD93D54",
}


def script_hash(path):
    h = 0
    for byte in path.encode("utf-8"):
        h = (h * 37 + byte) & 0xFFFFFFFF
    return h


def save_hex(path):
    """The code as it appears in the save and in dictionary.json."""
    return script_hash(path).to_bytes(4, "little").hex().upper()


# top-level folders under scripts/, for paths from a decompiled tree that dropped the "scripts/" level
SCRIPT_ROOTS = r"(?:items|skills|entity|ai|contracts|events|factions|retinue|scenarios|states|ui|world|mapgen|crafting|ambitions|tactical)"


def normalize(raw):
    p = raw.strip().strip('"').replace("\\", "/")
    p = re.sub(r"\.c?nut$", "", p)
    i = p.find("scripts/")
    if i >= 0:
        return p[i:]
    m = re.search(rf"(?:^|/)({SCRIPT_ROOTS}/.+)$", p)
    if m:
        return "scripts/" + m.group(1)
    raise ValueError(f'"{raw}" is not a script path (expected "scripts/..." or "items/...", "skills/...")')


def main():
    ap = argparse.ArgumentParser(description="Compute save-file hex codes for Battle Brothers script paths.")
    ap.add_argument("paths", nargs="*", help="script paths (reads stdin if none given)")
    ap.add_argument("--dict", type=Path, default=DEFAULT_DICT, help="dictionary.json to check codes against")
    args = ap.parse_args()

    for p, want in CONTROLS.items():
        if save_hex(p) != want:
            sys.exit(f"Self-check failed for {p}: got {save_hex(p)}, expected {want}")

    raw_paths = args.paths or [l for l in sys.stdin.read().splitlines() if l.strip()]
    if not raw_paths:
        ap.print_help()
        return

    known = {}
    if args.dict.exists():
        known = {hx: info.get("name", "?") for hx, info in json.loads(args.dict.read_text(encoding="utf-8-sig"))}
    else:
        print(f"[WARN] {args.dict} not found; not checking against the dictionary", file=sys.stderr)

    for raw in raw_paths:
        try:
            path = normalize(raw)
        except ValueError as e:
            print(f"[SKIP] {e}", file=sys.stderr)
            continue
        hx = save_hex(path)
        note = f"in dictionary as {known[hx]!r}" if hx in known else "NEW"
        print(f"{hx}  {path}  ({note})")


if __name__ == "__main__":
    main()
