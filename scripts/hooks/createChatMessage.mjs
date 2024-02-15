const DEBUG = false;
const LOW_MESSAGE_WARNING = 20;
let LOW = false;
let OUT = false;
let NEEDS_KEY = false;

/* -------------------------------------------- */

export async function callApi(url, body) {

    if ( NEEDS_KEY ) {
        throw new Error("Set a valid API Key");
    }
    if ( OUT ) {
        throw new Error("Out of messages");
    }

    const apiKey = game.settings.get("intelligent-npcs", "apiKey");
    const apiUrl = (DEBUG ? "http://localhost:7245/api/" : "https://intelligentnpcs.azurewebsites.net/api/") + url +
        '?code=I_ZasRU0hlvW5Q8y7zzYl4ZLnc3S8F9roA6H0I-idQuuAzFuUd5Srw==&clientId=module';
    const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "x-version": "1.0.0"
        },
        body: JSON.stringify(body)
    });

    // If this is a 401, the user needs to set their API key
    if ( response.status === 401 ) {
        ui.notifications.error("You need to set your Intelligent NPCs API key in the module settings.", {permanent: true});
        NEEDS_KEY = true;
        throw new Error("No API key");
    }

    // If this is a 403, the API key is valid but not active
    else if ( response.status === 403 ) {
        ui.notifications.error("Your Intelligent NPCs API key is not active. Please consider supporting the module on Patreon at https://www.patreon.com/ironmoose.", {permanent: true});
        NEEDS_KEY = true;
        throw new Error("API key not active");
    }

    // If this is a 404, the API key is not valid
    else if ( response.status === 404 ) {
        ui.notifications.error("Your Intelligent NPCs API key is invalid. Please double check your entry.", {permanent: true});
        NEEDS_KEY = true;
        throw new Error("Invalid API key");
    }

    // If this is a 429, we've run out of messages
    else if ( response.status === 429 ) {
        ui.notifications.error("You have run out of messages for Intelligent NPCs. Please consider supporting the module on Patreon at a higher tier for additional requests.", {permanent: true});
        OUT = true;
        throw new Error("Out of messages");
    }

    // If this is a 503, the API is overloaded
    else if ( response.status === 503 ) {
        ui.notifications.error("The Intelligent NPCs API is overloaded. Please try again in a short bit.");
        throw new Error("API overloaded");
    }

    // Read headers
    const remaining = response.headers.get("x-monthly-requests-remaining");
    if ( !LOW && remaining && (parseInt(remaining) <= LOW_MESSAGE_WARNING) ) {
        LOW = true;
        ui.notifications.warn("You are running low on messages for Intelligent NPCs. Please consider supporting the module on Patreon at a higher tier for additional requests.", {permanent: true});
    }

    // Read response as plaintext
    const messageContent = await response.text();
    return messageContent;
}

/* -------------------------------------------- */

export async function getConfig(npc) {
    if ( !npc ) return {};
    const actorConfig = npc.flags["intelligent-npcs"];
    const pageId = npc.getFlag("intelligent-npcs", "journalPage");
    const journal = game.journal.find(journalEntry => journalEntry.pages.get(pageId));
    if ( !journal ) return actorConfig;
    const page = journal.pages.get(pageId);
    const selectedPageConfig = page?.flags["intelligent-npcs"] ?? {};
    const config = {
        ...selectedPageConfig
    };
    if ( actorConfig.summary ) config.summary = actorConfig.summary;
    if ( actorConfig.appearance ) config.appearance = actorConfig.appearance;
    if ( actorConfig.messageHistory ) config.messageHistory = actorConfig.messageHistory;
    if ( actorConfig.memory ) config.memory = actorConfig.memory;

    if ( page.name !== npc.name ) {
        config.summary = config.summary.replace(new RegExp(page.name, "g"), npc.name);
        config.appearance = config.appearance.replace(new RegExp(page.name, "g"), npc.name);
        config.background = config.background.replace(new RegExp(page.name, "g"), npc.name);
        config.personality = config.personality.replace(new RegExp(page.name, "g"), npc.name);
        config.goals = config.goals.replace(new RegExp(page.name, "g"), npc.name);
        if ( config.connections ) config.connections = config.connections.replace(new RegExp(page.name, "g"), npc.name);
        config.exampleSentence = config.exampleSentence.replace(new RegExp(page.name, "g"), npc.name);
    }

    delete config.name;
    return config;
}

