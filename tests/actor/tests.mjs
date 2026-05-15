// This file contains tests for the Actor class in the DND5E system.

import { assert } from "../tests.mjs";

/**
 * Run a test and log its name before execution.
 * @param {string} name Full test identifier
 * @param {Function|Promise} fn The async function or promise to run
 * @returns {Promise<*>}
 */
async function runTest(name, fn) {
  console.log(`[TEST] ${name}`);
  return typeof fn === "function" ? await fn() : await fn;
}

const DEFAULTS = { thp: 0, hp: 10, fp: 0, ahp: 0, maxhp: 10, tempmax: 0 };

/**
 * Run all actor tests.
 * @returns {Promise<object>} Test results grouped by suite.
 */
export async function runActorTests() {
  const character = await Actor.create({ name: "DND5E Test Character", type: "character" });
  const npc = await Actor.create({ name: "DND5E Test NPC", type: "npc" });

  const results = {
    applyDamage_character: await runTest("actor.applyDamage_character", () => test_applyDamage_character(character)),
    applyDamage_npc: await runTest("actor.applyDamage_npc", () => test_applyDamage_npc(npc)),
    applyTempHP_character: await runTest("actor.applyTempHP_character", () => test_applyTempHP(character)),
    multiplierEdgeCases_character: await runTest("actor.multiplierEdgeCases_character", () => test_multiplierEdgeCases(character)),
    multiplierEdgeCases_npc: await runTest("actor.multiplierEdgeCases_npc", () => test_multiplierEdgeCasesNPC(npc)),
    tempmaxBoundary_exact: await runTest("actor.tempmaxBoundary_exact", () => test_tempmaxBoundaryExact(character)),
    ahpNegative_initial: await runTest("actor.ahpNegative_initial", () => test_ahpNegativeInitial(character)),
    threshold_zeroMaxHP: await runTest("actor.threshold_zeroMaxHP", () => test_thresholdZeroMaxHP(npc))
  };

  await Actor.deleteDocuments([character._id, npc._id]);
  return results;
}

/* ============================================ */
/*  CHARACTER TESTS                             */
/* ============================================ */

/**
 * Test applyDamage for characters (HP + THP + Armor).
 * @param {Actor5e} character
 * @returns {Promise<object>}
 */
async function test_applyDamage_character(character) {
  const results = {};

  const suites = [
    { name: "Basic Damage", tests: characterBasicDamage },
    { name: "Healing", tests: characterHealing },
    { name: "Multipliers", tests: characterMultipliers },
    { name: "Armor", tests: characterArmor },
    { name: "Hooks", tests: characterHooks }
  ];

  for (const suite of suites) {
    const suiteResults = await runSuite(character, suite.tests);
    Object.assign(results, suiteResults);
  }

  return results;
}

const characterBasicDamage = [
  {
    id: "01",
    desc: "Damage exceeding total HP + THP results in both zero",
    setup: { thp: 10, hp: 10 },
    damage: 50,
    expected: { thp: 0, hp: 0 }
  },
  {
    id: "02",
    desc: "Damage only reduces THP, not HP",
    setup: { thp: 10, hp: 10 },
    damage: 3,
    expected: { thp: 7, hp: 10 }
  },
  {
    id: "03",
    desc: "Damage uses all THP then reduces HP but not to zero",
    setup: { thp: 10, hp: 10 },
    damage: 15,
    expected: { thp: 0, hp: 5 }
  },
  {
    id: "06",
    desc: "Zero damage leaves all values unchanged",
    setup: { thp: 5, hp: 8 },
    damage: 0,
    expected: { thp: 5, hp: 8 }
  },
  {
    id: "07",
    desc: "Damage exactly equal to THP",
    setup: { thp: 10, hp: 10 },
    damage: 10,
    expected: { thp: 0, hp: 10 }
  },
  {
    id: "08",
    desc: "Damage exactly equal to HP (no THP)",
    setup: { thp: 0, hp: 10 },
    damage: 10,
    expected: { thp: 0, hp: 0 }
  },
  {
    id: "13",
    desc: "Damage when HP already at zero",
    setup: { thp: 0, hp: 0 },
    damage: 10,
    expected: { thp: 0, hp: 0 }
  }
];

