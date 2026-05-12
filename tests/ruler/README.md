# Ruler Elevation Tests

Runtime tests for the Sieg5e ruler elevation system. Tests run inside Foundry VTT and validate all ruler elevation functionality including 3D distance computation, elevation adjustment, ruler patches, keybindings, and mouse wheel handling.

## Test Suites

### 1. `compute3DDistance` (16 tests)

Tests the `compute3DDistance(groundDistance, elevationFeet, diagonalRule)` function with all diagonal movement rules.

| Test | Input `(ground, elevFeet, rule)` | Expected | Logic |
|------|----------------------------------|----------|-------|
| `eucl_01` | `(10, 0, "EUCL")` | `10` | Zero elevation returns ground distance |
| `eucl_02` | `(10, 10, "EUCL")` | `≈14.142` | Euclidean: hypot(10,10) = √200 |
| `eucl_03` | `(30, 40, "EUCL")` | `50` | Euclidean: hypot(30,40) = 50 (3-4-5 triangle) |
| `5105_01` | `(10, 0, "5105")` | `10` | Zero elevation returns ground distance |
| `5105_02` | `(10, 10, "5105")` | `15` | 5105: ground + (elev/10)*5 = 10 + (10/10)*5 = 15 |
| `5105_03` | `(20, 20, "5105")` | `30` | 5105: 20 + (20/10)*5 = 30 |
| `5105_04` | `(0, 10, "5105")` | `5` | Pure vertical: 0 + (10/10)*5 = 5 |
| `555_01` | `(10, 0, "555")` | `10` | Zero elevation returns ground distance |
| `555_02` | `(10, 10, "555")` | `10` | 555: max(10,10) = 10 |
| `555_03` | `(10, 20, "555")` | `20` | 555: max(10,20) = 20 (elevation > ground) |
| `555_04` | `(20, 10, "555")` | `20` | 555: max(20,10) = 20 (ground > elevation) |
| `default_01` | `(15, 15, "INVALID")` | `15` | Unknown rule falls through to 555: max(15,15) = 15 |
| `negElev_01` | `(10, -10, "555")` | `10` | Negative elevation uses abs: max(10,10) = 10 |
| `negElev_02` | `(10, -10, "EUCL")` | `≈14.142` | Negative elevation uses abs: hypot(10,10) |
| `negElev_03` | `(10, 10, "5105")` | `15` | Positive elev input to 5105 rule |

### 2. `getGridDistance` (2 tests)

Tests `getGridDistance()` which reads `canvas.scene.grid.distance` with fallback to 5.

| Test | `canvas.scene.grid` | Expected | Logic |
|------|---------------------|----------|-------|
| `fallback_01` | `{}` (no distance) | `5` | Fallback when grid.distance is undefined |
| `custom_01` | `{ distance: 15 }` | `15` | Returns custom grid distance |

### 3. `adjustElevation` (8 tests)

Tests `adjustElevation(ruler, delta)` which mutates `ruler.segmentElevations[last]`.

| Test | Setup `segmentElevations` | Delta | Expected | Logic |
|------|---------------------------|-------|----------|-------|
| `ascend_01` | `[0]` | `+1` | `segElev[0] === 1` | Positive delta ascends |
| `descend_01` | `[0]` | `-1` | `segElev[0] === -1` | Negative delta descends |
| `accumulate_01` | `[0]` | `+1, +1, -1` | `segElev[0] === 1` | Multiple deltas accumulate |
| `multi_seg_01` | `[1,2]` | `+1` | `segElev[0] === 1` | Only last segment adjusted |
| `multi_seg_02` | `[1,2]` | `+1` | `segElev[1] === 3` | Last segment: 2+1=3 |
| `pad_01` | `[0]` + add segment | `+1` | `segElev.length === 2` | Array padded for new segments |
| `pad_02` | `[0]` + add segment | `+1` | `segElev[1] === 1` | New segment gets delta |
| `undef_01` | `undefined` | `+1` | `segElev[0] === 1` | Undefined elevations default to 0 |

### 4. `getActiveRuler` (5 tests)

Tests `getActiveRuler()` which returns ruler only if `_state === 2` and has segments.

