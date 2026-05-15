# Tests — Sieg5e Runtime Test Suite

This document maps every logic case covered by each runtime test, organized by module.
Tests run inside Foundry VTT (not via npm). Main entry: `tests/tests.mjs`.

---

## 1. Actor Module (`tests/actor/tests.mjs`)

Tests the `Actor5e.applyDamage()` method for both **Character** and **NPC** types.

### 1A. Character Tests — Basic Damage

| Test ID | Logic Case Covered |
|---------|-------------------|
| `01` | Damage exceeding total HP + THP → both clamp to zero |
| `02` | Damage ≤ THP → only THP reduced, HP untouched |
| `03` | Damage > THP but < THP+HP → THP depleted, partial HP loss |
| `06` | Zero damage → all values unchanged (no-op) |
| `07` | Damage exactly equals THP → exact depletion, no HP loss |
| `08` | Damage exactly equals HP (no THP) → exact HP depletion to zero |
| `13` | Actor already at 0 HP/THP → damage has no effect (clamp guard) |

### 1B. Character Tests — Healing

| Test ID | Logic Case Covered |
|---------|-------------------|
| `04` | Negative damage (healing) restores HP from partial to higher |
| `05` | Healing beyond max HP caps at max value |
| `12` | Healing with THP present → THP is NOT restored (THP only consumed by damage, not healed) |
| `14` | Healing with `tempmax` ceiling → HP can exceed normal max up to `max + tempmax` |

### 1C. Character Tests — Multipliers

| Test ID | Logic Case Covered |
|---------|-------------------|
| `09` | Vulnerability multiplier (×2) doubles damage amount before applying |
| `10` | Resistance multiplier (×0.5) halves damage (floored to integer) |
| `11` | Fractional damage after multiplication is floored (`Math.floor`) |

### 1D. Character Tests — Armor Hit Points (AHP)

| Test ID | Logic Case Covered |
|---------|-------------------|
| `16` | AHP absorbs all damage when sufficient, THP/HP untouched |
| `17` | Partial AHP absorption → remainder goes directly to HP (no THP) |
| `18` | AHP + THP both absorb, but not enough for full damage; HP untouched |
| `19` | AHP + THP depleted → remaining damage reaches HP |
| `20` | AHP with vulnerability multiplier (×2) — armor absorbs all doubled damage |
| `21` | AHP with resistance multiplier (×0.5) — reduced damage absorbed by armor |
| `22` | AHP with fractional damage flooring on the multiplied amount |
| `23` | Exact depletion: damage equals AHP → AHP goes to zero, no HP loss |
| `24` | All layers fully depleted (AHP + THP + HP all go to zero) |
| `25` | Healing does NOT restore armor HP |
| `26` | AHP with tempmax healing ceiling — healing capped at max+tempmax |
| `27` | AHP when HP already at zero → armor still absorbs damage, HP stays at 0 |
| `28` | AHP + THP exact depletion (no HP loss) |
| `29` | AHP + THP + HP all exactly depleted to zero |
| `30` | Combined: vulnerability multiplier × AHP × THP — all layers consumed |

### 1E. Character Tests — Hooks

| Test ID | Logic Case Covered |
|---------|-------------------|
| `15` | `modifyTokenAttribute` hook returning `false` prevents the update entirely (values unchanged) |

### 1F. NPC Tests — Basic Damage

| Test ID | Logic Case Covered |
|---------|-------------------|
| `01` | Damage exceeding HP + THP + FP → all clamp to zero |
| `02` | Sequential depletion: THP first, then HP, then FP |
| `04` | Damage reduces FP after THP depleted (no remaining THP) |
| `05` | Damage with THP present depletes FP but preserves HP above threshold |
| `06` | FP already zero → damage goes to HP only, stops at 1 (threshold minimum) |
| `07` | FP already zero → damage reduces HP to exactly zero |
| `08` | Zero damage on NPC with all values > 0 → no-op |
| `09` | Damage exactly equals THP → exact depletion of THP only |
| `15` | All pools at zero → damage has no effect |

### 1G. NPC Tests — Healing

