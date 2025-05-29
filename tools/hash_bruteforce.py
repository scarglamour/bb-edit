#!/usr/bin/env python3
import argparse
import zlib
import re
import sys

# try to import mmh3 for MurmurHash3, otherwise skip it
try:
    import mmh3
except ImportError:
    mmh3 = None

FNV_PRIME = 0x01000193


def generate_variants(path):
    """
    Given a raw path string, yield all variants formed by:
      1) joining tokens on different delimiters: \\, /, ., or nothing
      2) stripping ".dat" wherever it appears
      3) replacing ".nut" → ".cnut" or removing it entirely
      4) repeating the above on every suffix from the first token onward
    """
    # split on backslash, forward-slash or dot
    tokens = re.split(r'[\\/\._]', path)
    variants = set()
    delims = ['\\', '/', '.', '', '_']
    for delim in delims:
        for i in range(len(tokens)):
            base = delim.join(tokens[i:])
            variants.add(base)
            # strip .dat
            if base.lower().endswith('.dat'):
                variants.add(base[:-4])
            # replace or strip .nut
            if base.lower().endswith('.nut'):
                stem = base[:-4]
                variants.add(stem + '.cnut')
                variants.add(stem)
    return variants


def fnv1a_32(data_bytes, seed):
    h = seed & 0xffffffff
    for b in data_bytes:
        h ^= b
        h = (h * FNV_PRIME) & 0xffffffff
    return h


def jenkins_one_at_a_time(data_bytes, seed):
    h = seed & 0xffffffff
    for b in data_bytes:
        h = (h + b) & 0xffffffff
        h = (h + (h << 10)) & 0xffffffff
        h ^= (h >> 6)
    h = (h + (h << 3)) & 0xffffffff
    h ^= (h >> 11)
    h = (h + (h << 15)) & 0xffffffff
    return h


def djb2_32(data_bytes, seed):
    h = seed & 0xffffffff
    for b in data_bytes:
        h = ((h << 5) + h + b) & 0xffffffff
    return h


def try_hash_first_match(variant, targets, seed_start, seed_end):
    data = variant.encode('utf-8')
    for seed in range(seed_start, seed_end + 1):
        # CRC32
        c = zlib.crc32(data, seed) & 0xffffffff
        if c in targets:
            label = 'CRC32 (BE)' if c == targets[0] else 'CRC32 (LE)'
            return label, seed

        # FNV-1a
        f = fnv1a_32(data, seed)
        if f in targets:
            label = 'FNV-1a (BE)' if f == targets[0] else 'FNV-1a (LE)'
            return label, seed

        # Jenkins one-at-a-time
        j = jenkins_one_at_a_time(data, seed)
        if j in targets:
            label = 'Jenkins (BE)' if j == targets[0] else 'Jenkins (LE)'
            return label, seed

        # DJB2
        d = djb2_32(data, seed)
        if d in targets:
            label = 'DJB2 (BE)' if d == targets[0] else 'DJB2 (LE)'
            return label, seed

        # Murmur3 (if available)
        if mmh3 is not None:
            m = mmh3.hash(data, seed) & 0xffffffff
            if m in targets:
                label = 'Murmur3 (BE)' if m == targets[0] else 'Murmur3 (LE)'
                return label, seed
    return None, None


def main():
    parser = argparse.ArgumentParser(
        description='Brute-force common 32-bit hashes over path-string variants'
    )
    parser.add_argument('target_hex',
                        help='Target 32-bit hex code, e.g. 95EC7AD9')
    parser.add_argument('paths', nargs='+',
                        help='One or more path-style strings to test')
    parser.add_argument('--seed-start', type=int, default=0,
                        help='First seed to try (default: 0)')
    parser.add_argument('--seed-end', type=int, default=255,
                        help='Last seed to try (default: 255)')
    args = parser.parse_args()

    # Parse target hex and compute big-endian and little-endian values
    try:
        target_be = int(args.target_hex, 16)
    except ValueError:
        print(f"Invalid hex value '{args.target_hex}'")
        sys.exit(1)
    be_bytes = target_be.to_bytes(4, 'big')
    target_le = int.from_bytes(be_bytes, 'little')
    targets = (target_be, target_le)

    found = False
    for path in args.paths:
        variants = sorted(generate_variants(path))
        total = len(variants)
        print(f"\nTesting path: {path} ({total} variants)")

        # Progress display
        for idx, variant in enumerate(variants, 1):
            percent = (idx / total) * 100
            msg = f"  [{idx}/{total} ({percent:.1f}%)] Trying: '{variant}'"
            # Clear line with ANSI escape and write message
            sys.stdout.write('\r\033[K' + msg)
            sys.stdout.flush()

            algo, seed = try_hash_first_match(
                variant, targets, args.seed_start, args.seed_end
            )
            if algo:
                print(f"\nMatch found! Algorithm: {algo}, Seed: {seed}, Variant: '{variant}'")
                found = True
                return

    if not found:
        print("\nNo matches found for any variant across all paths.")

if __name__ == '__main__':
    main()
