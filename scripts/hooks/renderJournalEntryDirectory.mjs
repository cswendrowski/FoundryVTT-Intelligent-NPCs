import IntelligentNpcsBrowser from "../apps/IntelligentNpcsBrowser.mjs";

export async function renderJournalEntryDirectory(app, html, data) {
    if (!game.user.isGM) return;
    const $html = html instanceof HTMLElement ? $(html) : html;

    // Add a "Browse Intelligent NPCs" button to header-actions
    const intelligentNpcsButton = $(`<button id="intelligent-npcs-btn" data-action="intelligent-npcs" data-tooltip="Browse and import free pre-made Intelligent NPCs from the catalog."><i class="fas fa-list-timeline"></i> iNpcs</button>`);
    const helpButton = $(`<button id="intelligent-npcs-help-btn" data-action="intelligent-npcs-help" data-tooltip="Quickstart guide and links."><i class="fas fa-circle-question"></i></button>`);
    $html.find('.header-actions').append(intelligentNpcsButton).append(helpButton);

    intelligentNpcsButton.on('click', ev => {
        ev.preventDefault();
        ui.notifications.info("Loading Intelligent NPCs browser...");
        // Disable button
        intelligentNpcsButton.attr("disabled", true);
        new IntelligentNpcsBrowser().render(true);
    });

    helpButton.on('click', ev => {
        ev.preventDefault();
        showQuickstartDialog();
    });
}

/**
 * Quickstart dialog — surfaces the basic onboarding steps and useful
 * links so a fresh GM doesn't have to leave Foundry to learn the
 * feature surface. Designed to fit one screen.
 */
function showQuickstartDialog() {
    const content = `
        <div class="inpc-quickstart" style="font-size: 0.95em;">
            <h2 style="margin-top: 0;"><i class="fas fa-thought-bubble"></i> Intelligent NPCs — Quickstart</h2>

            <h3 style="margin-bottom: 0.3em;">1. Set your API key</h3>
            <p style="margin-top: 0.2em;"><b>Game Settings → Configure Settings → Module Settings → Intelligent NPCs API Key</b>. Get a key by supporting <a href="https://www.patreon.com/ironmoose">@ironmoose on Patreon</a>. After setting, reload the world and click <b>Intelligent NPCs Account Status</b> on the Settings sidebar to verify.</p>

            <h3 style="margin-bottom: 0.3em;">2. Get an NPC</h3>
            <p style="margin-top: 0.2em;">Two paths:</p>
            <ul style="margin: 0.2em 0; padding-left: 1.4em;">
                <li><b>Import a pre-made NPC</b>: click the <b>iNpcs</b> button on this Journal sidebar. Pick one from the catalog, hit <b>Download</b>, then <b>Create Actor</b>.</li>
                <li><b>Make your own</b>: open any Actor, click the <b>⋮</b> menu in the sheet header → <b>Intelligent NPC</b> → <b>Create new page from this actor</b>. Edit the resulting journal page to set personality, background, and goals.</li>
            </ul>

            <h3 style="margin-bottom: 0.3em;">3. Chat with them</h3>
            <ul style="margin: 0.2em 0; padding-left: 1.4em;">
                <li>Drag the actor onto a scene to place a token.</li>
                <li><b>Target</b> the token (right-click → Target, or hold T).</li>
                <li>Type a message in chat <b>in-character</b>. The NPC will reply in character, with mood and emotes.</li>
                <li>To direct an NPC as the GM, <b>whisper to GMs</b> instead of speaking IC — your message becomes a <b>Command</b> the NPC follows.</li>
            </ul>

            <h3 style="margin-bottom: 0.3em;">4. Tier up for setpiece NPCs</h3>
            <p style="margin-top: 0.2em;">In the actor's <b>Intelligent NPC</b> dialog, switch <b>AI Model</b> from <i>World Default</i> to <i>Quality</i> for centerpiece characters (recurring villains, key NPCs). It costs more messages per turn but reasoning, voice, and consistency are noticeably better.</p>

            <h3 style="margin-bottom: 0.3em;">More</h3>
            <ul style="margin: 0.2em 0; padding-left: 1.4em;">
                <li><a href="https://github.com/cswendrowski/FoundryVTT-Intelligent-NPCs/wiki">Wiki</a> — full documentation</li>
                <li><a href="https://discord.gg/foundryvtt">Foundry Discord</a> — community help (#module-development for INPC questions)</li>
                <li><a href="https://www.patreon.com/ironmoose">Patreon</a> — API keys and roadmap</li>
            </ul>
        </div>
    `;
    new Dialog({
        title: "Intelligent NPCs — Quickstart",
        content: content,
        buttons: {
            close: {
                icon: '<i class="fas fa-check"></i>',
                label: "Got it",
                callback: () => {},
            },
        },
        default: "close",
    }, { width: 640 }).render(true);
}