| Test ID | Logic Case Covered |
|---------|-------------------|
| `03` | Healing restores HP/THP but leaves FP unchanged (FP is only for damage, not healing) |
| `14` | Depleted FP stays depleted after healing (no restoration from healing) |
| `16` | NPC with tempmax ceiling → HP exceeds normal max during healing |

### 1H. NPC Tests — Multipliers

| Test ID | Logic Case Covered |
|---------|-------------------|
| `12` | Resistance multiplier on damage that only affects FP (not THP) |
| `13` | Fractional damage flooring with multipliers in NPC context |
| `36` | Vulnerability ×2 on FP without triggering threshold |
| `37` | Vulnerability ×2 on FP **triggering** the fortitude points threshold |
| `38` | Resistance ×0.5 with fractional result flooring (NPC + FP) |

### 1I. NPC Tests — Fortitude Points

| Test ID | Logic Case Covered |
|---------|-------------------|
| `10` | Damage equal to HP triggers FP threshold → FP absorbs remainder |
| `11` | Vulnerability multiplier causing damage that hits the threshold exactly |
| `39` | HP at threshold, FP already zero → more damage goes below threshold (to 0) |

### 1J. NPC Tests — Thresholds

| Test ID | Logic Case Covered |
|---------|-------------------|
| `18` | Threshold at **0%** → HP capped at minimum 1, FP absorbs remainder |
| `19` | Threshold at **25%** → HP stops at calculated floor (3/10), FP absorbs rest |
| `20` | Threshold at **75%** → FP depleted before threshold reached, damage continues to HP |
| `21` | Threshold at **100%** → FP absorbs all damage immediately (no HP loss) |
| `40` | Threshold at **50%** → HP stops at 5/10 exactly, FP depleted |
| `41` | Excess damage after FP depletion → HP drops below threshold to zero |

### 1K. NPC Tests — Armor

| Test ID | Logic Case Covered |
|---------|-------------------|
| `22` | AHP absorbs all damage (no THP/HP/FP loss) |
| `23` | Partial AHP → remainder goes to THP (not HP, since THP present) |
| `24` | AHP + THP depleted → damage reaches HP but not FP threshold |
| `25` | All layers up to threshold depleted → FP absorbs remainder |
| `26` | Complete depletion of all four layers (AHP + THP + HP + FP) |
| `27` | AHP with vulnerability multiplier on NPC |
| `28` | AHP with resistance multiplier on NPC |
| `29` | AHP with fractional damage flooring on NPC |
| `30` | Exact depletion of AHP (damage = armor value) |
| `31` | Healing does NOT restore armor HP (NPC) |
| `32` | Armor when both HP and FP are at zero → still absorbs some damage |
| `33` | AHP + THP exact depletion with no FP/HP loss |
| `34` | All layers depleted exactly to threshold, FP absorbs nothing |
| `35` | All four layers (AHP + THP + HP + FP) exactly depleted together |
| `42` | NPC armor with tempmax healing ceiling |

### 1L. NPC Tests — Hooks

| Test ID | Logic Case Covered |
|---------|-------------------|
| `17` | `modifyTokenAttribute` hook returning `false` prevents update (NPC) |

---

## 2. Ruler Elevation Module (`tests/ruler/tests.mjs`)

Tests the ruler elevation feature in `module/canvas/ruler-elevation.mjs`.

### 2A. compute3DDistance — All Diagonal Rules

| Test ID | Logic Case Covered |
|---------|-------------------|
| `eucl_01` | EUCL with zero elevation → returns ground distance unchanged |
| `eucl_02` | EUCL: hypot(10, 10) = √200 ≈ 14.142 |
| `eucl_03` | EUCL: hypot(30, 40) = 50 (Pythagorean triple) |
| `5105_01` | 5105 with zero elevation → ground distance unchanged |
| `5105_02` | 5105: 10 + (10/10)*5 = 15 |
| `5105_03` | 5105: 20 + (20/10)*5 = 30 |
| `5105_04` | 5105 with zero ground distance → only elevation counts |
| `555_01` | 555 with zero elevation → ground distance unchanged |
| `555_02` | 555: max(10, 10) = 10 (equal values) |
| `555_03` | 555: max(10, 20) = 20 |
| `555_04` | 555: max(20, 10) = 20 (reverse order) |
| `default_01` | Invalid/unknown diagonal rule falls through to default (555) |
| `negElev_01` | Negative elevation → abs() used for distance calculation |