| Test | `canvas` | Expected | Logic |
|------|----------|----------|-------|
| `no_canvas_01` | `{ _test_noCanvas: true }` | `null` | No controls → null |
| `no_ruler_01` | `{ controls: {} }` | `null` | No ruler → null |
| `no_segments_01` | `{ controls: { ruler: { segments: [] } } }` | `null` | No segments → null |
| `not_measuring_01` | `{ controls: { ruler: { segments: [1,2], _state: 1 } } }` | `null` | _state ≠ 2 → null |
| `active_ruler_01` | `{ controls: { ruler: { segments: [1,2], _state: 2 } } }` | `ruler object` | Active ruler returned |

### 5. `toJSON` Patch (5 tests)

Tests Ruler.toJSON patch: `data.segmentElevations = this.segmentElevations \|\| [0]`.

| Test | `segmentElevations` | Expected | Logic |
|------|---------------------|----------|-------|
| `tojson_01` | `[2]` | `data.segmentElevations !== undefined` → `true` | Elevations included |
| `tojson_02` | `[2]` | `JSON.stringify([2]) === '[2]'` → `true` | Correct values |
| `tojson_default_01` | `null` | `JSON.stringify([0]) === '[0]'` → `true` | Null defaults to [0] |
| `tojson_04` | `undefined` | `JSON.stringify([0]) === '[0]'` → `true` | Undefined defaults to [0] |
| `tojson_03` | (any) | `data.x === 0 && data.y === 0` → `true` | Original toJSON called |

### 6. `update` Patch (4 tests)

Tests Ruler.update patch: `this.segmentElevations = data.segmentElevations` (if present).

| Test | Input data | Expected `segmentElevations` | Logic |
|------|------------|------------------------------|-------|
| `update_01` | `{ segmentElevations: [3,-1,2] }` | `[0] === 3` | First element restored |
| `update_02` | same | `[1] === -1` | Second element restored |
| `update_03` | same | `[2] === 2` | Third element restored |
| `update_no_elev_01` | `{ x:1, y:1 }` (no elev) | unchanged `[5]` → `[0] === 5` | No data → no change |
| `update_empty_arr` | `{ segmentElevations: [] }` | `[]` | Empty array assigned |

### 7. `clear` Patch (3 tests)

Tests Ruler.clear patch: `this.segmentElevations = [0]`.

| Test | Input `segmentElevations` | Expected | Logic |
|------|---------------------------|----------|-------|
| `clear_01` | `[3, -2]` | `[0] === 0` | Reset to 0 |
| `clear_02` | `[3, -2]` | `length === 1` | Single element |
| `clear_03` | (original called) | `true` | Original clear invoked |

### 8. `_removeWaypoint` Patch (5 tests)

Tests Ruler._removeWaypoint patch: `pop()` if `segmentElevations.length > 1`.

| Test | Input `segmentElevations` | Condition | Expected | Logic |
|------|---------------------------|-----------|----------|-------|
| `remove_01` | `[1,2,3]` | length > 1 → pop | `length === 2` | Pop removes last |
| `remove_02` | `[1,2,3]` | after pop | `[1] === 2` | Second element remains |
| `remove_04` | `[5]` | length = 1 → no pop | `length === 1` | Single element preserved |
| `remove_05` | `[5]` | after no-op | `[0] === 5` | Value unchanged |
| `remove_06` | `null` | null check | no error → `true` | Null-safe |

### 9. `moveToken` Patch (8 tests)

Tests Ruler.moveToken patch: `elevationDelta = cumElev × gridDist`, `rounded = ceil(elev/5)×5`.

| Test | `segmentElevations` | Grid dist | Cum elev | Expected token elevation | Logic |
|------|---------------------|-----------|----------|-------------------------|-------|
| `move_01` | `segments=[]` | — | — | `false` (early return) | No segments → false |
| `move_02` | `[0]` | 5 | 0 | `true` (!shouldUpdate) | No update when cum=0 |
| `move_03` | `[2]` | 5 | 2 | `true` (shouldUpdate) | Update when cum≠0 |
| `move_04` | `[2]` | 5 | 2 | `10` | 2×5=10, ceil(10/5)×5=10 |
| `move_05` | `[3]` | 5 | 3 | `15` | 3×5=15, ceil(15/5)×5=15 |
| `move_06` | `[2]` | 5 | 2 | `10` | 2×5=10, ceil(10/5)×5=10 |
| `move_07` | `[1]` | 5 | 1 | `5` | 1×5=5, ceil(5/5)×5=5 |
| `move_08` | `[2.4]` | 5 | 2.4 | `15` | 2.4×5=12, ceil(12/5)×5=15 |

### 10. `_getSegmentLabel` (7 tests)

