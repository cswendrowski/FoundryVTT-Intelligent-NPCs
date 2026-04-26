import IntelligentNpcsBrowser from "../apps/IntelligentNpcsBrowser.mjs";

export async function renderJournalEntryDirectory(app, html, data) {
    if (!game.user.isGM) return;
    const $html = html instanceof HTMLElement ? $(html) : html;

    // Add a "Browse Intelligent NPCs" button to header-actions
    const intelligentNpcsButton = $(`<button id="intelligent-npcs-btn" data-action="intelligent-npcs" data-tooltip="Browse and import free pre-made Intelligent NPCs from the catalog."><i class="fas fa-list-timeline"></i> iNpcs</button>`);
    $html.find('.header-actions').append(intelligentNpcsButton);

    intelligentNpcsButton.on('click', ev => {
        ev.preventDefault();
        ui.notifications.info("Loading Intelligent NPCs browser...");
        // Disable button
        intelligentNpcsButton.attr("disabled", true);
        new IntelligentNpcsBrowser().render(true);
    });
}
