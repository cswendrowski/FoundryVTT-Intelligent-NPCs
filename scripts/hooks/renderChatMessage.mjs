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
    const sender = html.find(".message-sender");
    let toAppend = "";

    const mood = message.flags["intelligent-npcs"]?.mood;
    if ( mood ) {
        toAppend += ` <i>(${mood})</i>`;
    }

    const targetName = message.flags["intelligent-npcs"]?.targetName;
    if ( targetName ) {
        toAppend +=` ➡ ${targetName}`;
    }

    sender.append(toAppend);
    sender[0].dataset.tooltip = sender[0].innerHTML;
}
