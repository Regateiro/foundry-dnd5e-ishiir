// extended tests for actor module: applyTempHP, multiplier edge cases, and boundary conditions.
import { assert } from "../tests.mjs";

const DEFAULTS = { thp: 0, hp: 10, fp: 0, ahp: 0, maxhp: 10, tempmax: 0 };

/**
 * Run all actor extended tests.
 * @returns {Promise<object>} Test results grouped by suite.
 */
export async function runExtendedActorTests() {
  console.debug("Running actor extended tests...");

  const character = await Actor.create({ name: "DND5E Test Character", type: "character" });
  const npc = await Actor.create({ name: "DND5E Test NPC", type: "npc" });

  const results = {
    applyTempHP_character: await test_applyTempHP(character),
    multiplierEdgeCases_character: await test_multiplierEdgeCases(character),
    multiplierEdgeCases_npc: await test_multiplierEdgeCasesNPC(npc),
    tempmaxBoundary_exact: await test_tempmaxBoundaryExact(character),
    ahpNegative_initial: await test_ahpNegativeInitial(character),
    threshold_zeroMaxHP: await test_thresholdZeroMaxHP(npc)
  };

  await Actor.deleteDocuments([character._id, npc._id]);
  return results;
}

/* ============================================ */
/*  applyTempHP Tests                           */
/* ============================================ */

/**
 * Test the applyTempHP method for characters.
 * Logic: amount > current → update to new amount; otherwise no-op.
 * @param {Actor5e} character
 * @returns {Promise<object>}
 */
async function test_applyTempHP(character) {
  console.debug("Running applyTempHP tests...");
  const results = {};

  // Test 01: Setting THP higher than current → updates
  await resetActor(character, { thp: 5 });
  await character.applyTempHP(10);
  results.update_higher_01 = assert(10, getActualValue(character, "thp"));

  // Test 02: Setting THP lower than current → no-op (value unchanged)
  await resetActor(character, { thp: 10 });
  await character.applyTempHP(5);
  results.update_lower_01 = assert(10, getActualValue(character, "thp"));

  // Test 03: Setting THP equal to current → no-op (amount not > tmp)
  await resetActor(character, { thp: 7 });
  await character.applyTempHP(7);
  results.update_equal_01 = assert(7, getActualValue(character, "thp"));

  // Test 04: Setting THP to zero when current is positive → no-op (0 not > tmp)
  await resetActor(character, { thp: 5 });
  await character.applyTempHP(0);
  results.update_zero_01 = assert(5, getActualValue(character, "thp"));

  // Test 05: Setting THP to zero when current is also zero → no-op (0 not > 0)
  await resetActor(character, { thp: 0 });
  await character.applyTempHP(0);
  results.update_zero_zero_01 = assert(0, getActualValue(character, "thp"));

  // Test 06: Setting THP to negative → parseInt(negative) preserves sign; -5 not > current → no-op
  await resetActor(character, { thp: 3 });
  await character.applyTempHP(-5);
  results.update_negative_01 = assert(3, getActualValue(character, "thp"));

  // Test 07: Setting THP to NaN-like string → parseInt("abc") = NaN; NaN > tmp is false → no-op
  await resetActor(character, { thp: 5 });
  await character.applyTempHP("invalid");
  results.update_nan_string_01 = assert(5, getActualValue(character, "thp"));

  // Test 08: Setting THP to string number → parseInt parses correctly; 20 > current → updates
  await resetActor(character, { thp: 3 });
  await character.applyTempHP("20");
  results.update_string_num_01 = assert(20, getActualValue(character, "thp"));

  // Test 09: Setting THP when already at max → updates to the value
  await resetActor(character, { thp: 15 });
  await character.applyTempHP(30);
  results.update_above_max_01 = assert(30, getActualValue(character, "thp"));

  // Test 10: Setting THP with default (amount=0) when current > 0 → no-op
  await resetActor(character, { thp: 5 });
  await character.applyTempHP();
  results.update_default_01 = assert(5, getActualValue(character, "thp"));

  return results;
}

/* ============================================ */
/*  Multiplier Edge Cases                       */
/* ============================================ */

/**
 * Test applyDamage with multiplier edge cases (character).
 * Logic: amount * multiplier is floored; special values tested.
 * @param {Actor5e} character
 * @returns {Promise<object>}
 */
