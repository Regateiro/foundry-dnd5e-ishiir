/**
 * The DnD5e game system for Foundry Virtual Tabletop
 * A system for playing the fifth edition of the world's most popular role-playing game.
 * Author: Atropos
 * Software License: MIT
 * Content License: https://www.dndbeyond.com/attachments/39j2li89/SRD5.1-CCBY4.0License.pdf
 * Repository: https://github.com/foundryvtt/dnd5e
 * Issue Tracker: https://github.com/foundryvtt/dnd5e/issues
 */

// Import Configuration
import DND5E from "./module/config.mjs";
import registerSystemSettings from "./module/settings.mjs";

// Import Submodules
import * as applications from "./module/applications/_module.mjs";
import * as canvas from "./module/canvas/_module.mjs";
import * as dataModels from "./module/data/_module.mjs";
import * as dice from "./module/dice/_module.mjs";
import * as documents from "./module/documents/_module.mjs";
import * as enrichers from "./module/enrichers.mjs";
import * as migrations from "./module/migration.mjs";
import * as utils from "./module/utils.mjs";
import {ModuleArt} from "./module/module-art.mjs";

/* -------------------------------------------- */
/*  Define Module Structure                     */
/* -------------------------------------------- */

globalThis.dnd5e = {
  applications,
  canvas,
  config: DND5E,
  dataModels,
  dice,
  documents,
  enrichers,
  migrations,
  utils
};

/* -------------------------------------------- */
/*  Foundry VTT Initialization                  */
/* -------------------------------------------- */

Hooks.once("init", function() {
  globalThis.dnd5e = game.dnd5e = Object.assign(game.system, globalThis.dnd5e);
  console.log(`DnD5e | Initializing the DnD5e Game System - Version ${dnd5e.version}\n${DND5E.ASCII}`);

  // Record Configuration Values
  CONFIG.DND5E = DND5E;
  CONFIG.ActiveEffect.documentClass = documents.ActiveEffect5e;
  CONFIG.Actor.documentClass = documents.Actor5e;
  CONFIG.Item.documentClass = documents.Item5e;
  CONFIG.Token.documentClass = documents.TokenDocument5e;
  CONFIG.Token.objectClass = canvas.Token5e;
  CONFIG.time.roundTime = 6;
  CONFIG.Dice.DamageRoll = dice.DamageRoll;
  CONFIG.Dice.D20Roll = dice.D20Roll;
  CONFIG.MeasuredTemplate.defaults.angle = 53.13; // 5e cone RAW should be 53.13 degrees
  CONFIG.ui.combat = applications.combat.CombatTracker5e;
  game.dnd5e.isV10 = game.release.generation < 11;

  // Register System Settings
  registerSystemSettings();

  // Validation strictness.
  if ( game.dnd5e.isV10 ) _determineValidationStrictness();

  // Configure module art.
  game.dnd5e.moduleArt = new ModuleArt();

  // Remove honor & sanity from configuration if they aren't enabled
  if ( !game.settings.get("dnd5e", "honorScore") ) delete DND5E.abilities.hon;
  if ( !game.settings.get("dnd5e", "sanityScore") ) delete DND5E.abilities.san;

  // Configure trackable & consumable attributes.
  _configureTrackableAttributes();
  _configureConsumableAttributes();

  // Patch Core Functions
  Combatant.prototype.getInitiativeRoll = documents.combat.getInitiativeRoll;

  // Register Roll Extensions
  CONFIG.Dice.rolls.push(dice.D20Roll);
  CONFIG.Dice.rolls.push(dice.DamageRoll);

  // Hook up system data types
  const modelType = game.dnd5e.isV10 ? "systemDataModels" : "dataModels";
  CONFIG.Actor[modelType] = dataModels.actor.config;
  CONFIG.Item[modelType] = dataModels.item.config;
  CONFIG.JournalEntryPage[modelType] = dataModels.journal.config;

  // Register sheet application classes
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("dnd5e", applications.actor.ActorSheet5eCharacter, {
    types: ["character"],
    makeDefault: true,
    label: "DND5E.SheetClassCharacter"
  });
  Actors.registerSheet("dnd5e", applications.actor.ActorSheet5eNPC, {
    types: ["npc"],
    makeDefault: true,
    label: "DND5E.SheetClassNPC"
  });
  Actors.registerSheet("dnd5e", applications.actor.ActorSheet5eVehicle, {
    types: ["vehicle"],
    makeDefault: true,
    label: "DND5E.SheetClassVehicle"
  });
  Actors.registerSheet("dnd5e", applications.actor.GroupActorSheet, {
    types: ["group"],
    makeDefault: true,
    label: "DND5E.SheetClassGroup"
  });

  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet("dnd5e", applications.item.ItemSheet5e, {
    makeDefault: true,
    label: "DND5E.SheetClassItem"
  });
  DocumentSheetConfig.registerSheet(JournalEntryPage, "dnd5e", applications.journal.JournalClassPageSheet, {
    label: "DND5E.SheetClassClassSummary",
    types: ["class"]
  });

  // Preload Handlebars helpers & partials
  utils.registerHandlebarsHelpers();
  utils.preloadHandlebarsTemplates();

  // Register arrow key bindings for ruler elevation adjustment
  // These PRIORITY keybindings override the core pan keybindings when the ruler is measuring
  canvas.registerElevationKeybindings("dnd5e");

  enrichers.registerCustomEnrichers();
});

