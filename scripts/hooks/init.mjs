import NpcPageSheet from "../apps/NpcPageSheet.mjs";

export async function init() {
    game.settings.register("intelligent-npcs", "apiKey", {
        name: "Intelligent NPCs API Key",
        hint: "You can get an API key by being a Patreon supporter at https://www.patreon.com/ironmoose.",
        scope: "world",
        default: "",
        config: true,
        type: String,
        requiresReload: true,
    });

    game.settings.register("intelligent-npcs", "model", {
        name: "Intelligent NPCs Model",
        hint: "The model to use for generating NPC chat messages. If you select a model that you don't have access to, it will default to V1.",
        scope: "world",
        default: "hybrid",
        config: true,
        type: String,
        choices: {
            "v1": "Fast - Faster and Cheaper - Costs 1 message per chat message. Great for your general run-of-the mill mooks and mobs.",
            "hybrid": "Hybrid - The default model. Costs 1 message per chat message. Not as fast as the Fast model, but more capable. Great for your Shopkeeps, Tavern Keepers, etc.",
            "v2": "Enhanced - More Capable and Nuanced, but costs 10 messages per chat message. Great for your setpiece bosses and NPCS your party will interact with often.",
        },
        requiresReload: true,
    });

    game.settings.register("intelligent-npcs", "experiment", {
        name: "Intelligent NPCs Experiment",
        hint: "From time to time, we'll have new experimental model tweaks that you can try out. Keep an eye on the Patreon for more information.",
        scope: "world",
        default: "",
        config: true,
        type: String,
        requiresReload: true,
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

    game.settings.register("intelligent-npcs", "sameSceneContext", {
        name: "Enable Same-Scene Context",
        hint: "If enabled, NPCs will be able to use Chatlog context from the same Scene to inform their chat messages.",
        scope: "world",
        config: true,
        type: Boolean,
        default: true
    });

    game.settings.register("intelligent-npcs", "moodPosition", {
        name: "Mood Position",
        hint: "Where to display the mood text on the chat message, such as 'annoyed'.",
        scope: "world",
        config: true,
        type: String,
        choices: {
            "inline": "Inline with Name, such as 'Bob (annoyed)'",
            "below": "Below Name, such as 'Bob' on one line and 'annoyed' on the next",
        },
        default: "below",
        requiresReload: true,
    });

    if ( game.modules.get("acd-talking-actors")?.active ) {
        game.settings.register("intelligent-npcs", "talkingActorsEnabled", {
            name: "Enable Talking Actors Integration",
            hint: "If enabled, NPCs will use the Talking Actors module to narrate their chat messages.",
            scope: "world",
            config: true,
            type: Boolean,
            default: true
        });
    }

    DocumentSheetConfig.registerSheet(JournalEntryPage, "intelligent-npcs", NpcPageSheet, {
        types: ["text"],
        label() {
            return "Intelligent NPC Configuration";
        }
    });
}