async function test_multiplierEdgeCases(character) {
  console.debug("Running multiplier edge case tests...");
  const results = {};

  // Test 01: Multiplier = 0 → damage becomes 0 (no-op effectively)
  await resetActor(character, { thp: 5, hp: 10 });
  await character.applyDamage(10, 0);
  results.mult_zero_01 = assert(5, getActualValue(character, "thp"));
  results.mult_zero_02 = assert(10, getActualValue(character, "hp"));

  // Test 02: Multiplier very large → damage amplified, all pools depleted to zero
  await resetActor(character, { thp: 5, hp: 10 });
  await character.applyDamage(10, 99);
  results.mult_large_01 = assert(0, getActualValue(character, "thp"));
  results.mult_large_02 = assert(0, getActualValue(character, "hp"));

  // Test 03: Multiplier negative → healing only affects HP; AHP/THP untouched
  await resetActor(character, { thp: 5, hp: 10 });
  await character.applyDamage(10, -1);
  results.mult_neg_01 = assert(5, getActualValue(character, "thp")); // THP not healed (stays at 5)
  results.mult_neg_02 = assert(10, getActualValue(character, "hp")); // HP capped at max (tempmax=0)

  // Test 04: Multiplier exactly 1 → no change from base damage
  await resetActor(character, { thp: 5, hp: 8 });
  await character.applyDamage(3, 1);
  results.mult_one_01 = assert(2, getActualValue(character, "thp"));
  results.mult_one_02 = assert(8, getActualValue(character, "hp"));

  // Test 05: Multiplier between -1 and 0 → heals partially; AHP/THP untouched
  await resetActor(character, { thp: 3, hp: 8 });
  await character.applyDamage(3, -0.4);
  results.mult_partial_neg_01 = assert(3, getActualValue(character, "thp")); // THP not healed (stays at 3)
  results.mult_partial_neg_02 = assert(10, getActualValue(character, "hp")); // floor(-1.2)=-2 → heal to 10 (capped at max)

  return results;
}

/**
 * Test applyDamage with multiplier edge cases (NPC).
 * @param {Actor5e} npc
 * @returns {Promise<object>}
 */
async function test_multiplierEdgeCasesNPC(npc) {
  console.debug("Running NPC multiplier edge case tests...");
  const results = {};

  // Test 01: Multiplier = 0 → no FP loss (damage becomes zero)
  await resetActor(npc, { thp: 5, hp: 10, fp: 8 });
  await npc.applyDamage(20, 0);
  results.npc_mult_zero_fp_01 = assert(8, getActualValue(npc, "fp")); // FP unchanged

  // Test 02: Multiplier very large → all pools depleted including FP
  await resetActor(npc, { thp: 5, hp: 10, fp: 8 });
  await npc.applyDamage(3, 99);
  results.npc_mult_large_fp_01 = assert(0, getActualValue(npc, "fp")); // FP depleted

  // Test 03: Multiplier negative → heals but does NOT restore FP
  await resetActor(npc, { thp: 0, hp: 5, fp: 0 });
  await npc.applyDamage(-10, -1);
  results.npc_mult_neg_fp_01 = assert(0, getActualValue(npc, "fp")); // FP stays at 0

  return results;
}

/* ============================================ */
/*  tempmax Boundary: HP exactly at max+tempmax */
/* ============================================ */

/**
 * Test healing that lands EXACTLY on max + tempmax boundary.
 * Logic: Math.clamped(oldHP - damage, hpThreshold, Math.max(0, hp.max + tmpMax))
 * When oldHP + |healing| === max+tempmax exactly → should reach it without overshooting.
 * @param {Actor5e} character
 * @returns {Promise<object>}
 */
async function test_tempmaxBoundaryExact(character) {
  console.debug("Running tempmax boundary exact tests...");
  const results = {};

  // Test 01: Healing lands EXACTLY on max + tempmax → HP reaches ceiling exactly
  await resetActor(character, { thp: 0, hp: 5, tempmax: 5 });
  // max = 10, tempmax = 5 → ceiling = 15; current = 5; heal by 10 → should reach 15
  await character.applyDamage(-10);
  results.boundary_exact_01 = assert(15, getActualValue(character, "hp"));

  // Test 02: Healing one short of ceiling → HP at max+tempmax - 1
  await resetActor(character, { thp: 0, hp: 4, tempmax: 6 });
  // max = 10, tempmax = 6 → ceiling = 16; current = 4; heal by 11 → should reach 15 (one short)
  await character.applyDamage(-11);
  results.boundary_one_short_01 = assert(15, getActualValue(character, "hp"));

  // Test 03: Healing exceeds ceiling → HP capped at max+tempmax exactly
  await resetActor(character, { thp: 0, hp: 8, tempmax: 2 });
  // max = 10, tempmax = 2 → ceiling = 12; current = 8; heal by 10 → should cap at 12
  await character.applyDamage(-10);
  results.boundary_exceeds_01 = assert(12, getActualValue(character, "hp"));

  // Test 04: tempmax = 0 → ceiling is just max (no extra)
  await resetActor(character, { thp: 0, hp: 5, tempmax: 0 });
  await character.applyDamage(-10);
  results.boundary_zero_tempmax_01 = assert(10, getActualValue(character, "hp"));

  return results;
}