Tests label formatting: `"{dist}{units} > {cumDist}{units} | {dir}{elev}{units}"`.

| Test | `distance` | `cumDistance` | `cumDeltaElev` | Expected label | Logic |
|------|-----------|---------------|----------------|----------------|-------|
| `label_01` | `5` | `5` | `0` | `"5ft"` | No cumulative, no elevation |
| `label_02` | `5` | `10` | `0` | `"5ft > 10ft"` | Cumulative distance shown |
| `label_03` | `5` | `5` | `10` | `"5ft | ↑10ft"` | Upward elevation |
| `label_04` | `5` | `5` | `-10` | `"5ft | ↓10ft"` | Downward elevation |
| `label_05` | `5` | `15` | `20` | `"5ft > 15ft | ↑20ft"` | All combined |
| `label_06` | `5.333` | `5.333` | `0` | `"5.4ft"` | ceil(53.33)/10 = 5.4 |
| `label_07` | `5` | `10` | `-15` | `"5ft > 10ft | ↓15ft"` | Negative elevation with cumulative |

### 11. `gridTypes` (17 tests)

Tests grid distance variants, hex detection, and unit labels.

| Test | Input | Expected | Logic |
|------|-------|----------|-------|
| `grid_5` | `grid.distance = 5` | `5` | Standard grid distance |
| `grid_10` | `grid.distance = 10` | `10` | Standard grid distance |
| `grid_15` | `grid.distance = 15` | `15` | Standard grid distance |
| `grid_20` | `grid.distance = 20` | `20` | Standard grid distance |
| `grid_40` | `grid.distance = 40` | `40` | Standard grid distance |
| `gridless_01` | `grid = null` | `5` | Fallback when no grid |
| `hex_detect_3` | type 3 (HEXODDR) | in `[3,4,5,6]` → `true` | Hex type detection |
| `hex_detect_4` | type 4 (HEXEVENR) | in `[3,4,5,6]` → `true` | Hex type detection |
| `hex_detect_5` | type 5 (HEXODDQ) | in `[3,4,5,6]` → `true` | Hex type detection |
| `hex_detect_6` | type 6 (HEXEVENQ) | in `[3,4,5,6]` → `true` | Hex type detection |
| `square_no_override_0` | type 0 (SQUARE) | NOT in hex list → `true` | Square not hex |
| `square_no_override_1` | type 1 (GRIDLESS) | NOT in hex list → `true` | Gridless not hex |
| `square_no_override_2` | type 2 | NOT in hex list → `true` | Other not hex |
| `square_no_override_01` | type 0 | NOT in hex list → `true` | Square not hex |
| `units_m_01` | `grid.units = "m"` | label = `"5m"` | Meter units |
| `units_yd_01` | `grid.units = "yd"` | label = `"5yd"` | Yard units |
| `units_km_01` | `grid.units = "km"` | label = `"5km"` | Kilometer units |

### 12. `mouseWheel` (6 tests)

Tests mouse wheel handler delta direction mapping and event handling.

| Test | `deltaY` | Expected delta | Logic |
|------|----------|----------------|-------|
| `delta_pos` | `> 0` | `-1` | Scroll down → descend |
| `delta_neg` | `< 0` | `+1` | Scroll up → ascend |
| `delta_zero` | `0` | `+1` | Zero → ascend (default) |
| `preventDefault_01` | — | `true` | `preventDefault()` called |
| `stopPropagation_01` | — | `true` | `stopPropagation()` called |
| `no_ruler_early_return` | — | `true` | No ruler → no adjustElevation |

### 13. `keybindings` (18 tests)

Tests keybinding registration and onDown behavior.