### 2B. getGridDistance — Fallback Behavior

| Test ID | Logic Case Covered |
|---------|-------------------|
| `fallback_01` | No grid on scene → defaults to 5ft fallback |
| `custom_01` | Grid with custom distance (15) returns that value |

### 2C. adjustElevation — Per-Segment Adjustment

| Test ID | Logic Case Covered |
|---------|-------------------|
| `ascend_01` | Positive delta (+1) → elevation increases |
| `descend_01` | Negative delta (-1) → elevation decreases |
| `accumulate_01` | Multiple adjustments accumulate correctly |
| `multi_seg_01/02` | Multi-segment: only adjusts the last segment |
| `pad_01/02` | Array padding when new segments added beyond current length |
| `undef_01` | Undefined/null initial elevations default to 0, then adjust |

### 2D. getActiveRuler — Null Conditions

| Test ID | Logic Case Covered |
|---------|-------------------|
| `no_canvas_01` | No canvas → returns null |
| `no_ruler_01` | Canvas without controls.ruler → returns null |
| `no_segments_01` | Ruler with empty segments array → returns null |
| `not_measuring_01` | Ruler in non-MEASURING state (e.g., `_state = 1`) → returns null |
| `active_ruler_01` | Active ruler in MEASURING state (`_state = 2`) → returns the ruler |

### 2E. toJSON Patch — Serialization

| Test ID | Logic Case Covered |
|---------|-------------------|
| `tojson_01/02` | segmentElevations included in serialized output |
| `tojson_default_01` | Null segmentElevations defaults to [0] |
| `tojson_04` | Undefined segmentElevations defaults to [0] |
| `tojson_03` | Original data (x, y) preserved alongside elevation |

### 2F. update Patch — Deserialization

| Test ID | Logic Case Covered |
|---------|-------------------|
| `update_01/02/03` | segmentElevations restored from incoming data |
| `update_no_elev_01` | No elevation in data → values unchanged |
| `update_empty_arr` | Empty array is truthy → gets assigned (length = 0) |

### 2G. clear Patch — Reset

| Test ID | Logic Case Covered |
|---------|-------------------|
| `clear_01/02` | segmentElevations reset to [0] on ruler clear |
| `clear_03` | Original clear function called after reset |

### 2H. _removeWaypoint Patch — Waypoint Removal

| Test ID | Logic Case Covered |
|---------|-------------------|
| `remove_01/02` | Multi-segment: pop removes last elevation entry, length decreases by 1 |
| `remove_04/05` | Single segment: does NOT pop (keeps [originalValue]) |
| `remove_06` | Null elevations array → no error thrown (guard check) |

### 2I. moveToken Patch — Token Elevation Application

| Test ID | Logic Case Covered |
|---------|-------------------|
| `move_01` | No segments → early return false, no elevation applied |
| `move_02` | Cumulative elevation = 0 → token NOT updated (guard) |
| `move_03/04` | Non-zero cumulative → token elevation calculated and rounded to nearest 5ft |
| `move_05` | Rounding: exact multiple of 5 stays exact (12ft → 15ft with ceil) |
| `move_06` | Rounding: another exact case |
| `move_07` | Rounding: single grid unit = 5ft, rounds to 5 |
| `move_08` | Fractional elevation (2.4 units → 12ft) → ceil(12/5)*5 = 15ft |

### 2J. setupRulerElevation — Initialization Flow

| Test ID | Logic Case Covered |
|---------|-------------------|
| `measureDistances_set` | dnd5e measureDistances assigned to canvas.grid.measureDistances |
| `diagonalRule_5105` | Square grid respects user's diagonal rule setting from game.settings |
| `computeDistance_replaced/not_original` | Ruler._computeDistance replaced with elevation-aware version |
| `patches_installed` | installRulerPatches called, _sieg5eRulerPatched flag set |
| `hex_override_3/4` | Hex grids (HEXODDR=3, HEXEVENR=4) override diagonalRule to "555" |