/* -------------------------------------------- */

async function chatCompletion(npc, message, scene) {
    const allTokenNames = scene.tokens.map(t => t.name);
    const sceneContext = scene.getFlag("intelligent-npcs", "sceneInfo") || "";
    const config = await getConfig(npc);
    // If the speaker has a summary, load it
    const speakerToken = scene.tokens.get(message.speaker.token);
    const speakerConfig = await getConfig(speakerToken?.actor);
    const speakerSummary = speakerConfig?.summary ?? "";
    const speakerAppearance = speakerConfig?.appearance ?? "";

    let body = {
        "name": npc.name,
        "message": message.content,
        "tokenNames": allTokenNames,
        "speaker": message.speaker.alias ?? (message.user.isGM ? "GM" : "Unknown"),
        "speakerSummary": speakerSummary,
        "speakerAppearance": speakerAppearance,
        "sceneContext": sceneContext,
        ...config
    };
    const model = game.settings.get("intelligent-npcs", "model");
    body.model = model;

    if ( game.settings.get("intelligent-npcs", "sameSceneContext") && canvas?.scene ) {
        const sameSceneMessages = game.messages.filter(m => m.type === CONST.CHAT_MESSAGE_TYPES.IC && m.speaker &&
            m.speaker.scene == canvas.scene.id && m.speaker.alias !== npc.name);
        // Take only the last 10 messages
        const sameSceneMessagesSlice = sameSceneMessages.slice(-10);
        const sameSceneMessageContent = sameSceneMessagesSlice.map(message => {
            const content = `Speaker: ${message.speaker.alias ?? "Unknown"} Message:<p>${message.content}</p>`;
            return content;
        });
        body.sameSceneMessages = sameSceneMessageContent;
    }

    const response = await callApi("ChatCompletion", body);
    return response;
}

/* -------------------------------------------- */

function newCoreMemory(npc, messageHistory) {

    // If messageHistory is less than 5, don't update memory
    if ( messageHistory.length < 5 ) return;

    // Ask GPT to update memory with the purged messages
    const currentMemory = npc.flags["intelligent-npcs"]?.memory || "";

    console.log("Forming new core memory");
    callApi("CoreMemory", {
        "memory": currentMemory,
        "messageHistory": messageHistory
    }).then(memory => {
        //console.dir(memory);
        npc.setFlag("intelligent-npcs", "memory", memory);
    });
}

/* -------------------------------------------- */

function manageMemory(npc, messageHistory) {
    const maxHistoryLength = 12;
    const keepFirst = 2;
    const keepLast = 6;
    if ( messageHistory.length > maxHistoryLength ) {
        newCoreMemory(npc, messageHistory);
        messageHistory.splice(keepFirst, keepLast);
    }

    // Start a timer - if 30 seconds pass without managingMemory, form a new coreMemory
    if ( npc.manageMemoryTimer ) clearTimeout(npc.manageMemoryTimer);
    npc.manageMemoryTimer = setTimeout(() => {
        newCoreMemory(npc, messageHistory);
    }, 30 * 1000);
}

/* -------------------------------------------- */

export async function createAiResponse(targetedNpc, message, messageHistory) {
    // Create a chat message to indicate that processing is happening
    const thinkingMessage = await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({actor: targetedNpc}),
        content: `<i class="fa-duotone fa-thought-bubble fa-beat-fade"></i> Thinking...`,
        type: CONST.CHAT_MESSAGE_TYPES.IC,
        flags: {
            vino: {
                skip: true
            }
        }
    });
    try {
        await respondAsAI(targetedNpc, message, messageHistory, thinkingMessage);
    } catch (err) {
        console.error(err);
        thinkingMessage.delete();

        if (err.message !== "Out of messages") {
            // Create a GM-only chat message to indicate that processing failed
            // Attach flag data of the request to allow for retry
            const flagData = {
                "message": message,
                "messageHistory": messageHistory,
                "targetedNpc": targetedNpc
            }
            await ChatMessage.create({
                content: `<i class="fa-solid fa-cloud-exclamation"></i> Processing failed. Check console for details. <button class="inpc-retry-message"><i class="fa-solid fa-arrow-right-from-bracket"></i> Retry</button>`,
                type: CONST.CHAT_MESSAGE_TYPES.OOC,
                whisper: game.users.filter(u => u.isGM).map(u => u._id),
                flags: {
                    "intelligent-npcs": flagData
                }
            });
        }
    }
}