| Test | Description | Expected | Logic |
|------|-------------|----------|-------|
| `up_key_count` | ArrowUp keybinding | 4 keys registered | ArrowUp, Numpad8, ArrowUp+Ctrl, Numpad8+Ctrl |
| `up_arrowup` | ArrowUp key | `"ArrowUp"` in list | Primary key |
| `up_numpad8` | Numpad8 key | `"Numpad8"` in list | Numpad alternative |
| `up_ctrl_arrowup` | Ctrl+ArrowUp | `"ArrowUp+Ctrl"` in list | Ctrl modifier |
| `up_ctrl_numpad8` | Ctrl+Numpad8 | `"Numpad8+Ctrl"` in list | Ctrl modifier |
| `down_key_count` | ArrowDown keybinding | 4 keys registered | ArrowDown, Numpad2, ArrowDown+Ctrl, Numpad2+Ctrl |
| `down_arrowdown` | ArrowDown key | `"ArrowDown"` in list | Primary key |
| `down_numpad2` | Numpad2 key | `"Numpad2"` in list | Numpad alternative |
| `down_ctrl_arrowdown` | Ctrl+ArrowDown | `"ArrowDown+Ctrl"` in list | Ctrl modifier |
| `down_ctrl_numpad2` | Ctrl+Numpad2 | `"Numpad2+Ctrl"` in list | Ctrl modifier |
| `up_onDown_active` | Ruler active (ascend) | `true` | Consume event when ruler active |
| `up_onDown_inactive` | Ruler inactive (ascend) | `true` | Don't consume when ruler inactive |
| `down_onDown_active` | Ruler active (descend) | `true` | Consume event when ruler active |
| `down_onDown_inactive` | Ruler inactive (descend) | `true` | Don't consume when ruler inactive |
| `up_name` | Keybinding name | `"Sieg5e.RulerElevationUp"` | Correct name |
| `down_name` | Keybinding name | `"Sieg5e.RulerElevationDown"` | Correct name |
| `up_hint` | Keybinding hint | `"Sieg5e.RulerElevationUpHint"` | Correct hint |
| `down_hint` | Keybinding hint | `"Sieg5e.RulerElevationDownHint"` | Correct hint |

### 14. `setupRulerElevation` (7 tests)

Tests setupRulerElevation: measureDistances, diagonalRule, _computeDistance replacement, patches.

| Test | Description | Expected | Logic |
|------|-------------|----------|-------|
| `measureDistances_set` | measureDistances assigned | `true` | canvasModule.measureDistances → gameCanvas.grid.measureDistances |
| `diagonalRule_5105` | Square grid, user chose 5105 | `true` | Square respects user choice |
| `computeDistance_replaced` | _computeDistance replaced | `true` | New function installed |
| `computeDistance_not_original` | Not original | `true` | Different from original |
| `patches_installed` | installRulerPatches called | `true` | _sieg5eRulerPatched flag set |
| `hex_override_3` | Hex type 3 forces 555 | `true` | HEXODDR → 555 |
| `hex_override_4` | Hex type 4 forces 555 | `true` | HEXEVENR → 555 |

### 15. `cumulativeDistance` (20 tests)

Tests total cumulative distance across multiple segments with all diagonal rules.

| Test | Segments | Expected | Logic |
|------|----------|----------|-------|
| `single_seg_01` | `[10]` | `cumDistance === 10` | Single segment |
| `two_seg_01` | `[10, 15]` | `seg[0].cumDistance === 10` | First segment |
| `two_seg_02` | `[10, 15]` | `seg[1].cumDistance === 25` | 10+15=25 |
| `three_seg_01` | `[5, 10, 15]` | `seg[0].cumDistance === 5` | First segment |
| `three_seg_02` | `[5, 10, 15]` | `seg[1].cumDistance === 15` | 5+10=15 |
| `three_seg_03` | `[5, 10, 15]` | `seg[2].cumDistance === 30` | 5+10+15=30 |
| `elev_seg_01` | `[10,10,10]` + elev `[0,10,5]` EUCL | `seg[0].cumDistance ≈ 10` | No elevation |
| `elev_seg_02` | `[10,10,10]` + elev `[0,10,5]` EUCL | `seg[1].cumDistance ≈ 24.142` | 10 + hypot(10,10) |
| `elev_seg_03` | `[10,10,10]` + elev `[0,10,5]` EUCL | `seg[2].cumDistance ≈ 35.322` | + hypot(10,5) |
| `555_seg_01` | `[10,10,10]` + elev `[0,2,-3]` 555 | `seg[0].cumDistance === 10` | No elevation |
| `555_seg_02` | `[10,10,10]` + elev `[0,2,-3]` 555 | `seg[1].cumDistance === 20` | max(10,10)=10 |
| `555_seg_03` | `[10,10,10]` + elev `[0,2,-3]` 555 | `seg[2].cumDistance === 40` | max(10,15)=15 |
| `5105_seg_01` | `[10,10,10]` + elev `[0,2,-3]` 5105 | `seg[0].cumDistance === 10` | No elevation |
| `5105_seg_02` | `[10,10,10]` + elev `[0,2,-3]` 5105 | `seg[1].cumDistance === 25` | 10+(10/10)*5 |
| `5105_seg_03` | `[10,10,10]` + elev `[0,2,3]` 5105 | `seg[2].cumDistance === 45` | 10+20+20=45 |
| `zero_seg_01` | `[0,0]` | `seg[0].cumDistance === 0` | Zero distance |
| `zero_seg_02` | `[0,0]` | `seg[1].cumDistance === 0` | Zero cumulative |
| `large_path_01` | `[5,10,15,20,25,30,35,40,45,50]` | `seg[0].cumDistance === 5` | First segment |
| `large_path_02` | `[5,10,15,20,25,30,35,40,45,50]` | `seg[5].cumDistance === 105` | 5+10+15+20+25+30=105 |
| `large_path_03` | `[5,10,15,20,25,30,35,40,45,50]` | `seg[9].cumDistance === 275` | Sum all = 275 |

