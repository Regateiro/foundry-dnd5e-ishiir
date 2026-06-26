export class GroupCheckManager {
  static activeCheck = null;

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
    await game.settings.set("dnd5e", "activeGroupCheck", GroupCheckManager.activeCheck);
    Hooks.callAll("dnd5e.groupCheckRefresh");
  }

  /* -------------------------------------------------- */

  static async updateResult(actorId, newTotal) {
    if ( !GroupCheckManager.activeCheck ) return;
    if ( !game.user.isGM ) return;
    if ( GroupCheckManager.activeCheck.results[actorId] ) {
      GroupCheckManager.activeCheck.results[actorId].total = newTotal;
      await game.settings.set("dnd5e", "activeGroupCheck", GroupCheckManager.activeCheck);
    }
  }

  /* -------------------------------------------------- */

  static async removeResult(actorId) {
    if ( !GroupCheckManager.activeCheck ) return;
    if ( !game.user.isGM ) return;
    if ( !GroupCheckManager.activeCheck.results[actorId] ) return;
    delete GroupCheckManager.activeCheck.results[actorId];
    await game.settings.set("dnd5e", "activeGroupCheck", GroupCheckManager.activeCheck);
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
