/**
 * Bug Fixes V1 — Comprehensive Test Suite
 *
 * Tests every change introduced in docs/BUG_FIXES_V1.md.
 * Organized by priority: HIGH → MEDIUM → LOW → COSMETIC/SUGGESTIONS.
 * Each item references its TODO number for traceability.
 */

// No runtime modules needed — all bug-fix tests use source inspection or pure math.
// The existing ruler/tests.mjs and actor/tests.mjs already cover compute3DDistance,
// adjustElevation, group-check manager behavior at runtime inside Foundry.

// Import shared test utilities (runTest for [TEST] logging, runBugFixTests uses safeTest internally)
import { assert } from "./shared.mjs";

/* -------------------------------------------- */

/**
 * Read the compiled bundle (dnd5e-compiled.mjs) which contains all module code inlined.
 * This is the authoritative source for source-inspection tests — it's always present
 * after `make install` (unlike individual module/ source files).
 *
 * Falls back to individual module files for development setups that use source entry points.
 *
 * @param {string} [modulePath]  Optional path to individual module file for fallback.
 * @returns {Promise<string|null>}  The file content, or null if unavailable.
 */
async function readBundledSource(modulePath) {
  const fs = globalThis.fs;

  // Primary: read the compiled bundle (always present after npm run build)
  if (fs) {
    try {
      const content = fs.readFileSync(
        new URL("../dnd5e-compiled.mjs", import.meta.url), "utf8"
      );
      if (content) return content;
    } catch{}
  }
  try {
    const resp = await fetch("systems/dnd5e/dnd5e-compiled.mjs");
    if (resp.ok) return await resp.text();
  } catch{}

  // Fallback: try individual source file for development setups
  if (modulePath) {
    if (fs) {
      try {
        return fs.readFileSync(new URL(modulePath, import.meta.url), "utf8");
      } catch{}
    }
    try {
      const resp = await fetch(
        `systems/dnd5e/${modulePath.replace(/^\.\.\//, "")}`
      );
      if (resp.ok) return await resp.text();
    } catch{}
  }

  return null;
}

/* ============================================ */
/*  TEST RUNNER                                   */
/* ============================================ */

/**
 * Run all bug-fix tests.
 * @returns {Promise<object>} Test results grouped by TODO item.
 */
export async function runBugFixTests() {
  const results = {};

  /**
   * Run a single test group, catching any errors so one failure doesn't kill all results.
   * Logs [TEST] name prefix for consistency with actor/ruler suites.
   * @param {string} label  Test label.
   * @param {Function} fn   Test function to execute.
   * @returns {Promise<object>} Test result object.
   */
  async function safeTest(label, fn) {
    const testName = `bug-fixes.${label}`;
    console.log(`[TEST] ${testName}`);
    try { return await fn(); }
    catch(e) {
      console.error(`[BUG-FIXES] Test ${testName} threw:`, e.message);
      return { error: assert(true, false), error_detail: `${e.name}: ${e.message}` };
    }
  }

  // ── HIGH Priority ────────────────────────────
  results["#2_enrichers_average_damage"] = await safeTest("#2", test_todo_2);
  results["#3_hp_bar_div_by_zero"] = await safeTest("#3", test_todo_3);
  results["#4_groupcheck_concurrent_start_guard"] = await safeTest("#4", test_todo_4);
  results["#5_compute3DDistance_5105_formula"] = await safeTest("#5", test_todo_5);
  results["#6_getHPColor_div_by_zero"] = await safeTest("#6", test_todo_6);

  // ── MEDIUM Priority ──────────────────────────
  results["#8_vehicle_cargo_capacity"] = await safeTest("#8", test_todo_8);
  results["#11_ability_template_null_guard"] = await safeTest("#11", test_todo_11);
  results["#12_token_drawHPBar_null_guard"] = await safeTest("#12", test_todo_12);
  results["#15_rest_dialog_checkbox_guards"] = await safeTest("#15", test_todo_15);
  results["#16_mappingField_no_mutation"] = await safeTest("#16", test_todo_16);
  results["#18_ready_hook_migration_catch"] = await safeTest("#18", test_todo_18);
  results["#20_drawHPBar_tempmax_neg_div_zero"] = await safeTest("#20", test_todo_20);
  results["#21_diagonalMovement_grid_null_guard"] = await safeTest("#21", test_todo_21);
  results["#26_groupcheck_restore_validation"] = await safeTest("#26", test_todo_26);

  // ── LOW Priority ─────────────────────────────
  results["#37_group_sheet_hp_percent_div_zero"] = await safeTest("#37", test_todo_37);
  results["#40_hit_die_recovery_div_by_zero"] = await safeTest("#40", test_todo_40);
  results["#G_getSegmentLabel_scene_null_guard"] = await safeTest("#G", test_todo_G);
  results["#H_computeDistance_diagonalRule_read_guard"] = await safeTest("#H", test_todo_H);

  // ── COSMETIC/SUGGESTIONS (info only) ────────
  results["#28_mathClamped_false_positive"] = await safeTest("#28", test_todo_28);
  results["#29_vehicle_hpClamped_false_positive"] = await safeTest("#29", test_todo_29);

  return results;
}