const characterHealing = [
  {
    id: "04",
    desc: "Healing restores HP without exceeding max",
    setup: { thp: 0, hp: 5 },
    damage: -1,
    expected: { thp: 0, hp: 6 }
  },
  {
    id: "05",
    desc: "Healing beyond max HP caps at max",
    setup: { thp: 0, hp: 0 },
    damage: -20,
    expected: { thp: 0, hp: 10 }
  },
  {
    id: "12",
    desc: "Healing when THP present does not restore THP",
    setup: { thp: 5, hp: 5 },
    damage: -3,
    expected: { thp: 5, hp: 8 }
  },
  {
    id: "14",
    desc: "Healing with tempmax ceiling allows HP to exceed normal max",
    setup: { thp: 0, hp: 8, tempmax: 5 },
    damage: -10,
    expected: { thp: 0, hp: 15 }
  }
];

const characterMultipliers = [
  {
    id: "09",
    desc: "Vulnerability multiplier (x2)",
    setup: { thp: 0, hp: 10 },
    damage: { amount: 5, multiplier: 2 },
    expected: { thp: 0, hp: 0 }
  },
  {
    id: "10",
    desc: "Resistance multiplier (x0.5)",
    setup: { thp: 0, hp: 10 },
    damage: { amount: 10, multiplier: 0.5 },
    expected: { thp: 0, hp: 5 }
  },
  {
    id: "11",
    desc: "Fractional damage is floored",
    setup: { thp: 0, hp: 10 },
    damage: { amount: 3.7, multiplier: 1 },
    expected: { thp: 0, hp: 7 }
  }
];

const characterArmor = [
  {
    id: "16",
    desc: "Armor absorbs all damage when sufficient",
    setup: { thp: 0, hp: 10, ahp: 8 },
    damage: 5,
    expected: { ahp: 3, thp: 0, hp: 10 }
  },
  {
    id: "17",
    desc: "Armor partially absorbs, remainder goes to HP",
    setup: { thp: 0, hp: 10, ahp: 3 },
    damage: 5,
    expected: { ahp: 0, thp: 0, hp: 8 }
  },
  {
    id: "18",
    desc: "Armor + THP partially absorb, HP unaffected",
    setup: { thp: 5, hp: 10, ahp: 5 },
    damage: 7,
    expected: { ahp: 0, thp: 3, hp: 10 }
  },
  {
    id: "19",
    desc: "Armor + THP insufficient, damage reaches HP",
    setup: { thp: 5, hp: 10, ahp: 5 },
    damage: 15,
    expected: { ahp: 0, thp: 0, hp: 5 }
  },
  {
    id: "20",
    desc: "Armor with vulnerability multiplier (x2)",
    setup: { thp: 0, hp: 10, ahp: 10 },
    damage: { amount: 5, multiplier: 2 },
    expected: { ahp: 0, thp: 0, hp: 10 }
  },
  {
    id: "21",
    desc: "Armor with resistance multiplier (x0.5)",
    setup: { thp: 0, hp: 10, ahp: 5 },
    damage: { amount: 10, multiplier: 0.5 },
    expected: { ahp: 0, thp: 0, hp: 10 }
  },
  {
    id: "22",
    desc: "Armor with fractional damage flooring",
    setup: { thp: 0, hp: 10, ahp: 5 },
    damage: { amount: 7.9, multiplier: 1 },
    expected: { ahp: 0, thp: 0, hp: 8 }
  },
  {
    id: "23",
    desc: "Armor exact depletion (damage equals AHP)",
    setup: { thp: 0, hp: 10, ahp: 5 },
    damage: 5,
    expected: { ahp: 0, thp: 0, hp: 10 }
  },
  {
    id: "24",
    desc: "Armor + THP + HP all fully depleted",
    setup: { thp: 5, hp: 10, ahp: 5 },
    damage: 25,
    expected: { ahp: 0, thp: 0, hp: 0 }
  },
  {
    id: "25",
    desc: "Healing does not restore armor HP",
    setup: { thp: 0, hp: 5, ahp: 3 },
    damage: -5,
    expected: { ahp: 3, thp: 0, hp: 10 }
  },
  {
    id: "26",
    desc: "Armor with tempmax healing ceiling",
    setup: { thp: 0, hp: 8, ahp: 5, tempmax: 5 },
    damage: -10,
    expected: { ahp: 5, thp: 0, hp: 15 }
  },
  {
    id: "27",
    desc: "Armor when HP already at zero",
    setup: { thp: 0, hp: 0, ahp: 5 },
    damage: 3,
    expected: { ahp: 2, thp: 0, hp: 0 }
  },
  {
    id: "28",
    desc: "Armor + THP exact depletion (no HP loss)",
    setup: { thp: 5, hp: 10, ahp: 5 },
    damage: 10,
    expected: { ahp: 0, thp: 0, hp: 10 }
  },
  {
    id: "29",
    desc: "Armor + THP + HP exact depletion",
    setup: { thp: 5, hp: 10, ahp: 5 },
    damage: 20,
    expected: { ahp: 0, thp: 0, hp: 0 }
  },
  {
    id: "30",
    desc: "Armor + vulnerability + THP combo",
    setup: { thp: 5, hp: 10, ahp: 5 },
    damage: { amount: 5, multiplier: 2 },
    expected: { ahp: 0, thp: 0, hp: 10 }
  }
];

