import AccountApp from "../apps/AccountApp.mjs";

export async function renderSettings(app, html) {
    if (!game.user.isGM) return;

    const accountStatusButton = $(`<button id="intelligent-npcs-account-status-btn" data-action="intelligent-npcs-account-status"><i class="fas fa-file-invoice"></i> Intelligent NPCs Account Status</button>`);
    html.find('button[data-action="players"]').after(accountStatusButton);

    accountStatusButton.on('click', ev => {
        ev.preventDefault();
        new AccountApp().render(true);
    });
}
