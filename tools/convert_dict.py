#!/usr/bin/env python3
import json
import argparse
from collections import defaultdict

def parse_args():
    parser = argparse.ArgumentParser(
        description="Extract and group items from dictionary.json by category"
    )
    parser.add_argument(
        "input", help="Path to dictionary.json", metavar="DICTIONARY_JSON"
    )
    parser.add_argument(
        "-o", "--output",
        help="Path to output text file (default: items_grouped.txt)",
        default="items_grouped.txt", metavar="OUTPUT_TXT"
    )
    return parser.parse_args()

def main():
    args = parse_args()

    # load the JSON array of [hex, info] entries
    with open(args.input, "r", encoding="utf-8") as f:
        data = json.load(f)

    # group by category (info['type'])
    grouped = defaultdict(list)
    for hex_code, info in data:
        category = info.get("type", "unknown")
        name     = info.get("name", "<no name>")
        grouped[category].append((hex_code, name))

    # write out, sorted by category and then by item name
    with open(args.output, "w", encoding="utf-8") as out:
        for category in sorted(grouped):
            # category header
            out.write(f"{category}\n")
            out.write("-" * len(category) + "\n")

            # each item: HEX – NAME – CATEGORY
            for hex_code, name in sorted(grouped[category], key=lambda x: x[1]):
                out.write(f"{hex_code} – {name} – {category}\n")
            out.write("\n")

    total = sum(len(v) for v in grouped.values())
    print(f"Wrote {total} items into {args.output}, grouped into {len(grouped)} categories.")

if __name__ == "__main__":
    main()
