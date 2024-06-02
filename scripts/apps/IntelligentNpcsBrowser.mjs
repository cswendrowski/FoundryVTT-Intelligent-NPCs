export default class IntelligentNpcsBrowser extends Application {
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            id: "intelligent-npcs-browser",
            template: 'modules/intelligent-npcs/templates/browser.hbs',
            classes: ["intelligent-npcs", "intelligent-npcs-browser"],
            width: 1200,
            height: 900
        });
    }

    /* -------------------------------------------- */

    static _npcDataCache;

    async getNpcData(context) {
        if ( IntelligentNpcsBrowser._npcDataCache ) return IntelligentNpcsBrowser._npcDataCache;

        const apiKey = game.settings.get("intelligent-npcs", "apiKey");

        try {
            const response = await fetch("https://intelligentnpcs.azurewebsites.net/api/Npcs?code=I_ZasRU0hlvW5Q8y7zzYl4ZLnc3S8F9roA6H0I-idQuuAzFuUd5Srw==&clientId=module", {
                headers: {
                    "x-api-key": apiKey
                }
            });

            if (response.ok) {
                const json = await response.json();
                context.packs = json.packs;
                context.hasPremium = json.hasPremium;

                // Compute the icon for each npc
                for (let pack of context.packs) {
                    for (let npc of pack.fields.npcs) {
                        npc.icon = npc.fields.free ? "fas fa-hand-holding-heart" : "fas fa-sack-dollar";
                        npc.iconTooltip = npc.fields.free ? "Free" : "Paid";
                        npc.downloadable = npc.fields.free || context.hasPremium;
                    }
                    // Sort free first, then by name
                    pack.fields.npcs.sort((a, b) => {
                        if (a.fields.free && !b.fields.free) {
                            return -1;
                        }
                        if (!a.fields.free && b.fields.free) {
                            return 1;
                        }
                        return a.fields.name.localeCompare(b.fields.name);
                    });
                }
            } else {
                console.error(response.statusText);
                context.errorMessage = "Could not connect to Intelligent NPCs API, please try again later.";
            }
        }
        catch (e) {
            console.error(e);
            context.errorMessage = "Could not connect to Intelligent NPCs API, please try again later.";
        }

        IntelligentNpcsBrowser._npcDataCache = context;
        return context;
    }

    /* -------------------------------------------- */

    async getData(options) {
        const data = super.getData(options);

        // Get the NPC data from the API
        const context = await this.getNpcData(data);

        const inpcJournals = game.journal.filter(journalEntry => journalEntry.pages
            .find(p => p.getFlag("core", "sheetClass") === "intelligent-npcs.NpcPageSheet"));
        const inpcJournalPages = inpcJournals
            .reduce((names, journal) => {
                const pages = journal.pages.filter(p => !foundry.utils.isEmpty(p.flags["intelligent-npcs"]));
                for (const page of pages) {
                    names.push(page.name);
                }
                return names;
            }, []);

        for ( const pack of context.packs ) {
            const journal = inpcJournals.find(j => j.name.endsWith(pack.fields.name));
            pack.imported = !!journal;
            pack.journalId = journal?._id;

            for ( const npc of pack.fields.npcs ) {
                npc.imported = inpcJournalPages.includes(npc.fields.name);
                if ( npc.imported ) npc.pageId = journal?.pages.find(p => p.name === npc.fields.name)?._id;
            }
        }

        return context;
    }

    /* -------------------------------------------- */

    activateListeners(html) {
        super.activateListeners(html);

        // Find the #intelligent-npcs-btn in window and reenable it
        const intelligentNpcsButton = window.document.getElementById('intelligent-npcs-btn');
        intelligentNpcsButton.removeAttribute("disabled");

        html.find(".npc-actions > button").click(this._onClickNpcAction.bind(this));
        html.find(".pack-actions > button").click(this._onClickPackAction.bind(this));
    }

    /* -------------------------------------------- */

    _onClickNpcAction(event) {
        const button = event.currentTarget;
        const action = button.dataset.action;

        switch (action) {
            case "download": return this._onClickDownloadNpc(button);
            case "open": return this._onClickOpenNpc(button);
        }
    }

    /* -------------------------------------------- */

    _onClickPackAction(event) {
        const button = event.currentTarget;
        const action = button.dataset.action;

        switch (action) {
            case "download": return this._onClickDownloadPack(button);
        }
    }

    /* -------------------------------------------- */

    async _createFolderIfMissing(folderPath) {
        let source = "data";
        if (typeof ForgeVTT != "undefined" && ForgeVTT.usingTheForge) {
            source = "forgevtt";
        }
        try
        {
            await FilePicker.browse(source, folderPath);
        }
        catch (error)
        {
            await FilePicker.createDirectory(source, folderPath);
        }
    }

    /* -------------------------------------------- */

    async downloadNpc(npcId, force=false) {
        const pack = IntelligentNpcsBrowser._npcDataCache.packs.find(p => p.fields.npcs.find(n => n.id == npcId));
        const npc = IntelligentNpcsBrowser._npcDataCache.packs.flatMap(p => p.fields.npcs).find(n => n.id == npcId);

        const genre = pack.fields.genre;
        const packName = `${genre} - ${pack.fields.name}`;

        // If the folder for the genre doesn't exist, create it
        let folder = game.folders.getName(genre);
        if ( !folder ) {
            folder = await Folder.create({
                name: genre,
                type: "JournalEntry",
                parent: null,
            });
        }

        // If the Journal for the pack doesn't exist, create it
        let journal = game.journal.getName(packName);
        if ( !journal ) {
            journal = await JournalEntry.create({
                name: packName,
                folder: folder.id,
            });
        }

        // If the Page for the record doesn't exist, create it
        let page = journal.pages.getName(npc.fields.name);
        if ( page && !force ) return;
        else if ( !page ) {
            const created = await journal.createEmbeddedDocuments("JournalEntryPage", [{
                name: npc.fields.name,
                type: "text",
            }], {});
            page = created[0];
        }

        // Update the page content
        let img = "";
        let filename = "";
        if ( npc.fields.image ) {
            img = npc.fields.image[0].url;
            filename = npc.fields.image[0].filename;
        }

        // Save the image
        await this._createFolderIfMissing("modules");
        await this._createFolderIfMissing("modules/intelligent-npcs");
        await this._createFolderIfMissing("modules/intelligent-npcs/storage");
        await this._createFolderIfMissing("modules/intelligent-npcs/storage/images");

        let source = "data";
        if (typeof ForgeVTT != "undefined" && ForgeVTT.usingTheForge) {
            source = "forgevtt";
        }

        let imageFolder = await FilePicker.browse(source, "modules/intelligent-npcs/storage/images");
        let matchingFile = imageFolder.files.find(x => x.endsWith(filename));
        if ( filename && matchingFile ) {
            img = matchingFile;
        }
        else {
            //console.log("Downloading " + fileName);
            let response = await fetch(img);
            let blob = await response.blob();
            let file = new File([blob], filename);
            let fileResponse = await FilePicker.upload(source, "modules/intelligent-npcs/storage/images", file, {});
            img = fileResponse.path;
        }

        await page.update({
            "name": npc.fields.Name,
            "flags.core.sheetClass": "intelligent-npcs.NpcPageSheet",
            "flags.intelligent-npcs": {
                "appearance": npc.fields.appearance,
                "background": npc.fields.background,
                "exampleSentence": npc.fields.exampleSentence,
                "goals": npc.fields.goals,
                "connections": npc.fields.connections,
                "img": img,
                "personality": npc.fields.personality,
                "summary": npc.fields.summary,
                "airtableId": npc.id,
            }
        });

        return { journal: journal, page: page };
    }

    /* -------------------------------------------- */

    async _onClickDownloadNpc(button) {
        // Disable the button and show a spinner
        button.setAttribute("disabled", true);
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Downloading...';

        // Get the NPC data from the cache
        const npcId = button.dataset.npcId;
        const { journal, page} = await this.downloadNpc(npcId);

        // Open the page
        journal.sheet.render(true, {pageId: page.id});

        // Update the button
        button.innerHTML = '<i class="fas fa-check"></i> Downloaded';
    }

    /* -------------------------------------------- */

    async _onClickOpenNpc(button) {
        const journalId = button.dataset.journalId;
        const pageId = button.dataset.pageId;
        const journal = game.journal.get(journalId);
        const page = journal.pages.get(pageId);
        journal.sheet.render(true, {pageId: page.id});
    }

    /* -------------------------------------------- */

    async _onClickDownloadPack(button) {
        // Disable the button and show a spinner
        button.setAttribute("disabled", true);
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Downloading...';

        // Disable all npc download buttons
        const npcButtons = button.parentElement.parentElement.querySelectorAll(".npc-actions > button");
        for (const npcButton of npcButtons) {
            npcButton.setAttribute("disabled", true);
            npcButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Downloading...';
        }

        // Get the Pack data from the cache
        const packId = button.dataset.packId;
        const pack = IntelligentNpcsBrowser._npcDataCache.packs.find(p => p.id == packId);
        let journal, page;
        for (const npc of pack.fields.npcs) {
            if ( !IntelligentNpcsBrowser._npcDataCache.hasPremium && !npc.fields.free ) continue;
            const { npcJournal, npcPage } = await this.downloadNpc(npc.id);
            journal = npcJournal;
        }

        // Open the page
        //journal.sheet.render(true);

        // Update the button
        button.innerHTML = '<i class="fas fa-check"></i> Downloaded';

        // Update all npc download buttons
        for (const npcButton of npcButtons) {
            npcButton.innerHTML = '<i class="fas fa-check"></i> Downloaded';
        }
    }
}
