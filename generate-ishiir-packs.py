import json
import os
import sys
from datetime import datetime
from os.path import join

PACKS_FOLDER = "./packs/src"
PACKS = {
    "classes": join(PACKS_FOLDER, "sieg5e-classes"),
    "subclasses": join(PACKS_FOLDER, "sieg5e-subclasses"),
    "features": join(PACKS_FOLDER, "sieg5e-classfeatures"),
    "optfeatures": join(PACKS_FOLDER, "sieg5e-optfeatures"),
    "races": join(PACKS_FOLDER, "sieg5e-races"),
}

def _import(source: str) -> None:
    # Ensure folders
    for pack_folder in PACKS.values():
        os.makedirs(pack_folder, exist_ok=True)

    data: dict = None
    with open(source, "r", encoding="utf-8") as fd:
        data = json.load(fd)

    for pack in PACKS:
        for pack_data in data[pack]:
            # Determine which name to use
            filepath = join(PACKS[pack], pack_data["_id"] + ".json")

            if not _updated(filepath, pack_data):
                continue

            # Add metadata
            pack_data = pack_data | {
                "_stats": {
                    "systemId": "dnd5e",
                    "systemVersion": "2.4.9",
                    "coreVersion": "10.303",
                    "createdTime": 1777072572464,
                    "modifiedTime": int(datetime.timestamp(datetime.now()) * 1000),
                    "lastModifiedBy": "dnd5ebuilder0000"
                },
                "_key": f"!items!{pack_data['_id']}"
            }

            # Write the data to file
            with open(filepath, "w", encoding="utf-8") as fd:
                json.dump(pack_data, fd, indent=2)

def _updated(filepath: str, new_data: dict) -> bool:
    # If the file doesn't exist, then it will be updated
    if not os.path.exists(filepath):
        return True
    
    # Read the current data
    curr_data: dict = None
    with open(filepath, "r", encoding="utf-8") as fd:
        curr_data = json.load(fd)

    # Delete the metadata
    try:
        del curr_data["_stats"]
        del curr_data["_key"]
        del curr_data["flags"]
        del curr_data["sort"]
    except:
        pass

    # The data has been updated if the dicts don't match
    return curr_data != new_data


# Entrypoint
if __name__ == "__main__":
    if len(sys.argv) == 1 or sys.argv[1].lower() == "ishiir":
        _import("sieg5e-ishiir.json")
        _import("sieg5e-arkaeos.json")
    elif sys.argv[1].lower() == "deoir":
        _import("sieg5e-deoir.json")
    elif sys.argv[1].lower() == "fjarrenvold":
        _import("sieg5e-fjarrenvold.json")
    else:
        print("Unknown Source")
