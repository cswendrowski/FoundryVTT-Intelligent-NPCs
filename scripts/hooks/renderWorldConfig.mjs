export function renderWorldConfig(app, html, context) {

    const current = context.world.flags["intelligent-npcs"]?.worldContext ?? "";

    const editor = html.find(".editor");

    // Insert a new form group before the hr
    editor.after(`
        <div class="form-group stacked">
            <label>Intelligent NPCs World Context</label>
            <textarea name="flags.intelligent-npcs.worldContext" placeholder="Enter world context here. This will be referenced by the Intelligent NPCs." rows="8">${current}</textarea>
        </div>
        `);
}
