export default function getUserContextOptions(app, options) {
    options.push({
        name: "Copy Intelligent TTRPGS Id",
        icon: '<i class="fas fa-copy"></i>',
        callback: li => {
            const userId = li.data("user-id");
            if ( game.user.id != userId ) {
                ui.notifications.error("You can only copy your own ID");
                return;
            }
            const apiKey = game.settings.get("intelligent-npcs", "apiKey");
            const id = apiKey + "-" + userId;
            if (!navigator.clipboard) {
                // Fallback for unsupported browsers
                var textArea = document.createElement("textarea");
                textArea.value = id;
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                try {
                    var successful = document.execCommand('copy');
                } catch (err) {
                    console.error('Fallback: Oops, unable to copy', err);
                }
                document.body.removeChild(textArea);
                return;
            }
            else {
                navigator.clipboard.writeText(id);
            }
            ui.notifications.info(`Copied ID`);
        },
        condition: li => {
            const userId = li.data("user-id");
            return userId === game.user.id;
        }
    })
}
