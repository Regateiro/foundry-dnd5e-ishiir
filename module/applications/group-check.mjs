// NOTE: GroupCheckApplication ↔ GroupCheckManager is a circular import.
// ES live bindings make it safe ONLY if no cross-references at module scope.

import { GroupCheckManager } from "../canvas/group-check.mjs";

export default class GroupCheckApplication extends Application {
  static #instance = null;

  static getInstance() {
    if ( !GroupCheckApplication.#instance ) {
      GroupCheckApplication.#instance = new GroupCheckApplication();
    }
    return GroupCheckApplication.#instance;
  }

  /* -------------------------------------------------- */

  constructor() {
    super();
    Hooks.on("dnd5e.groupCheckStart", () => this.refresh());
    Hooks.on("dnd5e.groupCheckEnd", () => this.refresh());
  }

  /* -------------------------------------------------- */

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      template: "systems/dnd5e/templates/group-check/application.hbs",
      title: game.i18n.localize("DND5E.GroupCheck"),
      width: 400,
      height: "auto",
      popOut: true
    });
  }

  /* -------------------------------------------------- */

  render(force=false, options={}) {
    if ( !game.user?.isGM ) return this;
    return super.render(force, options);
  }

  /* -------------------------------------------------- */

  getData() {
    const check = GroupCheckManager.getActiveCheck();
    if ( !check ) {
      return {
        active: false,
        skills: Object.entries(CONFIG.DND5E.skills).map(([k, v]) => ({
          key: k, label: game.i18n.localize(v.label)
        }))
      };
    }
    const entries = Object.entries(check.results).map(([id, r]) => ({
      id, name: r.name, total: r.total
    }));
    return {
      active: true,
      skillLabel: game.i18n.localize(CONFIG.DND5E.skills[check.skill]?.label ?? ""),
      entries,
      count: entries.length,
      hasEntries: entries.length > 0
    };
  }

  /* -------------------------------------------------- */

  activateListeners(html) {
    super.activateListeners(html);
    html.find(".start-check").click(this._onStartCheck.bind(this));
    html.find(".end-check").click(this._onEndCheck.bind(this));
    html.find(".cancel-check").click(this._onCancel.bind(this));
    html.find("input[data-actor-id]").on("change blur", this._onEditResult.bind(this));
  }

  /* -------------------------------------------------- */

  _onStartCheck(event) {
    event.preventDefault();
    const skillId = this.element.find("select[name='skill']").val();
    if ( skillId ) GroupCheckManager.start(skillId);
  }

  /* -------------------------------------------------- */

  _onEndCheck(event) {
    event.preventDefault();
    GroupCheckManager.end();
  }

  /* -------------------------------------------------- */

  _onCancel(event) {
    event.preventDefault();
    GroupCheckManager.cancel();
  }

  /* -------------------------------------------------- */

  _onEditResult(event) {
    const actorId = event.currentTarget.dataset.actorId;
    const newTotal = Number(event.currentTarget.value);
    if ( actorId && !isNaN(newTotal) ) GroupCheckManager.updateResult(actorId, newTotal);
  }

  /* -------------------------------------------------- */

  refresh() {
    if ( this.rendered ) this.render(true);
  }
}
