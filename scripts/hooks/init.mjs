import NpcPageSheet from "../apps/NpcPageSheet.mjs";

export async function init() {
    game.settings.register("intelligent-npcs", "apiKey", {
        name: "Intelligent NPCs API Key",
        hint: "You can get an API key by being a Patreon supporter at https://www.patreon.com/ironmoose.",
        scope: "world",
        default: "",
        config: true,
        type: String,
        reload: true,
    });

    game.settings.register("intelligent-npcs", "maxBackAndForthLength", {
        name: "Maximum NPC Back-and-Forth",
        hint: "When NPCs chat between each other, this is the maximum number of messages that will be sent in a single conversation to prevent infinite conversations. Set to 0 to disable.",
        scope: "world",
        config: true,
        type: Number,
        default: 15
    });

    game.settings.register("intelligent-npcs", "backAndForthDelay", {
        name: "NPC Back-and-Forth Delay",
        hint: "The delay between NPC back-and-forth messages, in words per second. Most people read around 3 words a second.",
        scope: "world",
        config: true,
        type: Number,
        default: 6
    });

    game.settings.register("intelligent-npcs", "combatBanterEnabled", {
        name: "Enable Combat Banter",
        hint: "If enabled, NPCs will make comments during combat, such as on their turn or when defeated.",
        scope: "world",
        config: true,
        type: Boolean,
        default: true
    });

    DocumentSheetConfig.registerSheet(JournalEntryPage, "intelligent-npcs", NpcPageSheet, {
        types: ["text"],
        label() {
            return "Intelligent NPC Configuration";
        }
    });
}