### 2K. adjustElevation → _computeDistance Chain — Full Integration

| Test ID | Logic Case Covered |
|---------|-------------------|
| `chain_initial_*` (EUCL/5105/Hex) | Initial state: zero elevation, distance = ground distance only |
| `chain_adj_*` (EUCL/5105/Hex) | Ascend +1 grid unit → segmentElevations updated, _computeDistance recalculates 3D distance |
| `chain_adj2_*` (EUCL/5105/Hex) | Further ascend (+2 more units) → cumulative elevation increases, distances update |
| `chain_desc_*` (EUCL/5105/Hex) | Descend (-1 unit) → elevation decreases, 3D distance recalculated correctly |

### 2L. _getSegmentLabel — Label Formatting

| Test ID | Logic Case Covered |
|---------|-------------------|
| `label_01` | Simple segment: "5ft" (no cumulative diff, no elevation) |
| `label_02` | Cumulative distance shown when different from segment distance: "5ft > 10ft" |
| `label_03` | Elevation up arrow: "↑N{units}" appended |
| `label_04` | Elevation down arrow: "↓N{units}" appended |
| `label_05` | All together: distance + cumulative + elevation: "5ft > 15ft | ↑20ft" |
| `label_06` | Decimal distances rounded to 1 decimal place (Math.ceil × 10 / 10) |
| `label_07` | Negative elevation with cumulative distance |

### 2M. gridTypes — Grid Distance Variants

| Test ID | Logic Case Covered |
|---------|-------------------|
| `grid_5/10/15/20/40` | Various standard grid distances returned correctly |
| `gridless_01` | No grid → defaults to 5ft fallback |
| `hex_detect_*` | All hex types (3, 4, 5, 6) detected as hex grids |
| `square_no_override_*` | Non-hex types NOT flagged as hex |
| `units_m/yd/km_01` | Unit suffixes applied correctly in labels (ft, m, yd, km) |

### 2N. mouseWheel — Delta Direction Mapping

| Test ID | Logic Case Covered |
|---------|-------------------|
| `delta_pos` | Positive deltaY → descend (-1 delta) |
| `delta_neg` | Negative deltaY → ascend (+1 delta) |
| `delta_zero` | Zero deltaY defaults to ascend (+1) |
| `preventDefault_01/stopPropagation_01` | Event methods called to prevent page scroll and bubbling |
| `wheel_calls_adjust/wheel_delta_correct` | Wheel handler calls adjustElevation with correct direction |

### 2O. keybindings — Registration & Behavior

| Test ID | Logic Case Covered |
|---------|-------------------|
| `up_key_count/arrowup/numpad8/*+Ctrl` | Up binding: ArrowUp, Numpad8, Ctrl+ArrowUp, Ctrl+Numpad8 (4 keys) |
| `down_key_count/arrowdown/numpad2/*+Ctrl` | Down binding: ArrowDown, Numpad2, Ctrl+ArrowDown, Ctrl+Numpad2 (4 keys) |
| `up_onDown_active/inactive` | Up keybinding returns true when ruler active, false when inactive |
| `down_onDown_active/inactive` | Down keybinding same behavior as up |
| `up/down_name/hint` | Keybinding names and hints use correct Sieg5e i18n keys |

### 2P. cumulativeDistance — Multi-Segment Paths

| Test ID | Logic Case Covered |
|---------|-------------------|
| `single_seg_01` | Single segment: cumDistance = distance |
| `two_seg_*` | Two segments accumulate correctly (5 + 10) |
| `three_seg_*` | Three segments accumulate correctly (5 + 10 + 15) |
| `elev_seg_*` | Multi-segment with elevation using EUCL rule on each segment |
| `555_seg_*` | Multi-segment with 555 rule (max of ground/elevation per segment) |
| `5105_seg_*` | Multi-segment with 5105 rule per segment |
| `zero_seg_*` | Zero-distance segments handled correctly |
| `large_path_*/` | Large path (10 segments) accumulation verified at multiple checkpoints |

