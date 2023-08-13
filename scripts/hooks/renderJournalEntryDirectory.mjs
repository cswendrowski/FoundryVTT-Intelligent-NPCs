import IntelligentNpcsBrowser from "../apps/IntelligentNpcsBrowser.mjs";

export async function renderJournalEntryDirectory(app, html, data) {
    if (!game.user.isGM) return;

    // Add a "Browse Intelligent NPCs" button to header-actions
    const intelligentNpcsButton = $(`<button id="intelligent-npcs-btn" data-action="intelligent-npcs"><i class="fas fa-list-timeline"></i> Intelligent NPCs</button>`);
    html.find('.header-actions').append(intelligentNpcsButton);

    intelligentNpcsButton.on('click', ev => {
        ev.preventDefault();
        ui.notifications.info("Loading Intelligent NPCs browser...");
        // Disable button
        intelligentNpcsButton.attr("disabled", true);
        new IntelligentNpcsBrowser().render(true);
    });
}
