export function renderDrawingConfig(app, html, context) {
    const current = context.object.flags["intelligent-npcs"]?.drawingContext ?? "";

    // Find the text data-tab
    const textTab = html.find("[data-tab='text']");

    // Find the last form-group
    const lastGroup = textTab.find(".form-group").last();

    lastGroup.after(`
        <div class="form-group stacked">
            <label>Intelligent NPCs Area Context</label>
            <textarea name="flags.intelligent-npcs.drawingContext" placeholder="Context for this drawing will be given only for Intelligent NPCs inside the area." rows="4" maxlength="200">${current}</textarea>
            <p class="notes">Intelligent NPCs within this drawing have this context. Use to describe buildings, rooms or specific items of interest in a area. Max length: 200 characters</p>
        </div>
        `);

    // Force full height
    textTab.css("height", "auto");
}
