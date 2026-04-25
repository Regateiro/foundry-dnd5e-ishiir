import json
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

DELETE_STR = "()'"


data = None
with open("sieg5e.json", encoding="utf-8") as fd:
    data = json.load(fd)

for pack in PACKS:
    for pack_data in data[pack]:
        # Get identifier
        identifier = pack_data.get("system", {}).get("identifier", None)
        # Get name and replace unwanted characters
        name = pack_data["name"].lower()
        name = name.replace(" ", "-")
        for char in DELETE_STR:
            name = name.replace(char, "")
        # Determine which name to use
        filename = (identifier if identifier else name) + ".json"

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
        with open(join(PACKS[pack], filename), "w", encoding="utf-8") as fd:
            json.dump(pack_data, fd)
