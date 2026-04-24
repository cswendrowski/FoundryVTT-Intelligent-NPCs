# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A **Foundry VTT module** (`intelligent-npcs`) that adds AI-driven NPC chat to Foundry. It is a client-side-only module — there is no build system, no test suite, no linter, and no `package.json` at the repo root. Foundry loads `scripts/intelligent-npcs.mjs` directly as an ES module. The actual AI work happens server-side on a paid backend reached via HTTPS + SignalR; this repo is the Foundry client.

The working directory **is** a live Foundry data path (`FoundryVTT/Data/modules/intelligent-npcs`), so edits take effect in Foundry on reload. The `hotReload` flag in `module.json` auto-reloads `css`, `hbs`, and `json` changes under `styles/`, `templates/`, `languages/`.

## Commands

There is no local build or test. Development loop:

- Edit files → reload Foundry world (F5) or rely on hot-reload for styles/templates/languages.
- Releases are fully automated by `.github/workflows/main.yml`: publish a GitHub Release tagged `vX.Y.Z` (or `X.Y.Z`) and the workflow substitutes `#{VERSION}#` / `#{URL}#` / `#{MANIFEST}#` / `#{DOWNLOAD}#` in `module.json` and attaches `module.json` + `module.zip` to the release. Do not hand-edit those `#{...}#` tokens.
- The `packs/` directory is gitignored — compendium DBs are built separately and only appear in published zips.

## Backend Server

The server lives at `F:\Programming\Git\IntelligentNpcs` (solution: `IntelligentNpcs.sln`, .NET 6). It contains three projects:

- **`IntelligentNpcs/`** — Azure Functions (v4) app that serves the HTTPS API the Foundry module hits at `https://intelligentnpcs.azurewebsites.net/api/...`. Each `.cs` file in `Functions/` is one endpoint (`FunctionName` attribute = route name the client uses). Key endpoints consumed by this module: `ChatCompletion` (conversational), `MonsterChatCompletion` (monster sheet), `CombatBark` (combat banter), `AccountStatus`, `NewApiKey`, `Npcs`, `UploadFile`/`DeleteFile`/`Filepicker`, and `CoreMemory`. The `Assistant*` endpoints are an OpenAI Assistants-threads flow (not the default path). DI and the OpenAI client are set up in `Functions/Startup.cs` — `OPENAI_KEY` and `OPENAI_ORG` come from env/`local.settings.json`.
- **`IntelligentTtrpgsModels/`** — shared DTOs referenced by both the Functions app and the Website. `CompletionInput.cs`/`CompletionResponse.cs` (aka `AiResponse`) define the exact wire format — **this is the contract the Foundry `body` in `chatCompletion(...)` must match**. `User.cs` is the Azure Table Storage entity (tracks `MonthlyRequests`, `BoughtRequests`, `MaxMonthlyRequests`, `Active`, `HasPremium`, `ReferralCode`). `INPC.cs` is the SignalR payload.
- **`IntelligentTtrpgsWebsite/`** — Blazor (Client/Server/Shared) site that hosts the SignalR hub and account management. The hub is `Server/Controllers/FoundryHub.cs` (route `/foundryhub`, matching `scripts/hub.mjs`). Hub methods invoked by the module: `JoinGroup`, `RegisterUser`, `GetInpcs`, `UpdateTargets`, `SendTranscription`. Hub → client events: `ReceiveTranscription`, `RequestInpcs`, `ReceiveInpcs`, `TargetUpdate` (all handled in `hub.mjs`). The Server also has controllers for `Account`, `Audio`, `Proxy`, and `Stripe` — Patreon/Auth0/Stripe integrations live here, not in the Functions app.

### Auth model (important when debugging 401/403/404/429)
The Foundry module sends `x-api-key: <ironmoose-XXXX>`. `ApiKeys.AuthenticateUser` (in `IntelligentNpcs/ApiKeys.cs`) looks the key up in the `users` Azure Table, checks `Active`, and increments `MonthlyRequests` by **1 for `v1`/`hybrid`, 10 for `v2`** — that increment is what matches the module's model-tier cost description. Responses include `x-monthly-requests-remaining` and `x-bought-requests-remaining` headers (exposed via CORS) which the module reads to drive its "low messages" warning. When changing the cost model on one side, change both.