/* ============================================ */
/*  AHP Negative Initial Value                  */
/* ============================================ */

/**
 * Test applyDamage when armor HP starts negative (edge case from parseInt).
 * Logic: const oldAHP = parseInt(hp.armor) || 0 → if hp.armor is a string, parseInt parses it;
 *         if it's -5, parseInt("-5") = -5 but -5 is truthy so used as-is... wait no.
 *         Actually parseInt("-5") returns -5 which is falsy? No, -5 is truthy in JS!
 *         But the code uses `parseInt(hp.armor) || 0` — if hp.armor is "-5", parseInt gives -5 (truthy).
 *         If hp.armor is "invalid" or empty string "", parseInt returns NaN which is falsy → falls to 0.
 * @param {Actor5e} character
 * @returns {Promise<object>}
 */
async function test_ahpNegativeInitial(character) {
  console.debug("Running AHP negative initial tests...");
  const results = {};

  // Test 01: Negative AHP string → clamped to 0 by data model
  await resetActor(character, { thp: 5, hp: 10 });
  await character.update({ "system.attributes.hp.armor": -3 });
  results.negative_ahp_str_clamped = assert(0, getActualValue(character, "ahp")); // AHP clamped to 0

  // Test 02: Negative numeric AHP → also clamped to 0
  await resetActor(character, { thp: 5, hp: 10 });
  await character.update({ "system.attributes.hp.armor": -10 });
  results.negative_ahp_num_clamped = assert(0, getActualValue(character, "ahp")); // AHP clamped to 0

  return results;
}

/* ============================================ */
/*  Threshold Edge: hp.max = 0                  */
/* ============================================ */

/**
 * Test applyDamage when max HP is zero.
 * Logic: const hpThreshold = Math.max(Math.ceil(hp.max * threshold / 100), 1)
 * When hp.max = 0: ceil(0 * threshold / 100) = ceil(0) = 0, then max(0, 1) = 1.
 * So threshold is always at least 1 regardless of max HP being zero.
 * @param {Actor5e} npc
 * @returns {Promise<object>}
 */
async function test_thresholdZeroMaxHP(npc) {
  console.debug("Running threshold zero-max-HP tests...");
  const results = {};

  // Test 01: max HP = 0, any threshold → floor is always 1 (due to Math.max(..., 1))
  await resetActor(npc, { thp: 5, hp: 0, fp: 5 });
  await npc.update({ "system.attributes.hp.max": 0 });

  // Damage of 3 should go through THP first → THP goes to 2, then HP (already at 0) can't drop below threshold=1
  // But wait: hp.value is already 0 and we're applying damage... the clamped range is [hpThreshold, max(0, hp.max+tempmax)] = [1, 1]
  // So oldHP - damage = 0 - 3 = -3. Math.clamped(-3, 1, 1) = 1? No wait: upper bound when hp.max=0 is max(0, 0+tempmax).
  // Actually for npc with tempmax=0 (default), max(0, 0+0) = 0. So Math.clamped(-3, 1, 0)... this would be clamped to... hmm.
  // The code uses: const upperHP = Math.clamped(oldHP - damage, hpThreshold, Math.max(0, hp.max + tmpMax));
  // If hp.max=0 and tmpMax=0: max(0, 0) = 0. So clamped(-3, 1, 0). Since lower > upper, behavior depends on Math.clamped implementation.
  // In Foundry core, Math.clamped(value, min, max) typically returns value if within [min,max], or the nearest boundary otherwise.
  // With min=1 and max=0 (invalid range), this could be undefined behavior. Let's test what actually happens.

  await npc.applyDamage(3);
  results.zero_max_hp_01 = assert(true, getActualValue(npc, "hp") >= 0); // HP should not go negative

  return results;
}

/* ============================================ */
/*  HELPERS                                     */
/* ============================================ */

function resetActor(actor, params = {}) {
  const { thp, hp, fp, maxhp, ahp, tempmax } = { ...DEFAULTS, ...params };
  return actor.update({
    "system.attributes.hp.value": hp,
    "system.attributes.hp.max": maxhp,
    "system.attributes.hp.temp": thp,
    "system.attributes.hp.armor": ahp,
    "system.attributes.hp.tempmax": tempmax,
    "system.resources.legres.value": fp
  });
}

function getActualValue(actor, key) {
  switch (key) {
    case "thp": return actor.system.attributes.hp.temp;
    case "hp": return actor.system.attributes.hp.value;
    case "ahp": return actor.system.attributes.hp.armor;
    case "fp": return actor.system.resources.legres.value;
    default: throw new Error(`Unknown key: ${key}`);
  }
}
