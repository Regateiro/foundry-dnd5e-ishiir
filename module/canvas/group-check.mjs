export class GroupCheckManager {
  static activeCheck = null;

  /**
   * Handle for the pending debounced world-setting write, if any.
   * @type {number|null}
   */
  static #persistTimer = null;

  /* -------------------------------------------------- */

  /**
   * Schedule a debounced write of the active check to the world setting.
   *
   * PURPOSE: Keep the tally recoverable across a client reconnect without paying a world Setting
   * document write (DB round-trip plus a broadcast to every connected client) for every result.
   *
   * WHY NEEDED: A single group check can produce one result per participant, each of which
   * previously wrote the whole payload and re-rendered the GM's tally window. Intermediate
   * tallies have little durability value — clients reconstruct live state from the socket — so
   * coalescing the writes and flushing on end/cancel keeps that recovery path at roughly one
   * write per check instead of one per roll.
   */
  static #schedulePersist() {
    if ( GroupCheckManager.#persistTimer ) window.clearTimeout(GroupCheckManager.#persistTimer);
    GroupCheckManager.#persistTimer = window.setTimeout(() => GroupCheckManager.#flushPersist(), 2000);
  }

  /* -------------------------------------------------- */

  /**
   * Write any pending debounced update immediately, discarding the timer.
   *
   * PURPOSE: Guarantee the setting is current at the boundaries where it matters (end, cancel)
   * rather than up to the debounce interval stale.
   *
   * @returns {Promise<void>|void}
   */
  static #flushPersist() {
    if ( !GroupCheckManager.#persistTimer ) return;
    window.clearTimeout(GroupCheckManager.#persistTimer);
    GroupCheckManager.#persistTimer = null;
    return game.settings.set("dnd5e", "activeGroupCheck", GroupCheckManager.activeCheck);
  }

  /* -------------------------------------------------- */

  /**
   * Cancel a pending debounced write without performing it.
   *
   * PURPOSE: Stop a queued write from landing after the caller has already written the setting
   * to its final value, which would otherwise overwrite that value.
   */
  static #discardPendingPersist() {
    if ( !GroupCheckManager.#persistTimer ) return;
    window.clearTimeout(GroupCheckManager.#persistTimer);
    GroupCheckManager.#persistTimer = null;
  }

  /* -------------------------------------------------- */

  static async start(skillId) {
    if ( !game.user.isGM ) return;
    if ( GroupCheckManager.activeCheck ) {
      ui.notifications.warn("A group check is already in progress.");
      return;
    }
    const ability = CONFIG.DND5E.skills[skillId].ability;
    const checkId = foundry.utils.randomID();
    GroupCheckManager.activeCheck = { id: checkId, skill: skillId, ability, results: {} };
    Hooks.callAll("dnd5e.groupCheckRender");
    await game.settings.set("dnd5e", "activeGroupCheck", GroupCheckManager.activeCheck);
    game.socket.emit("system.dnd5e", { operation: "start", checkId, skill: skillId, ability });
    Hooks.callAll("dnd5e.groupCheckStart", GroupCheckManager.activeCheck);
  }

  /* -------------------------------------------------- */

  static async submitResult(actorId, actorName, total) {
    if ( !GroupCheckManager.activeCheck ) return;
    if ( !game.user.isGM ) return;
    if ( GroupCheckManager.activeCheck.results[actorId] ) return;
    GroupCheckManager.activeCheck.results[actorId] = { name: actorName, total };
    GroupCheckManager.#schedulePersist();
    Hooks.callAll("dnd5e.groupCheckRefresh");
  }

  /* -------------------------------------------------- */

  static async updateResult(actorId, newTotal) {
    if ( !GroupCheckManager.activeCheck ) return;
    if ( !game.user.isGM ) return;
    const result = GroupCheckManager.activeCheck.results[actorId];
    // Skip no-op writes: re-submitting an unchanged total has no effect worth persisting or
    // re-rendering for.
    if ( !result || result.total === newTotal ) return;
    result.total = newTotal;
    GroupCheckManager.#schedulePersist();
  }

  /* -------------------------------------------------- */

  static async removeResult(actorId) {
    if ( !GroupCheckManager.activeCheck ) return;
    if ( !game.user.isGM ) return;
    if ( !GroupCheckManager.activeCheck.results[actorId] ) return;
    delete GroupCheckManager.activeCheck.results[actorId];
    GroupCheckManager.#schedulePersist();
    Hooks.callAll("dnd5e.groupCheckRefresh");
  }

  /* -------------------------------------------------- */

  static async end() {
    if ( !GroupCheckManager.activeCheck ) return;
    if ( !game.user.isGM ) return;
    const entries = Object.values(GroupCheckManager.activeCheck.results);
    const count = entries.length;
    if ( count === 0 ) {
      ui.notifications.warn(game.i18n.localize("DND5E.GroupCheckNoParticipants"));
      return;
    }
    const sum = entries.reduce((acc, r) => acc + r.total, 0);
    const average = Math.floor(sum / count);
    const skillLabel = game.i18n.localize(CONFIG.DND5E.skills[GroupCheckManager.activeCheck.skill].label);
    const content = await renderTemplate("systems/dnd5e/templates/group-check/result-card.hbs", {
      skillLabel,
      entries: entries.map(e => ({ name: e.name, total: e.total })),
      average, sum, count
    });
    await ChatMessage.create({
      content,
      flavor: skillLabel,
      speaker: ChatMessage.getSpeaker({ alias: game.i18n.localize("DND5E.GroupCheck") })
    });
    game.socket.emit("system.dnd5e", { operation: "end", checkId: GroupCheckManager.activeCheck.id });

    // Drop any debounced write before clearing, so a queued timer cannot resurrect the setting
    // after it has been nulled out.
    GroupCheckManager.#discardPendingPersist();
    await game.settings.set("dnd5e", "activeGroupCheck", null);
    Hooks.callAll("dnd5e.groupCheckClose");
    Hooks.callAll("dnd5e.groupCheckEnd", GroupCheckManager.activeCheck);
    GroupCheckManager.activeCheck = null;
  }

  /* -------------------------------------------------- */

  static async cancel() {
    if ( !GroupCheckManager.activeCheck ) return;
    if ( !game.user.isGM ) return;
    const checkId = GroupCheckManager.activeCheck.id;
    game.socket.emit("system.dnd5e", { operation: "end", checkId });

    // Drop any debounced write before clearing, so a queued timer cannot resurrect the setting
    // after it has been nulled out.
    GroupCheckManager.#discardPendingPersist();
    await game.settings.set("dnd5e", "activeGroupCheck", null);
    Hooks.callAll("dnd5e.groupCheckClose");
    Hooks.callAll("dnd5e.groupCheckEnd", GroupCheckManager.activeCheck);
    GroupCheckManager.activeCheck = null;
  }

  /* -------------------------------------------------- */

  static restoreFromSetting(data) {
    if ( data && typeof data === "object" && data.id && data.skill && data.ability ) {
      GroupCheckManager.activeCheck = data;
      if ( game.user.isGM ) Hooks.callAll("dnd5e.groupCheckRender");
    } else {
      GroupCheckManager.activeCheck = null;
    }
  }

  /* -------------------------------------------------- */

  static async _onSocketMessage(data) {
    if ( !data || typeof data !== "object" ) return;
    switch ( data.operation ) {
      case "start":
        if ( game.user.isGM ) return;
        if ( !data.checkId || !data.skill || !data.ability ) return;
        GroupCheckManager.activeCheck = {
          id: data.checkId, skill: data.skill, ability: data.ability, results: {}
        };
        Hooks.callAll("dnd5e.groupCheckStart", GroupCheckManager.activeCheck);
        break;
      case "result":
        if ( !game.user.isGM ) return;
        if ( !data.actorId || typeof data.total !== "number" ) return;
        // Reject results tagged for a different check. A player who rolls at the moment the GM
        // ends one check and starts another would otherwise have that stale total recorded
        // against the new tally, since the emit side has no way to know the check was replaced.
        if ( data.checkId !== GroupCheckManager.activeCheck?.id ) return;
        await GroupCheckManager.submitResult(data.actorId, data.actorName, data.total);
        break;
      case "end":
        if ( game.user.isGM ) return;
        const endedCheck = GroupCheckManager.activeCheck;
        GroupCheckManager.activeCheck = null;
        Hooks.callAll("dnd5e.groupCheckEnd", endedCheck);
        break;
    }
  }

  /* -------------------------------------------------- */

  static async _onRollSkill(actor, roll, skillId) {
    const check = GroupCheckManager.activeCheck;
    if ( !check ) return;
    if ( skillId !== check.skill ) return;
    if ( check.results[actor.id] ) return;
    if ( !actor.testUserPermission(game.user, "OWNER") ) return;
    const total = roll.total;
    const actorName = actor.name;
    if ( game.user.isGM ) {
      await GroupCheckManager.submitResult(actor.id, actorName, total);
    } else {
      game.socket.emit("system.dnd5e", {
        operation: "result",
        checkId: check.id,
        actorId: actor.id,
        actorName,
        total
      });
    }
  }

  /* -------------------------------------------------- */

  static getActiveCheck() {
    return GroupCheckManager.activeCheck;
  }

  static isActive() {
    return GroupCheckManager.activeCheck !== null;
  }

  static getSkillLabel() {
    if ( !GroupCheckManager.activeCheck ) return "";
    return game.i18n.localize(CONFIG.DND5E.skills[GroupCheckManager.activeCheck.skill]?.label ?? "");
  }
}
