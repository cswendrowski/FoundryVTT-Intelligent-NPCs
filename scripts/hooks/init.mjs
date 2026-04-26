import NpcPageSheet from "../apps/NpcPageSheet.mjs";
import MonsterPageSheet from "../apps/MonsterPageSheet.mjs";

export async function init() {
    // v13+ renamed CHAT_MESSAGE_TYPES → CHAT_MESSAGE_STYLES and froze CONST. Stash a
    // global alias so legacy `CONST.CHAT_MESSAGE_TYPES.X` lookups in this module still
    // resolve. (CONST itself can no longer be extended.)
    if ( !globalThis.CHAT_MESSAGE_TYPES_COMPAT ) {
        globalThis.CHAT_MESSAGE_TYPES_COMPAT = CONST.CHAT_MESSAGE_TYPES
            ?? { ...(CONST.CHAT_MESSAGE_STYLES ?? {}), ROLL: 5, WHISPER: 4 };
    }

    // v13+ removed the legacy {{#select}} block helper. Re-register a compatible
    // shim so existing templates keep rendering.
    if ( typeof Handlebars !== "undefined" && !Handlebars.helpers.select ) {
        Handlebars.registerHelper("select", function(selected, options) {
            const escapedValue = RegExp.escape(Handlebars.escapeExpression(selected));
            const rgx = new RegExp(' value=[\"\\\']' + escapedValue + '[\"\\\']');
            const html = options.fn(this);
            return html.replace(rgx, "$& selected");
        });
    }

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
        hint: "Fast is the default — great quality at 1 message per chat. Quality uses the most capable model for setpiece NPCs at 5 messages per chat.",
        scope: "world",
        default: "fast",
        config: true,
        type: String,
        choices: {
            "fast": "Fast — Best price-per-quality. Costs 1 message per chat. Great default for shopkeeps, guards, tavernfolk.",
            "quality": "Quality — Highest quality model. Costs 5 messages per chat. Great for centerpiece NPCs and party-recurring characters."
        },
        requiresReload: true,
    });

    game.settings.register("intelligent-npcs", "experiment", {
        name: "Intelligent NPCs Experiment",
        hint: "Leave blank unless an active Patreon experiment tells you to set a specific value. Most users should leave this empty.",
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
        hint: "How fast NPC-to-NPC banter scrolls, measured in words read per second. Higher = faster. Most readers handle around 3-6 words/sec.",
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
        hint: "If enabled, NPCs overhear recent IC chat in the same Scene. Example: Brenna and Tarn are both in the tavern and Tarn just cursed out a thug — Brenna will have heard, and her next response can react to it. Disable for tighter privacy between simultaneous scenes.",
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

    DocumentSheetConfig.registerSheet(JournalEntryPage, "intelligent-npcs", MonsterPageSheet, {
        types: ["text"],
        label() {
            return "Intelligent Monster Configuration";
        }
    });
}