/**
 * Determine if this is a 'legacy' world with permissive validation, or one where strict validation is enabled.
 * @internal
 */
function _determineValidationStrictness() {
  dataModels.SystemDataModel._enableV10Validation = game.settings.get("dnd5e", "strictValidation");
}

/**
 * Update the world's validation strictness setting based on whether validation errors were encountered.
 * @internal
 */
async function _configureValidationStrictness() {
  if ( !game.user.isGM ) return;
  const invalidDocuments = game.actors.invalidDocumentIds.size + game.items.invalidDocumentIds.size
    + game.scenes.invalidDocumentIds.size;
  const strictValidation = game.settings.get("dnd5e", "strictValidation");
  if ( invalidDocuments && strictValidation ) {
    await game.settings.set("dnd5e", "strictValidation", false);
    game.socket.emit("reload");
    foundry.utils.debouncedReload();
  }
}

/**
 * Configure explicit lists of attributes that are trackable on the token HUD and in the combat tracker.
 * @internal
 */
function _configureTrackableAttributes() {
  const common = {
    bar: [],
    value: [
      ...Object.keys(DND5E.abilities).map(ability => `abilities.${ability}.value`),
      ...Object.keys(DND5E.movementTypes).map(movement => `attributes.movement.${movement}`),
      "attributes.ac.value", "attributes.init.total"
    ]
  };

  const creature = {
    bar: [...common.bar, "attributes.hp", "spells.pact"],
    value: [
      ...common.value,
      ...Object.keys(DND5E.skills).map(skill => `skills.${skill}.passive`),
      ...Object.keys(DND5E.senses).map(sense => `attributes.senses.${sense}`),
      "attributes.spelldc"
    ]
  };

  CONFIG.Actor.trackableAttributes = {
    character: {
      bar: [...creature.bar, "resources.primary", "resources.secondary", "resources.tertiary", "details.xp"],
      value: [...creature.value]
    },
    npc: {
      bar: [...creature.bar, "resources.legact", "resources.legres"],
      value: [...creature.value, "details.cr", "details.spellLevel", "details.xp.value"]
    },
    vehicle: {
      bar: [...common.bar, "attributes.hp"],
      value: [...common.value]
    },
    group: {
      bar: [],
      value: []
    }
  };
}

/**
 * Configure which attributes are available for item consumption.
 * @internal
 */
function _configureConsumableAttributes() {
  CONFIG.DND5E.consumableResources = [
    ...Object.keys(DND5E.abilities).map(ability => `abilities.${ability}.value`),
    "attributes.ac.flat",
    "attributes.hp.value",
    ...Object.keys(DND5E.senses).map(sense => `attributes.senses.${sense}`),
    ...Object.keys(DND5E.movementTypes).map(type => `attributes.movement.${type}`),
    ...Object.keys(DND5E.currencies).map(denom => `currency.${denom}`),
    "details.xp.value",
    "resources.primary.value", "resources.secondary.value", "resources.tertiary.value",
    "resources.legact.value", "resources.legres.value",
    "spells.pact.value",
    ...Array.fromRange(Object.keys(DND5E.spellLevels).length - 1, 1).map(level => `spells.spell${level}.value`)
  ];
}

/* -------------------------------------------- */
/*  Foundry VTT Setup                           */
/* -------------------------------------------- */

/**
 * Prepare attribute lists.
 */
Hooks.once("setup", function() {
  CONFIG.DND5E.trackableAttributes = expandAttributeList(CONFIG.DND5E.trackableAttributes);
  game.dnd5e.moduleArt.registerModuleArt();

  // Apply custom compendium styles to the SRD rules compendium.
  if ( !game.dnd5e.isV10 ) {
    const rules = game.packs.get("dnd5e.rules");
    rules.applicationClass = applications.journal.SRDCompendium;
  }
});

