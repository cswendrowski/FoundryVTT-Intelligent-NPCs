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

        data.llmUrl = game.settings.get("intelligent-npcs", "llmUrl");
        data.apiKey = game.settings.get("intelligent-npcs", "apiKey");
        // example url https://intelligentnpcs.azurewebsites.net/api/AccountStatus?code=I_ZasRU0hlvW5Q8y7zzYl4ZLnc3S8F9roA6H0I-idQuuAzFuUd5Srw==&clientId=module

        try {
            const response = await fetch(data.llmUrl + ":generateContent?key=" + data.apiKey, {
                headers:{
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    'contents': [
                        {
                            'parts': [
                                {
                                    'text': 'Say hello'
                                }
                            ]
                        }
                    ]
                })
            });
            // reference
            // https://github.com/google-gemini/cookbook/blob/main/quickstarts/rest/Models_REST.ipynb
            // VERY USEFUL https://www.scrapingbee.com/curl-converter/javascript-fetch/

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
