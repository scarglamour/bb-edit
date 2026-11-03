#!/usr/bin/env python3
"""
Compare the PNGs referenced by the UI (HTML + CSS) against the PNGs on disk.

Every reference is resolved relative to the file that contains it, the same
way the browser resolves it, so "../../game-art/armor/x.png" in
src/renderer/hex.css is checked against <project>/game-art/armor/x.png.
A reference only counts as found if that exact file exists.

Writes tools/asset_report.txt with two sections:
  Missing - referenced in HTML/CSS but not on disk (path, and which file uses it)
  Unused  - on disk in an asset folder but referenced nowhere
"""
import re
from pathlib import Path

# — DETERMINE PROJECT ROOT & SRC DIR —
TOOLS_DIR    = Path(__file__).resolve().parent              # .../bb-edit/tools
PROJECT_ROOT = TOOLS_DIR.parent                             # .../bb-edit
SRC_DIR      = PROJECT_ROOT / "src" / "renderer"            # .../bb-edit/src/renderer

# — CONFIGURE paths here —
HTML_FILES = [SRC_DIR / "index.html"]
CSS_FILES  = [SRC_DIR / "index.css", SRC_DIR / "hex.css"]
ASSET_DIRS = [
    PROJECT_ROOT / "game-art",                              # .../bb-edit/game-art
    SRC_DIR / "assets",                                     # .../bb-edit/src/renderer/assets
]
REPORT_FILE = TOOLS_DIR / "asset_report.txt"

HTML_PATTERN = re.compile(r'(?:src|href)\s*=\s*["\']([^"\']+\.png)(?:["\']|$)', re.IGNORECASE)
CSS_PATTERN  = re.compile(r'url\(\s*["\']?([^)"\']+\.png)["\']?\s*\)', re.IGNORECASE)


def rel(path):
    """Project-relative path with forward slashes, for readable output."""
    try:
        return path.relative_to(PROJECT_ROOT).as_posix()
    except ValueError:
        return path.as_posix()


def find_references():
    """Map each resolved PNG path -> set of project files that reference it."""
    refs = {}
    sources = [(f, HTML_PATTERN) for f in HTML_FILES] + [(f, CSS_PATTERN) for f in CSS_FILES]
    for source, pattern in sources:
        if not source.exists():
            print(f"[WARN] Source file not found, skipped: {rel(source)}")
            continue
        text = source.read_text(encoding="utf-8")
        for raw in pattern.findall(text):
            raw = raw.split("?", 1)[0].split("#", 1)[0].strip()
            if raw.startswith(("http:", "https:", "data:")):
                continue
            target = (source.parent / raw).resolve()
            refs.setdefault(target, set()).add(rel(source))
    return refs


def find_existing():
    existing = set()
    for d in ASSET_DIRS:
        if not d.exists():
            print(f"[WARN] Asset folder not found, skipped: {rel(d)}")
            continue
        existing.update(f.resolve() for f in d.rglob("*.png") if f.is_file())
    return existing


def main():
    refs     = find_references()
    existing = find_existing()

    missing = sorted((p for p in refs if not p.is_file()), key=rel)
    unused  = sorted((p for p in existing if p not in refs), key=rel)

    with REPORT_FILE.open("w", encoding="utf-8") as out:
        out.write("== Missing .png references ==\n")
        if missing:
            for p in missing:
                out.write(f"  {rel(p)}  (used in {', '.join(sorted(refs[p]))})\n")
        else:
            out.write("  None 🎉\n")

        out.write("\n== Unused .png files ==\n")
        if unused:
            for p in unused:
                out.write(f"  {rel(p)}\n")
        else:
            out.write("  None 🎉\n")

    print(f"{len(refs)} referenced, {len(existing)} on disk: "
          f"{len(missing)} missing, {len(unused)} unused")
    print(f"✅ Report written to {REPORT_FILE}")


if __name__ == "__main__":
    main()