const characterHooks = [
  {
    id: "15",
    desc: "Hook returning false prevents update",
    setup: { thp: 10, hp: 10 },
    damage: 5,
    hook: { name: "modifyTokenAttribute", handler: () => false },
    expected: { thp: 10, hp: 10 }
  }
];

/* ============================================ */
/*  NPC TESTS                                   */
/* ============================================ */

/**
 * Test applyDamage for NPCs (HP + THP + Armor + Fortitude Points).
 * @param {Actor5e} npc
 * @returns {Promise<object>}
 */
async function test_applyDamage_npc(npc) {
  const results = {};

  const suites = [
    { name: "Basic Damage", tests: npcBasicDamage },
    { name: "Healing", tests: npcHealing },
    { name: "Multipliers", tests: npcMultipliers },
    { name: "Fortitude Points", tests: npcFortitude },
    { name: "Thresholds", tests: npcThresholds },
    { name: "Armor", tests: npcArmor },
    { name: "Hooks", tests: npcHooks }
  ];

  for (const suite of suites) {
    const suiteResults = await runSuite(npc, suite.tests);
    Object.assign(results, suiteResults);
  }

  return results;
}

const npcBasicDamage = [
  {
    id: "01",
    desc: "Damage exceeding total HP + THP + FP results in all zero",
    setup: { thp: 10, hp: 10, fp: 10 },
    damage: 50,
    expected: { thp: 0, hp: 0, fp: 0 }
  },
  {
    id: "02",
    desc: "Damage uses THP, then HP, then FP",
    setup: { thp: 10, hp: 10, fp: 10 },
    damage: 17,
    expected: { thp: 0, hp: 5, fp: 8 }
  },
  {
    id: "04",
    desc: "Damage reduces FP to zero without reducing HP (no THP)",
    setup: { thp: 0, hp: 8, fp: 5 },
    damage: 10,
    expected: { thp: 0, hp: 3, fp: 0 }
  },
  {
    id: "05",
    desc: "Damage reduces FP to zero while HP still above zero (THP present)",
    setup: { thp: 10, hp: 8, fp: 5 },
    damage: 20,
    expected: { thp: 0, hp: 3, fp: 0 }
  },
  {
    id: "06",
    desc: "Damage reduces HP to 1 after FP is already zero",
    setup: { thp: 10, hp: 10, fp: 0 },
    damage: 19,
    expected: { thp: 0, hp: 1, fp: 0 }
  },
  {
    id: "07",
    desc: "Damage reduces HP to zero after FP is already zero",
    setup: { thp: 10, hp: 10, fp: 0 },
    damage: 20,
    expected: { thp: 0, hp: 0, fp: 0 }
  },
  {
    id: "08",
    desc: "Zero damage leaves all values unchanged",
    setup: { thp: 5, hp: 8, fp: 3 },
    damage: 0,
    expected: { thp: 5, hp: 8, fp: 3 }
  },
  {
    id: "09",
    desc: "Damage exactly equal to THP",
    setup: { thp: 10, hp: 10, fp: 5 },
    damage: 10,
    expected: { thp: 0, hp: 10, fp: 5 }
  },
  {
    id: "15",
    desc: "Damage when both HP and FP are already at zero",
    setup: { thp: 0, hp: 0, fp: 0 },
    damage: 10,
    expected: { thp: 0, hp: 0, fp: 0 }
  }
];

