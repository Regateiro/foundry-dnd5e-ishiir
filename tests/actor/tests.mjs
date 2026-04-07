// This file contains tests for the Actor class in the DND5E system.

// Run tests related to the Actor class, including damage application and healing mechanics.
/**
 *
 */
export async function runActorTests() {
  console.debug("Running actor tests...");

  // Array to hold test results
  const results = {};

  // Create a test actors
  const character = await Actor.create({
    name: "DND5E Test Character",
    type: "character"
  });
  const npc = await Actor.create({
    name: "DND5E Test NPC",
    type: "npc"
  });

  // Run individual tests and collect results
  results.applyDamage_character = await test_applyDamage_character(character);
  results.applyDamage_npc = await test_applyDamage_npc(npc);

  // Clean up
  await Actor.deleteDocuments([character._id, npc._id]);

  // Return the results of all tests
  return results;
}

// Test the applyDamage method for characters, which only have HP and temporary HP.
/**
 *
 * @param character
 */
async function test_applyDamage_character(character) {
  console.debug("Running applyDamage tests for characters...");

  // Array to hold test results
  const results = {};

  // Set initial HP values
  await resetActor(character, {thp: 10, hp: 10});

  // Test01: Apply damage that exceeds the total of HP and temporary HP
  await character.applyDamage(50);
  results.test01_thp_is_zero = character.system.attributes.hp.temp === 0;
  results.test01_hp_is_zero = character.system.attributes.hp.value === 0;

  // Test02: Apply damage that reduces temporary HP but does not reduce HP
  await resetActor(character, {thp: 10, hp: 10});
  await character.applyDamage(3);
  results.test02_thp_is_seven = character.system.attributes.hp.temp === 7;
  results.test02_hp_is_ten = character.system.attributes.hp.value === 10;

  // Test03: Apply damage that reduces temporary HP to zero and then some HP, but does not reduce HP to zero
  await resetActor(character, {thp: 10, hp: 10});
  await character.applyDamage(15);
  results.test03_thp_is_zero = character.system.attributes.hp.temp === 0;
  results.test03_hp_is_five = character.system.attributes.hp.value === 5;

  // Test04: Apply healing that restores HP but does not exceed max HP
  await resetActor(character, {thp: 0, hp: 5});
  await character.applyDamage(-1); // Heal 1 HP
  results.test04_thp_is_zero = character.system.attributes.hp.temp === 0;
  results.test04_hp_is_six = character.system.attributes.hp.value === 6;

  // Test05: Apply healing that exceeds max HP
  await resetActor(character, {thp: 0, hp: 0});
  await character.applyDamage(-20); // Heal 20 HP
  results.test05_thp_is_zero = character.system.attributes.hp.temp === 0;
  results.test05_hp_is_ten = character.system.attributes.hp.value === 10;

  // Test06: Apply zero damage should leave all values unchanged
  await resetActor(character, {thp: 5, hp: 8});
  await character.applyDamage(0);
  results.test06_thp_unchanged = character.system.attributes.hp.temp === 5;
  results.test06_hp_unchanged = character.system.attributes.hp.value === 8;

  // Test07: Apply damage exactly equal to temporary HP
  await resetActor(character, {thp: 10, hp: 10});
  await character.applyDamage(10);
  results.test07_thp_is_zero = character.system.attributes.hp.temp === 0;
  results.test07_hp_is_ten = character.system.attributes.hp.value === 10;

  // Test08: Apply damage exactly equal to HP (no THP)
  await resetActor(character, {thp: 0, hp: 10});
  await character.applyDamage(10);
  results.test08_thp_is_zero = character.system.attributes.hp.temp === 0;
  results.test08_hp_is_zero = character.system.attributes.hp.value === 0;

  // Test09: Apply damage with vulnerability multiplier (2x)
  await resetActor(character, {thp: 0, hp: 10});
  await character.applyDamage(5, 2); // 5 * 2 = 10 damage
  results.test09_thp_is_zero = character.system.attributes.hp.temp === 0;
  results.test09_hp_is_zero = character.system.attributes.hp.value === 0;

  // Test10: Apply damage with resistance multiplier (0.5x)
  await resetActor(character, {thp: 0, hp: 10});
  await character.applyDamage(10, 0.5); // 10 * 0.5 = 5 damage
  results.test10_thp_is_zero = character.system.attributes.hp.temp === 0;
  results.test10_hp_is_five = character.system.attributes.hp.value === 5;

  // Test11: Apply fractional damage that should be floored
  await resetActor(character, {thp: 0, hp: 10});
  await character.applyDamage(3.7, 1); // Should floor to 3
  results.test11_hp_is_seven = character.system.attributes.hp.value === 7;

  // Test12: Apply healing when THP is set should not restore THP
  await resetActor(character, {thp: 5, hp: 5});
  await character.applyDamage(-3); // Heal 3 HP
  results.test12_thp_unchanged = character.system.attributes.hp.temp === 5;
  results.test12_hp_is_eight = character.system.attributes.hp.value === 8;

  // Test13: Apply damage when HP is already at 0
  await resetActor(character, {thp: 0, hp: 0});
  await character.applyDamage(10);
  results.test13_thp_is_zero = character.system.attributes.hp.temp === 0;
  results.test13_hp_is_zero = character.system.attributes.hp.value === 0;

  // Test14: Apply healing with tempmax HP ceiling
  await resetActor(character, {thp: 0, hp: 8, maxhp: 10});
  await character.update({"system.attributes.hp.tempmax": 5});
  await character.applyDamage(-10); // Try to heal 10
  results.test14_hp_is_tempmax = character.system.attributes.hp.value === 15; // Max(10) + tempmax(5)
  await character.update({"system.attributes.hp.tempmax": 0}); // Clean up tempmax

  // Test15: Hook prevention - modifyTokenAttribute returning false should prevent update
  const hookId = Hooks.on("modifyTokenAttribute", () => false);
  await resetActor(character, {thp: 10, hp: 10});
  await character.applyDamage(5);
  results.test15_hook_prevented_thp = character.system.attributes.hp.temp === 10;
  results.test15_hook_prevented_hp = character.system.attributes.hp.value === 10;
  Hooks.off("modifyTokenAttribute", hookId);

  // Armor Hitpoints tests for characters
  // Test16: Armor absorbs all damage when sufficient ahp
  await resetActor(character, {thp: 0, hp: 10, ahp: 8});
  await character.applyDamage(5);
  results.test16_ahp_remaining = character.system.attributes.hp.armor === 3;
  results.test16_hp_unaffected = character.system.attributes.hp.value === 10;

  // Test17: Armor partially absorbs damage, rest goes to HP
  await resetActor(character, {thp: 0, hp: 10, ahp: 3});
  await character.applyDamage(5);
  results.test17_ahp_depleted = character.system.attributes.hp.armor === 0;
  results.test17_hp_reduced = character.system.attributes.hp.value === 8;

  // Test18: Armor insufficient, damage goes to temporary HP, but not below 0
  await resetActor(character, {thp: 5, hp: 10, ahp: 5});
  await character.applyDamage(7);
  results.test18_ahp_zero = character.system.attributes.hp.armor === 0;
  results.test18_thp_reduced = character.system.attributes.hp.temp === 3;

  // Test19: Armor insufficient, damage goes to temporary HP and then HP, but not below 0
  await resetActor(character, {thp: 5, hp: 10, ahp: 5});
  await character.applyDamage(15);
  results.test19_ahp_zero = character.system.attributes.hp.armor === 0;
  results.test19_thp_zero = character.system.attributes.hp.temp === 0;
  results.test19_hp_reduced = character.system.attributes.hp.value === 5;

  // If we reach this point without any assertion errors, the test passes
  return results;
}

