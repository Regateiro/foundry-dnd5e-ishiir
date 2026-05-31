# Group Checks — How It Works

1. GM clicks the Group Check button in the top canvas toolbar (Token tools) → a window opens
2. GM picks a skill from the dropdown (e.g. Stealth) and clicks Start Check
3. GM tells players "roll Stealth" however they want (voice, chat, etc.)
4. Players click Stealth on their sheet as normal — the roll dialog, chat message, everything works the same
5. Behind the scenes: the system silently captures the first Stealth roll per actor and sends the total to the GM
6. The GM's window fills in live: actor name + roll total for each participant
7. GM can click any roll to edit it (if someone forgot a bonus or needs a fix)
8. GM clicks End Check whenever ready
9. A chat card is posted: all participants listed, their individual rolls, the sum, and the averaged result
10. The window closes. The feature is ready for next use.

NPCs work the same way — whoever controls the NPC rolls their skill and it gets captured.

That's the full flow. No player-side UI changes, no extra buttons, no new dialogs for anyone but the GM.

## Known Limitations

- **No NPC mass-roll shortcut**: GMs running multiple identical NPCs (e.g. 5 goblins) must click each NPC sheet individually to roll. A bulk-roll feature is out of scope for v1.
