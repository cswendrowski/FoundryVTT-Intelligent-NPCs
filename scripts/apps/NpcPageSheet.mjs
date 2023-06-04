export default class NpcPageSheet extends JournalPageSheet {
    /** @inheritdoc */
    static get defaultOptions() {
        const options = super.defaultOptions;
        options.classes.push("form");
        return options;
    }

    /* -------------------------------------------- */

    /** @inheritdoc */
    get template() {
        return this.isEditable ? `/modules/intelligent-npcs/templates/journal/page-inpc-edit.hbs` :
            `/modules/intelligent-npcs/templates/journal/page-inpc-view.hbs`;
    }

    /* -------------------------------------------- */

    /** @inheritDoc */
    async getData(options) {
        const context = super.getData(options);

        /** @type {FishingSpotData} */
        let config = context.document.flags["intelligent-npcs"] ?? {};
        if ( foundry.utils.isEmpty(config) ) {
            config["enabled"] = true;
            config["summary"] = "You are a generic NPC named Bob.";
            config["background"] = "You live in a quiet town where nothing much goes on. You are married to a woman named Jane. You have a son named Billy and a daughter named Sally.";
            config["personality"] = "You are quiet and reserved, talking in short sentences.";
            config["goals"] = "Live a quiet life.";
            config["appearance"] = "Farmer attire";
            config["exampleSentence"] = "<i>Tips hat</i> \"Evening.\"";
            config["memory"] = "Today my wife and I went to the market. We bought some bread and milk.";
        }

        return foundry.utils.mergeObject(context, {
            journal: this.object,
            config: config,
            user: game.user,
            messageHistory: JSON.stringify(context.document.getFlag("intelligent-npcs", "messageHistory"), null, 2)
        });
    }

    /* -------------------------------------------- */

    async _updateObject(event, formData) {
        const updateData = foundry.utils.mergeObject(formData, {
            "flags": {
                ["intelligent-npcs"]: formData
            }
        });
        return super._updateObject(event, updateData);
    }

    /* -------------------------------------------- */

    /** @override */
    _getHeaderButtons() {
        const buttons = super._getHeaderButtons();

        if ( !this.isEditable ) return buttons;

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
        this.object.flags["intelligent-npcs"] = config;
        this.render();
    }

    /* -------------------------------------------- */

    async _onExport() {
        // Export the actor flag data as JSON
        const config = this.object.flags["intelligent-npcs"];
        // delete config.messageHistory;
        const content = JSON.stringify(config, null, 2);
        const filename = `${this.object.name}-intelligent-npc-journal-page-config.json`;
        saveDataToFile(content, "application/json", filename);
    }
}