// Test the applyDamage method for NPCs, which also have Fortitude Points.
/**
 *
 * @param npc
 */
async function test_applyDamage_npc(npc) {
  console.debug("Running applyDamage tests for NPC...");

  // Array to hold test results
  const results = {};

  // Test01: Apply damage that exceeds the total of HP, temporary HP, and Fortitude Points
  await resetActor(npc, {thp: 10, hp: 10, fp: 10});
  await npc.applyDamage(50);
  results.test01_thp_is_zero = npc.system.attributes.hp.temp === 0;
  results.test01_hp_is_zero = npc.system.attributes.hp.value === 0;
  results.test01_fp_is_zero = npc.system.resources.legres.value === 0;

  // Test02: Apply damage that reduces temporary HP to zero, then HP, and then some Fortitude Points
  await resetActor(npc, {thp: 10, hp: 10, fp: 10});
  await npc.applyDamage(17);
  results.test02_thp_is_zero = npc.system.attributes.hp.temp === 0;
  results.test02_hp_is_five = npc.system.attributes.hp.value === 5;
  results.test02_fp_is_eight = npc.system.resources.legres.value === 8;

  // Test03: Apply healing that restores HP and temporary HP but does not exceed max HP, and does not affect Fortitude Points
  await resetActor(npc, {thp: 0, hp: 5, fp: 5});
  await npc.applyDamage(-20); // Heal back up
  results.test03_thp_is_zero = npc.system.attributes.hp.temp === 0;
  results.test03_hp_is_ten = npc.system.attributes.hp.value === 10;
  results.test03_fp_is_five = npc.system.resources.legres.value === 5;

  // Test04: Apply damage that reduces FP to zero but does not reduce HP to zero, and temporary HP is already at zero
  await resetActor(npc, {thp: 0, hp: 8, fp: 5});
  await npc.applyDamage(10);
  results.test04_thp_is_zero = npc.system.attributes.hp.temp === 0;
  results.test04_hp_is_three = npc.system.attributes.hp.value === 3;
  results.test04_fp_is_zero = npc.system.resources.legres.value === 0;

  // Test05: Apply damage that reduces FP to zero but does not reduce HP to zero, and temporary HP is at some value
  await resetActor(npc, {thp: 10, hp: 8, fp: 5});
  await npc.applyDamage(20);
  results.test05_thp_is_zero = npc.system.attributes.hp.temp === 0;
  results.test05_hp_is_three = npc.system.attributes.hp.value === 3;
  results.test05_fp_is_zero = npc.system.resources.legres.value === 0;

  // Test06: Apply damage that reduces HP to 1 after FP is already at zero, and temporary HP is at some value
  await resetActor(npc, {thp: 10, hp: 10, fp: 0});
  await npc.applyDamage(19);
  results.test06_thp_is_zero = npc.system.attributes.hp.temp === 0;
  results.test06_hp_is_one = npc.system.attributes.hp.value === 1;
  results.test06_fp_is_zero = npc.system.resources.legres.value === 0;

  // Test07: Apply damage that reduces HP to zero after FP is already at zero, and temporary HP is at some value
  await resetActor(npc, {thp: 10, hp: 10, fp: 0});
  await npc.applyDamage(20);
  results.test07_thp_is_zero = npc.system.attributes.hp.temp === 0;
  results.test07_hp_is_zero = npc.system.attributes.hp.value === 0;
  results.test07_fp_is_zero = npc.system.resources.legres.value === 0;

  // Test08: Apply zero damage should leave all values unchanged
  await resetActor(npc, {thp: 5, hp: 8, fp: 3});
  await npc.applyDamage(0);
  results.test08_thp_unchanged = npc.system.attributes.hp.temp === 5;
  results.test08_hp_unchanged = npc.system.attributes.hp.value === 8;
  results.test08_fp_unchanged = npc.system.resources.legres.value === 3;

  // Test09: Apply damage exactly equal to temporary HP
  await resetActor(npc, {thp: 10, hp: 10, fp: 5});
  await npc.applyDamage(10);
  results.test09_thp_is_zero = npc.system.attributes.hp.temp === 0;
  results.test09_hp_is_ten = npc.system.attributes.hp.value === 10;
  results.test09_fp_is_five = npc.system.resources.legres.value === 5;

  // Test10: Apply damage exactly equal to HP after THP triggers FP threshold
  await resetActor(npc, {thp: 0, hp: 10, fp: 5});
  await npc.applyDamage(10);
  results.test10_thp_is_zero = npc.system.attributes.hp.temp === 0;
  results.test10_hp_at_threshold = npc.system.attributes.hp.value === 5; // FP threshold prevents HP from going lower
  results.test10_fp_is_zero = npc.system.resources.legres.value === 0; // Remaining damage depletes FP

  // Test11: Apply damage with vulnerability multiplier (2x) triggers FP threshold
  await resetActor(npc, {thp: 0, hp: 10, fp: 5});
  await npc.applyDamage(5, 2); // 5 * 2 = 10 damage
  results.test11_thp_is_zero = npc.system.attributes.hp.temp === 0;
  results.test11_hp_at_threshold = npc.system.attributes.hp.value === 5; // FP threshold prevents HP from going lower
  results.test11_fp_is_zero = npc.system.resources.legres.value === 0; // Remaining damage depletes FP

  // Test12: Apply damage with resistance multiplier (0.5x) triggers FP threshold
  await resetActor(npc, {thp: 0, hp: 10, fp: 5});
  await npc.applyDamage(10, 0.5); // 10 * 0.5 = 5 damage
  results.test12_thp_is_zero = npc.system.attributes.hp.temp === 0;
  results.test12_hp_at_threshold = npc.system.attributes.hp.value === 5;
  results.test12_fp_is_five = npc.system.resources.legres.value === 5; // No damage remains for FP

  // Test13: Apply fractional damage that should be floored
  await resetActor(npc, {thp: 0, hp: 10, fp: 5});
  await npc.applyDamage(3.7, 1); // Should floor to 3
  results.test13_hp_is_seven = npc.system.attributes.hp.value === 7;
  results.test13_fp_is_five = npc.system.resources.legres.value === 5;

  // Test14: Apply healing when FP is depleted should not restore FP
  await resetActor(npc, {thp: 0, hp: 5, fp: 0});
  await npc.applyDamage(-3); // Heal 3 HP
  results.test14_thp_is_zero = npc.system.attributes.hp.temp === 0;
  results.test14_hp_is_eight = npc.system.attributes.hp.value === 8;
  results.test14_fp_is_zero = npc.system.resources.legres.value === 0;

  // Test15: Apply damage when both HP and FP are already at 0
  await resetActor(npc, {thp: 0, hp: 0, fp: 0});
  await npc.applyDamage(10);
  results.test15_thp_is_zero = npc.system.attributes.hp.temp === 0;
  results.test15_hp_is_zero = npc.system.attributes.hp.value === 0;
  results.test15_fp_is_zero = npc.system.resources.legres.value === 0;

  // Test16: Apply healing with tempmax HP ceiling
  await resetActor(npc, {thp: 0, hp: 8, maxhp: 10, fp: 5});
  await npc.update({"system.attributes.hp.tempmax": 5});
  await npc.applyDamage(-10); // Try to heal 10
  results.test16_hp_is_tempmax = npc.system.attributes.hp.value === 15; // Max(10) + tempmax(5)
  results.test16_fp_unchanged = npc.system.resources.legres.value === 5;
  await npc.update({"system.attributes.hp.tempmax": 0}); // Clean up tempmax

  // Test17: Hook prevention - modifyTokenAttribute returning false should prevent update
  const hookId = Hooks.on("modifyTokenAttribute", () => false);
  await resetActor(npc, {thp: 10, hp: 10, fp: 5});
  await npc.applyDamage(5);
  results.test17_hook_prevented_thp = npc.system.attributes.hp.temp === 10;
  results.test17_hook_prevented_hp = npc.system.attributes.hp.value === 10;
  results.test17_hook_prevented_fp = npc.system.resources.legres.value === 5;
  Hooks.off("modifyTokenAttribute", hookId);

  // Test18: Threshold at 0% (minimum 1) - HP stops at 1 before FP absorbs damage
  const originalThreshold = getThreshold();
  await setThreshold(0);
  await resetActor(npc, {thp: 0, hp: 10, fp: 5});
  await npc.applyDamage(10);
  results.test18_hp_at_minimum = npc.system.attributes.hp.value === 1;
  results.test18_fp_absorbed_one = npc.system.resources.legres.value === 4;

  // Test19: Threshold at 25% - HP stops at 3 before FP absorbs remaining damage
  await setThreshold(25);
  await resetActor(npc, {thp: 0, hp: 10, fp: 5});
  await npc.applyDamage(10);
  results.test19_hp_at_threshold = npc.system.attributes.hp.value === 3;
  results.test19_fp_absorbed_three = npc.system.resources.legres.value === 2;

  // Test20: Threshold at 75% - HP stops at 8, remaining damage depletes FP then drops HP further
  await setThreshold(75);
  await resetActor(npc, {thp: 0, hp: 10, fp: 5});
  await npc.applyDamage(10);
  results.test20_hp_after_fp_depleted = npc.system.attributes.hp.value === 5;
  results.test20_fp_is_zero = npc.system.resources.legres.value === 0;

  // Test21: Threshold at 100% - FP absorbs damage immediately on first hit
  await setThreshold(100);
  await resetActor(npc, {thp: 0, hp: 10, fp: 5});
  await npc.applyDamage(10);
  results.test21_hp_after_fp_depleted = npc.system.attributes.hp.value === 5;
  results.test21_fp_is_zero = npc.system.resources.legres.value === 0;

  // Restore original threshold
  await setThreshold(originalThreshold);

  // If we reach this point without any assertion errors, the test passes
  return results;
}

