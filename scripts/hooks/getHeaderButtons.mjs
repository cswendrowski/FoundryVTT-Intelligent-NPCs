import ActoriNpcConfiguration from "../apps/ActoriNpcConfiguration.mjs";

// Foundry v10–v12 ActorSheet (V1 Application) header buttons
export function getActorHeaderButtons(sheet, buttons) {

    if ( !sheet.object.canUserModify(game.user, "update") ) return;

    // Push a new button to the front of the list
    buttons.unshift({
        class: "configure-intelligent-npc",
        icon: "fas fa-thought-bubble",
        onclick: (event) => {
            let configurationApp = new ActoriNpcConfiguration(sheet.actor);
            configurationApp.render(true);
        },
        label: "Intelligent NPC"
    });
}

// Foundry v13+ ActorSheetV2 header controls (rendered in the toggleControls context menu)
export function getActorSheetV2HeaderControls(app, controls) {
    const actor = app.actor ?? app.document;
    if ( !actor?.canUserModify?.(game.user, "update") ) return;
    if ( controls.find(c => c.action === "configureIntelligentNpc") ) return;

    controls.unshift({
        action: "configureIntelligentNpc",
        icon: "fas fa-thought-bubble",
        label: "Intelligent NPC",
        onClick: () => {
            new ActoriNpcConfiguration(actor).render(true);
        }
    });
}
