export default class AccountApp extends Application {
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            id: "intelligent-npcs-account-form",
            template: 'modules/intelligent-npcs/templates/account-app.hbs',
            classes: ["intelligent-npcs", "intelligent-npcs-account"],
            width: 450,
            height: 350
        });
    }

    async getData(options) {
        const data = super.getData(options);

        data.apiKey = game.settings.get("intelligent-npcs", "apiKey");

        try {
            const response = await fetch("https://intelligentnpcs.azurewebsites.net/api//AccountStatus?code=I_ZasRU0hlvW5Q8y7zzYl4ZLnc3S8F9roA6H0I-idQuuAzFuUd5Srw==&clientId=module", {
                headers: {
                    "x-api-key": data.apiKey
                }
            });

            if (response.ok) {
                data.status = await response.json();
            } else {
                console.error(response.statusText);
                data.errorMessage = "Could not connect to Intelligent NPCs API, please try again later.";
            }
        }
        catch (e) {
            console.error(e);
            data.errorMessage = "Could not connect to Intelligent NPCs API, please try again later.";
        }

        return data;
    }
}
