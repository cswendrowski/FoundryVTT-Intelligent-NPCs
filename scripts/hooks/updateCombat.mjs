import {callApi, getConfig} from "./createChatMessage.mjs";

export async function updateCombat(combat, updateData, options) {
    if ( !game.settings.get("intelligent-npcs", "combatBanterEnabled") ) return;
    if ( !updateData.round && !updateData.turn ) return;
    let currentCombatant = combat.combatant;

    // If the user is not the first GM, return
    if ( !this.firstGM ) this.firstGM = game.users.find(u => u.isGM && u.active);
    if ( game.user !== this.firstGM ) return;

    // If the combatant is not an AI, return
    let npc = currentCombatant.actor;
    if ( !npc?.flags["intelligent-npcs"]?.enabled ) return;

    // If the combatant is defeated, return
    if ( currentCombatant.defeated ) return;

    // get the message history from the npc flags
    const messageHistory = npc.getFlag("intelligent-npcs", "messageHistory") || [];

    await createAiResponse(npc, combat, messageHistory);
}

/* -------------------------------------------- */

export async function updateCombatant(combatant, updateData, options, userId) {
    if ( !game.settings.get("intelligent-npcs", "combatBanterEnabled") ) return;
    if ( !updateData.defeated ) return;

    // If the user is not the first GM, return
    if ( !this.firstGM ) this.firstGM = game.users.find(u => u.isGM && u.active);
    if ( game.user !== this.firstGM ) return;

    // If the combatant is not an AI, return
    let npc = combatant.actor;
    if ( !npc?.flags["intelligent-npcs"]?.enabled ) return;

    // get the message history from the npc flags
    const messageHistory = npc.getFlag("intelligent-npcs", "messageHistory") || [];

    await createAiResponse(npc, combatant.parent, messageHistory, true);
}

/* -------------------------------------------- */

async function createAiResponse(npc, combat, messageHistory, defeated=false) {

    // Create a chat message to indicate that processing is happening
    const thinkingMessage = await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({actor: npc}),
        content: `<i class="fa-duotone fa-thought-bubble fa-beat-fade"></i> Thinking...`,
        type: CONST.CHAT_MESSAGE_TYPES.IC,
    });
    try {
        await respondAsAI(npc, combat, messageHistory, thinkingMessage, defeated);
    } catch (err) {
        console.error(err);
        thinkingMessage.delete();

        if (err.message !== "Out of messages") {
            // Create a GM-only chat message to indicate that processing failed
            // Attach flag data of the request to allow for retry
            const flagData = {
                "messageHistory": messageHistory,
                "targetedNpc": npc
            }
            await ChatMessage.create({
                content: `<i class="fa-solid fa-cloud-exclamation"></i> Processing failed. Check console for details.`,
                type: CONST.CHAT_MESSAGE_TYPES.OOC,
                whisper: game.users.filter(u => u.isGM).map(u => u._id),
                flags: {
                    "intelligent-npcs": flagData
                }
            });
        }
    }
}

/* -------------------------------------------- */

async function respondAsAI(npc, combat, messageHistory, thinkingMessage, defeated) {
    // Start a timer, if we take longer than 5 seconds, tell the user we are taking longer than expected
    const timer = setTimeout(() => {
        thinkingMessage.update({
            content: `<i class="fa-duotone fa-thought-bubble fa-beat-fade"></i> Thinking... (Taking longer than expected)`
        });
    }, 5000);

    const messageContent = await combatBark(npc, combat, defeated);
    //console.dir(messageContent);

    // Parse message content as json
    let content = "";
    let mood = "";
    try {
        const parsedMessageContent = parseAsJson(messageContent);
        //const parsedMessageContent = parseStructuredText(messageContent);
        //console.dir(parsedMessageContent);
        content = parsedMessageContent.response;
        mood = parsedMessageContent.mood;
    } catch (e) {
        console.error(e);
        content = messageContent;
    }

    // Clear the timer
    clearTimeout(timer);

    // Delete the thinking message
    thinkingMessage.delete();

    // Save the previous bark
    const previousBarks = combat.flags["intelligent-npcs"]?.barks || [];
    previousBarks.push(`Speaker: ${npc.name} Bark: ${messageContent}`);
    await combat.setFlag("intelligent-npcs", "barks", previousBarks);

    return ChatMessage.create({
        speaker: ChatMessage.getSpeaker({actor: npc}),
        content: `<div>${content}</div>`,
        type: CONST.CHAT_MESSAGE_TYPES.IC,
        flags: {
            vino: {
                mood: mood
            },
            "intelligent-npcs": {
                mood: mood
            }
        }
    });
}

/* -------------------------------------------- */

async function combatBark(npc, combat, defeated) {
    const allTokenNames = combat.combatants.map(t => t.name);
    const sceneContext = combat.scene?.getFlag("intelligent-npcs", "sceneInfo") || "";
    const config = await getConfig(npc);

    let previousBarks = "";
    for (const bark of combat.flags["intelligent-npcs"]?.barks || []) {
        previousBarks += bark + "\n";
    }

    let combatState = "";

    function attachBar(bar) {
        if ( !bar ) return;
        const value = bar.value;
        const max = bar.max;
        const attribute = bar.attribute;

        combatState += "\t" + attribute + ": " + value + "/" + max + "\n";
    }

    function attachBars(combatant) {
        const bar1 = combatant.token.getBarAttribute("bar1");
        const bar2 = combatant.token.getBarAttribute("bar2");
        attachBar(bar1);
        attachBar(bar2);
    }

    // If this combatant is hostile, flip the relative disposition for other tokens
    const token = npc.token ?? npc.prototypeToken;
    const flipDisposition = token?.disposition === CONST.TOKEN_DISPOSITIONS.HOSTILE;

    for ( const combatant of combat.combatants ) {
        // Skip the current combatant
        if ( combatant._id === combat.combatant._id ) continue;

        combatState += "Combatant: " + combatant.name + "\n";
        combatState += "\tDefeated: " + combatant.defeated + "\n";
        const token = combat.scene.tokens.get(combatant.tokenId);
        if ( token ) {
            // Get disposition
            let dispositionValue = token.disposition;
            if ( flipDisposition ) dispositionValue *= -1;
            const disposition = Object.entries(CONST.TOKEN_DISPOSITIONS).find(e => e[1] === dispositionValue)[0];
            combatState += "\tDisposition: " + disposition + "\n";

            attachBars(combatant);
        }
        combatState += "\n\n";
    }

    // Attach info about self
    combatState += "Your Combat State: \n";
    attachBars(combat.combatant);
    if ( defeated ) combatState += "\tDefeated: true\n";

    //console.dir(combatState);

    const body = {
        "name": npc.name,
        "tokenNames": allTokenNames,
        "sceneContext": sceneContext,
        "combatState": combatState,
        "previousBarks": previousBarks,
        "defeated": defeated,
        ...config
    };
    const response = await callApi("CombatBark", body);
    return response;
}

/* -------------------------------------------- */

function parseAsJson(messageContent) {
    //console.dir(messageContent);
    const parsedMessageContent = JSON.parse(messageContent);

    return {
        response: parsedMessageContent.content,
        mood: parsedMessageContent.mood
    }
}
