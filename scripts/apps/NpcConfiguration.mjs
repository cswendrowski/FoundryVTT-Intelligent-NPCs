export default class NpcConfiguration extends FormApplication {

    constructor(actor, options) {
        super(options);

        this.actor = actor;
    }

    /* -------------------------------------------- */

    /** @override */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            template: `modules/intelligent-npcs/templates/npc-configuration.hbs`,
            title: "Intelligent NPC Configuration",
            popOut: true,
            width: 1000,
            height: 960,
            closeOnSubmit: false,
            submitOnClose: true
        });
    }

    /* -------------------------------------------- */

    /** @override */
    async getData(options) {
        const context = super.getData(options);
        const config = this.actor.flags["intelligent-npcs"] ?? {};

        if ( !config ) {
            config["summary"] = "You are a generic NPC named Bob.";
            config["background"] = "You live in a quiet town where nothing much goes on. You are married to a woman named Jane. You have a son named Billy and a daughter named Sally.";
            config["personality"] = "You are quiet and reserved, talking in short sentences.";
            config["goals"] = "Live a quiet life.";
            config["appearance"] = "Farmer attire";
            config["exampleSentence"] = "Evening.";
            config["memory"] = "Today my wife and I went to the market. We bought some bread and milk.";
            config["inventory"] = "A small knife, a pouch of 100 silver coins, a loaf of bread, a jug of milk.";
        }

        return foundry.utils.mergeObject(context, {
            actor: this.actor,
            config: config,
            messageHistory: JSON.stringify(this.actor.getFlag("intelligent-npcs", "messageHistory"), null, 2)
        });
    }

    /* -------------------------------------------- */

    /** @override */
    async _updateObject(event, formData) {
        // For each entry in the form data, update the corresponding actor data
        for (let [key, value] of Object.entries(formData)) {
            await this.actor.setFlag("intelligent-npcs", key, value);
        }
    }

    /* -------------------------------------------- */

    /** @override */
    _getHeaderButtons() {
        const buttons = super._getHeaderButtons();

        buttons.unshift({
            label: "Import",
            class: "import",
            icon: "fas fa-file-import",
            onclick: () => this._onImport(),
        },
        {
            label: "Export",
            class: "export",
            icon: "fas fa-file-export",
            onclick: () => this._onExport(),
        });

        return buttons;
    }

    /* -------------------------------------------- */

    /** @override */
    activateListeners(html) {
        html.find(".clear-history").click(this._onClearHistory.bind(this));
    }

    /* -------------------------------------------- */

    async _onImport() {
        // Display a dialog with html to ask for a file input
        const content = await renderTemplate("modules/intelligent-npcs/templates/import-dialog.hbs");
        new Dialog({
            title: "Import Intelligent NPC Configuration",
            content: content,
            buttons: {
                import: {
                    icon: '<i class="fas fa-file-import"></i>',
                    label: "Import",
                    callback: html => this._onImportSubmit(html),
                }
            }
        }).render(true);
    }

    /* -------------------------------------------- */

    async _onImportSubmit(html) {
        // Get the file input
        const input = html.find("input[type='file']")[0];
        if ( !input || !input.files || !input.files.length ) return;

        // Read the file
        const file = input.files[0];
        const content = await readTextFromFile(file);

        // Read as JSON
        const config = JSON.parse(content);
        if ( !config ) return;

        // Update the actor
        this.actor.flags["intelligent-npcs"] = config;
        this.render();
    }

    /* -------------------------------------------- */

    async _onExport() {
        // Export the actor flag data as JSON
        const config = this.actor.flags["intelligent-npcs"];
        delete config.inventory;
        // delete config.messageHistory;
        const content = JSON.stringify(config, null, 2);
        const filename = `${this.actor.name}-intelligent-npc-config.json`;
        saveDataToFile(content, "application/json", filename);
    }

    /* -------------------------------------------- */

    async _onClearHistory() {

        const allow = await Dialog.confirm({
            title: "Clear Message History",
            content: "Are you sure you want to clear the message history? This cannot be undone.",
        });
        if ( !allow ) return;

        // Clear the message history
        await this.actor.setFlag("intelligent-npcs", "messageHistory", []);
        this.render();
    }
}