export async function createChatMessage(message, options, userId) {

    // If the user is not the first GM, return
    if ( !this.firstGM ) this.firstGM = game.users.find(u => u.isGM && u.active);
    if ( game.user !== this.firstGM ) return;

    const scene = game.scenes.get(message.speaker.scene ?? canvas.scene._id);

    //console.dir(message);

    if ( message.content.includes("Thinking...") ) return;
    if ( message.content.includes("Processing failed.") ) return;

    // If the message is OOC or a Roll, return
    if ( message.type === CONST.CHAT_MESSAGE_TYPES.OOC || message.type === CONST.CHAT_MESSAGE_TYPES.ROLL ) return;

    // Get the user who created the message
    const user = message.user;

    // If the message flags have a target, prefer that
    let targetedToken = null;
    if ( message.flags && message.flags["intelligent-npcs"] ) {
        if ( message.flags["intelligent-npcs"].target ) {
            targetedToken = scene.tokens.get(message.flags["intelligent-npcs"].target);
        }
        if ( message.flags["intelligent-npcs"].endConversation ) {
            return;
        }
    }
    if ( !targetedToken ) {
        // Get the user's targeted tokens
        const tokens = user.targets.size ? Array.from(user.targets) : null;
        if ( !tokens ) return;
        targetedToken = tokens[0];
    }
    const targetedNpc = targetedToken?.actor;

    // If the target is not an AI, return
    const aiNpcs = scene.tokens.filter(t => t.actor?.flags["intelligent-npcs"]?.enabled === true).map(t => t.actor._id);
    const speakerIsTarget = targetedNpc._id === message.speaker.actor;
    if (!aiNpcs.includes(targetedNpc._id) || speakerIsTarget) return;

    // get the message history from the npc flags
    const messageHistory = targetedNpc.getFlag("intelligent-npcs", "messageHistory") || [];

    // Add this message to the message history as a user message. If the message is a GM whisper, interpret it as a command
    let content = "";
    if ( message.type === CONST.CHAT_MESSAGE_TYPES.WHISPER && message.user.isGM ) {
        content = `${message.content}`;
    }
    else {
        content = `Speaker: ${message.speaker.alias ?? "Unknown"} Message:<p>${message.content}</p>`;
    }
    messageHistory.push({
        "role": "user",
        "content": content
    });
    await createAiResponse(targetedNpc, message, messageHistory);
}

/* -------------------------------------------- */

function parseAsJson(messageContent) {
    //console.dir(messageContent);
    const parsedMessageContent = JSON.parse(messageContent);

    // Replace even numbers of * with <i> tags
    // let seen = 0;
    // content = content.replace(/\*/g, (match, offset, string) => {
    //     seen++;
    //     return (seen % 2) ? "<i>" : "</i>";
    // });

    let responseData = {
        response: parsedMessageContent.content,
        mood: parsedMessageContent.mood,
        target: parsedMessageContent.target,
        endConversation: parsedMessageContent.endConversation
    }

    // Parse trailing , from mood and response
    if (responseData.mood.endsWith(",")) {
        responseData.mood = responseData.mood.slice(0, -1);
    }
    if (responseData.response.endsWith(",")) {
        responseData.response = responseData.response.slice(0, -1);
    }

    return responseData;
}

/* -------------------------------------------- */