// Helper function to reset actor's HP, temporary HP, and Fortitude Points for testing purposes
/**
 *
 * @param actor
 * @param params
 */
async function resetActor(actor, params = {}) {
  // Set default values if not provided
  params = {thp: 10, hp: 10, fp: 0, maxhp: 10, ahp: 0, ...params};

  // This function resets the actor's HP and temporary HP to their initial values for testing purposes.
  const updates = {
    "system.attributes.hp.value": params.hp,
    "system.attributes.hp.max": params.maxhp,
    "system.attributes.hp.temp": params.thp,
    "system.attributes.hp.armor": params.ahp,
    "system.resources.legres.value": params.fp
  };

  // Update the actor with the reset values
  return await actor.update(updates);
}

/**
 *
 */
function getThreshold() {
  // Get the current threshold value
  return game.settings.get("dnd5e", "fortitudePointsThreshold");
}

/**
 *
 * @param threshold
 */
async function setThreshold(threshold) {
  // This function sets the Fortitude Points threshold for NPCs. It validates that the threshold is between 0 and 100 before setting it.
  if (threshold < 0 || threshold > 100) {
    throw new Error("Threshold must be between 0 and 100");
  }
  // Update the game setting for the Fortitude Points threshold
  await game.settings.set("dnd5e", "fortitudePointsThreshold", threshold);
}
