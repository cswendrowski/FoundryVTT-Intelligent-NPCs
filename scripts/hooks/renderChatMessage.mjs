import {createAiResponse} from "./createChatMessage.mjs";

export async function renderChatMessage(message, html, data) {

    // Attach retry handler
    html.find(".inpc-retry-message").on("click", async (event) => {
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
    const sender = html.find(".message-sender");
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
        html.find(".message-content").prepend(`<b>${toPrependToContent}</b>`);
    }
}
