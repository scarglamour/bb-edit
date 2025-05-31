# BB-Edit

**BB-Edit** is a save editor for _Battle Brothers_ (v1.5.1–1.5.1.7) that lets you modify your mercenaries’ stats, inventory, perks, backgrounds, traits, and more.

---

## Features

- Edit brother stats, perks, backgrounds, and traits
- Rename unique items and tweak their stats
- Add attachments (noble tabards, mantles) to armor
- Auto-generate or byte-tweak stat potentials
- Manage stash inventory, including custom attachments
- Built with Electron and web technologies for cross-platform consistency

---

## Installation

1. Clone this repository:

   ```bash
   git clone https://github.com/scarglamour/bb-edit.git
   ```

2. Install dependencies:

   ```bash
   cd bb-edit
   npm install
   ```

3. Extract game assets **before** running the app:

   ```bash
   python tools/extract_and_map.py \
     --dat "/path/to/Battle Brothers/data/data_001.dat" \
     --out game-art \
     --map tools/asset-map.json
   ```

   This will populate the `game-art/` folder with the images required by BB-Edit.

4. Run in development mode:

   ```bash
   npm start
   ```

## Packaging

To create a portable Windows build (EXE + ZIP):

```bash
npm run dist
```

This will produce:

- `dist/BB-Edit-<version>-portable.exe` (self-contained executable build)
- `dist/BB-Edit-<version>.zip` (compressed archive)

---

## Project Structure

```
bb-edit/
├── src/              # Application source code
│   ├── main.js       # Electron main process
│   └── renderer/     # BrowserWindow UI, HTML/CSS/JS
└── tools/            # Development utility scripts (not shipped)
    ├── asset-map.json
    ├── check_png_usage.py
    ├── compare_assets.py
    ├── convert_dict.py
    ├── extract_and_map.py
    └── generate_asset_map.py
```

---

## Tools Directory

The `tools/` folder contains helper scripts and mapping data used during development to extract, remap, and check game assets. These files are **not** packaged into the distributed app.

### asset-map.json

A JSON mapping of archive entries to the desired local filenames.

- **Key:** Path inside `data_001.dat` (e.g. `gfx/ui/items/accessory/oathtaker_skull_01.png`).
- **Value:** Relative path under `tools/game-art/` (e.g. `accessory/young-anselm-skull-1.png`).

Used by `extract_and_map.py` to know exactly which files to extract and how to rename them.

### check_png_usage.py

`check_png_usage.py` scans `.nut` script files to determine which PNG assets listed in an `asset_report.txt` (under the section `== Unused .png files ==`) are actually referenced in those scripts. It reports both “found” (used) and “not found” (unused) PNG filenames.

**Usage:**

```bash
python3 check_png_usage.py --script-dir /path/to/nut-scripts --report-file /path/to/asset_report.txt
```

### compare_assets.py

`compare_assets.py` scans your project’s HTML and CSS files to detect all referenced PNG assets and compares that set against the PNG files actually present in designated asset directories. It generates a report listing:

1. **Missing .png references** – PNG filenames referenced in HTML/CSS but not found on disk.
2. **Unused .png files** – PNG files present in asset directories but never referenced by any HTML/CSS.
   This helps you quickly identify broken links (missing images) and orphaned assets (unused images) in the project.

**Usage:**

```bash
python3 compare_assets.py
```

### convert_dict.py

`convert_dict.py` reads a JSON file (expected to be an array of [hex_code, info] entries), groups those items by their “type” field in info, and writes a human-readable text file listing each item under its category header.

**Usage:**

```bash
python3 convert_dict.py /path/to/dictionary.json -o /path/to/items_grouped.txt
```

### extract_and_map.py

Script to unpack `data_001.dat` and extract images into your `game-art/` folder according to the `asset-map.json`.

- **Usage:**

  ```bash
  python tools/extract_and_map.py \
    --dat "/path/to/data_001.dat" \
    --out "game-art" \
    --map "tools/asset-map.json" [--all]
  ```

- **Flags:**

  - `--all`: also perform fallback extraction for unmatched entries and report them.

### generate_asset_map.py

Utility to auto-generate `asset-map.json` by hashing and matching your existing `game-art/` files against the entries in `data_001.dat`.

- **Usage:**

  ```bash
  python tools/generate_asset_map.py \
    --dat "/path/to/data_001.dat" \
    --game-art "game-art" \
    --out "tools/asset-map.json"
  ```

- Compares SHA-256 hashes of local files to archive entries to build the mapping JSON.

---

## Contributing

1. Fork the repository
2. Create a new feature branch (`git checkout -b feature/xyz`)
3. Commit your changes (`git commit -m "Add feature XYZ"`)
4. Push to your branch (`git push origin feature/xyz`)
5. Open a Pull Request

---

## License

MIT © 9thKingOfLies, ScarGlamour