const npcHealing = [
  {
    id: "03",
    desc: "Healing restores HP/THP but leaves FP unchanged",
    setup: { thp: 0, hp: 5, fp: 5 },
    damage: -20,
    expected: { thp: 0, hp: 10, fp: 5 }
  },
  {
    id: "14",
    desc: "Healing when FP is depleted does not restore FP",
    setup: { thp: 0, hp: 5, fp: 0 },
    damage: -3,
    expected: { thp: 0, hp: 8, fp: 0 }
  },
  {
    id: "16",
    desc: "Healing with tempmax ceiling allows HP to exceed normal max",
    setup: { thp: 0, hp: 8, fp: 5, tempmax: 5 },
    damage: -10,
    expected: { thp: 0, hp: 15, fp: 5 }
  }
];

const npcMultipliers = [
  {
    id: "12",
    desc: "Resistance multiplier (x0.5) with FP",
    setup: { thp: 0, hp: 10, fp: 5 },
    damage: { amount: 10, multiplier: 0.5 },
    expected: { thp: 0, hp: 5, fp: 5 }
  },
  {
    id: "13",
    desc: "Fractional damage is floored",
    setup: { thp: 0, hp: 10, fp: 5 },
    damage: { amount: 3.7, multiplier: 1 },
    expected: { thp: 0, hp: 7, fp: 5 }
  },
  {
    id: "36",
    desc: "FP with vulnerability multiplier (without threshold trigger)",
    setup: { thp: 0, hp: 10, fp: 5 },
    damage: { amount: 2, multiplier: 2 },
    expected: { thp: 0, hp: 6, fp: 5 }
  },
  {
    id: "37",
    desc: "FP with vulnerability multiplier triggering threshold",
    setup: { thp: 0, hp: 10, fp: 5 },
    damage: { amount: 4, multiplier: 2 },
    expected: { thp: 0, hp: 5, fp: 2 }
  },
  {
    id: "38",
    desc: "FP with fractional damage flooring (multiplier)",
    setup: { thp: 0, hp: 10, fp: 5 },
    damage: { amount: 6.3, multiplier: 0.5 },
    expected: { thp: 0, hp: 7, fp: 5 }
  }
];

const npcFortitude = [
  {
    id: "10",
    desc: "Damage equal to HP triggers FP threshold",
    setup: { thp: 0, hp: 10, fp: 5 },
    damage: 10,
    expected: { thp: 0, hp: 5, fp: 0 }
  },
  {
    id: "11",
    desc: "Vulnerability multiplier (x2) triggers FP threshold",
    setup: { thp: 0, hp: 10, fp: 5 },
    damage: { amount: 5, multiplier: 2 },
    expected: { thp: 0, hp: 5, fp: 0 }
  },
  {
    id: "39",
    desc: "HP at threshold, FP at zero, more damage goes below threshold",
    setup: { thp: 0, hp: 5, fp: 0 },
    damage: 5,
    expected: { thp: 0, hp: 0, fp: 0 }
  }
];

