// File: scripts/!mods_preload/mod_hash_dump.nut
//
// Prints the save-file hex code of each script listed in `paths`, so new
// items, backgrounds and traits can be added to dictionary.json without
// spawning them and reverse-reading a save.
//
// The save writes each item as _out.writeI32(item.ClassNameHash), and
// bb-edit reads those 4 bytes raw, so the code it expects is the hash's
// bytes in little-endian order. That is what the third column prints.
//
// Usage: see "Getting hex codes for new game content" in README.md.
// Output goes to log.html (Documents\Battle Brothers\log.html);
// search it for "HASHDUMP". Requires Modern Hooks.

::ModHashDump <- {
    ID      = "mod_hash_dump",
    Version = "1.1.0",
    Name    = "Hash Dump"
};

::ModHashDump.HooksMod <- ::Hooks.register(
    ::ModHashDump.ID,
    ::ModHashDump.Version,
    ::ModHashDump.Name
);

::ModHashDump.HooksMod.queue(function() {

    local paths = [
        // --- controls: codes already in dictionary.json -------------
        // Keep these. If they print as expected, the output is trustworthy.
        "scripts/items/helmets/bascinet_with_mail",          // 276BE611
        "scripts/items/weapons/warbrand",                    // 1D4A54A0
        "scripts/items/weapons/named/named_warbrand",        // 2DD93D54

        // --- add the scripts you need codes for below ----------------
        // Paths are relative to the game's data folder, without ".nut".
        // Example:
        // "scripts/items/armor/heraldic_mail",              // 3E313C03
    ];

    local digits = "0123456789ABCDEF";

    local byteHex = function( b ) {
        return digits.slice(b >> 4, (b >> 4) + 1) + digits.slice(b & 15, (b & 15) + 1);
    };

    // little-endian: lowest byte first, matching the raw bytes in the save
    local toSaveHex = function( h ) {
        local s = "";
        for (local i = 0; i < 4; i++) s += byteHex((h >> (8 * i)) & 0xFF);
        return s;
    };

    ::logInfo("HASHDUMP;path;saveHex");

    foreach (p in paths)
    {
        local hash = null;

        try
        {
            hash = ::new(p).ClassNameHash;
        }
        catch (e)
        {
            try { hash = ::IO.scriptHashByFilename(p); } catch (e2) {}
        }

        if (hash == null)
        {
            ::logInfo("HASHDUMP;" + p + ";FAILED");
            continue;
        }

        ::logInfo("HASHDUMP;" + p + ";" + toSaveHex(hash));
    }

    ::logInfo("HASHDUMP;done");

}, ::Hooks.QueueBucket.FirstWorldInit);