### Prompt contract (how the module and backend agree)
The backend returns a single string containing `[RESPONSE]: ...`, `[MOOD]: ...`, `[END_CONVERSATION]: ...`, `[TARGET]: ...`, `[SFX]: ...` markers, parsed server-side (see regexes near the top of `V1Completion` in `ChatCompletion.cs`) and returned to the module as an `AiResponse` JSON object. The `sfx` field is matched against the allow-list the module sent in `body.sfx` (sound names from the configured Foundry Playlist). The `target` field is matched against `body.tokenNames`. OpenAI model mapping is in `GetOpenAiModel`: `v1` → `gpt-3.5-turbo-0125`, `hybrid` → `gpt-4o-mini`, `v2` → `gpt-4o`. The `experiment` string is a free-form backend toggle for prompt A/B tweaks.

### Local dev against the backend
1. Run the Functions app from Visual Studio/`func start` — it binds to `http://localhost:7245`.
2. Run the Website (SignalR hub) — it binds to `https://localhost:7094`.
3. Flip `DEBUG = true` at the top of `scripts/hooks/createChatMessage.mjs` **and** confirm `scripts/hub.mjs` is using its `localhost:7094/foundryhub` URL (the commented block at the top). Both toggles must agree — one pointing local and the other pointing prod will half-work and look like an auth bug.

### Evaluation harness
`IntelligentNpcs.Eval/` is a console tool that replays representative fixtures against the real prompt-building code and scores output via Claude-as-judge. Run it before and after any prompt or model change; `eval-runs/baseline-*/` in the backend repo contains the locked-in baselines. See `IntelligentNpcs.Eval/README.md` for usage.

## Architecture

### Entry point and hook wiring
`scripts/intelligent-npcs.mjs` is the only esmodule Foundry loads. It does nothing but register Foundry lifecycle hooks (`init`, `ready`, `renderChatMessage`, `updateCombat`, etc.) to handlers under `scripts/hooks/`. When adding behavior that reacts to a Foundry event, add a hook file there and wire it in `intelligent-npcs.mjs` — do not add logic to the entry file itself.

### Two backends, chosen per feature
- **HTTP API (`callApi` in `scripts/hooks/createChatMessage.mjs`)** — the main path for chat completions. Hits `https://intelligentnpcs.azurewebsites.net/api/...` with an `x-api-key` header. `DEBUG = true` at the top of that file swaps to `http://localhost:7245`. The function centralizes 401/403/404/429/503 handling and the "low messages" warning via module-scoped `NEEDS_KEY`/`OUT`/`LOW` flags — route new API calls through it rather than calling `fetch` directly.
- **SignalR hub (`scripts/hub.mjs`)** — used for realtime features (live transcription, target sync, scene NPC inventory). Loaded via the classic `scripts/lib/signalr.js` (registered under `"scripts"` in `module.json`, not `"esmodules"`). `Hub` has its own localhost toggle that must be flipped manually alongside the `DEBUG` flag in `createChatMessage.mjs` when developing against a local backend.

### NPC configuration model (important, non-obvious)
NPC "personalities" live on **`JournalEntryPage` documents**, not on Actors. Two custom page sheets are registered in `scripts/hooks/init.mjs`:
- `NpcPageSheet` → conversational NPCs
- `MonsterPageSheet` → combat-focused monsters

An Actor becomes an Intelligent NPC by setting `flags["intelligent-npcs"].enabled = true` and `flags["intelligent-npcs"].journalPage = <pageId>`. At send time, `getConfig(npc)` in `createChatMessage.mjs` merges the Actor flags on top of the referenced JournalEntryPage flags, then does a `page.name → actor.name` string replacement across every text field (summary, appearance, background, personality, goals, connections, exampleSentence, whatEveryoneKnows). This is what lets one "template" page drive many renamed tokens — respect it when adding new config fields (add them to the replacement block and to both page sheets + templates).

### Context hierarchy (see `context-hierarchy.d2`)
Requests to the AI stack context from widest to narrowest: **World → Scene → Area (Drawing subarea) → NPC → Speaker**. Sources:
- World: `game.world.flags["intelligent-npcs"].worldContext` (edited via `renderWorldConfig` hook).
- Scene: `scene.getFlag("intelligent-npcs", "sceneInfo")` (edited via `renderSceneConfig` hook).
- Area: per-Drawing flags (edited via `renderDrawingConfig` hook), resolved by `getSubareaContext` against the NPC's token position.
- NPC: merged Actor + JournalEntryPage flags (see above).
- Speaker: the speaker token's own `getConfig(...).whatEveryoneKnows` + `appearance` — that is the only NPC-to-NPC info they share.