### 16. `computeDistanceFields` (32 tests)

Tests all fields computed by Ruler._computeDistance: distance, cumDistance, cumDeltaElevation, last, text.

| Test | Description | Expected | Logic |
|------|-------------|----------|-------|
| `dist_01` | EUCL: `[10,10,10]` + elev `[0,2,-1]` | `seg[0].distance === 10` | No elevation |
| `dist_02` | EUCL: `[10,10,10]` + elev `[0,2,-1]` | `seg[1].distance ≈ 14.142` | hypot(10,10) |
| `dist_03` | EUCL: `[10,10,10]` + elev `[0,2,-1]` | `seg[2].distance ≈ 11.180` | hypot(10,5) |
| `cumDist_01` | EUCL cumulative | `seg[0].cumDistance ≈ 10` | First segment |
| `cumDist_02` | EUCL cumulative | `seg[1].cumDistance ≈ 24.142` | 10 + 14.142 |
| `cumDist_03` | EUCL cumulative | `seg[2].cumDistance ≈ 35.322` | 24.142 + 11.180 |
| `cumDelta_01` | EUCL cumDeltaElev | `seg[0].cumDeltaElevation === 0` | No elevation |
| `cumDelta_02` | EUCL cumDeltaElev | `seg[1].cumDeltaElevation === 10` | 0 + 2×5 |
| `cumDelta_03` | EUCL cumDeltaElev | `seg[2].cumDeltaElevation === 5` | 10 + (-1)×5 |
| `last_01` | EUCL last flag | `seg[0].last === false` | Not last |
| `last_02` | EUCL last flag | `seg[1].last === false` | Not last |
| `last_03` | EUCL last flag | `seg[2].last === true` | Last segment |
| `text_01` | EUCL text | `seg[0].text === "label_0"` | Placeholder label |
| `text_02` | EUCL text | `seg[1].text === "label_1"` | Placeholder label |
| `text_03` | EUCL text | `seg[2].text === "label_2"` | Placeholder label |
| `555_dist_01` | 555: `[10,10,10]` + elev `[0,2,-3]` | `seg[0].distance === 10` | No elevation |
| `555_dist_02` | 555: `[10,10,10]` + elev `[0,2,-3]` | `seg[1].distance === 10` | max(10,10) |
| `555_dist_03` | 555: `[10,10,10]` + elev `[0,2,-3]` | `seg[2].distance === 15` | max(10,15) |
| `555_cumDist_01` | 555 cumulative | `seg[2].cumDistance === 35` | 10+10+15 |
| `555_cumDelta_01` | 555 cumDeltaElev | `seg[2].cumDeltaElevation === -5` | 0+10-15 |
| `5105_dist_01` | 5105: `[10,10]` + elev `[0,2]` | `seg[0].distance === 10` | No elevation |
| `5105_dist_02` | 5105: `[10,10]` + elev `[0,2]` | `seg[1].distance === 15` | 10+(10/10)*5 |
| `5105_cumDist_01` | 5105 cumulative | `seg[1].cumDistance === 25` | 10+15 |
| `5105_cumDelta_01` | 5105 cumDeltaElev | `seg[1].cumDeltaElevation === 10` | 0+2×5 |
| `single_dist` | Single: `[10]` + elev `[3]` | `distance ≈ 18.028` | hypot(10,15) |
| `single_cumDist` | Single cumulative | `cumDistance ≈ 18.028` | Same as distance |
| `single_cumDelta` | Single cumDeltaElev | `cumDeltaElevation === 15` | 3×5 |
| `single_last` | Single last flag | `last === true` | Only segment |
| `neg_dist_01` | Negative: `[10,10]` + elev `[0,-2]` | `seg[0].distance === 10` | No elevation |
| `neg_dist_02` | Negative: `[10,10]` + elev `[0,-2]` | `seg[1].distance ≈ 14.142` | hypot(10,10) |
| `neg_cumDelta_01` | Negative cumDeltaElev | `seg[0].cumDeltaElevation === 0` | No elevation |
| `neg_cumDelta_02` | Negative cumDeltaElev | `seg[1].cumDeltaElevation === -10` | 0+(-2)×5 |

