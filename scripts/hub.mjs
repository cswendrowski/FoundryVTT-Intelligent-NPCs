import {getConfig} from "./hooks/createChatMessage.mjs";

export default class Hub {
    async initialize() {
        this.connection = new signalR.HubConnectionBuilder()
            //.withUrl("https://localhost:7094/foundryhub", {withCredentials: false})
            .withUrl("https://intelligentttrpgs.azurewebsites.net/foundryhub", {withCredentials: false})
            .withAutomaticReconnect()
            .configureLogging(signalR.LogLevel.Information)
            .build();


        this.connection.onclose(async () => {
            await this.start();
        });

        this.connection.on("ReceiveTranscription", (transcription) => {
            console.log(transcription);
            // Create a chat message
            let message = {
                user: game.user,
                speaker: ChatMessage.getSpeaker(),
                content: transcription,
                type: CONST.CHAT_MESSAGE_TYPES.IC
            };
            ChatMessage.create(message);
        });

        this.connection.on("RequestInpcs", async () => {
            console.log("RequestInpcs");
            await this.fulfillInpcs();
        });

        this.connection.on("TargetUpdate", async (targeted) => {
            console.log("TargetUpdate", targeted);
            let first = true;
            targeted.forEach(t => {
                const token = canvas.tokens.get(t);
                token.setTarget(true, {releaseOthers: first});
                first = false;
            });
            if (targeted.length === 0) {
                game.user.targets.forEach(t => t.setTarget(false));
            }
        });

        Hooks.on("targetToken", this.fulfillInpcs.bind(this));
        Hooks.on("createToken", this.fulfillInpcs.bind(this));
        Hooks.on("deleteToken", this.fulfillInpcs.bind(this));
    }

    async fulfillInpcs() {
        if (!canvas.scene) return;
        const apiKey = game.settings.get("intelligent-npcs", "apiKey");
        const userId = game.user.id;
        const targets = game.user.targets.map(x => x.document._id);
        let inpcs = await Promise.all(canvas.scene.tokens
            .filter(t => t.actor?.flags["intelligent-npcs"]?.enabled === true)
            .map(async t => {
                const config = await getConfig(t.actor);
                const imgUrl = game.data.addresses.remote + t.texture.src;
                return {
                    Id: t._id,
                    Name: t.name,
                    Summary: config.summary,
                    ImageUrl: imgUrl,
                    Targeted: targets.has(t._id),
                }
            }));
        console.log(inpcs);
        this.connection.invoke("GetInpcs", apiKey + "-" + userId, inpcs);
    }

    async start() {
        try {
            await this.connection.start();
            console.log("SignalR Connected.");
            const apiKey = game.settings.get("intelligent-npcs", "apiKey");
            const userId = game.user.id;
            await this.joinGroup(apiKey + "-" + userId);
            await this.fulfillInpcs();
        } catch (err) {
            console.log(err);
            setTimeout(this.start, 5000);
        }
    };

    async joinGroup(groupId) {
        try {
            await this.connection.invoke("JoinGroup", groupId);
            console.log(`Joined group ${groupId}`);
        } catch (err) {
            console.error(`Error joining group ${groupId}: ${err}`);
        }
    }

    async leaveGroup(groupId) {
        try {
            await this.connection.invoke("LeaveGroup", groupId);
            console.log(`Left group ${groupId}`);
        } catch (err) {
            console.error(`Error leaving group ${groupId}: ${err}`);
        }
    }
}