/* --------------------------------------------- */

/**
 * Expand a list of attribute paths into an object that can be traversed.
 * @param {string[]} attributes  The initial attributes configuration.
 * @returns {object}  The expanded object structure.
 */
function expandAttributeList(attributes) {
  return attributes.reduce((obj, attr) => {
    foundry.utils.setProperty(obj, attr, true);
    return obj;
  }, {});
}

/* --------------------------------------------- */

/**
 * Perform one-time pre-localization and sorting of some configuration objects
 */
Hooks.once("i18nInit", () => utils.performPreLocalization(CONFIG.DND5E));

/* -------------------------------------------- */
/*  Foundry VTT Ready                           */
/* -------------------------------------------- */

/**
 * Once the entire VTT framework is initialized, check to see if we should perform a data migration
 */
Hooks.once("ready", function() {
  if ( game.dnd5e.isV10 ) {
    // Configure validation strictness.
    _configureValidationStrictness();

    // Apply custom compendium styles to the SRD rules compendium.
    const rules = game.packs.get("dnd5e.rules");
    rules.apps = [new applications.journal.SRDCompendium(rules)];

    // If the user name is "TestRunner", import and run all tests.
    if ( game.user.name === "TestRunner" ) {
      import("./tests/tests.mjs").then(tests => {
        // Run all tests
        tests.runAllTests().then(results => {
          // Collect all failures with expected/actual values
          const allFailures = [];
          for (const [moduleName, moduleResult] of Object.entries(results)) {
            const failures = tests.collectFailures(moduleResult, moduleName);
            allFailures.push(...failures);
          }

          // Notify the user of the outcome
          if ( allFailures.length === 0 ) {
            ui.notifications.info("All tests passed successfully!", {localize: true});
            console.log("\n✅ All tests passed!");
          } else {
            ui.notifications.error(`Test failures: ${allFailures.length} test(s) failed. Check the console for details.`, {localize: true});
            console.log(`\n📊 Test Results: ${allFailures.length} failure(s)\n`);
            console.log(tests.formatFailures(allFailures));
          }
        });
      });
    }
  }

  // Wait to register hotbar drop hook on ready so that modules could register earlier if they want to
  Hooks.on("hotbarDrop", (bar, data, slot) => {
    if ( ["Item", "ActiveEffect"].includes(data.type) ) {
      documents.macro.create5eMacro(data, slot);
      return false;
    }
  });

  // Determine whether a system migration is required and feasible
  if ( !game.user.isGM ) return;
  const cv = game.settings.get("dnd5e", "systemMigrationVersion") || game.world.flags.dnd5e?.version;
  const totalDocuments = game.actors.size + game.scenes.size + game.items.size;
  if ( !cv && totalDocuments === 0 ) return game.settings.set("dnd5e", "systemMigrationVersion", game.system.version);
  if ( cv && !isNewerVersion(game.system.flags.needsMigrationVersion, cv) ) return;

  // Perform the migration
  if ( cv && isNewerVersion(game.system.flags.compatibleMigrationVersion, cv) ) {
    ui.notifications.error("MIGRATION.5eVersionTooOldWarning", {localize: true, permanent: true});
  }
  migrations.migrateWorld();
});

/* -------------------------------------------- */
/*  Canvas Initialization                       */
/* -------------------------------------------- */

/**
 * Hook that runs when the canvas is fully initialized.
 * Patches the canvas's _sortObjects method to use our custom token sorting logic,
 * then triggers an initial sort of all tokens on the canvas.
 * Also sets up ruler elevation support.
 */
