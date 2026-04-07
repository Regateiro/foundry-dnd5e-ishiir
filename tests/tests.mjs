// This file serves as the main entry point for running all tests related to the D&D 5e system. It imports and executes tests from various modules, such as actors, items, spells, etc., and aggregates the results.

import { runActorTests } from "./actor/tests.mjs";

/**
 *
 */
export async function runAllTests() {
  // This function runs all tests for the D&D 5e system.
  console.log("Running all tests...");

  // Array to hold test results
  const results = {};

  // Import and run tests from various modules
  results.actor = await runActorTests();

  // Return the results of all tests
  return results;
}
