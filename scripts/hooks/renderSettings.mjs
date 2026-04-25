import AccountApp from "../apps/AccountApp.mjs";

export async function renderSettings(app, html) {
    if (!game.user.isGM) return;
    const $html = html instanceof HTMLElement ? $(html) : html;

    const accountStatusButton = $(`<button id="intelligent-npcs-account-status-btn" data-action="intelligent-npcs-account-status"><i class="fas fa-file-invoice"></i> Intelligent NPCs Account Status</button>`);
    const playersBtn = $html.find('button[data-action="players"], button[data-app="players"]');
    if ( playersBtn.length ) playersBtn.after(accountStatusButton);
    else $html.find('button[data-action="openApp"]').last().after(accountStatusButton);

    accountStatusButton.on('click', ev => {
        ev.preventDefault();
        new AccountApp().render(true);
    });
}
