import {init} from "./hooks/init.mjs";
import {ready} from "./hooks/ready.mjs";
import {getActorHeaderButtons} from "./hooks/getHeaderButtons.mjs";
import {createChatMessage} from "./hooks/createChatMessage.mjs";
import {renderChatMessage} from "./hooks/renderChatMessage.mjs";
import {renderSceneConfig} from "./hooks/renderSceneConfig.mjs";
import {renderSettings} from "./hooks/renderSettings.mjs";
import {renderJournalEntryDirectory} from "./hooks/renderJournalEntryDirectory.mjs";

Hooks.once("init", init);
Hooks.once("ready", ready);
Hooks.on("getActorSheetHeaderButtons", getActorHeaderButtons);
Hooks.on("createChatMessage", createChatMessage);
Hooks.on("renderChatMessage", renderChatMessage);
Hooks.on("renderSceneConfig", renderSceneConfig);
Hooks.on("renderSettings", renderSettings);
Hooks.on("renderJournalDirectory", renderJournalEntryDirectory);
