export default class ActoriNpcConfiguration extends FormApplication {

    constructor(actor, options) {
        super(options);

        this.actor = actor;
    }

    /* -------------------------------------------- */

    /** @override */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            template: `modules/intelligent-npcs/templates/actor-inpc-configuration.hbs`,
            title: "Intelligent NPC Configuration",
            popOut: true,
            width: 1000,
            height: "auto",
            closeOnSubmit: false,
            submitOnClose: true,
            resizable: true,
        });
    }

    /* -------------------------------------------- */

    /** @override */
    async getData(options) {
        const context = super.getData(options);
        const config = this.actor.flags["intelligent-npcs"] ?? {};

        if ( foundry.utils.isEmpty(config) ) {
            config["summary"] = "You are a generic NPC named Bob.";
            config["appearance"] = "Farmer attire";
        }

        const inpcJournals = game.journal.filter(journalEntry => journalEntry.pages
            .find(p => p.getFlag("intelligent-npcs", "enabled")));
        const inpcJournalPages = inpcJournals
            .reduce((obj, journal) => {
                const pages = journal.pages.filter(p => !foundry.utils.isEmpty(p.flags["intelligent-npcs"]));
                for (const page of pages) {
                    if ( !obj.optgroups.find(og => og.label === journal.name) ) {
                        obj.optgroups.push({label: journal.name, options: []});
                    }
                    obj.optgroups.find(og => og.label === journal.name).options.push({value: page.id, label: page.name});
                }
                return obj;
            }, { optgroups: []});

        let pageId = this.actor.getFlag("intelligent-npcs", "journalPage");
        let pageUUID = "";
        const journal = game.journal.find(journalEntry => journalEntry.pages.get(pageId));
        const page = journal?.pages.get(pageId);
        if ( !page ) pageId = "none";
        else {
            pageUUID = page.uuid;
        }
        const selectedPageConfig = page?.flags["intelligent-npcs"] ?? {};

        const hasMessageHistory = config["messageHistory"] && config["messageHistory"].length > 0;
        const hasDifferentMemory = config["memory"] && config["memory"].length > 0
            && config["memory"] !== selectedPageConfig["memory"];
        const hasDifferentName = (this.actor && page) ? this.actor.name !== page.name : false;

        const canSwap = (pageId === "none") || !(hasMessageHistory || hasDifferentMemory || hasDifferentName);

        return foundry.utils.mergeObject(context, {
            actor: this.actor,
            config: config,
            journalPages: inpcJournalPages,
            canSwap: canSwap,
            journalPageUUID: pageUUID,
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

    /** @override */
    activateListeners(html) {
        html.find(".clear-history").click(this._onClearHistory.bind(this));
        html.find(".reset-inpc").click(this._onReset.bind(this));
        html.find("select[name='journalPage']").change(this._onJournalPageChange.bind(this));
        html.find("textarea[name='memory']").change(this._onMemoryChange.bind(this));
        html.find(".inpc-journal-page-link").click(this._onJournalPageLink.bind(this));
    }

    /* -------------------------------------------- */

    async _onJournalPageChange(event) {
        const pageId = event.target.value;
        const page = game.journal.find(journalEntry => journalEntry.pages.get(pageId)).pages.get(pageId);
        const selectedPageConfig = page?.flags["intelligent-npcs"] ?? {};

        // Update the page link uuid
        this.element.find(".inpc-journal-page-link")[0].dataset.uuid = page.uuid;

        // Update the form data with the new page's config
        this.actor.update({
            name: page.name,
            "prototypeToken.name": page.name,
            "prototypeToken.texture.src": selectedPageConfig["img"],
            img: selectedPageConfig["img"],
        });
        if ( canvas.scene ) {
            const token = canvas.scene.tokens.find(t => t.actorId === this.actor.id);
            if ( token ) {
                token.update({
                    name: page.name,
                    img: selectedPageConfig["img"],
                });
            }
        }
        await this.actor.setFlag("intelligent-npcs", "name", page.name);
        await this.actor.setFlag("intelligent-npcs", "journalPage", pageId);
        await this.actor.setFlag("intelligent-npcs", "memory", selectedPageConfig["memory"]);
        this.render(true);
    }

    /* -------------------------------------------- */

    async _onMemoryChange(event) {
        const memory = event.target.value;
        await this.actor.setFlag("intelligent-npcs", "memory", memory);
        this.render(true);
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
        // delete config.messageHistory;
        const content = JSON.stringify(config, null, 2);
        const filename = `${this.actor.name}-intelligent-npc-actor-config.json`;
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

    /* -------------------------------------------- */

    async _onReset() {
        const allow = await Dialog.confirm({
            title: "Reset Intelligent NPC",
            content: "Are you sure you want to reset this intelligent NPC? This will clear any customizations and interactions you have.",
        });
        if ( !allow ) return;

        // Clear the customizations
        await this.actor.setFlag("intelligent-npcs", "summary", "");
        await this.actor.setFlag("intelligent-npcs", "appearance", "");
        await this.actor.setFlag("intelligent-npcs", "messageHistory", []);
        await this.actor.setFlag("intelligent-npcs", "memory", "");

        const pageId = this.actor.getFlag("intelligent-npcs", "journalPage");
        const page = game.journal.find(journalEntry => journalEntry.pages.get(pageId)).pages.get(pageId);
        const selectedPageConfig = page?.flags["intelligent-npcs"] ?? {};

        // Update the form data with the new page's config
        this.actor.update({
            name: page.name,
            "prototypeToken.name": page.name,
            "prototypeToken.texture.src": selectedPageConfig["img"],
            img: selectedPageConfig["img"],
        });
        if ( canvas.scene ) {
            const token = canvas.scene.tokens.find(t => t.actorId === this.actor.id);
            if ( token ) {
                token.update({
                    name: page.name,
                    img: selectedPageConfig["img"],
                });
            }
        }
        await this.actor.setFlag("intelligent-npcs", "name", page.name);
        await this.actor.setFlag("intelligent-npcs", "memory", selectedPageConfig["memory"]);
        this.render();
    }

    /* -------------------------------------------- */

    async _onJournalPageLink(event) {
        const uuid = event.currentTarget.dataset.uuid;
        const page = await fromUuid(uuid);
        page?._onClickDocumentLink(event);
    }
}