const npcThresholds = [
  {
    id: "18",
    desc: "Threshold at 0% - HP capped at minimum 1, FP absorbs remainder",
    setup: { thp: 0, hp: 10, fp: 5 },
    damage: 10,
    threshold: 0,
    expected: { thp: 0, hp: 1, fp: 4 }
  },
  {
    id: "19",
    desc: "Threshold at 25% - HP stops at 3, FP absorbs remainder",
    setup: { thp: 0, hp: 10, fp: 5 },
    damage: 10,
    threshold: 25,
    expected: { thp: 0, hp: 3, fp: 2 }
  },
  {
    id: "20",
    desc: "Threshold at 75% - FP depleted, HP drops further",
    setup: { thp: 0, hp: 10, fp: 5 },
    damage: 10,
    threshold: 75,
    expected: { thp: 0, hp: 5, fp: 0 }
  },
  {
    id: "21",
    desc: "Threshold at 100% - FP absorbs damage immediately",
    setup: { thp: 0, hp: 10, fp: 5 },
    damage: 10,
    threshold: 100,
    expected: { thp: 0, hp: 5, fp: 0 }
  },
  {
    id: "40",
    desc: "Threshold at 50% - HP stops at 5, FP depleted",
    setup: { thp: 0, hp: 10, fp: 5 },
    damage: 10,
    threshold: 50,
    expected: { thp: 0, hp: 5, fp: 0 }
  },
  {
    id: "41",
    desc: "Threshold at 50% with excess damage, HP goes below threshold after FP depleted",
    setup: { thp: 0, hp: 10, fp: 5 },
    damage: 15,
    threshold: 50,
    expected: { thp: 0, hp: 0, fp: 0 }
  }
];

const npcArmor = [
  {
    id: "22",
    desc: "Armor absorbs all damage (no FP loss)",
    setup: { thp: 0, hp: 10, fp: 5, ahp: 8 },
    damage: 5,
    expected: { ahp: 3, thp: 0, hp: 10, fp: 5 }
  },
  {
    id: "23",
    desc: "Armor partially absorbs, remainder goes to THP",
    setup: { thp: 5, hp: 10, fp: 5, ahp: 3 },
    damage: 5,
    expected: { ahp: 0, thp: 3, hp: 10, fp: 5 }
  },
  {
    id: "24",
    desc: "Armor + THP depleted, damage reaches HP but not FP threshold",
    setup: { thp: 5, hp: 10, fp: 5, ahp: 3 },
    damage: 10,
    expected: { ahp: 0, thp: 0, hp: 8, fp: 5 }
  },
  {
    id: "25",
    desc: "Armor + THP + HP depleted to threshold, FP absorbs remainder",
    setup: { thp: 5, hp: 10, fp: 5, ahp: 3 },
    damage: 15,
    expected: { ahp: 0, thp: 0, hp: 5, fp: 3 }
  },
  {
    id: "26",
    desc: "Armor + THP + HP + FP all fully depleted",
    setup: { thp: 5, hp: 10, fp: 5, ahp: 3 },
    damage: 30,
    expected: { ahp: 0, thp: 0, hp: 0, fp: 0 }
  },
  {
    id: "27",
    desc: "Armor with vulnerability multiplier (x2)",
    setup: { thp: 0, hp: 10, fp: 5, ahp: 10 },
    damage: { amount: 5, multiplier: 2 },
    expected: { ahp: 0, thp: 0, hp: 10, fp: 5 }
  },
  {
    id: "28",
    desc: "Armor with resistance multiplier (x0.5)",
    setup: { thp: 0, hp: 10, fp: 5, ahp: 5 },
    damage: { amount: 10, multiplier: 0.5 },
    expected: { ahp: 0, thp: 0, hp: 10, fp: 5 }
  },
  {
    id: "29",
    desc: "Armor with fractional damage flooring",
    setup: { thp: 0, hp: 10, fp: 5, ahp: 5 },
    damage: { amount: 7.9, multiplier: 1 },
    expected: { ahp: 0, thp: 0, hp: 8, fp: 5 }
  },
  {
    id: "30",
    desc: "Armor exact depletion (damage equals AHP)",
    setup: { thp: 0, hp: 10, fp: 5, ahp: 5 },
    damage: 5,
    expected: { ahp: 0, thp: 0, hp: 10, fp: 5 }
  },
  {
    id: "31",
    desc: "Healing does not restore armor HP",
    setup: { thp: 0, hp: 5, fp: 5, ahp: 3 },
    damage: -5,
    expected: { ahp: 3, thp: 0, hp: 10, fp: 5 }
  },
  {
    id: "32",
    desc: "Armor when HP and FP are already at zero",
    setup: { thp: 0, hp: 0, fp: 0, ahp: 5 },
    damage: 3,
    expected: { ahp: 2, thp: 0, hp: 0, fp: 0 }
  },
  {
    id: "33",
    desc: "Armor + THP exact depletion (no HP/FP loss)",
    setup: { thp: 5, hp: 10, fp: 5, ahp: 5 },
    damage: 10,
    expected: { ahp: 0, thp: 0, hp: 10, fp: 5 }
  },
  {
    id: "34",
    desc: "Armor + THP + HP exact depletion to threshold (FP absorbs nothing)",
    setup: { thp: 5, hp: 10, fp: 5, ahp: 5 },
    damage: 15,
    expected: { ahp: 0, thp: 0, hp: 5, fp: 5 }
  },
  {
    id: "35",
    desc: "Armor + THP + HP + FP exact depletion",
    setup: { thp: 5, hp: 10, fp: 5, ahp: 5 },
    damage: 20,
    expected: { ahp: 0, thp: 0, hp: 5, fp: 0 }
  },
  {
    id: "42",
    desc: "Armor + tempmax healing ceiling",
    setup: { thp: 0, hp: 8, fp: 5, ahp: 5, tempmax: 5 },
    damage: -10,
    expected: { ahp: 5, thp: 0, hp: 15, fp: 5 }
  }
];

