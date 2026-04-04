// This file contains tests for the Actor class in the DND5E system.

// Run tests related to the Actor class, including damage application and healing mechanics.
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

  // If we reach this point without any assertion errors, the test passes
  return results;
}

// Test the applyDamage method for NPCs, which also have Fortitude Points.
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

  // If we reach this point without any assertion errors, the test passes
  return results;
}

// Helper function to reset actor's HP, temporary HP, and Fortitude Points for testing purposes
async function resetActor(actor, params = {}) {
  // Set default values if not provided
  params = Object.assign({thp: 10, hp: 10, fp: 0, maxhp: 10}, params);

  // This function resets the actor's HP and temporary HP to their initial values for testing purposes.
  const updates = { 
    "system.attributes.hp.value": params.hp, 
    "system.attributes.hp.max": params.maxhp, 
    "system.attributes.hp.temp": params.thp,
    "system.resources.legres.value": params.fp
  };

  // Update the actor with the reset values
  return await actor.update(updates);
}
