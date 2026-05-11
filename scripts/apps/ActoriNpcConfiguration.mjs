export default class ActoriNpcConfiguration extends FormApplication {

    constructor(actor, options) {
        super(options);

        this.actor = actor;
    }

    /* -------------------------------------------- */

    /**
     * If this is the first time any NPC has been activated in this world,
     * post a one-time GM-only chat card with a quickstart tip ("how do I
     * make this NPC talk?"). Called from both _onJournalPageChange and
     * _onCreatePage so it fires on either onboarding path.
     */
    static async _maybeShowFirstActivationTip(actorName) {
        if ( !game.user.isGM ) return;
        const shown = game.settings.get("intelligent-npcs", "firstActivationShown");
        if ( shown ) return;
        await game.settings.set("intelligent-npcs", "firstActivationShown", true);

        const content = `
            <div class="inpc-first-activation">
                <h3 style="margin-top: 0;"><i class="fas fa-thought-bubble"></i> Your first Intelligent NPC is live!</h3>
                <p><b>${actorName}</b> is ready to chat. Here's how:</p>
                <ol style="padding-left: 1.4em; margin: 0.4em 0;">
                    <li>Drag the actor onto a scene to place a token (or use an existing token if it's already on a scene).</li>
                    <li><b>Target</b> the token (right-click → Target, or hold T).</li>
                    <li>Type a message in chat <b>in-character</b> (the speech-bubble dropdown set to "Public as User" or "Public as Character"). The NPC will reply.</li>
                </ol>
                <p class="notes">Want the GM to direct the NPC instead? Whisper to GMs — your message becomes a <b>Command</b> the NPC follows. NPCs with strong personality may resist out-of-character orders, which is intentional.</p>
                <p class="notes">More setup: open the actor's <b>Intelligent NPC</b> dialog (⋮ menu) to edit memory, goals, objectives, or switch to the Quality model tier for setpiece characters.</p>
            </div>
        `;
        await ChatMessage.create({
            user: game.user.id,
            whisper: game.users.filter(u => u.isGM).map(u => u.id),
            content: content,
            flags: { "intelligent-npcs": { firstActivation: true } },
        });
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
            config["summary"] = "A generic NPC named Bob.";
            config["whatEveryoneKnows"] = "You don't know anything about this person beyond what you can glean from their appearance.";
            config["appearance"] = "Farmer attire";
        }

        const inpcJournals = game.journal.filter(journalEntry => journalEntry.pages
            .find(p => p.getFlag("core", "sheetClass") === "intelligent-npcs.NpcPageSheet"));
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
        const hasDifferentMemory = config.memory?.length > 0
            && config.memory !== selectedPageConfig.memory;
        const hasDifferentName = (this.actor && page) ? this.actor.name !== page.name : false;

        const canSwap = (pageId === "none") || !(hasMessageHistory || hasDifferentMemory || hasDifferentName);

        return foundry.utils.mergeObject(context, {
            actor: this.actor,
            config: config,
            journalPages: inpcJournalPages,
            canSwap: canSwap,
            journalPageUUID: pageUUID,
            messageHistory: JSON.stringify(this.actor.getFlag("intelligent-npcs", "messageHistory"), null, 2),
            worldCombatBanterLabel: game.settings.get("intelligent-npcs", "combatBanterEnabled") ? "always bark" : "never bark",
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
        html.find("textarea[name='goals']").change(this._onGoalsChange.bind(this));
        html.find("textarea[name='objectives']").change(this._onObjectivesChange.bind(this));
        html.find(".inpc-journal-page-link").click(this._onJournalPageLink.bind(this));
        html.find(".inpc-create-page").click(this._onCreatePage.bind(this));
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
                    actorLink: true,
                });
            }
        }
        await this.actor.setFlag("intelligent-npcs", "enabled", true);
        await this.actor.setFlag("intelligent-npcs", "model", "default");
        await this.actor.setFlag("intelligent-npcs", "name", page.name);
        await this.actor.setFlag("intelligent-npcs", "journalPage", pageId);
        await this.actor.setFlag("intelligent-npcs", "memory", selectedPageConfig["memory"]);
        await ActoriNpcConfiguration._maybeShowFirstActivationTip(page.name);
        this.render(true);
    }

    /* -------------------------------------------- */

    async _onMemoryChange(event) {
        const memory = event.target.value;
        await this.actor.setFlag("intelligent-npcs", "memory", memory);
        this.render(true);
    }

    /* -------------------------------------------- */

    async _onGoalsChange(event) {
        const goals = event.target.value;
        await this.actor.setFlag("intelligent-npcs", "goals", goals);
        this.render(true);
    }

    /* -------------------------------------------- */

    async _onObjectivesChange(event) {
        const objectives = event.target.value;
        await this.actor.setFlag("intelligent-npcs", "objectives", objectives);
        this.render(true);
    }

    /* -------------------------------------------- */

    /**
     * Scaffold a new Intelligent NPC journal entry + page from the current
     * actor, then wire this actor to it. Removes the biggest onboarding
     * wall: a fresh user with no INPC pages no longer has to leave the
     * dialog and assemble a journal page by hand.
     */
    async _onCreatePage(event) {
        event.preventDefault();
        const actor = this.actor;
        const actorName = actor.name;

        // Find or create the catch-all journal entry that holds module-scaffolded pages.
        const entryName = "Intelligent NPCs";
        let entry = game.journal.find(j => j.name === entryName);
        if ( !entry ) {
            entry = await JournalEntry.create({ name: entryName });
        }

        // Create the page. The NpcPageSheet auto-fills sensible defaults
        // (the "Bob the farmer" placeholder) on first render when the
        // intelligent-npcs flag bag is empty — we just need to seed enough
        // to make it feel like THIS actor.
        const page = await JournalEntryPage.create({
            name: actorName,
            type: "text",
            "flags.core.sheetClass": "intelligent-npcs.NpcPageSheet",
            "flags.intelligent-npcs": {
                enabled: true,
                summary: `${actorName} is a generic person who is well known for existing.`,
                background: "",
                personality: "",
                goals: "",
                connections: "",
                appearance: "",
                exampleSentence: `\"Hello.\"`,
                memory: "",
                playlist: null,
                img: actor.img,
            }
        }, { parent: entry });

        // Wire this actor to the new page (mirrors _onJournalPageChange).
        await actor.setFlag("intelligent-npcs", "enabled", true);
        await actor.setFlag("intelligent-npcs", "model", "default");
        await actor.setFlag("intelligent-npcs", "name", actorName);
        await actor.setFlag("intelligent-npcs", "journalPage", page.id);

        ui.notifications.info(`Created Intelligent NPC page for ${actorName}. Open the journal page to fill in personality, goals, and memory.`);
        await ActoriNpcConfiguration._maybeShowFirstActivationTip(actorName);

        // Re-render the dialog so the page appears in the dropdown and is selected.
        this.render(true);

        // Open the new page so the user can immediately edit personality/etc.
        page.sheet.render(true);
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
        await this.actor.setFlag("intelligent-npcs", "whatEveryoneKnows", "");
        await this.actor.setFlag("intelligent-npcs", "appearance", "");
        await this.actor.setFlag("intelligent-npcs", "messageHistory", []);
        await this.actor.setFlag("intelligent-npcs", "memory", "");
        await this.actor.setFlag("intelligent-npcs", "goals", "");
        await this.actor.setFlag("intelligent-npcs", "objectives", "");

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
        event.preventDefault();
        const uuid = event.currentTarget?.dataset?.uuid;
        if ( !uuid ) return;
        const page = await fromUuid(uuid);
        if ( !page ) return;
        // v14's Document#_onClickDocumentLink reads event.currentTarget.dataset
        // expecting a content-link <a> shape that our <i> icon doesn't satisfy
        // (and currentTarget is sometimes null by the time it runs). Open the
        // parent journal directly to the page instead — same end result, fewer
        // moving parts.
        const journal = page.parent;
        if ( journal?.sheet ) journal.sheet.render(true, { pageId: page.id });
        else page.sheet?.render(true);
    }
}
