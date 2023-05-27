export function renderSceneConfig(app, html, context) {

    const current = context.document.flags["intelligent-npcs"]?.sceneInfo;

    // Find the ambience data-tab
    const ambienceTab = html.find("[data-tab='ambience']");

    // Find the first hr
    const hr = ambienceTab.find("hr").first();

    // Insert a new form group before the hr
    hr.before(`
        <div class="form-group stacked">
            <label>Intelligent NPCs Scene Info</label>
            <textarea name="flags.intelligent-npcs.sceneInfo" placeholder="Enter scene info here. This will be referenced by the Intelligent NPCs." rows="4">${current}</textarea>
        </div>
        `);
}