function parseStructuredText(text) {
    const responseRegex = /\[RESPONSE\]: ([\s\S]+?)(?=\[|$)/i;
    const moodRegex = /\[MOOD\]: ([\s\S]+?)(?=\[|$)/i;
    const endConversationRegex = /\[END_CONVERSATION\]: ([\s\S]+?)(?=\[|$)/i;
    const targetRegex = /\[TARGET\]: ([\s\S]+?)(?=\[|$)/i;

    const responseMatch = text.match(responseRegex);
    const moodMatch = text.match(moodRegex);
    const endConversationMatch = text.match(endConversationRegex);
    const targetMatch = text.match(targetRegex);

    let response = responseMatch ? responseMatch[1].trim() : '';

    // If we have an open <i> without a closing </i> before a " or a new line, close it
    response = response.replace(/<i>([^<]*?["\n])/g, "<i>$1</i>");

    let mood = moodMatch ? moodMatch[1].trim() : '';
    // Clean any html out of mood
    mood = mood.replace(/(<([^>]+)>)/gi, "");
    const endConversation = endConversationMatch ? (endConversationMatch[1].trim().toLowerCase() === 'true') : false;
    const target = targetMatch ? targetMatch[1].trim() : '';

    return {
        response,
        mood,
        endConversation,
        target,
    };
}

/* -------------------------------------------- */

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/* -------------------------------------------- */

async function respondAsAI(targetedNpc, message, messageHistory, thinkingMessage) {
    const scene = game.scenes.get(message.speaker.scene ?? canvas.scene._id);

    // Start a timer, if we take longer than 5 seconds, tell the user we are taking longer than expected
    const timer = setTimeout(() => {
        thinkingMessage.update({
            content: `<i class="fa-duotone fa-thought-bubble fa-beat-fade"></i> Thinking... (Taking longer than expected)`
        });
    }, 5000);

    const messageContent = await chatCompletion(targetedNpc, message, scene);

    // Clear the timer
    clearTimeout(timer);

    // Parse message content as json
    let content = "";
    let mood = "";
    let target = null;
    let endConversation = false;
    try {
        const parsedMessageContent = parseAsJson(messageContent);
        //const parsedMessageContent = parseStructuredText(messageContent);
        //console.dir(parsedMessageContent);
        content = parsedMessageContent.response;
        mood = parsedMessageContent.mood;

        if (parsedMessageContent.target) {
            target = scene.tokens.find(t => t.name === parsedMessageContent.target);
        }
        if (parsedMessageContent.endConversation) {
            endConversation = parsedMessageContent.endConversation;
        }
    } catch (e) {
        content = messageContent;
    }

    // Add this message to the message history as an assistant message
    messageHistory.push({
        "role": "assistant",
        "content": `[RESPONSE]: ${content}\n[MOOD]: ${mood}\n[END_CONVERSATION]: ${endConversation}\n[TARGET]: ${target?.name ?? ""}`
    });

    manageMemory(targetedNpc, messageHistory);

    // Update the npc's message history
    await targetedNpc.setFlag("intelligent-npcs", "messageHistory", messageHistory);

    // If the NPC we are targeting is the same as the speaker who just spoke to us, increase the backAndForthLength
    let backAndForthLength = message.flags?.["intelligent-npcs"]?.backAndForthLength || 0;
    if (target?.name === message.speaker.alias) {
        backAndForthLength++;

        const backAndForthDelay = game.settings.get("intelligent-npcs", "backAndForthDelay");
        if ( backAndForthDelay > 0 ) {
            const delayAmount = Math.floor(message.content.split(" ").length / backAndForthDelay) * 1000;
            thinkingMessage.update({
                content: `<i class="fa-duotone fa-thought-bubble fa-beat-fade"></i> Responding...`
            });
            await delay(delayAmount);
        }
    } else {
        backAndForthLength = 0;
    }
    const maxBackAndForthLength = game.settings.get("intelligent-npcs", "maxBackAndForthLength");

    thinkingMessage.delete();
    try {
        const targetedToken = canvas.scene.tokens.find(t => t.actorId == targetedNpc.id);
        canvas.hud.bubbles.broadcast(targetedToken, content, {});
    }
    catch (e) {
    }

    if ( game.modules.get("acd-talking-actors")?.active && game.settings.get("intelligent-npcs", "talkingActorsEnabled") ) {
        const copy = game.talkingactors.connector.postToChat;
        game.talkingactors.connector.postToChat = (chatData, flavor, messageText) => {
        };
        game.talkingactors.connector.processChatMessage(null, "/talk " + content, {
            speaker: ChatMessage.getSpeaker({actor: targetedNpc})
        });
        game.talkingactors.connector.postToChat = copy;
    }
    return ChatMessage.create({
        speaker: ChatMessage.getSpeaker({actor: targetedNpc}),
        content: `<div>${content}</div>`,
        type: CONST.CHAT_MESSAGE_TYPES.IC,
        flags: {
            vino: {
                mood: mood,
                skipAutoQuote: true
            },
            "intelligent-npcs": {
                target: target?._id,
                targetName: target?.name,
                endConversation: backAndForthLength > maxBackAndForthLength ? true : endConversation,
                backAndForthLength: backAndForthLength,
                mood: mood
            }
        }
    });
}
