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
        if (value.passed === false) {
          failures.push({ path, expected: value.expected, actual: value.actual });
        }
      } else {
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
  lines.push(`\n  \u274c ${failures.length} test(s) failed:\n`);

  for (const f of failures) {
    lines.push(`  \u250c\u2500 ${f.path}`);
    lines.push(`  \u2502  Expected: ${JSON.stringify(f.expected)}`);
    lines.push(`  \u2502  Actual:   ${JSON.stringify(f.actual)}`);
    lines.push("  \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500");
  }

  return `${lines.join("\n")}\n`;
}
