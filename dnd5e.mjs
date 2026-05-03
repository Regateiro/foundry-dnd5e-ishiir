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

    // If the setting to run tests at startup is enabled, import and run all tests.
    if ( game.settings.get("dnd5e", "runTestsAtStartup") ) {
      import("./tests/tests.mjs").then(tests => {
        // Run all tests
        tests.runAllTests().then(results => {
          // Check results and notify the user of the outcome
          const allPassed = Object.values(results).every(moduleResult => {
            return Object.values(moduleResult).every(testResult => {
              return Object.values(testResult).every(result => result);
            });
          });
          // Notify the user of the results
          if ( allPassed ) {
            ui.notifications.info("All tests passed successfully!", {localize: true});
          } else {
            ui.notifications.error("Some tests failed. Check the console for details.", {localize: true});
          }
          // Log the results to the console for debugging purposes
          console.debug("Test Results:", results);
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
 */
Hooks.on("canvasReady", () => {

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

  // Force an immediate sort of all tokens on the canvas so they appear in the
  // correct z-order when the scene first loads.
  globalThis.canvas.primary.sortChildren();
});

/* -------------------------------------------- */
/*  Canvas Initialization                       */
/* -------------------------------------------- */

/**
 * Canvas ready hook that sets up Ruler elevation support.
 * This allows players to measure 3D distances (including vertical elevation)
 * using the ruler tool with mouse wheel controls.
 */
/**
 * Hook that runs when the canvas is fully initialized.
 * Sets up the elevation measurement feature for the Ruler tool.
 *
 * This hook:
 * 1. Applies the dnd5e measureDistances function to handle diagonal movement rules
 * 2. Sets the diagonal rule from game settings
 * 3. Overrides measureDistances to include elevation in distance calculations
 * 4. Patches the Ruler class to support mouse wheel elevation adjustment
 */
Hooks.on("canvasReady", gameCanvas => {
  // === Step 1: Apply the dnd5e measureDistances function ===
  // The dnd5e system provides its own measureDistances that handles diagonal movement rules
  // (555, 5105, or Euclidean). Without this, the grid would use the base Foundry function
  // which doesn't apply any diagonal rule logic.
  const { measureDistances } = canvas;
  gameCanvas.grid.measureDistances = measureDistances;

  // === Step 2: Set the diagonal movement rule ===
  // The dnd5e measureDistances reads from this.parent.diagonalRule (InterfaceCanvasGroup).
  // We get this from the game settings and set it on the canvas group.
  // The settings.mjs onChange also updates grid.parent when the setting changes.
  const diagonalRule = game.settings.get("dnd5e", "diagonalMovement");
  gameCanvas.grid.parent.diagonalRule = diagonalRule;

  /**
   * Custom measureDistances function that adds elevation to base distance.
   * This function is called by Foundry's Ruler tool whenever it needs to calculate distances.
   *
   * How elevation affects distance depends on the diagonal rule:
   *
   * - EUCL (Euclidean): Uses the Pythagorean theorem to calculate the true 3D straight-line
   *   distance. This is the most accurate representation of flying/gliding in a straight line.
   *   Formula: sqrt(ground² + elevation²)
   *
   * - 5105 (DMG diagonal rule): Each 10ft of elevation adds 5ft to movement (like diagonals).
   *   Formula: max(ground, elevation * 0.5)
   *
   * - 555 (PHB diagonal rule): Each square is always gridDistance away, so distance is the max.
   *   Formula: max(ground, elevation)
   *
   * @param {Array} groundSegments Array of distances for each segment (already calculated by Foundry, in feet)
   * @returns {Array} Array of distances adjusted for elevation per segment
   */
  function measureDistancesWithElevation(groundSegments) {
    // Get the ruler instance which stores our custom elevation data
    const ruler = globalThis.canvas.controls?.ruler;
    const segmentElevations = ruler?.segmentElevations || [0];

    // Get the grid distance (usually 5ft per square)
    const gridDistance = globalThis.canvas.scene?.grid?.distance || 5;
    const diagonalRule = game.settings.get("dnd5e", "diagonalMovement");

    // === Safety check: Ensure elevation array matches segment count ===
    // This handles edge cases where the ruler adds a new segment but our elevation
    // tracking array hasn't been updated yet (e.g., rapid clicking).
    if (segmentElevations.length < groundSegments.length && ruler) {
      while (segmentElevations.length < groundSegments.length) {
        segmentElevations.push(0);
      }
      ruler.segmentElevations = segmentElevations;
    }

    // === Apply elevation calculation to each segment ===
    // Each segment can have its own elevation value (set via mouse wheel)
    for (let i = 0; i < groundSegments.length; i++) {
      const elevation = segmentElevations[i];
      if (elevation) {
        // Convert elevation grid units to feet (e.g., 2 units * 5ft = 10ft)
        const elevationFeet = Math.abs(elevation) * gridDistance;

        // === Calculate 3D distance based on diagonal rule ===
        if (diagonalRule === "EUCL") {
          // Euclidean: True 3D straight-line distance using Pythagorean theorem
          // This represents flying in a straight line from start to end point
          groundSegments[i] = Math.hypot(groundSegments[i], elevationFeet);
        } else if (diagonalRule === "5105") {
          // DMG 5/10/5: Each 10ft of elevation adds 5ft to movement (like diagonal cost)
          // Formula: ground + (elevation / 10) * 5
          groundSegments[i] += (elevationFeet / 10) * 5;
        } else {
          // PHB 5/5/5: Distance is the max of ground or elevation
          // Each square is always gridDistance away
          groundSegments[i] = Math.max(groundSegments[i], elevationFeet);
        }
      }
    }

    return groundSegments;
  }

  // === Step 3: Override measureDistances to add elevation ===
  // Wrap the dnd5e measureDistances with elevation logic.
  // First call the original (which handles diagonal rules), then add elevation adjustment.
  const originalMeasure = gameCanvas.grid.measureDistances;
  gameCanvas.grid.measureDistances = function(segments, options) {
    // Call the original dnd5e measureDistances to get base distances with diagonal rules applied
    const groundSegments = originalMeasure.call(this, segments, options);
    // Then add elevation adjustments
    return measureDistancesWithElevation.call(this, groundSegments);
  };

  // === Step 4: Patch the Ruler class ===
  // The Ruler class may not be available when canvasReady fires, so we try to get it
  // immediately, or defer to a timeout if it's not ready yet.
  let Ruler = foundry.applications?.controls?.Ruler;
  if (!Ruler) {
    setTimeout(() => {
      const rulerInstance = globalThis.canvas?.controls?.ruler;
      Ruler = rulerInstance ? rulerInstance.constructor : null;
      if (Ruler) {
        installRulerPatches(Ruler);
      }
    }, 1000);
  } else {
    installRulerPatches(Ruler);
  }

  /**
   * Installs patches on the Ruler class to add elevation support.
   *
   * @param {Function} Ruler The Ruler class constructor
   *
   * Patches:
   * - _getSegmentLabel: Modifies the distance label to show cumulative elevation per segment
   * - setWaypoints: Tracks when new waypoints are added to create new elevation slots
   * - clear: Resets elevation when ruler is deactivated
   * - moveToken: Applies elevation delta to token after movement completes
   * - wheel event: Allows mouse wheel to adjust elevation for the current segment
   */
  function installRulerPatches(Ruler) {

    // === Patch _getSegmentLabel to show cumulative elevation ===
    // This function is called by Foundry for each segment label as the ruler is drawn.
    // We modify it to append elevation information to the distance label.
    //
    // The original function returns a string like "25ft" but we modify it to show
    // "25ft | ↑20ft" when there's elevation change, where ↑ indicates rising.
    Ruler.prototype._getSegmentLabel = function(segment, distance) {
      const scene = globalThis.canvas.scene;
      const gridDistance = scene?.grid?.distance || 5;

      const segmentElevations = this.segmentElevations || [0];

      // Track which segment we're currently labeling
      // Foundry calls this once per segment during measurement, so we need to track
      // state across calls. We use a temporary index (_labelSegmentIndex) that gets
      // reset after the last segment is processed.
      if (this._labelSegmentIndex === undefined) {
        this._labelSegmentIndex = 0;
      }
      const idx = this._labelSegmentIndex;
      this._labelSegmentIndex++;

      // Reset counter when we reach the last segment so next measurement starts fresh
      if (segment?.last === true) {
        this._labelSegmentIndex = 0;
      }

      // Calculate cumulative elevation (sum of all segments up to current)
      // We show cumulative because the player cares about the total elevation change
      // from the starting point, not just the current segment.
      let cumulativeElevation = 0;
      for (let i = 0; i <= idx; i++) {
        cumulativeElevation += segmentElevations[i] || 0;
      }

      // Show cumulative elevation in label using direction arrow
      // Format: "25ft | ↑20ft" where ↑ indicates rising, 20ft is the elevation change
      if (cumulativeElevation !== 0) {
        const elevationInFeet = cumulativeElevation * gridDistance;
        const direction = elevationInFeet >= 0 ? "↑" : "↓";
        const roundedElevation = Math.ceil(Math.abs(elevationInFeet) * 10) / 10;
        return `${Math.ceil(distance * 10) / 10}ft | ${direction}${roundedElevation}ft`;
      }
      return `${Math.ceil(distance * 10) / 10}ft`;
    };

    // === Initialize ruler instance with elevation tracking ===
    const rulerInstance = globalThis.canvas.controls.ruler;
    if (rulerInstance) {
      // SegmentElevations: Array storing elevation in grid units (not feet) for each segment.
      // Index 0 corresponds to the first segment, etc. Each value is an integer representing
      // how many grid squares of elevation change that segment has.
      rulerInstance.segmentElevations = [0];

      // === Patch clear() to reset elevation ===
      // When the ruler is deactivated (user finishes measuring or presses escape),
      // we need to reset the elevation array so the next measurement starts fresh.
      const originalClear = Ruler.prototype.clear;
      if (originalClear) {
        Ruler.prototype.clear = function() {
          this.segmentElevations = [0];
          return originalClear.call(this);
        };
      }

      // === Patch setWaypoints() to add elevation slots ===
      // Each time the user adds a new waypoint (Ctrl+Click), a new segment is created.
      // We need to add a corresponding elevation slot for that new segment, initialized to 0.
      const originalSetWaypoints = Ruler.prototype.setWaypoints;
      if (originalSetWaypoints) {
        Ruler.prototype.setWaypoints = function(waypoints, { emit = true } = {}) {
          const currentCount = waypoints?.length || 0;
          const prevCount = this.segmentElevations?.length || 1;
          // If adding a new waypoint, add a new elevation slot (initialized to 0)
          if (currentCount > prevCount) {
            this.segmentElevations = this.segmentElevations || [0];
            this.segmentElevations.push(0);
          }
          return originalSetWaypoints.call(this, waypoints, { emit });
        };
      }

      // === Patch moveToken() to apply elevation to token ===
      // After the token moves via SPACEBAR, we need to update its elevation.
      // The cumulative elevation is the sum of all segment elevations (in grid units).
      // We convert to feet, round up to the next multiple of 5 (standard D&D rounding),
      // and update the token's document.
      const originalMoveToken = Ruler.prototype.moveToken;
      if (originalMoveToken) {
        Ruler.prototype.moveToken = async function() {
          // Guard: skip if no segments exist to prevent errors in original function
          if (!this.segments || this.segments.length === 0) {
            return false;
          }

          // Get token BEFORE movement (state is valid), and calculate elevation
          const token = this._getMovementToken();
          const cumulativeElevation = this.segmentElevations?.reduce((a, b) => a + b, 0) || 0;
          const result = await originalMoveToken.call(this);

          // Only apply elevation if movement succeeded and we have elevation data
          if (result && token && cumulativeElevation !== 0) {
            const gridDistance = globalThis.canvas.scene?.grid?.distance || 5;
            const elevationDelta = cumulativeElevation * gridDistance;
            // Round up to the next multiple of 5 (e.g., 7 -> 10, 12 -> 15)
            const roundedElevationDelta = Math.ceil(elevationDelta / 5) * 5;
            await token.document.update({ elevation: token.document.elevation + roundedElevationDelta });
          }
          return result;
        };
      }

      // === Mouse wheel handler for elevation adjustment ===
      // Listen for mouse wheel events while the ruler is active.
      // - Scroll up (negative deltaY) = increase elevation = fly/climb higher
      // - Scroll down (positive deltaY) = decrease elevation = descend
      // Only the current (last) segment's elevation is adjusted.
      const handleWheel = event => {
        // Get the current ruler instance from canvas (not a stored reference)
        const ruler = globalThis.canvas?.controls?.ruler;
        if (!ruler) return;

        // Only adjust elevation when ruler is actively measuring
        // _state === 2 means MEASURING - this ensures we're in an active measurement
        if (ruler._state !== 2) return;
        event.preventDefault();
        event.stopPropagation();

        // Determine direction: scroll up = positive (climb), scroll down = negative (descend)
        const delta = event.deltaY > 0 ? -1 : 1;

        // Ensure array exists (safety check)
        ruler.segmentElevations = ruler.segmentElevations || [0];

        // Update elevation for the current (last) segment only
        // The last index represents the segment currently being drawn/measured
        const lastIndex = ruler.segmentElevations.length - 1;
        ruler.segmentElevations[lastIndex] = (ruler.segmentElevations[lastIndex] || 0) + delta;

        // Force the ruler to re-measure and update the label
        // Manually call _computeDistance to update segments with new elevation,
        // then call _drawMeasuredPath to redraw labels
        ruler._computeDistance(true);
        ruler.ruler.clear();
        ruler._drawMeasuredPath();
      };

      // Add the wheel event listener to the canvas view
      // passive: false allows us to call preventDefault() to stop page scrolling
      gameCanvas.app.view.addEventListener("wheel", handleWheel, { passive: false });
    }
  }
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
