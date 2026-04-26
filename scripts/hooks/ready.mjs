import Hub from "../hub.mjs";
import { showWhatsNewIfNeeded } from "./whatsNew.mjs";

export async function ready() {
    var signalrHub = new Hub();
    await signalrHub.initialize();
    await signalrHub.start();

    // Fire-and-forget — don't block ready on the chat card.
    showWhatsNewIfNeeded().catch(e => console.error("intelligent-npcs whatsNew:", e));
}