When the `sameSceneContext` setting is on, the last 10 IC chat messages from the same scene (excluding the NPC itself) are also appended. Keep this pipeline in mind before adding new "the NPC should know X" features — pick the right layer.

### Combat, SFX, and integrations
- `updateCombat`/`updateCombatant` hooks drive combat banter (gated by the `combatBanterEnabled` setting).
- Each NPC config can name a Foundry Playlist UUID (`config.playlist`); sound names from that playlist are passed to the backend as an `sfx` allow-list so the AI can reference them by name in replies. `createChatMessage.mjs` plays them back.
- Optional integration: if `acd-talking-actors` is active, `init.mjs` registers an extra `talkingActorsEnabled` setting and narration is delegated to that module.

### Settings and model tiers
All settings are registered in `scripts/hooks/init.mjs` under the `"intelligent-npcs"` namespace. The `model` setting (`v1` / `hybrid` / `v2`) is a per-world default; individual NPCs can override it via `npc.getFlag("intelligent-npcs", "model")` where `"default"` means "inherit world setting". The `experiment` setting is a free-form string forwarded to the backend for opt-in experimental prompt tweaks.

## User-facing behavior (from the wiki)

The end-user docs live in the GitHub wiki (<https://github.com/cswendrowski/FoundryVTT-Intelligent-NPCs/wiki>). Things worth knowing when writing code because they shape user expectations:

- **Activation flow** (wiki: "How to configure and use"): user creates a JournalEntryPage, switches its sheet to "Intelligent NPC Configuration", fills fields, then opens a token/Actor and picks that page from the "Intelligent NPCs" header button (`getActorHeaderButtons` hook → `ActoriNpcConfiguration`). API key comes from Patreon/Discord, entered in module settings.
- **Three-layer identity model** (wiki: "What makes an NPC intelligent"): *where they are* (scene/area/world context) + *who they are* (NPC page fields + dynamic memory) + *who they're talking to* (speaker summary/appearance). This is the same hierarchy encoded in `context-hierarchy.d2` and the `getConfig` merge — keep these three layers conceptually distinct when adding features.
- **Dynamic memory**: the `memory` field on NPC flags is *writable at runtime*. GMs are expected to edit it mid-game to plant hooks, record events, or reset it when the NPC changes locations. Don't treat memory as read-only config.
- **GM direction via whisper, not a slash command**: when a message is `CHAT_MESSAGE_TYPES.WHISPER` from an `isGM` user (see `createChatMessage.mjs` ~line 371), the module rewrites it into the history as `Command: ...` instead of `Speaker: ... Message: ...`. The wiki calls this `/gm` colloquially but there is no such slash command — it is just a GM whisper. Strong-personality NPCs may disregard commands, which is intentional.
- **Combat banter** (wiki: "Combat Banter", since v1.5.0): fires on *start of turn* and *when marked defeated*, uses token disposition (HOSTILE/FRIENDLY) and resource bars. Per-combat banter history is kept so NPCs hear each other, but is intentionally not persisted long-term — don't add "memory" pathways for it.
- **Speech-to-text** is out-of-process: users open <https://intelligentttrpgs.azurewebsites.net/transcription> on a separate device, pair via a per-user ID (right-click a Foundry user to copy it), and the Website's SignalR hub pushes transcripts into Foundry via the `ReceiveTranscription` event handled in `hub.mjs`. Billed at 1 message per minute of audio, rounded up — all users bill against the world's single API key.
- **Tips for GMs** wiki page frames off-script NPC behavior as a feature, not a bug. Avoid "fixing" divergence by over-constraining the prompt; the product intent is improvisation within the provided context.

## Conventions

- **Foundry compatibility target is v10 minimum, v12 verified** (`module.json`). Avoid v13+ APIs. When touching chat, note that `CONST.CHAT_MESSAGE_TYPES.IC` is still used — don't migrate to the newer style unless bumping the verified version.
- Flag namespace is always `"intelligent-npcs"`. Use `getFlag`/`setFlag` or direct `flags["intelligent-npcs"]` access; both patterns coexist in the codebase.
- Templates live in `templates/` (top-level dialogs) and `templates/journal/` (the page sheets). Styles in `styles/intelligent-npcs.css`. Localization strings in `languages/en.json`.
- The `packs/` directory is a release artifact, not source — don't commit to it.
