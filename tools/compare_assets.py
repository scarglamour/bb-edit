#!/usr/bin/env python3
import re
from pathlib import Path

# — DETERMINE PROJECT ROOT & SRC DIR —
TOOLS_DIR    = Path(__file__).resolve().parent              # .../bb-edit/tools
PROJECT_ROOT = TOOLS_DIR.parent                             # .../bb-edit
SRC_DIR      = PROJECT_ROOT / "src" / "renderer"            # .../bb-edit/src/renderer

# — CONFIGURE paths here —
HTML_FILE  = SRC_DIR / "index.html"
CSS_FILES  = [SRC_DIR / "index.css", SRC_DIR / "hex.css"]
ASSET_DIRS = [
    PROJECT_ROOT / "game-art",                              # .../bb-edit/game-art
    SRC_DIR / "assets" / "ui"                               # .../bb-edit/src/renderer/assets/ui
]
REPORT_FILE = TOOLS_DIR / "asset_report.txt"

def find_references():
    refs = set()

    # 1) from HTML: src="…" and href="…"
    text = HTML_FILE.read_text(encoding="utf-8")
    for match in re.findall(r'(?:src|href)\s*=\s*["\']([^"\']+\.png)(?:["\']|$)', text, flags=re.IGNORECASE):
        refs.add(match)

    # 2) from CSS: url(…)
    for css in CSS_FILES:
        txt = css.read_text(encoding="utf-8")
        for match in re.findall(r'url\(\s*["\']?([^)"\']+\.png)["\']?\s*\)', txt, flags=re.IGNORECASE):
            refs.add(match)

    # normalize: strip query/hash, leading slashes/backslashes
    cleaned = set()
    for r in refs:
        r = r.split("?",1)[0].split("#",1)[0]
        cleaned.add(r.lstrip("/\\"))
    return cleaned

def find_existing():
    existing = {}
    for d in ASSET_DIRS:
        if not d.exists():
            continue
        for f in d.rglob("*.png"):
            if f.is_file():
                # store path relative to project root, with forward slashes
                rel = f.relative_to(PROJECT_ROOT).as_posix()
                existing[rel] = f
    return existing

def main():
    refs     = find_references()
    existing = find_existing()

    # -- Missing: refs that don’t match any existing path exactly
    missing = [r for r in refs if r not in existing and
               not any(Path(rel).name == Path(r).name for rel in existing)]

    # -- Unused: existing files never referenced
    ref_names = { Path(r).name for r in refs }
    unused    = [rel for rel in existing if Path(rel).name not in ref_names]

    # -- Write report --
    with REPORT_FILE.open("w", encoding="utf-8") as out:
        out.write("== Missing .png references ==\n")
        if missing:
            for m in sorted(missing):
                out.write(f"  {m}\n")
        else:
            out.write("  None 🎉\n")

        out.write("\n== Unused .png files ==\n")
        if unused:
            for u in sorted(unused):
                out.write(f"  {u}\n")
        else:
            out.write("  None 🎉\n")

    print(f"✅ Report written to {REPORT_FILE}")

if __name__ == "__main__":
    main()
