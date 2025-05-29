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
   git clone https://github.com/<your-username>/bb-edit.git
   ```

2. Install dependencies:

   ```bash
   cd bb-edit
   npm install
   ```

3. Run in development mode:

   ```bash
   npm start
   ```

---

## Packaging

To create a portable Windows build (EXE + ZIP):

```bash
npm run dist
```

This will produce:

- `release/BB-Edit-<version>-portable.exe` (self-extracting)
- `release/BB-Edit-<version>.zip` (compressed archive)

---

## Project Structure

```
bb-edit/
├── src/              # Application source code
│   ├── main.js       # Electron main process
│   └── renderer/     # BrowserWindow UI, HTML/CSS/JS
└── tools/            # Development utility scripts (not shipped)
    ├── asset-map.json
    ├── extract_and_map.py
    └── generate_asset_map.py
```

---

## Tools Directory

The `tools/` folder contains helper scripts and mapping data used during development to extract and remap game assets. These files are **not** packaged into the distributed app.

### asset-map.json

A JSON mapping of archive entries to the desired local filenames.

- **Key:** Path inside `data_001.dat` (e.g. `gfx/ui/items/accessory/oathtaker_skull_01.png`).
- **Value:** Relative path under `tools/game-art/` (e.g. `accessory/young-anselm-skull-1.png`).

Used by `extract_and_map.py` to know exactly which files to extract and how to rename them.

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
