import { runActorTests } from "./actor/tests.mjs";
import { runRulerElevationTests } from "./ruler/tests.mjs";
import { runBugFixTests } from "./bug-fixes.mjs";
import { assert, assertApprox, collectFailures, formatFailures } from "./shared.mjs";

// Extended tests for test infrastructure: assert helper, collectFailures traversal, etc.

/**
 * Test the assert helper with edge cases not covered by runtime tests.
 * @returns {Promise<object>} Test results
 */
async function test_assertHelper() {
  const results = {};

  // Test 01-02: assert(true, true) → passed
  results.true_true_01 = assert(true, assert(true, true).passed);

  // Test 03-04: assert(false, false) → passed
  results.false_false_01 = assert(true, assert(false, false).passed);

  // Test 05-06: assert(0, 0) → passed (falsy value comparison)
  results.zero_zero_01 = assert(true, assert(0, 0).passed);

  // Test 07-08: assert("", "") → passed (empty string comparison)
  results.empty_str_empty_str_01 = assert(true, assert("", "").passed);

  // Test 09-10: assert(null, null) → passed (null equality)
  results.null_null_01 = assert(true, assert(null, null).passed);

  // Test 11-12: assert(undefined, undefined) → passed (undefined equality)
  results.undefined_undefined_01 = assert(true, assert(undefined, undefined).passed);

  // Test 13-14: assert({}, {}) → failed (object reference comparison, not deep equal)
  results.obj_ref_diff_01 = assert(false, assert({}, {}).passed);

  // Test 15-16: assert([], []) → failed (array reference comparison)
  results.arr_ref_diff_01 = assert(false, assert([], []).passed);

  // Test 17-18: assert(0, false) → failed (strict equality: 0 !== false)
  results.zero_false_01 = assert(false, assert(0, false).passed);

  // Test 19-20: assert("", false) → failed (strict equality: "" !== false)
  results.empty_str_false_01 = assert(false, assert("", false).passed);

  return results;
}

/**
 * Test the assertApprox helper with edge cases.
 * @returns {Promise<object>} Test results
 */
async function test_assertApproxHelper() {
  const results = {};

  // Test 01-02: Exact match → passed (within default tolerance)
  results.exact_match_01 = assert(true, assertApprox(5, 5).passed);

  // Test 03-04: Within default tolerance (0.001) → passed
  results.within_default_tol = assert(true, assertApprox(5, 5.0005).passed);

  // Test 05-06: At boundary of default tolerance → failed (diff === tolerance is not < tolerance)
  results.at_boundary_01 = assert(false, assertApprox(5, 5.001).passed);

  // Test 07-08: Negative values at boundary (diff === tolerance) → failed
  results.negative_at_boundary = assert(false, assertApprox(-5, -4.999).passed);

  // Test 09-10: Negative values within tighter custom tolerance → passed
  results.negative_within_tighter = assert(true, assertApprox(-5, -4.999, 0.002).passed);

  // Test 11-12: Large numbers beyond default tolerance (diff=0.5 > 0.001) → failed
  results.large_beyond_default = assert(false, assertApprox(1e6, 1e6 + 0.5).passed);

  // Test 13-14: Custom tolerance (wider) → passed even beyond default
  results.custom_wide_tol = assert(true, assertApprox(5, 5.1, 0.2).passed);

  // Test 15-16: Custom tolerance (narrower) → failed within default but not custom
  results.custom_narrow_tol = assert(false, assertApprox(5, 5.0006, 0.0001).passed);

  // Test 17-18: Zero values with large difference → failed
  results.zero_large_diff_01 = assert(false, assertApprox(0, 100).passed);

  return results;
}

/**
 * Test collectFailures with deeply nested structures not covered by runtime tests.
 * @returns {Promise<object>} Test results
 */
async function test_collectFailuresDeepNesting() {
  const results = {};

  // Create a deeply nested result structure (4 levels)
  const deepStructure = {
    level1: {
      level2a: {
        level3a: {
          test_01: { passed: true, expected: 5, actual: 5 },
          test_02: { passed: false, expected: 10, actual: 8 }
        },
        level3b: {
          test_03: { passed: true, expected: "a", actual: "a" }
        }
      },
      level2b: {
        level3c: {
          test_04: { passed: false, expected: 1, actual: 2 },
          test_05: { passed: true, expected: null, actual: null }
        }
      }
    }
  };

  // Test 01-02: collectFailures finds all failures at any nesting depth
  const deepFailures = collectFailures(deepStructure);
  results.deep_failure_count = assert(2, deepFailures.length);

  // Test 03-04: Failure paths include full nested path
  const paths = deepFailures.map(f => f.path);
  results.has_level1_path = assert(true, paths.some(p => p.includes("level1")));
  results.has_full_nested_path = assert(true, paths.some(p => p.includes("test_02")));

  // Test 05-06: collectFailures does NOT crash on mixed leaf/non-leaf objects
  const mixedStructure = {
    a: { passed: true },      // Leaf with true
    b: { c: { d: { e: false, f: "g" } } },  // Deeply nested non-leaf then false
    h: { i: 5, j: 10 }        // Non-passed object (no passed key) — should recurse but find no leaf failures
  };

  let threwError = false;
  try { collectFailures(mixedStructure); } catch(e) { threwError = true; }
  results.no_crash_on_mixed = assert(false, threwError);

  // Test 07-08: Deep nesting with mixed passed values — only false failures collected
  const mixedPassedValues = {
    x1: { passed: true },
    x2: { nested: { y1: { passed: false } } },
    x3: { z1: { passed: true, expected: "a", actual: "b" } } // Has passed key but value is not boolean → recursed as non-leaf
  };

  const mixedResults = collectFailures(mixedPassedValues);
  results.only_false_failures = assert(1, mixedResults.length);

  return results;
}

/**
 * Test formatFailures with empty input (no failures).
 * @returns {Promise<object>} Test results
 */
async function test_formatFailuresEmpty() {
  const results = {};

  // Test 01-02: Empty array → returns empty string
  const emptyResult = formatFailures([]);
  results.empty_returns_empty_string_01 = assert(true, emptyResult === "");

  return results;
}

/**
 * Run a test and log its name before execution.
 * @param {string} name Full test identifier (e.g., "actor.applyDamage_character")
 * @param {Function|Promise} fn The async function or promise to run
 * @returns {Promise<*>}
 */
export async function runTest(name, fn) {
  console.log(`[TEST] ${name}`);
  return typeof fn === "function" ? await fn() : await fn;
}

/**
 * Runs all tests for the D&D 5e system.
 * @returns {Promise<object>} The aggregated test results.
 */
export async function runAllTests() {
  // This function runs all tests for the D&D 5e system.

  // Array to hold test results
  const results = {};

  // Import and run tests from various modules
  results.actor = await runActorTests();
  results.ruler = await runRulerElevationTests();
  results["bug-fixes"] = await runBugFixTests();

  // Infrastructure (assert, collectFailures, formatFailures) self-tests
  results.infrastructure = {
    assertHelper: await runTest("infrastructure.assertHelper", test_assertHelper),
    assertApproxHelper: await runTest("infrastructure.assertApproxHelper", test_assertApproxHelper),
    collectFailuresDeepNesting: await runTest("infrastructure.collectFailuresDeepNesting", test_collectFailuresDeepNesting),
    formatFailuresEmpty: await runTest("infrastructure.formatFailuresEmpty", test_formatFailuresEmpty)
  };

  // Return the results of all tests
  return results;
}
