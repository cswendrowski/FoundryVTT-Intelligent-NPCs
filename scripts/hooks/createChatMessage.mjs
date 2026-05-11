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
    if ( actorConfig.whatEveryoneKnows ) config.whatEveryoneKnows = actorConfig.whatEveryoneKnows;
    if ( actorConfig.appearance ) config.appearance = actorConfig.appearance;
    if ( actorConfig.messageHistory ) config.messageHistory = actorConfig.messageHistory;
    if ( actorConfig.memory ) config.memory = actorConfig.memory;
    if ( actorConfig.goals ) config.goals = actorConfig.goals;
    if ( actorConfig.objectives ) config.objectives = actorConfig.objectives;

    if ( page.name !== npc.name ) {
        config.summary = config.summary.replace(new RegExp(page.name, "g"), npc.name);
        config.whatEveryoneKnows = config.whatEveryoneKnows.replace(new RegExp(page.name, "g"), npc.name);
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

async function chatCompletion(npc, targetedToken, message, scene) {
    const allTokenNames = scene.tokens.map(t => t.name);
    const sceneContext = scene.getFlag("intelligent-npcs", "sceneInfo") || "";
    const worldContext = game.world.flags["intelligent-npcs"]?.worldContext || "";
    const config = await getConfig(npc);

    // If the speaker has a summary, load it
    const speakerToken = scene.tokens.get(message.speaker.token);
    const speakerConfig = await getConfig(speakerToken?.actor);
    const speakerWhatEveryoneKnows = speakerConfig?.whatEveryoneKnows ?? "";
    const speakerAppearance = speakerConfig?.appearance ?? "";

    // Get the subarea context if it exists
    const subareaContext = getSubareaContext(scene, npc.token?._object);
    console.log(subareaContext);

    let combatState = "";

    function attachBar(bar) {
        if ( !bar ) return;
        const value = bar.value;
        const max = bar.max;
        const attribute = bar.attribute;

        combatState += "\t" + attribute + ": " + value + "/" + max + "\n";
    }

    function attachBars(token) {
        const bar1 = token.getBarAttribute("bar1");
        const bar2 = token.getBarAttribute("bar2");
        attachBar(bar1);
        attachBar(bar2);
    }

    // Attach info about self
    combatState += "Your Combat State: \n";
    attachBars(npc.token ?? npc.prototypeToken);

    // Discover all SFX this AI can use
    const playlistUuid = config.playlist;
    const sfxPlaylist = await fromUuid(playlistUuid);

    // Map them to UUID - name pairs
    const sfxMap = [];
    if (sfxPlaylist) {
        sfxPlaylist.sounds.forEach(sound => {
            sfxMap.push(`"${sound.name}"`);
        });
    }
    console.log(sfxMap);

    let body = {
        "name": npc.name,
        "message": message.content,
        "tokenNames": allTokenNames,
        "speaker": message.speaker.alias ?? ((message.author ?? message.user)?.isGM ? "GM" : "Unknown"),
        "speakerSummary": speakerWhatEveryoneKnows,
        "speakerAppearance": speakerAppearance,
        "sceneContext": sceneContext + "\n\n" + subareaContext,
        "worldContext": worldContext,
        "combatState": combatState,
        "sfx": sfxMap,
        "flag": "ai",
        ...config
    };
    const defaultModel = game.settings.get("intelligent-npcs", "model");
    const npcModel = npc.getFlag("intelligent-npcs", "model");
    if ( !npcModel || npcModel === "default" ) {
        body.model = defaultModel;
    }
    else {
        body.model = npcModel;
    }

    if ( game.settings.get("intelligent-npcs", "sameSceneContext") && canvas?.scene ) {
        const sameSceneMessages = game.messages.filter(m => (m.style ?? m.type) === (CONST.CHAT_MESSAGE_STYLES?.IC ?? 2) && m.speaker &&
            m.speaker.scene == canvas.scene.id && m.speaker.alias !== npc.name);
        // Take only the last 10 messages
        const sameSceneMessagesSlice = sameSceneMessages.slice(-10);
        const sameSceneMessageContent = sameSceneMessagesSlice.map(message => {
            const content = `Speaker: ${message.speaker.alias ?? "Unknown"} Message:<p>${message.content}</p>`;
            return content;
        });
        body.sameSceneMessages = sameSceneMessageContent;
    }

    body.experiment = game.settings.get("intelligent-npcs", "experiment");

    const response = await callApi("ChatCompletion", body);
    return response;
}

/* -------------------------------------------- */

function getSubareaContext(scene, token) {
    if ( !token ) return "";
    const { x, y } = token.center;
    let subareaContext = "";

    for (const drawing of scene.drawings) {
        const shape = drawing.shape;
        let inside = false;
        // Polygon
        if (shape.type === "p") {
            const points = shape.points;
            const polygon = new PIXI.Polygon(points);
            inside = polygon.contains((x - drawing.x), (y - drawing.y));
        }

        // Rectangle
        else if (shape.type === "r") {
            const startX = shape.parent.x;
            const startY = shape.parent.y;
            const points = [
                startX, startY,
                startX + shape.width, startY,
                startX + shape.width, startY + shape.height,
                startX, startY + shape.width
            ];
            const polygon = new PIXI.Polygon(points);
            inside = polygon.contains(x, y);
        }

        if (inside) {
            subareaContext += drawing.flags["intelligent-npcs"]?.drawingContext + "\n\n" || "";
        }
    }
    return subareaContext;
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
        "name": npc.name,
        "experiment": game.settings.get("intelligent-npcs", "experiment"),
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

export async function createAiResponse(targetedNpc, targetedToken, message, messageHistory) {
    // Create a chat message to indicate that processing is happening
    const thinkingMessage = await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({actor: targetedNpc}),
        content: `<i class="fa-duotone fa-thought-bubble fa-beat-fade"></i> Thinking...`,
        style: CONST.CHAT_MESSAGE_STYLES?.IC ?? CONST.CHAT_MESSAGE_TYPES.IC,
        flags: {
            vino: {
                skip: true
            }
        }
    });
    try {
        await respondAsAI(targetedNpc, targetedToken, message, messageHistory, thinkingMessage);
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
                style: CONST.CHAT_MESSAGE_STYLES?.OOC ?? CONST.CHAT_MESSAGE_TYPES.OOC,
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

    // Get the user who created the message (v13+ renamed `user` → `author`)
    const user = message.author ?? message.user;

    // If the message is OOC or a Roll, return — UNLESS it is a GM whisper.
    // In v14 the WHISPER chat style is gone (whispers are detected only via
    // `message.whisper?.length > 0`), and the GM "Private to Gamemasters"
    // selector often produces an OOC-style message. Letting GM whispers
    // through here is what enables the GM-direction Command path below.
    const messageStyle = message.style ?? message.type;
    const STYLES = CONST.CHAT_MESSAGE_STYLES ?? CONST.CHAT_MESSAGE_TYPES ?? {};
    const isGmWhisper = message.whisper?.length > 0 && user?.isGM;
    if ( !isGmWhisper && (messageStyle === STYLES.OOC || messageStyle === STYLES.ROLL || message.rolls?.length > 0) ) return;

    // If the message flags have a target, prefer that
    let targetedToken = null;
    if ( message.flags && message.flags["intelligent-npcs"] ) {
        if ( message.flags["intelligent-npcs"].target ) {
            targetedToken = scene.tokens.get(message.flags["intelligent-npcs"].target);
        }
        if ( message.flags["intelligent-npcs"].endConversation ) {
            return;
        }
        // If the speaker (an iNPC) just asked the GM for resolution, the
        // conversation is paused on the GM's call. Don't let the targeted
        // iNPC barrel ahead — it would either pre-empt the GM's ruling or
        // narrate around it. The GM's Approve/Deny/Custom click writes a
        // follow-up message that resumes the chain.
        if ( message.flags["intelligent-npcs"].gmResolutionRequest ) {
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
    const hidden = targetedNpc?.token?.hidden || targetedToken?.document?.hidden;
    if ( !aiNpcs.includes(targetedNpc._id) || speakerIsTarget || hidden ) return;

    // get the message history from the npc flags
    const messageHistory = targetedNpc.getFlag("intelligent-npcs", "messageHistory") || [];

    // Add this message to the message history as a user message. If the message is a GM whisper, interpret it as a command
    let content = "";
    if ( message.whisper?.length > 0 && user.isGM ) {
        content = `Command: ${message.content}`;
    }
    else {
        content = `Speaker: ${message.speaker.alias ?? "Unknown"} Message:<p>${message.content}</p>`;
    }
    messageHistory.push({
        "role": "user",
        "content": content
    });
    await createAiResponse(targetedNpc, targetedToken, message, messageHistory);
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

    // sfx is an array on the wire as of the side-effects rework. Older backends
    // emitted a string; tolerate both for one release.
    let sfx = parsedMessageContent.sfx;
    if ( typeof sfx === "string" ) sfx = sfx ? [sfx] : [];
    if ( !Array.isArray(sfx) ) sfx = [];

    let responseData = {
        response: parsedMessageContent.content,
        mood: parsedMessageContent.mood,
        target: parsedMessageContent.target,
        endConversation: parsedMessageContent.endConversation,
        sfx,
        reasoning: parsedMessageContent.reasoning ?? "",
        gmResolutionRequest: parsedMessageContent.gmResolutionRequest ?? null,
        memoryAppend: parsedMessageContent.memoryAppend ?? null,
        goals: parsedMessageContent.goals ?? null
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

async function respondAsAI(targetedNpc, targetedToken, message, messageHistory, thinkingMessage) {
    const scene = game.scenes.get(message.speaker.scene ?? canvas.scene._id);

    // If there is a "stop" command, end the conversation
    if ( game.world.flags["intelligent-npcs"]?.stopConversations ) {
        game.world.flags["intelligent-npcs"].stopConversations = false;
        return;
    }

    // Start a timer, if we take longer than 5 seconds, tell the user we are taking longer than expected
    const timer = setTimeout(() => {
        thinkingMessage.update({
            content: `<i class="fa-duotone fa-thought-bubble fa-beat-fade"></i> Thinking... (Taking longer than expected)`
        });
    }, 5000);

    const messageContent = await chatCompletion(targetedNpc, targetedToken, message, scene);

    // Clear the timer
    clearTimeout(timer);

    // Parse message content as json
    let content = "";
    let mood = "";
    let target = null;
    let endConversation = false;
    let sfx = [];
    let reasoning = "";
    let gmResolutionRequest = null;
    let memoryAppend = null;
    let goalsUpdate = null;
    let objectivesUpdate = null;
    try {
        console.dir(messageContent);
        const parsedMessageContent = parseAsJson(messageContent);
        //const parsedMessageContent = parseStructuredText(messageContent);
        //console.dir(parsedMessageContent);
        content = parsedMessageContent.response;
        mood = parsedMessageContent.mood;
        sfx = (parsedMessageContent.sfx ?? []).map(s => (s ?? "").replace(/"/g, "").trim()).filter(s => s.length > 0);
        reasoning = parsedMessageContent.reasoning ?? "";
        gmResolutionRequest = parsedMessageContent.gmResolutionRequest ?? null;
        memoryAppend = parsedMessageContent.memoryAppend ?? null;
        goalsUpdate = parsedMessageContent.goals ?? null;
        objectivesUpdate = parsedMessageContent.objectives ?? null;

        if (parsedMessageContent.target) {
            target = scene.tokens.find(t => t.name === parsedMessageContent.target);
        }
        if (parsedMessageContent.endConversation) {
            endConversation = parsedMessageContent.endConversation;
        }
    } catch (e) {
        content = messageContent;
    }

    // Apply self-declared side effects to the actor's flags.
    // memory: append a single new line to the runtime memory (curated by the
    // existing memory-compact feature). goals: full replacement when the NPC
    // declares a priority shift.
    if ( memoryAppend ) {
        const existingMemory = targetedNpc.getFlag("intelligent-npcs", "memory") ?? "";
        const newMemory = existingMemory.length > 0
            ? `${existingMemory}\n${memoryAppend}`
            : memoryAppend;
        await targetedNpc.setFlag("intelligent-npcs", "memory", newMemory);
    }
    if ( goalsUpdate ) {
        await targetedNpc.setFlag("intelligent-npcs", "goals", goalsUpdate);
    }
    if ( objectivesUpdate ) {
        await targetedNpc.setFlag("intelligent-npcs", "objectives", objectivesUpdate);
    }

    // Add this message to the message history as an assistant message
    messageHistory.push({
        "role": "assistant",
        "content": [
            reasoning ? `[REASONING]: ${reasoning}` : null,
            `[RESPONSE]: ${content}`,
            `[MOOD]: ${mood}`,
            `[END_CONVERSATION]: ${endConversation}`,
            `[TARGET]: ${target?.name ?? ""}`,
            sfx.length ? `[SFX]: ${sfx.join(", ")}` : null,
            gmResolutionRequest ? `[GM_RESOLUTION]: ${gmResolutionRequest}` : null,
            memoryAppend ? `[MEMORY_APPEND]: ${memoryAppend}` : null,
            goalsUpdate ? `[GOALS]: ${goalsUpdate}` : null,
            objectivesUpdate ? `[OBJECTIVES]: ${objectivesUpdate}` : null,
        ].filter(line => line !== null).join("\n")
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

    // If there is SFX attached, play each one. sfx is an array as of the
    // side-effects rework — multiple sounds in one beat (door-slam + gasp) play in order.
    if ( sfx && sfx.length ) {
        const config = await getConfig(targetedNpc);
        const attachedPlaylistUuid = config.playlist;
        console.log("Playlist: ", attachedPlaylistUuid);
        const playlist = await fromUuid(attachedPlaylistUuid);
        if ( playlist ) {
            for ( const sfxName of sfx ) {
                const sound = playlist.sounds.getName(sfxName);
                if ( sound ) playlist.playSound(sound);
            }
        }
    }

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
        style: CONST.CHAT_MESSAGE_STYLES?.IC ?? CONST.CHAT_MESSAGE_TYPES.IC,
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
                mood: mood,
                reasoning: reasoning || null,
                gmResolutionRequest: gmResolutionRequest,
                npcId: targetedNpc.id
            }
        }
    });
}
