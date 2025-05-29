#!/usr/bin/env python3
import os
import sys
import argparse
from pathlib import Path

def load_unused_pngs(report_path: Path):
    """
    Parse the asset_report.txt for the section '== Unused .png files ==' and return a list of png basenames.
    """
    unused = []
    in_section = False
    with report_path.open('r', encoding='utf-8', errors='ignore') as f:
        for line in f:
            stripped = line.strip()
            if stripped == '== Unused .png files ==':
                in_section = True
                continue
            if in_section and stripped.startswith('==') and stripped != '== Unused .png files ==':
                break
            if in_section and stripped:
                # Only keep the basename, discarding any path
                unused.append(Path(stripped).name)
    return unused


def collect_nut_files(root: Path):
    """
    Recursively collect all .nut files under root.
    """
    return [p for p in root.rglob('*.nut') if p.is_file()]


def derive_search_token(png_name: str) -> str:
    """
    Derive a search token based on the png filename basename:
    - If name matches '_0X.png', return prefix including '_0' (e.g. 'icon_05.png' -> 'icon_0')
    - If name matches '_XX.png', return prefix including underscore (e.g. 'icon_42.png' -> 'icon_')
    - Otherwise, return the full basename without the extension
    """
    name_wo_ext = png_name[:-4] if png_name.lower().endswith('.png') else png_name
    # Pattern _0X: last two chars: '0' + digit
    if len(name_wo_ext) >= 3 and name_wo_ext[-2] == '0' and name_wo_ext[-1].isdigit():
        return name_wo_ext[:-1]
    # Pattern _XX: last two chars digits with preceding underscore
    if len(name_wo_ext) >= 3 and name_wo_ext[-3] == '_' and name_wo_ext[-2].isdigit() and name_wo_ext[-1].isdigit():
        return name_wo_ext[:-2] + '_'
    # Default: full basename without extension
    return name_wo_ext


def main(script_dir: Path, report_path: Path):
    # Validate inputs
    if not report_path.is_file():
        print(f"Error: report file '{report_path}' does not exist.", file=sys.stderr)
        sys.exit(1)
    if not script_dir.is_dir():
        print(f"Error: script directory '{script_dir}' does not exist.", file=sys.stderr)
        sys.exit(1)

    # Load unused PNG list
    png_list = load_unused_pngs(report_path)
    if not png_list:
        print(f"No entries found under '== Unused .png files ==' in {report_path}.", file=sys.stderr)
        sys.exit(1)
    print(f"Loaded {len(png_list)} PNG(s) from report: {png_list}\n")

    # Collect .nut files
    nut_files = collect_nut_files(script_dir)
    if not nut_files:
        print(f"No .nut scripts found under {script_dir}.", file=sys.stderr)
        sys.exit(1)

    used = set()
    total = len(nut_files)

    for idx, nut in enumerate(nut_files, 1):
        try:
            content = nut.read_text(encoding='utf-8', errors='ignore')
        except Exception:
            print(f"Warning: Could not read {nut}, skipping.")
            continue
        content_lower = content.lower()
        print(f"\rScanning {idx}/{total}: {nut.name}", end='', flush=True)

        for png in png_list:
            if png in used:
                continue
            png_lower = png.lower()
            # First attempt: full basename search
            if png_lower in content_lower:
                used.add(png)
                # Show relative to script directory to avoid cwd mismatch
                rel_path = nut.relative_to(script_dir)
                print(f"\n✔  {png} (full match) in {rel_path}")
                continue
            # Derive token fallback
            token = derive_search_token(png)
            if token.lower() in content_lower:
                used.add(png)
                rel_path = nut.relative_to(script_dir)
                print(f"\n✔  {png} (token '{token}') in {rel_path}")

    found = sorted(used)
    not_found = sorted(set(png_list) - used)

    print("\n\n=== Result ===")
    print(f"Total PNGs listed: {len(png_list)}")
    print(f"Referenced in scripts: {len(found)}")
    print(f"Not referenced (unused): {len(not_found)}\n")

    if found:
        print("Referenced assets:")
        for png in found:
            print(f" • {png}")
    if not_found:
        print("\nUnused assets:")
        for png in not_found:
            print(f" • {png}")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(
        description="Use a list of PNGs from asset_report.txt to check references in .nut scripts."
    )
    parser.add_argument(
        '--script-dir', '-s',
        type=Path,
        required=True,
        help="Directory containing your .nut scripts"
    )
    parser.add_argument(
        '--report-file', '-r',
        type=Path,
        default=Path(__file__).parent / 'asset_report.txt',
        help="Path to asset_report.txt with '== Unused .png files ==' section"
    )
    args = parser.parse_args()

    main(args.script_dir, args.report_file)