### 2Q. _computeDistanceFields — Field Computation

| Test ID | Logic Case Covered |
|---------|-------------------|
| `dist_*` (EUCL/555/5105/single/neg) | Per-segment distance field with all diagonal rules and edge cases |
| `cumDist_*` | Cumulative distance across multiple segments per rule type |
| `cumDelta_*` | Cumulative delta elevation tracking (signed, includes negative values) |
| `last_*` | Last segment flag set correctly for each position in array |
| `text_*` | Text label field populated by _getSegmentLabel patch |

### 2R. diagonalRuleFlow — Rule Selection Logic

| Test ID | Logic Case Covered |
|---------|-------------------|
| `square_EUCL/5105/555` | Square grid respects all three user choices |
| `hex_EUCL/5105/555` | Hex grid overrides ALL user choices to "555" (3 test cases) |
| `hex_type_*` | All four hex types force 555 regardless of initial rule |
| `hex_type_*_5105user` | Even with 5105 user choice, hex forces 555 |
| `hex_type_*_555user` | No-op: already-555 stays 555 on hex grids |
| `square_5105_*` | Square grid maintains user's 5105 setting through transitions |
| `555_hex_*` (ground/elev) | 555 formula verified for various ground/elevation combos in hex context |

### 2S. computeDistanceInvocation — Actual _computeDistance Call

| Test ID | Logic Case Covered |
|---------|-------------------|
| `invoke_replaced` | _computeDistance is the patched version (not original) |
| `invoke_zero_*` | Zero elevation segments → distance unchanged, cumDelta = 0 |
| `invoke_eucl_*` | EUCL rule applied per-segment via actual _computeDistance call |
| `invoke_all_seg*/cum/delta` | Elevation consumed for ALL segments in array simultaneously |
| `invoke_neg_cumDelta/dist` | Negative elevation: abs() used for distance, signed value tracked in cumDelta |
| `invoke_last_*` | Last flag set correctly on each segment position |
| `invoke_text_set` | Text field populated by patched _getSegmentLabel |

---

## 3. End-to-End Tests (`tests/ruler/e2e.mjs`)

Simulates realistic user workflows by chaining multiple operations.

| Scenario | Logic Cases Covered |
|----------|-------------------|
| **measurePathWithElevation** | Multi-segment path with per-segment elevation adjustments; cumulative elevation summing |
| **moveTokenWithElevation** | Cumulative elevation → feet conversion → 5ft rounding → token document update |
| **clearAndMeasureAgain** | Ruler clear resets segmentElevations to [0]; ready for new measurement session |
| **removeWaypoints** | Waypoint removal pops from segmentElevations; length decreases correctly |
| **switchGridTypes** | Square→Hex forces 555 override; Hex→Square respects user setting |
| **multipleDiagonalRules** | Distance comparison across EUCL < 5105 for equal ground/elevation inputs |
| **remoteSync** | toJSON serialization → broadcast → update deserialization of segmentElevations |
| **keyboardElevation** | ArrowUp/ArrowDown/Numpad2 key sequences accumulate elevation correctly |
| **wheelElevation** | Mouse wheel deltaY mapping: scroll up = ascend, scroll down = descend |
| **complexMultiSegmentPath** | Full path with 4 segments, mixed elevations, 555 rule on hex grid; all fields verified |

---

## 4. Extended Actor Tests (`tests/actor/extended-tests.mjs`)

Additional tests covering previously untested logic paths in the actor module.

### 4A. applyTempHP — Temporary Hit Point Application