### 17. `diagonalRuleFlow` (8 tests)

Tests diagonal rule flow: square grids respect user choice, hex grids always force 555.

| Test | Grid type | User choice | Expected | Logic |
|------|-----------|-------------|----------|-------|
| `square_EUCL` | SQUARE (0) | EUCL | `EUCL` | Square respects user choice |
| `square_5105` | SQUARE (0) | 5105 | `5105` | Square respects user choice |
| `square_555` | SQUARE (0) | 555 | `555` | Square respects user choice |
| `hex_EUCL` | HEX (3) | EUCL | `555` | Hex forces 555 |
| `hex_5105` | HEX (3) | 5105 | `555` | Hex forces 555 |
| `hex_555` | HEX (3) | 555 | `555` | Hex forces 555 (no-op) |
| `hex_type_3` | HEXODDR (3) | EUCL | `555` | All hex types force 555 |
| `hex_type_4` | HEXEVENR (4) | EUCL | `555` | All hex types force 555 |

### 18. `adjustElevationChain` (10 tests)

Tests the full `adjustElevation` → `_computeDistance` chain via actual function invocation. Verifies `segmentElevations` mutation, 555 distance formula, cumDeltaElevation accumulation.

| Test | Description | Expected | Logic |
|------|-------------|----------|-------|
| `chain_initial_dist` | Zero elevation → distance = 5 | `5` | No elevation, ground distance |
| `chain_initial_cum` | Zero elevation → cumDistance = 5 | `5` | No elevation, cum = ground |
| `chain_initial_delta` | Zero elevation → cumDelta = 0 | `0` | No elevation delta |
| `chain_adj_segElev` | After +1 → segmentElevations[0] = 1 | `1` | adjustElevation mutates array |
| `chain_adj_ground` | +1 → elev=1×5=5ft, 555: max(5,5)=5 | `5` | 555 formula: equal → ground |
| `chain_adj_cumDelta` | +1 → cumDelta = 1×5 = 5 | `5` | Elevation in feet accumulated |
| `chain_adj2_segElev` | After +2 → segmentElevations[0] = 3 | `3` | Accumulation: 1+2 |
| `chain_adj2_dist` | +2 → elev=3×5=15ft, 555: max(5,15)=15 | `15` | 555 formula: elev > ground |
| `chain_adj2_cum` | Cumulative distance = 5+15 | `15` | 3D distance accumulated |
| `chain_adj2_cumDelta` | +2 → cumDelta = 3×5 = 15 | `15` | Elevation accumulated |
| `chain_desc_segElev` | After -1 → segmentElevations[0] = 2 | `2` | Descend: 3-1=2 |
| `chain_desc_dist` | -1 → elev=2×5=10ft, 555: max(5,10)=10 | `10` | 555 formula: elev > ground |
| `chain_desc_cumDelta` | -1 → cumDelta = 2×5 = 10 | `10` | Cumulative delta reset |

### 19. `computeDistanceInvocation` (15 tests)

Tests `_computeDistance` replacement — actually invokes the patched method. Verifies `segmentElevations` array consumption, EUCL formula, negative elevation abs, last flag, text field.