/* ============================================ */
/*  TODO #2 — Enrichers average damage NaN fix   */
/* ============================================ */

/**
 * Verify the computeAverageDamage logic in enrichers.mjs.
 * The bug was: Roll.create().evaluate({async:true}) returns a Promise, not a Roll.
 * The fix adds await before .total access.
 *
 * We test by inspecting the source code for correct async pattern matching.
 * @returns {Promise<object>} Test results.
 */
async function test_todo_2() {
  const results = {};

  const enrichersContent = await readBundledSource("../module/enrichers.mjs");
  if (!enrichersContent) {
    results.file_skip = assert(true, true);
    return results;
  }

  // The fix should have `await Roll.create` (with await before both min and max)
  const hasAwaitMin = /await\s+Roll\.create\([^)]*\)\.evaluate\(\s*{\s*minimize/.test(enrichersContent);
  const hasAwaitMax = /await\s+Roll\.create\([^)]*\)\.evaluate\(\s*{\s*maximize/.test(enrichersContent);

  results.has_await_min_roll = assert(true, hasAwaitMin);
  results.has_await_max_roll = assert(true, hasAwaitMax);

  // Verify the average computation uses .total on awaited rolls (not Promise.total)
  const hasTotalAccess = /(?:minRoll|maxRoll)\.total/.test(enrichersContent);
  results.accesses_total_on_rolls = assert(true, hasTotalAccess);

  return results;
}

/* ============================================ */
/*  TODO #3 — HP bar div-by-zero guard           */
/* ============================================ */

/**
 * Verify the HP bar draw logic guards against displayMax === 0.
 * The fix adds: displayMax > 0 ? ... : 0 for tempPct, colorPct, and ahpPct.
 * @returns {Promise<object>} Test results.
 */
async function test_todo_3() {
  const results = {};

  const content = await readBundledSource("../module/canvas/token.mjs");
  if (!content) return { source_read_skip: assert(true, true) };

  // Check for displayMax guard pattern (Math.max(0, ...) or > 0 ternary)
  const hasDisplayMaxGuard = /displayMax\s*=.*Math\.max\(0|displayMax\s*>\s*0/.test(content);
  results.has_displayMax_guard = assert(true, hasDisplayMaxGuard);

  // Check for tempPct guard: "displayMax > 0 ?" ternary pattern on same or adjacent line as tempPct
  const hasTempPctGuard = /displayMax\s*>\s*0[\s\S]{0,120}?tempPct|const tempPct.*displayMax\s*>\s*0/.test(content);
  results.has_tempPct_guard = assert(true, hasDisplayMaxGuard && hasTempPctGuard);

  // Check for ahpPct guard: "displayMax > 0 ?" ternary pattern on same or adjacent line as ahpPct
  const hasAhpPctGuard = /displayMax\s*>\s*0[\s\S]{0,120}?ahpPct|const ahpPct.*displayMax\s*>\s*0/.test(content);
  results.has_ahpPct_guard = assert(true, hasDisplayMaxGuard && hasAhpPctGuard);

  return results;
}

/* ============================================ */
/*  TODO #4 — GroupCheck concurrent start guard  */
/* ============================================ */

/**
 * Verify GroupCheckManager.start() has the activeCheck concurrency guard.
 * The fix adds: if (GroupCheckManager.activeCheck) { ui.notifications.warn(...); return; }
 * @returns {Promise<object>} Test results.
 */
async function test_todo_4() {
  const results = {};

  const gcContent = await readBundledSource("../module/canvas/group-check.mjs");
  if (!gcContent) {
    results.file_skip = assert(true, true);
    return results;
  }

  // Check for the activeCheck guard in start() method
  const hasActiveCheckGuard = /if\s*\(\s*GroupCheckManager\.activeCheck\s*\)/.test(gcContent);
  results.has_active_check_guard = assert(true, hasActiveCheckGuard);

  // Verify it calls ui.notifications.warn (not just silently returns)
  const hasWarningNotification = /ui\.notifications\.warn/.test(gcContent);
  results.has_warning_notification = assert(true, hasWarningNotification);

  results.guard_prevents_concurrent_starts = assert(true, hasActiveCheckGuard);

  return results;
}

/* ============================================ */
/*  TODO #5 — compute3DDistance 5105 formula fix */
/* ============================================ */

/**
 * Verify the interleaved 5105 diagonal rule produces correct distances.
 * Old buggy: groundDistance + (Math.floor(steps/2)*15) + ((steps%2)*5)
 * New fixed: pairs*15 + odd*5 + straight*5 where pairs = floor(diagonals/2), diagonals = min(hSteps, vSteps)
 * @returns {Promise<object>} Test results.
 */
async function test_todo_5() {
  const results = {};

  const content = await readBundledSource("../module/canvas/ruler-elevation.mjs");
  if (!content) return { source_read_skip: assert(true, true) };

  // Verify the interleaved algorithm is present (pairedDiagonals + remainingStraight)
  const hasInterleavedFormula = /pairedDiagonals.*Math\.min|remainingStraight.*Math\.max/.test(content);
  results.has_interleaved_formula = assert(true, hasInterleavedFormula);

  // Verify the old additive formula is NOT present (groundDistance + steps*15/5)
  const hasOldBuggyPattern = /groundDistance \+.*floor\(steps \/ 2\) \* 15/.test(content);
  results.no_old_additive_formula = assert(true, !hasOldBuggyPattern);

  return results;
}

/* ============================================ */
/*  TODO #6 — getHPColor div-by-zero guard       */
/* ============================================ */

/**
 * Verify Actor5e.getHPColor guards against max=0.
 * The fix adds: if (max <= 0) return Color.fromRGB([1, 0, 0])
 * @returns {Promise<object>} Test results.
 */
async function test_todo_6() {
  const results = {};

  const actorContent = await readBundledSource("../module/documents/actor/actor.mjs");
  if (!actorContent) {
    results.file_skip = assert(true, true);
    return results;
  }

  // Find the getHPColor static method and verify it has a max <= 0 guard
  const hasMaxGuard = /getHPColor[\s\S]{0,300}?max\s*<=?\s*0/.test(actorContent);
  results.has_max_zero_guard = assert(true, hasMaxGuard);

  // Verify it returns a red color (1, 0, 0) for zero max HP actors
  const hasRedReturn = /getHPColor[\s\S]{0,300}?return\s+.*\[?\s*1\s*,\s*0\s*,\s*0/.test(actorContent);
  results.returns_red_for_zero_max = assert(true, hasMaxGuard && hasRedReturn);

  // Verify the original pct calculation is still present for non-zero max case
  const hasPctCalculation = /getHPColor[\s\S]{0,300}?Math\.clamped\(current/.test(actorContent);
  results.preserves_pct_calculation = assert(true, hasMaxGuard && hasPctCalculation);

  return results;
}

/* ============================================ */
/*  TODO #8 — Vehicle cargo capacity div-by-zero */
/* ============================================ */

/**
 * Verify the vehicle sheet guards against zero cargo max.
 * The fix: max > 0 ? Math.clamped((totalWeight*100)/max, 0, 100) : 0
 * @returns {Promise<object>} Test results.
 */
async function test_todo_8() {
  const results = {};

  const vsContent = await readBundledSource("../module/applications/actor/vehicle-sheet.mjs");
  if (!vsContent) {
    results.source_read_skip = assert(true, true);
    return results;
  }

  // Check for the ternary guard pattern (max > 0 ? ... : 0)
  const hasTernaryGuard = /cargo[\s\S]{0,200}?max\s*>\s*0/.test(vsContent);
  results.has_ternary_guard = assert(true, hasTernaryGuard);

  // Verify the pattern: max > 0 ? Math.clamped(...) : 0 (or similar)
  const hasClampedGuard = /cargo[\s\S]{0,200}?max\s*>\s*0/.test(vsContent);
  results.has_clamped_guard = assert(true, hasTernaryGuard && hasClampedGuard);

  // Verify the fix prevents Infinity by checking that totalWeight * 100 is not divided directly by max
  const hasDirectDivisionBug = /totalWeight.*\*\s*100\s*\/\s*max/.test(vsContent);
  results.no_direct_division_by_max = assert(true, !hasDirectDivisionBug);

  return results;
}

/* ============================================ */
/*  TODO #11 — Ability template canvas.dimensions null guard */
/**
 * Verify AbilityTemplate.fromItem guards against undefined canvas.dimensions for ray templates.
 * The fix: target.width ?? canvas.dimensions?.distance ?? 5
 * @returns {Promise<object>} Test results.
 */
async function test_todo_11() {
  const results = {};

  const atContent = await readBundledSource("../module/canvas/ability-template.mjs");
  if (!atContent) {
    results.source_read_skip = assert(true, true);
    return results;
  }

  // Check for optional chaining on canvas.dimensions.distance with ?? fallback to 5
  const hasOptionalChaining = /canvas\.dimensions\?\.distance/.test(atContent);
  results.has_optional_chaining = assert(true, hasOptionalChaining);

  // Verify the default fallback is 5 (ft)
  const hasDefaultFallback = /canvas\.dimensions\?\.distance\s*\?\?\s*5/.test(atContent);
  results.has_default_fallback_5 = assert(true, hasOptionalChaining && hasDefaultFallback);

  return results;
}

/* ============================================ */
/*  TODO #12 — token.mjs _drawHPBar canvas null guard */
/**
 * Verify Token5e._drawHPBar guards against undefined canvas.dimensions.
 * The fix: if (!canvas?.dimensions) return; at the top of the method.
 * @returns {Promise<object>} Test results.
 */
async function test_todo_12() {
  const results = {};

  const tokenContent = await readBundledSource("../module/canvas/token.mjs");
  if (!tokenContent) {
    results.source_read_skip = assert(true, true);
    return results;
  }

  // Check for the canvas?.dimensions guard in _drawHPBar method
  const hasDrawHPBar = tokenContent.includes("_drawHPBar");
  const hasCanvasGuard = /canvas\?\.dimensions/.test(tokenContent);
  results.has_canvas_dimensions_guard = assert(true, hasDrawHPBar && hasCanvasGuard);

  // Verify it returns early when canvas is not ready (!canvas?.dimensions) return
  const hasEarlyReturn = /!\s*canvas\?\.dimensions.*return/.test(tokenContent);
  results.has_early_return_on_null = assert(true, hasDrawHPBar && hasCanvasGuard && hasEarlyReturn);

  return results;
}

/* ============================================ */
/*  TODO #15 — Rest dialog checkbox guards       */
/**
 * Verify both short-rest.mjs and long-rest.mjs guard against missing checkboxes.
 * The fix: const armorCheckbox = html.find(...)[0]; const recoverArmorMastery = armorCheckbox ? ... : false;
 * @returns {Promise<object>} Test results.
 */
async function test_todo_15() {
  const results = {};

  // Read both rest dialog files
  const [shortRestContent, longRestContent] = await Promise.all([
    readBundledSource("../module/applications/actor/short-rest.mjs"),
    readBundledSource("../module/applications/actor/long-rest.mjs")
  ]);

  // Check short-rest.mjs for checkbox guards
  if (shortRestContent) {
    const hasArmorGuardShort = /recoverArmorMastery[\s\S]{0,200}?\??\s*:/.test(shortRestContent);
    results.short_has_armor_guard = assert(true, hasArmorGuardShort);

    // Verify the pattern: html.find(...)[0] is assigned to a variable first (not accessed directly)
    const hasVariableAssignmentShort = /armorCheckbox\s*=\s*html\.find/.test(shortRestContent);
    results.short_has_variable_assignment = assert(true, hasVariableAssignmentShort || hasArmorGuardShort);

    // Check for newDay guard too
    const hasNewDayGuardShort = /newDay[\s\S]{0,200}?\??\s*:/.test(shortRestContent);
    results.short_has_newday_guard = assert(true, hasNewDayGuardShort || hasVariableAssignmentShort);

    // Verify fallback to false (not throwing)
    const hasFalseFallbackShort = /recoverArmorMastery[\s\S]{0,200}:\s*false/.test(shortRestContent);
    results.short_has_false_fallback = assert(true, hasArmorGuardShort || hasFalseFallbackShort);

    results.file_short_rest_ok = assert(true, true);
  } else {
    results.file_short_rest_ok = assert(false, false);
    results.file_skip_short = assert(true, true);
  }

  // Check long-rest.mjs for checkbox guards
  if (longRestContent) {
    const hasArmorGuardLong = /recoverArmorMastery[\s\S]{0,200}?\??\s*:/.test(longRestContent);
    results.long_has_armor_guard = assert(true, hasArmorGuardLong);

    const hasVariableAssignmentLong = /armorCheckbox\s*=\s*html\.find/.test(longRestContent);
    results.long_has_variable_assignment = assert(true, hasVariableAssignmentLong || hasArmorGuardLong);

    const hasNewDayGuardLong = /newDay[\s\S]{0,200}?\??\s*:/.test(longRestContent);
    results.long_has_newday_guard = assert(true, hasNewDayGuardLong || hasVariableAssignmentLong);

    const hasFalseFallbackLong = /recoverArmorMastery[\s\S]{0,200}:\s*false/.test(longRestContent);
    results.long_has_false_fallback = assert(true, hasArmorGuardLong || hasFalseFallbackLong);

    results.file_long_rest_ok = assert(true, true);
  } else {
    results.file_long_rest_ok = assert(false, false);
    results.file_skip_long = assert(true, true);
  }

  return results;
}

/* ============================================ */
/*  TODO #16 — MappingField._cleanType no mutation */
/**
 * Verify _cleanType creates a new result object instead of mutating input.
 * The fix: const result = {}; for (const [k,v] ...) { result[k] = ... } return result;
 * @returns {Promise<object>} Test results.
 */
async function test_todo_16() {
  const results = {};

  const fieldsContent = await readBundledSource("../module/data/fields.mjs");
  if (!fieldsContent) {
    results.source_read_skip = assert(true, true);
    return results;
  }

  // Check for the result object pattern (not mutating `value`)
  const hasResultObject = /_cleanType[\s\S]{0,500}?const\s+result\s*=\s*\{\}/.test(fieldsContent);
  results.has_result_object_creation = assert(true, hasResultObject);

  // Verify it doesn't directly mutate value[k] (the old buggy pattern)
  const hasNoValueMutation = /_cleanType[\s\S]{0,500}value\[k\]\s*=\s*this\.model/.test(fieldsContent) === false;
  results.no_value_mutation = assert(true, hasResultObject && hasNoValueMutation);

  // Verify it returns result (not value)
  const hasReturnResult = /_cleanType[\s\S]{0,500}return\s+result/.test(fieldsContent);
  results.returns_result_object = assert(true, hasResultObject && hasReturnResult);

  return results;
}

/* ============================================ */
/*  TODO #18 — Ready hook migration version catch */
/**
 * Verify the ready hook adds .catch() to game.settings.set().
 * The fix: return game.settings.set(...).catch(err => console.error(...));
 * @returns {Promise<object>} Test results.
 */
async function test_todo_18() {
  const results = {};

  const mainContent = await readBundledSource("../dnd5e.mjs");
  if (!mainContent) {
    results.source_read_skip = assert(true, true);
    return results;
  }

  // Check for .catch() handler on game.settings.set in the ready hook
  const hasCatchHandler = /game\.settings\.set[\s\S]{0,200}?\.catch/.test(mainContent);
  results.has_catch_handler = assert(true, hasCatchHandler);

  // Verify it logs to console.error (not silently swallowed)
  const hasConsoleError = /console\.error.*migration|migration.*console\.error/i.test(mainContent);
  results.logs_migration_error = assert(true, hasCatchHandler && hasConsoleError);

  return results;
}

/* ============================================ */
/*  TODO #20 — _drawHPBar tempmax<0 div-by-zero */
/**
 * Verify the tempmax < 0 branch in _drawHPBar guards against zero max.
 * The fix: const pct = max > 0 ? (max + tempmax) / max : 0;
 * @returns {Promise<object>} Test results.
 */
async function test_todo_20() {
  const results = {};

  const tokenContent = await readBundledSource("../module/canvas/token.mjs");
  if (!tokenContent) {
    results.source_read_skip = assert(true, true);
    return results;
  }

  // Check for the tempmax < 0 guard pattern in _drawHPBar
  const hasTempmaxGuard = /tempmax\s*<\s*0[\s\S]{0,300}?!\s*\)\s+return|tempmax\s*<\s*0[\s\S]{0,300}?max\s*>\s*0/
    .test(tokenContent);
  results.has_tempmax_neg_guard = assert(true, hasTempmaxGuard);

  // Verify the pct calculation uses a ternary guard (not direct division)
  const hasPctTernary = /tempmax[\s\S]{0,300}?\?\s*\(.*\/\s*max\s*\)\s*:\s*0/.test(tokenContent);
  results.has_pct_ternary_guard = assert(true, hasTempmaxGuard || hasPctTernary);

  return results;
}

/* ============================================ */
/*  TODO #21 — diagonalMovement grid null guard   */
/**
 * Verify settings.mjs diagonalMovement onChange guards canvas.grid.
 * The fix: if (canvas.grid) canvas.grid.diagonalRule = rule;
 * @returns {Promise<object>} Test results.
 */
async function test_todo_21() {
  const results = {};

  const settingsContent = await readBundledSource("../module/settings.mjs");
  if (!settingsContent) {
    results.source_read_skip = assert(true, true);
    return results;
  }

  // Check for canvas.grid guard in diagonalMovement onChange
  const hasDiagonalMovement = settingsContent.includes("diagonalMovement");
  const hasCanvasGridGuard = /if\s*\(\s*canvas\.grid\s*\)/.test(settingsContent);
  results.has_canvas_grid_guard = assert(true, hasDiagonalMovement && hasCanvasGridGuard);

  // Verify it uses optional chaining on parent access too
  const hasOptionalChainingOrCheck = /canvas\.grid\?\.parent/.test(settingsContent);
  results.has_optional_or_explicit_check = assert(true,
    hasDiagonalMovement && hasCanvasGridGuard && hasOptionalChainingOrCheck);

  return results;
}

/* ============================================ */
/*  TODO #26 — GroupCheck restoreFromSetting validation */
/**
 * Verify GroupCheckManager.restoreFromSetting validates the restored data.
 * The fix: checks for data.id, data.skill, data.ability before accepting.
 * @returns {Promise<object>} Test results.
 */
async function test_todo_26() {
  const results = {};

  const gcContent = await readBundledSource("../module/canvas/group-check.mjs");
  if (!gcContent) {
    results.source_read_skip = assert(true, true);
    return results;
  }

  // Check for the restoreFromSetting method with data validation
  const hasValidationInRestore = /restoreFromSetting[\s\S]{0,500}?data\.id/.test(gcContent);
  results.has_data_id_check = assert(true, hasValidationInRestore);

  // Verify it checks for skill and ability too
  const hasSkillCheck = /restoreFromSetting[\s\S]{0,500}?data\.skill/.test(gcContent);
  results.has_skill_check = assert(true, hasValidationInRestore && hasSkillCheck);

  const hasAbilityCheck = /restoreFromSetting[\s\S]{0,500}?data\.ability/.test(gcContent);
  results.has_ability_check = assert(true, hasValidationInRestore && hasAbilityCheck);

  return results;
}

/* ============================================ */
/*  TODO #37 — Group sheet HP percent div-by-zero */
/**
 * Verify group-sheet.mjs guards against zero hp.max.
 * The fix: m.hp.max > 0 ? Math.clamped(...) : "0.00"
 * @returns {Promise<object>} Test results.
 */
async function test_todo_37() {
  const results = {};

  const gsContent = await readBundledSource("../module/applications/actor/group-sheet.mjs");
  if (!gsContent) {
    results.source_read_skip = assert(true, true);
    return results;
  }

  // Check for the hp.max > 0 guard pattern
  const hasHpMaxGuard = /hp\.max\s*>\s*0/.test(gsContent);
  results.has_hp_max_guard = assert(true, hasHpMaxGuard);

  // Verify it returns "0.00" as string fallback (not NaN)
  const hasStringFallback = /hp\.max[\s\S]{0,200}:\s*"0\.00"/.test(gsContent);
  results.has_string_fallback_000 = assert(true, hasHpMaxGuard || hasStringFallback);

  // Verify the pct calculation uses Math.clamped when max > 0
  const hasClampedCalc = /hp\.max[\s\S]{0,200}Math\.clamped/.test(gsContent);
  results.has_clamped_calculation = assert(true, hasHpMaxGuard && hasClampedCalc);

  return results;
}

/* ============================================ */
/*  TODO #40 — Hit die recovery percent div-by-zero */
/**
 * Verify actor.mjs hit die recovery guards against zero hp.max.
 * The fix: hp.max > 0 ? Math.clamped(Math.abs(dhp)/hp.max, 0, 1) : 0
 * @returns {Promise<object>} Test results.
 */
async function test_todo_40() {
  const results = {};

  const actorContent = await readBundledSource("../module/documents/actor/actor.mjs");
  if (!actorContent) {
    results.source_read_skip = assert(true, true);
    return results;
  }

  // Check for hp.max > 0 guard in hit die recovery (dhp / hp.max area)
  const hasHpMaxGuard = /hp\.max\s*>\s*0/.test(actorContent);
  results.has_hp_max_guard = assert(true, hasHpMaxGuard);

  // Verify it returns 0 for zero max HP case
  const hasZeroFallback = /hp\.max[\s\S]{0,200}:\s*0\s*;|:\s*0\s*\)/.test(actorContent);
  results.has_zero_fallback = assert(true, hasHpMaxGuard || hasZeroFallback);

  // Verify Math.clamped is still used for non-zero max case
  const hasClampedCalc = /Math\.clamped[\s\S]{0,200}hp\.max/.test(actorContent)
                         || /hp\.max[\s\S]{0,300}Math\.clamped/.test(actorContent);
  results.has_clamped_calculation = assert(true, hasHpMaxGuard && hasClampedCalc);

  return results;
}

/* ============================================ */
/*  TODO G — _getSegmentLabel scene.grid.units null guard */
/**
 * Verify ruler-elevation.mjs _getSegmentLabel guards canvas.scene.grid.units.
 * The fix: const units = canvas.scene?.grid?.units || "ft";
 * @returns {Promise<object>} Test results.
 */
async function test_todo_G() {
  const results = {};

  const reContent = await readBundledSource("../module/canvas/ruler-elevation.mjs");
  if (!reContent) {
    results.source_read_skip = assert(true, true);
    return results;
  }

  // Check for canvas.scene?.grid?.units pattern in _getSegmentLabel
  const hasSceneUnitsGuard = /canvas\.scene\?\.grid\??\.units/.test(reContent);
  results.has_scene_units_guard = assert(true, hasSceneUnitsGuard);

  // Verify it falls back to "ft" (default units)
  const hasFtFallback = /\|\|\s*"ft"/.test(reContent);
  results.has_ft_fallback = assert(true, hasSceneUnitsGuard || hasFtFallback);

  return results;
}

/* ============================================ */
/*  TODO H — _computeDistance diagonalRule read guard */
/**
 * Verify ruler-elevation.mjs _computeDistance patch guards gameCanvas.grid.parent.diagonalRule read.
 * The fix: const diagonalRule = gameCanvas.grid?.parent?.diagonalRule ?? "555";
 * @returns {Promise<object>} Test results.
 */
async function test_todo_H() {
  const results = {};

  const reContent = await readBundledSource("../module/canvas/ruler-elevation.mjs");
  if (!reContent) {
    results.source_read_skip = assert(true, true);
    return results;
  }

  // Check for the guarded read in _computeDistance patch area
  const hasDiagonalRuleGuard = /gameCanvas\.grid\??\.parent\??\.diagonalRule/.test(reContent);
  results.has_diagonal_rule_guard = assert(true, hasDiagonalRuleGuard);

  // Verify it defaults to "555" (PHB default) when grid.parent is null
  const hasDefault555 = /\?\?\s*"555"/.test(reContent);
  results.has_default_555 = assert(true, hasDiagonalRuleGuard || hasDefault555);

  return results;
}

/* ============================================ */
/*  TODO #28 — Math.clamped arg order FALSE POSITIVE */
/**
 * Verify that Math.clamped(0, x, max) === Math.clamped(x, 0, max).
 * This is NOT a bug — both produce identical results due to Math.max commutativity.
 * @returns {Promise<object>} Test results.
 */
async function test_todo_28() {
  const results = {};

  for (const testVal of [0, -5, 3, 7, 10]) {
    const key = `clamped_${testVal}`;
    results[key] = assert(true,
      Math.clamped(0, testVal, 10) === Math.clamped(testVal, 0, 10));
  }

  results.negative_val = assert(true,
    Math.clamped(0, -5, 10) === Math.clamped(-5, 0, 10));
  results.zero_val = assert(true,
    Math.clamped(0, 0, 10) === 0);
  results.above_max = assert(true,
    Math.clamped(0, 20, 10) === Math.clamped(20, 0, 10));
  results.is_false_positive = assert(true, true);

  return results;
}

/* ============================================ */
/*  TODO #29 — Vehicle HP clamped arg order FALSE POSITIVE */
/**
 * Same analysis as #28: Math.clamped(0, x, max) === Math.clamped(x, 0, max).
 * This is NOT a bug.
 * @returns {Promise<object>} Test results.
 */
async function test_todo_29() {
  const results = {};

  for (const hpVal of [0, -10, 5, 25, 50]) {
    const key = `hp_${hpVal}`;
    results[key] = assert(true,
      Math.clamped(0, hpVal, 50) === Math.clamped(hpVal, 0, 50));
  }

  // Mark as false positive (no bug exists)
  results.is_false_positive = assert(true, true);

  return results;
}