| Test ID | Logic Case Covered |
|---------|-------------------|
| `update_higher_01` | Setting THP higher than current → updates to new value |
| `update_lower_01` | Setting THP lower than current → no-op (value unchanged) |
| `update_equal_01` | Setting THP equal to current → no-op (amount not > tmp) |
| `update_zero_01` | Setting THP to zero when positive → no-op (0 not > tmp) |
| `update_zero_zero_01` | Setting THP to zero when already zero → no-op |
| `update_negative_01` | Setting negative THP → parseInt preserves sign; -5 not > current → no-op |
| `update_nan_string_01` | Passing "invalid" string → parseInt returns NaN (falsy); amount not > tmp → no-op |
| `update_string_num_01` | Passing numeric string "20" → parseInt parses correctly, updates if higher |
| `update_above_max_01` | Setting THP above normal max → allowed (no cap on temp HP) |
| `update_default_01` | Default parameter (amount=0) when current > 0 → no-op |

### 4B. Multiplier Edge Cases — Character

| Test ID | Logic Case Covered |
|---------|-------------------|
| `mult_zero_0*/**` | Multiplier = 0 → damage becomes 0 (no THP/HP loss) |
| `mult_large_0*/**` | Very large multiplier (×99) → all pools depleted to zero |
| `mult_neg_01/**` | Negative multiplier (-1) → healing, but THP not restored |
| `mult_one_01/**` | Multiplier exactly 1 → no change from base damage |
| `mult_partial_neg_*/**` | Partial negative multiplier (×-0.4) → fractional floor applied |

### 4C. Multiplier Edge Cases — NPC

| Test ID | Logic Case Covered |
|---------|-------------------|
| `npc_mult_zero_fp_01` | Multiplier = 0 with FP present → FP unchanged (no damage to absorb) |
| `npc_mult_large_fp_01` | Very large multiplier → all pools including FP depleted |
| `npc_mult_neg_fp_01` | Negative multiplier → heals but does NOT restore depleted FP |

### 4D. tempmax Boundary — Exact Ceiling

| Test ID | Logic Case Covered |
|---------|-------------------|
| `boundary_exact_01` | Healing lands EXACTLY on max+tempmax → reaches ceiling without overshooting |
| `boundary_one_short_01` | Healing one short of ceiling → HP at max+tempmax-1 exactly |
| `boundary_exceeds_01` | Healing exceeds ceiling → HP capped at max+tempmax exactly |
| `boundary_zero_tempmax_01` | tempmax = 0 → ceiling is just max (no extra), healing capped normally |

### 4E. AHP Negative Initial Value

| Test ID | Logic Case Covered |
|---------|-------------------|
| `negative_ahp_str_01` | AHP as string "-3" → parseInt parses to -3, damage goes through THP/HP instead of armor |
| `negative_ahp_num_01` | AHP as numeric -5 → same behavior, damage bypasses negative armor |

### 4F. Threshold Edge: max HP = 0

| Test ID | Logic Case Covered |
|---------|-------------------|
| `zero_max_hp_01` | Max HP = 0 with threshold → Math.clamped prevents HP from going below zero |

## 5. Extended Ruler Elevation Tests (`tests/ruler/extended-tests.mjs`)

Additional tests covering previously untested logic paths in the ruler elevation module.

### 5A. hasPermission("SHOW_RULER") Broadcast Guard

| Test ID | Logic Case Covered |
|---------|-------------------|
| `with_perm_broadcast_called/has_elev` | With SHOW_RULER permission → adjustElevation triggers broadcastActivity with segmentElevations data |
| `without_perm_no_broadcast/elev_still_adjusted` | Without permission → no broadcast (silent), but local elevation still adjusted correctly |

### 5B. Hex Grid Full Chain — Adjust → _computeDistance

| Test ID | Logic Case Covered |
|---------|-------------------|
| `hex_forced_555` | Hex grid forces diagonalRule to "555" despite user selecting EUCL |
| `hex_initial_dist/cumDelta` | Initial state: zero elevation, distance = ground distance only |
| `hex_adj_segElev/dist_555_rule` | Ascend +2 on hex → 555 rule applied (max(10, 20) = 20, NOT EUCL hypot ≈ 22.36) |
| `hex_desc_elev/dist_555` | Descend → elevation decreases, distance recalculated with 555 rule |

### 5C. installRulerPatches Double-Patch Guard