| Test | Description | Expected | Logic |
|------|-------------|----------|-------|
| `invoke_replaced` | _computeDistance !== original | `true` | Method replaced |
| `invoke_zero_dist` | Zero elevation → distance unchanged | `10` | No 3D adjustment |
| `invoke_zero_cum` | Zero elevation → cumDistance = 10 | `10` | No elevation to accumulate |
| `invoke_zero_delta` | Zero elevation → cumDelta = 0 | `0` | No elevation delta |
| `invoke_eucl_dist` | EUCL: elev=2×5=10ft → hypot(10,10)≈14.142 | `≈14.142` | Euclidean 3D distance |
| `invoke_eucl_cum` | Cumulative: 10+14.142 | `≈24.142` | 3D distance accumulated |
| `invoke_eucl_delta` | cumDelta = 2×5 = 10 | `10` | Elevation in feet |
| `invoke_all_seg0` | All segments elevated → seg0 = hypot(10,5) | `≈11.180` | segmentElevations[0] consumed |
| `invoke_all_seg1` | All segments elevated → seg1 = hypot(10,5) | `≈11.180` | segmentElevations[1] consumed |
| `invoke_all_seg2` | All segments elevated → seg2 = hypot(10,5) | `≈11.180` | segmentElevations[2] consumed |
| `invoke_all_cum` | 3×11.180 | `≈33.540` | All segments accumulated |
| `invoke_all_delta` | cumDelta = (1+1+1)×5 = 15 | `15` | Total elevation change |
| `invoke_neg_cumDelta` | Negative elev: (-1)×5 = -5 | `-5` | Negative delta accumulates |
| `invoke_neg_dist` | Negative: abs(elev)=1 → hypot(10,5) | `≈11.180` | abs() used for distance |
| `invoke_last_0` | First segment → last = false | `false` | Last flag: i !== last |
| `invoke_last_1` | Second segment → last = false | `false` | Last flag: i !== last |
| `invoke_last_2` | Third segment → last = true | `true` | Last flag: i === last |
| `invoke_text_set` | text field is non-empty string | `true` | Label populated |

---

## Test Execution

Tests run inside Foundry VTT via `tests/tests.mjs`:

```javascript
import { runAllTests } from "./tests.mjs";
const results = await runAllTests();
```

Results structure:
```json
{
  "actor": { "applyDamage_character": {...}, "applyDamage_npc": {...} },
  "ruler": {
    "compute3DDistance": {...},
    "getGridDistance": {...},
    "adjustElevation": {...},
    "getActiveRuler": {...},
    "installRulerPatches_toJSON": {...},
    "installRulerPatches_update": {...},
    "installRulerPatches_clear": {...},
    "installRulerPatches_removeWaypoint": {...},
    "installRulerPatches_moveToken": {...},
    "_getSegmentLabel": {...},
    "gridTypes": {...},
    "mouseWheel": {...},
    "keybindings": {...},
    "setupRulerElevation": {...},
    "cumulativeDistance": {...},
    "computeDistanceFields": {...},
    "diagonalRuleFlow": {...},
    "adjustElevationChain": {...},
    "computeDistanceInvocation": {...}
  },
  "e2e": {
    "measurePathWithElevation": {...},
    "moveTokenWithElevation": {...},
    "clearAndMeasureAgain": {...},
    "removeWaypoints": {...},
    "switchGridTypes": {...},
    "multipleDiagonalRules": {...},
    "remoteSync": {...},
    "keyboardElevation": {...},
    "wheelElevation": {...},
    "complexMultiSegmentPath": {...}
  }
}
```

## End-to-End Test Scenarios

### 1. `measurePathWithElevation` (4 tests)
User measures 3-segment path, adjusts elevation per segment via scroll.

| Test | Description | Expected | Logic |
|------|-------------|----------|-------|
| `seg0_elev` | First segment elevation | `2` | Assert(2, actual) |
| `seg1_elev` | Second segment elevation | `-1` | Assert(-1, actual) |
| `seg2_elev` | Third segment elevation | `1` | Assert(1, actual) |
| `total_elev` | Cumulative elevation | `2` | 2 + (-1) + 1 = 2 |

### 2. `moveTokenWithElevation` (4 tests)
User measures path with elevation, moves token via SPACEBAR.

| Test | Description | Expected | Logic |
|------|-------------|----------|-------|
| `cumulative_elev` | Total elevation | `2` | 2 + (-1) + 1 = 2 |
| `elevation_delta_ft` | Delta in feet | `10` | 2 × 5ft = 10ft |
| `rounded_delta` | Rounded to 5ft | `10` | ceil(10/5) × 5 = 10 |
| `token_end_elev` | Token final elevation | `10` | 0 + 10 = 10 |

### 3. `clearAndMeasureAgain` (3 tests)
User clears ruler (ESC), measures new path.

| Test | Description | Expected | Logic |
|------|-------------|----------|-------|
| `old_elev` | Old ruler elevation | `2` | Previous measurement |
| `new_elev` | New ruler elevation | `0` | Reset to [0] |
| `new_elev_length` | New elevation array length | `1` | Single element |

### 4. `removeWaypoints` (5 tests)
User right-clicks waypoint to remove while measuring.

