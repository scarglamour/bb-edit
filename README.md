# BB-Edit

**BB-Edit** is a save editor for _Battle Brothers_ (v1.5.1–v1.5.2.3) that lets you modify your mercenaries’ stats, inventory, perks, backgrounds, traits, and more.

> [!IMPORTANT]
> **BB-Edit only works with saves from an unmodified game.** The base game and all official DLCs are supported. Saves made while mods were installed are not, even if the mods were removed later: mods can add items, backgrounds and traits the editor doesn't know, or change how the save file is laid out. Depending on what a mod added, BB-Edit may refuse to open the save, hide the stash, or show unrecognised perks and traits as blank placeholders.
>
> Always back up your save before editing it.

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
    ├── mod_hash_dump/  # Game mod that prints save-file hex codes
    ├── asset-map.json
    ├── check_png_usage.py
    ├── compare_assets.py
    ├── convert_dict.py
    ├── extract_and_map.py
    ├── generate_asset_map.py
    └── hash_path.py
```

---

## Updating for a New Game Version

When a game patch adds items, backgrounds or traits, the editor needs three things for each one:

1. A `dictionary.json` entry, keyed by the hex code the game writes into the save.
2. CSS in `src/renderer/hex.css` so it has a picture.
3. An `asset-map.json` entry, so `extract_and_map.py` extracts that picture.

Model new dictionary entries on existing ones of the same type, because the `type` field decides how many bytes the parser reads.

Color or paint variants of armor and helmets usually need no dictionary change. The variant is stored as the item's `icon` number, so a new variant only needs its picture: a `[data-slot="…"][data-icon="N"]` CSS rule plus a map entry.

### Getting hex codes for new game content

The save identifies each item, background, trait and perk by a hash of its script path, so the code can be computed directly:

```bash
python tools/hash_path.py scripts/items/weapons/estoc scripts/skills/backgrounds/executioner_background
```

```
FE7323BD  scripts/items/weapons/estoc  (in dictionary as 'Estoc')
D424EA88  scripts/skills/backgrounds/executioner_background  (in dictionary as 'Executioner')
```

Paths can also be pasted straight from an extracted or decompiled script folder (backslashes and `.nut`/`.cnut` are fine), or piped in one per line. Each result says whether the code is already in `dictionary.json` or is `NEW`.

To double-check codes against the running game, use the hash-dump mod in `tools/mod_hash_dump/`. It asks the game for the code of each script you list. It requires [Modern Hooks](https://github.com/MSUTeam/Modern-Hooks).

1. Open `tools/mod_hash_dump/scripts/!mods_preload/mod_hash_dump.nut` and add the script paths you need to the `paths` list, relative to the game's `data` folder and without `.nut` (e.g. `"scripts/items/weapons/estoc"`). Leave the three control entries in place.

2. Zip the mod so that `scripts/` is at the top of the archive:

   ```powershell
   Compress-Archive -Path tools\mod_hash_dump\scripts -DestinationPath mod_hash_dump.zip -Force
   ```

3. Copy `mod_hash_dump.zip` into the game's `data` folder, start the game and load any campaign.

4. Open `Documents\Battle Brothers\log.html` and search for `HASHDUMP`. Each line reads `HASHDUMP;<script path>;<hex code>`.

5. Check the three control lines first. They must print `276BE611`, `1D4A54A0` and `2DD93D54`; if they don't, don't trust the rest. A `FAILED` line means the path is wrong.

6. Remove the zip from the game's `data` folder when you're done.

### Adding the pictures

Add the new map entries to `tools/asset-map.json` by hand (archive path → local name), then run `extract_and_map.py` as in the Installation section. Run `compare_assets.py` afterwards to confirm nothing referenced in the CSS is missing.

> **Note:** don't run `generate_asset_map.py` to add new entries. It rebuilds the map from the images already in `game-art/`, so it drops every entry whose image hasn't been extracted yet, including the ones you just added. Only use it to rebuild the map from a complete `game-art/` folder.

---

## Tools Directory

The `tools/` folder contains helper scripts and mapping data used during development to extract, remap, and check game assets. These files are **not** packaged into the distributed app.

### asset-map.json

A JSON mapping of archive entries to the desired local filenames.

- **Key:** Path inside `data_001.dat` (e.g. `gfx/ui/items/accessory/oathtaker_skull_01.png`).
- **Value:** Relative path under `game-art/` (e.g. `accessory/young-anselm-skull-1.png`).

Used by `extract_and_map.py` to know exactly which files to extract and how to rename them.

### check_png_usage.py

`check_png_usage.py` scans `.nut` script files to determine which PNG assets listed in an `asset_report.txt` (under the section `== Unused .png files ==`) are actually referenced in those scripts. It reports both “found” (used) and “not found” (unused) PNG filenames.

**Usage:**

```bash
python3 check_png_usage.py --script-dir /path/to/nut-scripts --report-file /path/to/asset_report.txt
```

### compare_assets.py

`compare_assets.py` scans your project’s HTML and CSS files for referenced PNG assets and compares them against the PNG files in `game-art/` and `src/renderer/assets/`. Each reference is resolved relative to the file that contains it, the same way the app loads it, so only an exact path match counts. It writes `tools/asset_report.txt` listing:

1. **Missing .png references** – PNGs referenced in HTML/CSS but not found at that path, with the file that references them.
2. **Unused .png files** – PNGs present in the asset folders but never referenced by any HTML/CSS.

This helps you quickly identify broken links (missing images) and orphaned assets (unused images) in the project.

**Usage** (works from any directory):

```bash
python tools/compare_assets.py
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
- Only use it on a complete `game-art/` folder: entries whose images aren't on disk are left out of the new map.

### hash_path.py

Computes the save-file hex code (the `dictionary.json` key) for any script path, and says whether that code is already in the dictionary. See [Getting hex codes for new game content](#getting-hex-codes-for-new-game-content).

- **Usage:**

  ```bash
  python tools/hash_path.py scripts/items/weapons/estoc [more paths...]
  python tools/hash_path.py < paths.txt
  ```

### mod_hash_dump/

A Battle Brothers mod that asks the running game for the hex codes of the scripts you list, to cross-check `hash_path.py`. See [Getting hex codes for new game content](#getting-hex-codes-for-new-game-content).

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
