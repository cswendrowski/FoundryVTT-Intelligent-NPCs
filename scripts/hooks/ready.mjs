import Hub from "../hub.mjs";

export async function ready() {
    var signalrHub = new Hub();
    await signalrHub.initialize();
    await signalrHub.start();
}
