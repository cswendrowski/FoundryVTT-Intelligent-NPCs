export async function renderChatMessage(message, html, data) {
    // find .message-sender and append the target's name
    const sender = html.find(".message-sender");
    let toAppend = "";

    const mood = message.flags["intelligent-npcs"]?.mood;
    if ( mood ) {
        toAppend += ` <i>(${mood})</i>`;
    }

    const targetName = message.flags["intelligent-npcs"]?.targetName;
    if ( targetName ) {
        toAppend +=` ➡ ${targetName}`;
    }

    sender.append(toAppend);
}
