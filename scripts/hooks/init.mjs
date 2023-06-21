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
        hint: "You can get an API key by being a Patreon supporter at https://www.patreon.com/ironmoose.",
        scope: "world",
        config: true,
        type: Number,
        default: 15
    });

    DocumentSheetConfig.registerSheet(JournalEntryPage, "intelligent-npcs", NpcPageSheet, {
        types: ["text"],
        label() {
            return "Intelligent NPC Configuration";
        }
    });
}
