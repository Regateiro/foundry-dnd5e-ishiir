"""Generate Foundry VTT pack files from source JSON data.

Consumes a flat JSON export (e.g. sieg5e-ishiir.json) and splits its entries
into individual pack files under packs/src/, injecting the required _stats
and _key metadata so each file is ready to import.
"""

import json
import sys
from datetime import datetime
from pathlib import Path

# Output directory for pack files
PACKS_FOLDER = Path("./packs/src")

# Metadata injected into every written file
DEFAULT_STATS = {
    "systemId": "dnd5e",
    "systemVersion": "2.4.9",
    "coreVersion": "10.303",
    "createdTime": 1777072572464,
    "modifiedTime": int(datetime.timestamp(datetime.now()) * 1000),
    "lastModifiedBy": "dnd5ebuilder0000",
}

# Maps pack categories to their output folders
PACKS = {
    "classes": PACKS_FOLDER / "sieg5e-classes",
    "subclasses": PACKS_FOLDER / "sieg5e-subclasses",
    "features": PACKS_FOLDER / "sieg5e-classfeatures",
    "optfeatures": PACKS_FOLDER / "sieg5e-optfeatures",
    "races": PACKS_FOLDER / "sieg5e-races",
}

# Fields added on write; stripped before comparison in _updated
METADATA_KEYS = ("_stats", "_key", "flags", "sort")

# Supported sources and their source JSON files
SOURCE_MAP = {
    "ishiir": ("sieg5e-ishiir.json", "sieg5e-arkaeos.json"),
    "deoir": ("sieg5e-deoir.json",),
    "fjarrenvold": ("sieg5e-fjarrenvold.json",),
}


def _import(src: str) -> None:
    """Load entries from a source JSON and write them as individual pack files.

    @param src - Path to the JSON file (e.g. sieg5e-ishiir.json)
    @returns None
    """
    # Ensure output directories exist
    for pack_folder in PACKS.values():
        pack_folder.mkdir(parents=True, exist_ok=True)

    with open(src, "r", encoding="utf-8") as fd:
        data = json.load(fd)

    for pack, pack_folder in PACKS.items():
        for pack_data in data[pack]:
            filepath = pack_folder / f"{pack_data['_id']}.json"

            # Skip if the data hasn't changed since last write
            if not _updated(filepath, pack_data):
                continue

            # Inject metadata before writing
            pack_data["_stats"] = DEFAULT_STATS
            pack_data["_key"] = f"!items!{pack_data['_id']}"

            with open(filepath, "w", encoding="utf-8") as fd:
                json.dump(pack_data, fd, indent=2)


def _updated(filepath: Path, new_data: dict) -> bool:
    """Check whether the data on disk differs from the new data.

    Compares after stripping known metadata fields that are added on write.
    @param filepath - Path to the existing pack file
    @param new_data - Fresh data from the source JSON
    @returns True if the file needs to be updated
    """
    if not filepath.exists():
        return True

    with open(filepath, "r", encoding="utf-8") as fd:
        curr_data = json.load(fd)

    # Strip written-only metadata before comparing
    for key in METADATA_KEYS:
        curr_data.pop(key, None)

    return curr_data != new_data


if __name__ == "__main__":
    # Default to ishiir if no argument given
    src_key = sys.argv[1].lower() if len(sys.argv) > 1 else "ishiir"
    sources = SOURCE_MAP.get(src_key)

    if not sources:
        print("Unknown source. Valid options: ishiir, deoir, fjarrenvold")
        sys.exit(1)

    for source_path in sources:
        _import(source_path)