const npcHooks = [
  {
    id: "17",
    desc: "Hook returning false prevents update",
    setup: { thp: 10, hp: 10, fp: 5 },
    damage: 5,
    hook: { name: "modifyTokenAttribute", handler: () => false },
    expected: { thp: 10, hp: 10, fp: 5 }
  }
];

/* ============================================ */
/*  TEST RUNNER                                 */
/* ============================================ */

/**
 * Run a suite of declarative test cases against an actor.
 * @param {Actor5e} actor
 * @param {Array<object>} tests
 * @returns {Promise<object>}
 */
async function runSuite(actor, tests) {
  const results = {};
  const originalThreshold = await getThreshold();

  for (const test of tests) {
    const setup = { ...DEFAULTS, ...test.setup };

    if (test.threshold !== undefined) {
      await setThreshold(test.threshold);
    }

    await resetActor(actor, setup);

    if (test.hook) {
      const hookId = Hooks.on(test.hook.name, test.hook.handler);
      await applyTestDamage(actor, test.damage);
      Hooks.off(test.hook.name, hookId);
    } else {
      await applyTestDamage(actor, test.damage);
    }

    for (const [key, expectedValue] of Object.entries(test.expected)) {
      const actualValue = getActualValue(actor, key);
      results[`test${test.id}_${key}`] = assert(expectedValue, actualValue);
    }
  }

  await setThreshold(originalThreshold);
  return results;
}

/**
 * Apply damage using the test's damage format.
 * @param {Actor5e} actor
 * @param {Promise<number|object>} damage
 */
async function applyTestDamage(actor, damage) {
  if (typeof damage === "number") {
    await actor.applyDamage(damage);
  } else {
    await actor.applyDamage(damage.amount, damage.multiplier);
  }
}

/**
 * Get the actual value from the actor for a given key.
 * @param {Actor5e} actor
 * @param {string} key
 * @returns {number}
 */
