# Actor Tests

## Test Summary

| # | Function | Scenario |
|---|----------|----------|
| **Character** | | |
| 01 | `applyDamage_character` | Damage exceeding total HP + THP → both become zero. |
| 02 | `applyDamage_character` | Damage that only reduces THP, not HP. |
| 03 | `applyDamage_character` | Damage that uses up all THP and then reduces HP but not to zero. |
| 04 | `applyDamage_character` | Healing (negative damage) restores HP without exceeding max HP. |
| 05 | `applyDamage_character` | Healing beyond max HP caps at max HP. |
| 06 | `applyDamage_character` | Zero‑damage leaves all values unchanged. |
| 07 | `applyDamage_character` | Damage equal to THP – THP becomes zero, HP stays same. |
| 08 | `applyDamage_character` | Damage equal to HP (no THP) – both become zero. |
| 09 | `applyDamage_character` | Vulnerability multiplier (×2) – damage doubled, HP drops to zero. |
| 10 | `applyDamage_character` | Resistance multiplier (×0.5) – damage halved, HP reduced appropriately. |
| 11 | `applyDamage_character` | Fractional damage is floored before application. |
| 12 | `applyDamage_character` | Healing when THP present does **not** restore THP. |
| 13 | `applyDamage_character` | Damage applied when HP already at zero – remains zero. |
| 14 | `applyDamage_character` | Healing with a non‑zero `tempmax` – HP can exceed normal max up to `max + tempmax`. |
| 15 | `applyDamage_character` | Hook that returns `false` prevents any update. |
| 16 | `applyDamage_character` | Armor absorbs all damage when sufficient ahp – remaining armor, temporary HP and HP are unchanged. |
| 17 | `applyDamage_character` | Armor partially absorbs damage, rest goes to temporary HP and HP is unchanged. |
| 18 | `applyDamage_character` | Armor and temporary HP partially absorbs damage, rest goes to HP. |
| 19 | `applyDamage_character` | Armor insufficient, damage goes to temporary HP and then HP, but not below 0. |
| 20 | `applyDamage_character` | Armor with vulnerability multiplier (×2) – damage doubled, armor depleted, HP unaffected. |
| 21 | `applyDamage_character` | Armor with resistance multiplier (×0.5) – damage halved, armor depleted, HP unaffected. |
| 22 | `applyDamage_character` | Armor with fractional damage flooring – damage floored, armor depleted, HP reduced. |
| 23 | `applyDamage_character` | Armor exact depletion (damage equals AHP) – armor becomes zero, HP unaffected. |
| 24 | `applyDamage_character` | Armor + THP + HP all fully depleted – all become zero. |
| 25 | `applyDamage_character` | Healing does not restore armor HP – armor unchanged, HP restored. |
| 26 | `applyDamage_character` | Armor with tempmax healing ceiling – armor unchanged, HP reaches max + tempmax. |
| 27 | `applyDamage_character` | Armor when HP is already at 0 – armor absorbs damage, HP remains zero. |
| 28 | `applyDamage_character` | Armor exact depletion of armor + THP (no HP loss) – both become zero, HP unaffected. |
| 29 | `applyDamage_character` | Armor exact depletion of armor + THP + HP – all become zero. |
| 30 | `applyDamage_character` | Armor + vulnerability multiplier with THP combo – armor and THP depleted, HP unaffected. |
| **NPC** | | |
| 01 | `applyDamage_npc` | Damage exceeding total HP + THP + FP → all become zero. |
| 02 | `applyDamage_npc` | Damage uses up THP, then HP, then FP – final values as expected. |
| 03 | `applyDamage_npc` | Healing restores HP and THP but leaves FP unchanged. |
| 04 | `applyDamage_npc` | Damage that reduces FP to zero with no HP loss (THP already zero). |
| 05 | `applyDamage_npc` | Damage that reduces FP to zero while HP still above zero (THP present). |
| 06 | `applyDamage_npc` | Damage reduces HP to 1 after FP is already zero. |
| 07 | `applyDamage_npc` | Damage reduces HP to zero after FP is already zero. |
| 08 | `applyDamage_npc` | Zero‑damage leaves all values unchanged. |
| 09 | `applyDamage_npc` | Damage equal to THP – THP becomes zero, HP stays same. |
| 10 | `applyDamage_npc` | Damage equal to HP after THP triggers FP threshold – HP stops at threshold; FP absorbs remaining damage. |
| 11 | `applyDamage_npc` | Vulnerability multiplier (×2) when FP is present – similar behavior as test 10, but with doubled damage. |
| 12 | `applyDamage_npc` | Resistance multiplier (×0.5) with FP – damage halved; threshold logic applied. |
| 13 | `applyDamage_npc` | Fractional damage is floored before application. |
| 14 | `applyDamage_npc` | Healing when FP is depleted does not restore FP. |
| 15 | `applyDamage_npc` | Damage when both HP and FP are zero – remains zero. |
| 16 | `applyDamage_npc` | Healing with a non‑zero `tempmax` – HP can exceed normal max up to `max + tempmax`. |
| 17 | `applyDamage_npc` | Hook that returns `false` prevents any update. |
| 18 | `applyDamage_npc` | Threshold at 0 % – HP capped at 1; one point of damage is absorbed by FP (FP goes from 5 to 4). |
| 19 | `applyDamage_npc` | Threshold at 25% – HP stops at 3; remaining damage is absorbed by FP. |
| 20 | `applyDamage_npc` | Threshold at 75% – After FP depletion, HP ends up at 5 and FP is zero. |
| 21 | `applyDamage_npc` | Threshold at 100% – All damage first absorbed by FP until exhausted; remaining HP reduced to 5. |
| 22 | `applyDamage_npc` | Armor absorbs all damage when sufficient ahp – armor reduced, HP and FP unaffected. |
| 23 | `applyDamage_npc` | Armor partially absorbs, remainder goes to THP, no HP/FP loss. |
| 24 | `applyDamage_npc` | Armor + THP depleted, damage reaches HP but not FP threshold. |
| 25 | `applyDamage_npc` | Armor + THP + HP depleted to threshold, FP absorbs remainder. |
| 26 | `applyDamage_npc` | Armor + THP + HP + FP all fully depleted – all become zero. |
| 27 | `applyDamage_npc` | Armor with vulnerability multiplier (×2) – armor depleted, HP and FP unaffected. |
| 28 | `applyDamage_npc` | Armor with resistance multiplier (×0.5) – armor depleted, HP and FP unaffected. |
| 29 | `applyDamage_npc` | Armor with fractional damage flooring – damage floored, armor depleted, HP reduced. |
| 30 | `applyDamage_npc` | Armor exact depletion (damage equals AHP) – armor becomes zero, HP and FP unaffected. |
| 31 | `applyDamage_npc` | Healing does not restore armor HP – armor unchanged, HP restored, FP unchanged. |
| 32 | `applyDamage_npc` | Armor when HP and FP are already at 0 – armor absorbs damage, HP and FP remain zero. |
| 33 | `applyDamage_npc` | Armor + THP exact depletion (no HP/FP loss) – both become zero, HP and FP unaffected. |
| 34 | `applyDamage_npc` | Armor + THP + HP exact depletion to threshold (FP absorbs nothing) – FP unchanged. |
| 35 | `applyDamage_npc` | Armor + THP + HP + FP exact depletion – armor, THP, and FP become zero, HP at threshold. |
| 36 | `applyDamage_npc` | FP with vulnerability multiplier (without threshold trigger) – HP reduced, FP unaffected. |
| 37 | `applyDamage_npc` | FP with vulnerability multiplier triggering threshold – HP at threshold, FP reduced. |
| 38 | `applyDamage_npc` | FP with fractional damage flooring (multiplier) – damage floored, HP reduced, FP unaffected. |
| 39 | `applyDamage_npc` | HP at threshold, FP at 0, more damage goes below threshold – HP becomes zero. |
| 40 | `applyDamage_npc` | Threshold at 50% – HP stops at 5, FP absorbs remainder and is depleted. |
| 41 | `applyDamage_npc` | Threshold at 50% with more damage, HP goes below threshold after FP depleted – HP becomes zero. |
| 42 | `applyDamage_npc` | Armor + THP + HP + FP + tempmax healing ceiling – armor and FP unchanged, HP reaches max + tempmax. |

---

These tests exercise the full behaviour of `Actor.applyDamage` for both character and NPC actors, including edge cases such as zero damage, healing, fractional amounts, multipliers, threshold adjustments, and armor hit point interactions.