| Test ID | Logic Case Covered |
|---------|-------------------|
| `first_call_patched` | First call sets _sieg5eRulerPatched = true |
| `second_call_no_repatch/valid_output_after_double_patch` | Second call does NOT re-patch; output still valid |

### 5D. Mouse Wheel When No Active Ruler

| Test ID | Logic Case Covered |
|---------|-------------------|
| `no_canvas_null/no_controls_null/no_ruler_null/no_segments_null/not_measuring_null` | All null-return conditions for getActiveRuler verified (canvas missing, no controls, no ruler, empty segments, wrong state) |
| `wheel_no_error_on_null` | Wheel handler with no active ruler → no error thrown (early return guard works) |

### 5E. setupRulerElevation Undefined measureDistances

| Test ID | Logic Case Covered |
|---------|-------------------|
| `undefined_module_throws` | Passing undefined canvasModule → destructuring throws TypeError |
| `no_measure_dist_undefined` | Empty object (missing measureDistances) → grid.measureDistances set to undefined (no crash from assignment) |

### 5F. Negative/Zero Grid Distance for getGridDistance

| Test ID | Logic Case Covered |
|---------|-------------------|
| `negative_dist_01` | Negative grid distance (-5) → returns the negative value (shouldn't happen in practice but tested) |
| `zero_dist_01` | Zero grid distance → returns 0 (not fallback, since 0 is falsy but explicitly set) |
| `no_distance_prop_fallback/null_distance_fallback/gridless_full_fallback/large_grid_dist_01` | Various fallback scenarios: missing property, null value, no scene, very large values |

### 5G. Keybinding onDown Behavior vs Pan Prevention

| Test ID | Logic Case Covered |
|---------|-------------------|
| `active_ruler_not_null/inactive_ruler_null` | getActiveRuler returns non-null when ruler active, null when inactive |
| `ascend_onDown_returns_true_when_active/descend_onDown_returns_false_when_inactive` | onDown logic: true (consume event) when ruler active; false (pass to core pan) when inactive |

### 5H. adjustElevation Before Measurement

| Test ID | Logic Case Covered |
|---------|-------------------|
| `empty_segments_no_error/normal_adjust_works` | Empty segments array → no error thrown; normal ruler → adjusts correctly |

### 5I. _getSegmentLabel Edge Cases

| Test ID | Logic Case Covered |
|---------|-------------------|
| `zero_dist_label` | Zero distance → label shows "0ft" |
| `neg_elev_down_arrow/large_elev_label/decimal_elev_label` | Negative elevation (↓), large values, decimal precision in labels |
| `null_values_label` | Null/undefined segment fields → defaults applied without error |

### 5J. Ruler State Transitions — All _state Values

| Test ID | Logic Case Covered |
|---------|-------------------|
| `state_0_inactive/state_1_inactive/state_2_active/state_3_inactive` | getActiveRuler returns null for states 0, 1, 3; non-null only for state 2 (MEASURING) |

## 6. Extended Infrastructure Tests (`tests/extended-tests.mjs`)

Tests for test infrastructure edge cases.

### 6A. assert Helper Edge Cases

| Test ID | Logic Case Covered |
|---------|-------------------|
| `true_true_01/false_false_01` | Boolean true and false comparisons pass correctly |
| `zero_zero_01/empty_str_empty_str_01/null_null_01/undefined_undefined_01` | Falsy values (0, "", null, undefined) compared with strict equality pass when equal |
| `obj_ref_diff_01/arr_ref_diff_01` | Object and array reference comparison fails (not deep-equal) — correct behavior for assert |
| `zero_false_01/empty_str_false_01` | Strict equality: 0 !== false, "" !== false → correctly reports failure |

### 6B. assertApprox Helper Edge Cases

| Test ID | Logic Case Covered |
|---------|-------------------|
| `exact_match_01` | Exact match (diff = 0) passes within default tolerance |
| `within_default_tol/at_boundary_01` | Default tolerance boundary: diff < 0.001 passes, diff === 0.001 fails |
| `negative_within/large_numbers/custom_wide_tol/custom_narrow_tol/zero_large_diff_01` | Negative values, large numbers, custom tolerances (wider and narrower), zero with large difference |

### 6C. collectFailures Deep Nesting

| Test ID | Logic Case Covered |
|---------|-------------------|
| `deep_failure_count/has_level1_path/has_full_nested_path` | Deeply nested structure (4 levels) → all failures found at any depth with full path |
| `no_crash_on_mixed/mixed_passed_values_only_false_failures` | Mixed leaf/non-leaf objects don't crash; only false-passed values collected as failures |

### 6D. formatFailures Empty Input

| Test ID | Logic Case Covered |
|---------|-------------------|
| `empty_returns_empty_string_01` | Empty failure array → returns empty string (no spurious output) |

## Additional Test Coverage Summary

The extended test suites cover logic paths that were not previously exercised by any tests.

| Area | New Cases |
|------|-----------|
| `applyTempHP()` increase/decrease/equal/zero/negative/string inputs | Section 4A (10 cases) |
| Multiplier edge values (×0, ×-1, NaN) on character and NPC | Sections 4B-4C (8 cases) |
| tempmax ceiling exact match (+ one short, exceeds, zero) | Section 4D (4 cases) |
| Negative AHP initial value from parseInt parsing | Section 4E (2 cases) |
| Threshold with hp.max = 0 | Section 4F (1 case) |
| SHOW_RULER permission guard (broadcast vs silent paths) | Section 5A (3 cases) |
| Hex grid full chain test (adjust → _computeDistance with forced 555) | Section 5B (6 cases) |
| Double-patch prevention via _sieg5eRulerPatched flag | Section 5C (2 cases) |
| Mouse wheel with no active ruler (all null-return conditions) | Section 5D (7 cases) |
| Undefined measureDistances parameter robustness | Section 5E (2 cases) |
| Negative/zero grid distance fallbacks (null, missing, large values) | Section 5F (8 cases) |
| Keybinding onDown true/false behavior vs pan prevention | Section 5G (4 cases) |
| adjustElevation before measurement starts | Section 5H (2 cases) |
| _getSegmentLabel edge inputs (zero distance, null fields, large values) | Section 5I (6 cases) |
| Ruler state transitions for all states (0-3) | Section 5J (4 cases) |
| assert/assertApprox helper edge cases (falsy values, tolerance boundaries) | Sections 6A-6B (18 cases) |
| collectFailures deep nesting (4-level structures, mixed objects) | Section 6C (3 cases) |
| formatFailures empty input | Section 6D (1 case) |

## Remaining Untested Areas

These logic paths have not been tested. They represent edge cases outside normal gameplay flows.

| Area | Description | Severity |
|------|-------------|----------|
| Group actor type | `if (!hp)` early return in applyDamage — requires creating a group-type actor to exercise the guard path | Medium |
| Error handling paths | Actor creation failures, update failures, hook exceptions during applyDamage | Low |
| _isRemarkableAthlete() | Private method with flag-based logic check | Very Low |
| Non-standard grid units | Label formatting passes through arbitrary unit strings; only ft/m/yd/km tested explicitly | Very Low |

## Summary Statistics

| Category | Tests Written | Logic Cases Covered |
|----------|--------------|---------------------|
| Actor (Character) | ~42 assertions across 15 test cases | Damage, healing, multipliers, armor, hooks |
| Actor (NPC) | ~60 assertions across 17 test cases | Damage, healing, FP, thresholds, armor, hooks |
| **Extended Actor Tests** | ~42 assertions across 13 test cases | applyTempHP, multiplier edge cases, tempmax boundary, AHP negative, threshold with max=0 |
| Ruler Elevation | ~250+ individual assertion checks | All core functions, all diagonal rules, patches, keybindings, mouse wheel |
| **Extended Ruler Tests** | ~70 assertions across 19 test cases | Permission guards, hex chain, double-patch guard, edge cases for grid distance/labels/states |
| End-to-End | 10 scenarios | Common user workflows |
| **Extended Infrastructure Tests** | ~24 assertions across 8 test cases | assert/assertApprox helpers, collectFailures deep nesting, formatFailures empty input |

**Total unique logic cases tested**: ~150+ distinct behaviors