function getActualValue(actor, key) {
  switch (key) {
    case "thp": return actor.system.attributes.hp.temp;
    case "hp": return actor.system.attributes.hp.value;
    case "ahp": return actor.system.attributes.hp.armor;
    case "fp": return actor.system.resources.legres.value;
    default: throw new Error(`Unknown key: ${key}`);
  }
}

// Extended tests for actor module: applyTempHP, multiplier edge cases, and boundary conditions.

/**
 * Test the applyTempHP method for characters.
 * Logic: amount > current → update to new amount; otherwise no-op.
 * @param {Actor5e} character
 * @returns {Promise<object>}
 */
async function test_applyTempHP(character) {
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
  results.mult_partial_neg_02 = assert(10, getActualValue(character, "hp")); // Floor(-1.2)=-2 → heal to 10 (capped at max)

  return results;
}

/**
 * Test applyDamage with multiplier edge cases (NPC).
 * @param {Actor5e} npc
 * @returns {Promise<object>}
 */
async function test_multiplierEdgeCasesNPC(npc) {
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
  const results = {};

  // Test 01: Healing lands EXACTLY on max + tempmax → HP reaches ceiling exactly
  await resetActor(character, { thp: 0, hp: 5, tempmax: 5 });
  // Max = 10, tempmax = 5 → ceiling = 15; current = 5; heal by 10 → should reach 15
  await character.applyDamage(-10);
  results.boundary_exact_01 = assert(15, getActualValue(character, "hp"));

  // Test 02: Healing one short of ceiling → HP at max+tempmax - 1
  await resetActor(character, { thp: 0, hp: 4, tempmax: 6 });
  // Max = 10, tempmax = 6 → ceiling = 16; current = 4; heal by 11 → should reach 15 (one short)
  await character.applyDamage(-11);
  results.boundary_one_short_01 = assert(15, getActualValue(character, "hp"));

  // Test 03: Healing exceeds ceiling → HP capped at max+tempmax exactly
  await resetActor(character, { thp: 0, hp: 8, tempmax: 2 });
  // Max = 10, tempmax = 2 → ceiling = 12; current = 8; heal by 10 → should cap at 12
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
  const results = {};

  // Test 01: max HP = 0, any threshold → floor is always 1 (due to Math.max(..., 1))
  await resetActor(npc, { thp: 5, hp: 0, fp: 5 });
  await npc.update({ "system.attributes.hp.max": 0 });
  // Damage of 3 goes through THP first → THP to 2. HP stays at 0 since threshold=1 and max=0.
  await npc.applyDamage(3);
  await npc.applyDamage(3);
  results.zero_max_hp_01 = assert(true, getActualValue(npc, "hp") >= 0); // HP should not go negative

  return results;
}

/* ============================================ */
/*  HELPERS                                     */
/* ============================================ */

/**
 * Reset an actor's HP, THP, AHP, and FP to known values.
 * @param {Actor5e} actor
 * @param {Promise<object>} params
 */
async function resetActor(actor, params = {}) {
  const { thp, hp, fp, maxhp, ahp, tempmax } = { ...DEFAULTS, ...params };

  await actor.update({
    "system.attributes.hp.value": hp,
    "system.attributes.hp.max": maxhp,
    "system.attributes.hp.temp": thp,
    "system.attributes.hp.armor": ahp,
    "system.attributes.hp.tempmax": tempmax,
    "system.resources.legres.value": fp
  });
}

/**
 * Get the current fortitude points threshold setting.
 * @returns {number}
 */
function getThreshold() {
  return game.settings.get("dnd5e", "fortitudePointsThreshold");
}

/**
 * Set the fortitude points threshold setting.
 * @param {number} threshold
 */
async function setThreshold(threshold) {
  if (threshold < 0 || threshold > 100) {
    throw new Error("Threshold must be between 0 and 100");
  }
  await game.settings.set("dnd5e", "fortitudePointsThreshold", threshold);
}
