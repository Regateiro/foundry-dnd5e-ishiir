// Main entry point for running all tests related to the D&D 5e system.
// Imports and executes tests from various modules and aggregates the results.
import { runActorTests } from "./actor/tests.mjs";
import { runRulerElevationTests } from "./ruler/tests.mjs";
import { runExtendedActorTests } from "./actor/extended-tests.mjs";
import { runExtendedRulerElevationTests } from "./ruler/extended-tests.mjs";
import { runExtendedInfrastructureTests } from "./extended-tests.mjs";

/**
 * Assert helper that compares expected vs actual for failure reporting.
 * @param {*} expected The expected value
 * @param {*} actual The actual value
 * @returns {{passed: boolean, expected: *, actual: *}}
 */
export function assert(expected, actual) {
  let passed;
  if (expected === true) passed = !!actual;
  else if (expected === false) passed = !actual;
  else passed = expected === actual;
  return { passed, expected, actual };
}

/**
 * Assert helper for floating-point tolerance comparisons.
 * @param {number} expected The expected value
 * @param {number} actual The actual value
 * @param {number} [tolerance=0.001] Acceptable difference
 * @returns {{passed: boolean, expected: *, actual: *}}
 */
export function assertApprox(expected, actual, tolerance = 0.001) {
  const diff = Math.abs(actual - expected);
  return { passed: diff < tolerance, expected, actual };
}

/**
 * Walk a nested results object and collect all failing test paths with their expected/actual values.
 * @param {object} obj The results object to walk
 * @param {string} [prefix] Current path prefix
 * @returns {Array<{path: string, expected: *, actual: *}>}
 */
export function collectFailures(obj, prefix = "") {
  const failures = [];
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      if (value.passed === true || value.passed === false) {
        // Leaf node: a test result with passed/expected/actual
        if (value.passed === false) {
          failures.push({ path, expected: value.expected, actual: value.actual });
        }
      } else {
        // Nested object: recurse
        failures.push(...collectFailures(value, path));
      }
    }
  }
  return failures;
}

/**
 * Format failure details for console output.
 * @param {Array<{path: string, expected: *, actual: *}>} failures Array of failure objects
 * @returns {string}
 */
export function formatFailures(failures) {
  if (failures.length === 0) return "";

  const lines = [];
  lines.push(`\n  ❌ ${failures.length} test(s) failed:\n`);

  for (const f of failures) {
    lines.push(`  ┌─ ${f.path}`);
    lines.push(`  │  Expected: ${JSON.stringify(f.expected)}`);
    lines.push(`  │  Actual:   ${JSON.stringify(f.actual)}`);
    lines.push("  └───────────");
  }

  return `${lines.join("\n")}\n`;
}

/**
 * Runs all tests for the D&D 5e system.
 * @returns {Promise<object>} The aggregated test results.
 */
export async function runAllTests() {
  // This function runs all tests for the D&D 5e system.
  console.log("Running all tests...");

  // Array to hold test results
  const results = {};

  // Import and run tests from various modules
  // Core test suites
  results.actor = await runActorTests();
  results.ruler = await runRulerElevationTests();

  // Additional tests covering previously untested logic paths
  results.extended_actor = await runExtendedActorTests();
  results.extended_ruler = await runExtendedRulerElevationTests();
  results.infrastructure = await runExtendedInfrastructureTests();

  // Return the results of all tests
  return results;
}
