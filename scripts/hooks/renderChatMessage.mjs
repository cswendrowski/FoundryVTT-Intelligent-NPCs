import {createAiResponse} from "./createChatMessage.mjs";

export async function renderChatMessage(message, html, data) {
    const $html = html instanceof HTMLElement ? $(html) : html;

    // Attach retry handler
    $html.find(".inpc-retry-message").on("click", async (event) => {
        // Get the flag data
        const flagData = message.flags["intelligent-npcs"];
        if ( !flagData ) return;

        const scene = game.scenes.get(flagData.message.speaker.scene);
        const npc = scene.tokens.find(t => t.actor?._id === flagData.targetedNpc._id)?.actor ??
            game.actors.get(flagData.targetedNpc._id);

        await message.delete();

        await createAiResponse(npc, flagData.message, flagData.messageHistory)
    });

    // find .message-sender and append the target's name
    const moodPosition = game.settings.get("intelligent-npcs", "moodPosition");
    const sender = $html.find(".message-sender");
    let toAppendToName = "";
    let toPrependToContent = "";

    const mood = message.flags["intelligent-npcs"]?.mood;
    if ( mood ) {
        if ( moodPosition === "inline" ) toAppendToName += ` <i>(${mood})</i>`;
        else toPrependToContent += `<i>${mood}</i>`;
    }

    const targetName = message.flags["intelligent-npcs"]?.targetName;
    if ( targetName ) {
        toAppendToName +=` ➡ ${targetName}`;
    }

    if ( toAppendToName ) {
        sender.append(toAppendToName);
        sender[0].dataset.tooltip = sender[0].innerHTML;
    }

    if ( moodPosition === "below" ) {
        $html.find(".message-content").prepend(`<b>${toPrependToContent}</b>`);
    }

    const flagData = message.flags["intelligent-npcs"];
    const messageContent = $html.find(".message-content");

    // GM-only: render the NPC's reasoning as a collapsible "thoughts" block.
    if ( game.user.isGM && flagData?.reasoning ) {
        const escaped = foundry.utils.escapeHTML?.(flagData.reasoning) ?? flagData.reasoning;
        messageContent.append(`
            <details class="inpc-reasoning">
                <summary><i class="fas fa-thought-bubble"></i> Thoughts (GM only)</summary>
                <p>${escaped}</p>
            </details>
        `);
    }

    // GM-only: render the NPC's GM-resolution request as an actionable card.
    if ( game.user.isGM && flagData?.gmResolutionRequest && !flagData?.gmResolutionResolved ) {
        const escapedAsk = foundry.utils.escapeHTML?.(flagData.gmResolutionRequest) ?? flagData.gmResolutionRequest;
        const card = $(`
            <div class="inpc-gm-resolution">
                <div class="inpc-gm-resolution-header">
                    <i class="fas fa-gavel"></i> NPC requests GM resolution
                </div>
                <div class="inpc-gm-resolution-ask">${escapedAsk}</div>
                <div class="inpc-gm-resolution-buttons">
                    <button class="inpc-gm-approve" data-action="approve"><i class="fas fa-check"></i> Approve</button>
                    <button class="inpc-gm-deny" data-action="deny"><i class="fas fa-times"></i> Deny</button>
                    <button class="inpc-gm-custom" data-action="custom"><i class="fas fa-pen"></i> Custom...</button>
                </div>
            </div>
        `);

        const handleResolution = async (outcomeText) => {
            const npc = flagData.npcId ? game.actors.get(flagData.npcId) : null;
            if ( !npc ) {
                ui.notifications.warn("Intelligent NPCs: could not find actor to record GM resolution.");
                return;
            }
            const history = npc.getFlag("intelligent-npcs", "messageHistory") ?? [];
            history.push({ role: "user", content: `Command: GM resolution for "${flagData.gmResolutionRequest}" — ${outcomeText}` });
            await npc.setFlag("intelligent-npcs", "messageHistory", history);
            await message.update({ "flags.intelligent-npcs.gmResolutionResolved": outcomeText });
            ui.notifications.info(`GM resolution recorded.`);
        };

        card.find('[data-action="approve"]').on("click", () => handleResolution(`Approved: ${flagData.gmResolutionRequest}`));
        card.find('[data-action="deny"]').on("click", () => handleResolution(`Denied: ${flagData.gmResolutionRequest}`));
        card.find('[data-action="custom"]').on("click", async () => {
            const outcome = await Dialog.prompt({
                title: "GM resolution outcome",
                content: `<p>${escapedAsk}</p><textarea name="outcome" rows="3" style="width:100%" placeholder="Describe what actually happens..."></textarea>`,
                callback: (html) => html.find('textarea[name="outcome"]').val()?.trim(),
                rejectClose: false,
            });
            if ( outcome ) await handleResolution(outcome);
        });

        messageContent.append(card);
    }

    // Show resolved outcome inline if already handled.
    if ( game.user.isGM && flagData?.gmResolutionResolved ) {
        const outcome = foundry.utils.escapeHTML?.(flagData.gmResolutionResolved) ?? flagData.gmResolutionResolved;
        messageContent.append(`<div class="inpc-gm-resolution-resolved"><i class="fas fa-gavel"></i> ${outcome}</div>`);
    }
}
