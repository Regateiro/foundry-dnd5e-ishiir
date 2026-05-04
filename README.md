![](https://github.com/foundryvtt/dnd5e/blob/v10-dev/media/repo-dnd5e.jpg?raw=true)

# Foundry Virtual Tabletop - DnD5e Game System (Sieg5e Fork)

This game system for [Foundry Virtual Tabletop](http://foundryvtt.com) provides character sheet and game system
support for the Fifth Edition of the world's most popular roleplaying game.

This system provides character sheet support for Actors and Items, mechanical support for dice and rules necessary to
play games of 5th Edition, and compendium content for Monsters, Heroes, Items, Spells, Class Features, Monster
Features, and more!

## Sieg5e Fork Changes

This is a fork of the official `foundryvtt/dnd5e` system with the following customizations:

### Custom Compendium Packs
- **Custom Classes (Ishiir)**: Additional classes including Artificer with custom progression and infusions
- **Custom Subclasses (Ishiir)**: House-specific subclass options
- **Custom Class Features (Ishiir)**: Additional class features tied to custom classes
- **Optional Features (Ishiir)**: Additional feats and options (infusions, fighting styles, etc.)
- **Custom Races (Ishiir)**: Additional race options

### Custom Code Features

#### Ruler Elevation
- Mouse wheel scroll to adjust vertical elevation while measuring distance
- Supports all three diagonal movement rules:
  - **555**: max(groundDistance, elevationDistance)
  - **5105**: groundDistance + (elevationDistance * 0.5)
  - **EUCL**: sqrt(ground² + elevation²)
- Displays cumulative elevation in ruler labels (e.g., "25.0ft | ↑15.0ft")
- After movement (SPACEBAR), token elevation is updated (rounded up to nearest 5ft)
- **Elevation syncs to other connected clients** - when you adjust elevation, other players see the adjusted distance on their screen

#### Token Sorting
- Modified token sorting so smaller tokens render on top
- Player tokens render on top of NPC tokens
- More recently moved tokens render on top

#### Armor Mastery
- Added Armor Mastery actor flag for characters with the Armor Mastery feature
- During rests, allows recovery of Armor Mastery temporary hit points
- Added rest dialog options to toggle Armor Mastery recovery

#### Masterworked Items
- Added `masterworked` property to physical items
- Toggle button on character sheet to mark items as masterworked
- Items can be visually distinguished as masterworked

#### Other Changes
- Removed chain shirt from SRD items
- Updated polymorph/wildshape behavior and option labels
- Added icon for setting masterworked status on character sheet
- Various bug fixes merged from upstream

This work includes material taken from the System Reference Document 5.1 ("SRD 5.1") by Wizards of the Coast LLC and available at https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 is licensed under the Creative Commons Attribution 4.0 International License available at https://creativecommons.org/licenses/by/4.0/legalcode.

Images present under the `icons/` directory are distributed under various terms, please see the `icons/LICENSE` file for full details.

The software component of this system is distributed under the MIT license.

## Installation Instructions

To install and use the DnD5e system for Foundry Virtual Tabletop, simply paste the following URL into the 
**Install System** dialog on the Setup menu of the application.

https://raw.githubusercontent.com/foundryvtt/dnd5e/master/system.json

If you wish to manually install the system, you must clone or extract it into the ``Data/systems/dnd5e`` folder. You
may do this by cloning the repository or downloading a zip archive from the
[Releases Page](https://github.com/foundryvtt/dnd5e/releases).

## Frequently Asked Questions  
Check the [Wiki](../../wiki) for answers to our most [frequently asked questions](../../wiki/faq)

## Community Contribution

See the [CONTRIBUTING](/CONTRIBUTING.md) file for information about how you can help this project.