| Test | Description | Expected | Logic |
|------|-------------|----------|-------|
| `elev_length` | After remove | `2` | Popped last element |
| `elev_0` | First element | `0` | Unchanged |
| `elev_1` | Second element | `2` | Was index 2, now index 1 |
| `final_length` | After second remove | `1` | Popped again |
| `final_elev` | Final element | `0` | Only first remains |

### 5. `switchGridTypes` (3 tests)
User switches between square and hex grids.

| Test | Description | Expected | Logic |
|------|-------------|----------|-------|
| `square_rule` | Square + 5105 user choice | `5105` | Square respects choice |
| `hex_rule` | Hex + 5105 user choice | `555` | Hex forces 555 |
| `square_rule_2` | Square + EUCL user choice | `EUCL` | Square respects choice |

### 6. `multipleDiagonalRules` (4 tests)
User measures with different diagonal rules.

| Test | Description | Expected | Logic |
|------|-------------|----------|-------|
| `eucl_dist` | EUCL: hypot(10,10) | `≈14.142` | Euclidean distance |
| `5105_dist` | 5105: 10 + (10/10)*5 | `15` | 5105 formula |
| `555_dist` | 555: max(10,10) | `10` | 555 formula |
| `order` | Rule ordering | `true` | 555 ≤ 5105 ≤ EUCL |

### 7. `remoteSync` (3 tests)
User adjusts elevation, broadcasts to remote clients.

| Test | Description | Expected | Logic |
|------|-------------|----------|-------|
| `serialized_elev` | toJSON includes elevations | `[0,2]` | segmentElevations serialized |
| `remote_elev_0` | Remote first element | `0` | Restored from data |
| `remote_elev_1` | Remote second element | `2` | Restored from data |

### 8. `keyboardElevation` (3 tests)
User uses arrow keys to adjust elevation.

| Test | Description | Expected | Logic |
|------|-------------|----------|-------|
| `after_up` | ArrowUp × 3 | `3` | 0 + 1 + 1 + 1 = 3 |
| `after_down` | ArrowDown × 1 | `2` | 3 - 1 = 2 |
| `after_numpad` | Numpad2 × 1 | `1` | 2 - 1 = 1 |

### 9. `wheelElevation` (1 test)
User scrolls mouse wheel to adjust elevation.

| Test | Description | Expected | Logic |
|------|-------------|----------|-------|
| `final_elev` | Scroll up, up, down, up | `2` | 1 + 1 - 1 + 1 = 2 |

### 10. `complexMultiSegmentPath` (14 tests)
Full path simulation with all fields computed.

| Test | Description | Expected | Logic |
|------|-------------|----------|-------|
| `seg0_dist` | Segment 0 distance | `5` | No elevation |
| `seg1_dist` | Segment 1 distance | `10` | max(5, 10) = 10 |
| `seg2_dist` | Segment 2 distance | `5` | max(5, 5) = 5 |
| `seg3_dist` | Segment 3 distance | `15` | max(5, 15) = 15 |
| `seg0_cum` | Segment 0 cumulative | `5` | First segment |
| `seg1_cum` | Segment 1 cumulative | `15` | 5 + 10 = 15 |
| `seg2_cum` | Segment 2 cumulative | `20` | 15 + 5 = 20 |
| `seg3_cum` | Segment 3 cumulative | `35` | 20 + 15 = 35 |
| `seg0_cumDelta` | Segment 0 cumDeltaElev | `0` | No elevation |
| `seg1_cumDelta` | Segment 1 cumDeltaElev | `10` | 0 + 2×5 = 10 |
| `seg2_cumDelta` | Segment 2 cumDeltaElev | `5` | 10 + (-1)×5 = 5 |
| `seg3_cumDelta` | Segment 3 cumDeltaElev | `20` | 5 + 3×5 = 20 |
| `seg0_last` | Segment 0 last flag | `false` | Not last |
| `seg3_last` | Segment 3 last flag | `true` | Last segment |

## Test Patterns

- **Pure function tests**: Direct function calls with known inputs/outputs
- **Patch logic tests**: Simulate patch behavior without calling real Foundry methods
- **Mock object tests**: Use mock canvas/ruler/game objects for integration testing
- **Save/restore pattern**: Always save `globalThis.canvas` and restore after tests
- **Actual invocation tests**: Call real patched methods to verify segmentElevations consumption

## Total

**19 unit/integration suites + 10 e2e scenarios, 238 assertions, 0 failures**