Hooks.on("canvasReady", gameCanvas => {
/**
 * CanvasReady Hook: Custom Token Sorting Override
 *
 * PURPOSE: Replace Foundry's default canvas object sorting with Sieg5e's multi-criteria token
 * ordering system. Two separate overrides are installed:
 *
 *   (1) PrimaryCanvasGroup._sortObjects — intercepts every pairwise comparison during z-ordering.
 *       If both objects are TokenMesh instances, delegates to Token5e.sortTokens(). Otherwise,
 *       falls back to Foundry's original sort for non-token objects (walls, tokens not yet loaded).
 *
 *   (2) TokenLayer.objects.sortChildren — replaces the container-level sort so that when
 *       elevation sorting is enabled by core, same-elevation siblings are still ordered by our
 *       custom rules rather than Foundry's generic document.sort field.
 *
 * WHY NEEDED: Standard Foundry sorts tokens purely by a single numeric field (usually elevation or
 * creation time). D&D 5e combat requires nuanced visual layering:
 *   - Higher-elevation tokens must appear ON TOP of lower ones (taller creatures block shorter)
 *   - Smaller tokens need to be visible — tiny creatures would be invisible under large ogre tokens
 *     without overriding by size
 *   - Player characters should visually override NPCs so the GM can easily track who's whose
 *   - Recently moved tokens briefly go on top for visual feedback during movement
 *
 * Without this, combat becomes confusing: a Tiny Fey hiding behind a Huge Dragon would be completely
 * occluded, and players wouldn't know which of their characters are currently active.
 */
  const PrimaryCanvasGroup = globalThis.canvas.primary.constructor;

  // Store the original Foundry sort function so we can fall back to it for non-tokens.
  const originalSort = PrimaryCanvasGroup._sortObjects;

  // Override _sortObjects to intercept token sorting and use our custom logic.
  // This method is called by Foundry whenever objects on the canvas need to be sorted
  // (e.g., for z-index ordering). We check if both objects are TokenMesh instances
  // and if they have valid documents before applying our custom sort order.
  PrimaryCanvasGroup._sortObjects = (a, b) => {
    const aIsToken = a.constructor.name === "TokenMesh";
    const bIsToken = b.constructor.name === "TokenMesh";

    // Only apply custom sorting when both objects are tokens with valid documents.
    // Otherwise, fall back to the original Foundry sorting behavior.
    if (aIsToken && bIsToken && a.document && b.document) {
      return dnd5e.canvas.Token5e.sortTokens(a.document.object, b.document.object);
    }

    return originalSort.call(PrimaryCanvasGroup, a, b);
  };

  // --- TokenLayer objects container sorting override ---
  //
  // Purpose: Override _sortObjectsByElevation (set by core when elevationSorting is true)
  // so that same-elevation tokens are sorted by our custom z-order rules instead of
  // the generic document.sort field.
  //
  // Sort order (Token5e.sortTokens): higher elevation on top > smaller tokens > player chars > recently moved.
  const tokensObjects = globalThis.canvas.tokens?.objects;
  if (tokensObjects) {
    tokensObjects.sortChildren = function() {
      this.children.sort((a, b) => dnd5e.canvas.Token5e.sortTokens(a, b));
      this.sortDirty = false;
    }.bind(tokensObjects);

    // Trigger initial sort so existing tokens are in correct z-order on scene load.
    tokensObjects.sortChildren();
  }


  // Force an immediate sort of all objects on the canvas primary group.
  globalThis.canvas.primary.sortChildren();

  /**
   * CanvasReady Hook: Ruler Elevation Support Setup
   *
   * PURPOSE: Initialize the full 3D ruler system by calling setupRulerElevation(), which:
   *   (1) Replaces grid.measureDistances with Sieg5e's diagonal-rule-aware implementation
   *   (2) Sets the scene's diagonalRule from game settings (forced to "555" for hex grids)
   *   (3) Patches Ruler._computeDistance to calculate 3D hypotenuse distances per segment
   *   (4) Installs all Ruler prototype patches (toJSON, update, clear, moveToken, etc.)
   *
   * WHY NEEDED: Foundry's ruler can only measure flat ground distance. Without this setup,
   * flying creatures climbing buildings or fighting in multi-level dungeons would get incorrect
   * movement costs. The 3D elevation system lets GMs draw measurement paths that include
   * vertical components, with the ruler computing proper hypotenuse distances using the scene's
   * diagonal rule (PHB/5-5-5, DMG/5/10/5, or Euclidean).
   */
  const { setupRulerElevation } = canvas;
  setupRulerElevation(gameCanvas, canvas);
});

/* -------------------------------------------- */
/*  Other Hooks                                 */
/* -------------------------------------------- */

Hooks.on("renderChatMessage", documents.chat.onRenderChatMessage);
Hooks.on("getChatLogEntryContext", documents.chat.addChatMessageContextOptions);

Hooks.on("renderChatLog", (app, html, data) => documents.Item5e.chatListeners(html));
Hooks.on("renderChatPopout", (app, html, data) => documents.Item5e.chatListeners(html));
Hooks.on("getActorDirectoryEntryContext", documents.Actor5e.addDirectoryContextOptions);

/* -------------------------------------------- */
/*  Bundled Module Exports                      */
/* -------------------------------------------- */

export {
  applications,
  canvas,
  dataModels,
  dice,
  documents,
  enrichers,
  migrations,
  utils,
  DND5E
};
