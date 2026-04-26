# UX walkthrough — fresh-user perspective

**Date:** 2026-04-25
**Scope:** Foundry v14, intelligent-npcs module post-feature work
            (declarative side-effects, objectives field, GM resolution card,
             CombatBark v2 prompt, memory v2 prompt).
**Method:** simulated a fresh user from "I just installed this" to
            "I have a working NPC I can talk to."

This isn't a feature critique — it's a friction inventory. Each item is
something a first-time user *will* hit, and the cost of removing the
friction is usually small.

## Setup / first impression

### F1 — Module settings: `experiment` field is unexplained

The Game Settings panel surfaces 8 module settings. Seven are clear; one
isn't:

> **Intelligent NPCs Experiment**
> *From time to time, we'll have new experimental model tweaks that you
>  can try out. Keep an eye on the Patreon for more information.*

A first-time user reading this thinks "do I need to put something here?"
and there's no "leave empty unless told otherwise" cue. **Fix:** prepend
*"Leave blank unless an active Patreon experiment tells you to set a
specific value. Most users should leave this empty."*

### F2 — `backAndForthDelay` units unintuitive

The hint reads *"the delay between NPC back-and-forth messages, in words
per second. Most people read around 3 words a second."* — units of "words
per second" for a "delay" setting parses oddly. **Fix:** rephrase as
*"How fast NPC-to-NPC banter scrolls, measured in words read per second
(higher = faster pacing)."*

### F3 — `sameSceneContext` is undocumented in plain language

*"Enable Same-Scene Context: If enabled, NPCs will be able to use Chatlog
context from the same Scene to inform their chat messages."* — a fresh
user can guess but a one-line concrete example would land harder. **Fix:**
add *"e.g. if Brenna and Tarn are both in the tavern and Tarn just cursed
out a thug, Brenna will have heard."*

## Onboarding / making the first NPC

### F4 — Onboarding wall: empty Journal Page dropdown

This is the biggest friction point. From a fresh world:

1. User opens an actor sheet.
2. Clicks the ⋮ controls dropdown.
3. Picks "Intelligent NPC."
4. Configuration dialog opens with a `Journal Page` dropdown that has
   only `[None]` in it.
5. There is no in-dialog hint about what to do.

To make any progress they have to:
- Close the dialog
- Open the Journal sidebar
- Create a new entry
- Add a page
- Switch the page sheet to "Intelligent NPC Configuration" (a
  Foundry-level dropdown, not labeled in the module UI)
- Fill out personality, background, etc.
- Re-open the actor's INPC dialog
- Pick the page from the dropdown
- Set "AI Enabled"
- Save

That's an 8-step rabbit hole with no in-dialog guidance.

**Fix options:**
- **Best:** in-dialog button "Create a new Intelligent NPC page from
  this actor's data" that scaffolds a journal entry/page automatically
  and selects it. One click.
- **Cheaper:** if the dropdown is empty, replace `[None]` with a
  `[Create new from this actor →]` option that opens the page-creation
  flow.
- **Cheapest:** add a `<p class="notes">` under the dropdown:
  *"No pages? Click [Browse Intelligent NPCs] in the Journal sidebar
  to import a free pre-made NPC, or create a new Journal entry → page →
  switch sheet to 'Intelligent NPC Configuration'."*

### F5 — "AI Enabled" defaults off after picking a page

After the user picks a journal page, the page name auto-fills and the
actor renames itself, but the `AI Enabled` checkbox is still unchecked.
The user has to remember to check it. **Fix:** auto-tick `AI Enabled`
the first time a journal page is picked (existing behavior already calls
`setFlag("enabled", true)` in `_onJournalPageChange` — verify the form
re-render reflects it; current state showed the checkbox still unchecked
in the open dialog after a swap).

### F6 — Discovery: header control hidden behind ⋮

On Foundry v14's ApplicationV2 actor sheets, the "Intelligent NPC" entry
only appears in the toggleControls dropdown (the ⋮ button in the window
header). A new user has no chrome cue that anything special exists for
their actor — they have to hunt. This is a v14 platform change, not a
module bug, but mitigation could be:
- Inject a small button or icon into the actor sheet body itself (e.g.
  near the character name, a brain-circuit icon that opens the INPC
  config). Mirrors what the journal sidebar already does with the
  "Intelligent NPCs" header-actions button.

### F7 — "Intelligent NPCs" sidebar button doesn't say it's a free catalog

The journal-directory header has a button labeled `[Intelligent NPCs]`
that opens the browser. New users don't know whether clicking will:
- Open a catalog of free pre-made NPCs (the actual behavior)
- Open settings
- Open something else

**Fix:** label it `[Browse Free NPCs]` or `[Import NPC...]` to clarify
it's a discovery path, not a config menu.

### F8 — "Test API Key" / "Account Status" exists but is hidden

The module injects an `[Intelligent NPCs Account Status]` button into the
Game Settings sidebar. A fresh user (especially one who just pasted an
API key) wants to confirm it works before spending time on setup. They
have to leave the world settings dialog and go back to the sidebar.

**Fix:** also surface a "Test connection" link inside the API Key setting
hint, OR add a one-time toast on world load that reports
`x-monthly-requests-remaining` if a key is set.

## Configuration dialog — fields and their meaning

### F9 — Two-layer memory/goals/objectives is invisible

The dialog has Memory, Goals, and Objectives textareas. The journal page
ALSO has these fields. Which is which?

- Page values are templates inherited at first attach.
- Actor values override templates; they're what runtime updates write to.

A fresh user sees both editable sets and wonders "why are these here
twice?" The note text on each actor-level textarea hints at it but
doesn't explicitly say *"this overrides the journal page; leave empty to
inherit the page's value"*.

**Fix:** for each of the three fields (memory, goals, objectives), the
note should say something like *"Overrides the journal page's <field>.
If empty, the page value is used. Reset to clear back to the page
template."*

### F10 — `Reset` button under Journal Page is destructive without warning text

When `canSwap === false` (because the actor has runtime divergence from
the page), the dialog shows a `Reset` button. The note says *"This NPC
has been customized. Please reset to swap configured personality"* —
that doesn't communicate that Reset wipes Memory, Message History, and
Goals. The button has a confirm dialog but the surrounding note could
warn earlier.

**Fix:** the note text should say *"Reset will clear this NPC's runtime
memory, goals, message history, and customizations, returning them to
the journal page's defaults. Required before swapping pages."*

### F11 — `Message History` textarea is read-only JSON

The "Message History" field at the bottom of the actor INPC config
dialog renders the conversation history as a raw JSON dump. This is
useful for power-users debugging weird NPC behavior, but it's not
helpful to a fresh user — and there's no `Clear History` button next to
it on the read-only textarea.

Wait, there IS a `Clear History` button (it's next to the textarea
label). But it's small and a fresh user might not associate it with the
dump below it. **Fix:** add a paragraph above the textarea:
*"This is the raw transcript the NPC remembers from its conversations.
You usually don't need to read it. Click 'Clear History' to start the
NPC fresh."*

## Conversation flow

### F12 — No-API-key error is good ✅

When chatting at an INPC without a key, the user gets a permanent toast:
*"You need to set your Intelligent NPCs API key in the module settings."*
Clear, actionable.

### F13 — How do I make my NPC talk?

After setup, a new user faces the question *"how do I trigger a
conversation?"* The answer is "target the NPC's token and post a
chat message," but there's no in-module documentation that says this.
The wiki probably has it, but in-module discoverability would help.

**Fix:** include a one-time GM-only chat card on first activation:
*"Tip: target an Intelligent NPC's token and send a chat message in
character. The NPC will reply. To make the GM speak as the NPC, whisper
to GMs — your message becomes a Command the NPC follows."*

### F14 — GM resolution card: first-time semantics opaque

When the NPC first emits `[GM_RESOLUTION]` and the card shows up:

> 🔨 NPC requests GM resolution
> *"Boblin attempts to climb the wall..."*
> [Approve] [Deny] [Custom...]
> ☑ Continue conversation

A fresh GM doesn't immediately know:
- *Why* the NPC is asking
- What "Approve" vs "Deny" actually does to the next turn
- What "Continue conversation" toggles

The Continue checkbox has a tooltip but the buttons don't. **Fix:** add
`data-tooltip` on each button:
- Approve: *"The NPC's action succeeds. NPC will react in the next turn."*
- Deny: *"The NPC's action fails. NPC will react in the next turn."*
- Custom: *"Type a specific outcome. NPC will react in the next turn."*

Plus a one-line subtitle in the card itself: *"How does this play out?"*

### F15 — Reasoning collapsible is great ✅

The "Thoughts (GM only)" `<details>` element is well-shaped. New GMs
will discover it, click it, and immediately understand its purpose.

## Combat-specific

### F16 — `combatBanterEnabled` defaults to ON

A user who creates an Intelligent NPC and then enters combat will see
their NPC start shouting at people. This is by design — but a fresh
user might be surprised. Consider:

- Surface the setting more visibly OR
- Default to off and have the NPC config dialog include a per-NPC
  combat-banter checkbox so users opt in per character.

### F17 — Combat banter has no per-NPC silencer

If a user has `combatBanterEnabled: true` globally and one Intelligent
NPC actor that they DON'T want to bark in combat (e.g. a stealth-focused
character whose silence is part of the fiction), there's no per-NPC
opt-out short of disabling the NPC entirely.

**Fix:** add a per-NPC `combatBarkEnabled` flag on the actor INPC config
sheet (default inherits from world setting; per-NPC toggle overrides).

## Documentation gaps

### F18 — No in-module quickstart

Module has zero in-product help. Wiki link in CLAUDE.md is for
developers; the GM-facing GitHub wiki is mentioned in CLAUDE.md but not
linked from within the module. **Fix:** add a single "Help" entry to
the journal-directory header (next to the existing "Intelligent NPCs"
button) that opens a Foundry dialog with:
- A 3-step getting-started ("paste API key → import an NPC from the
  catalog → target its token and chat")
- A link to the wiki
- A link to the Discord/Patreon

### F19 — No version-update notes surfaced

If a returning user upgrades, they have no signal that new features
exist (objectives, GM resolution, reasoning, multi-SFX). **Fix:**
on first ready hook after a version bump, show a one-time GM-only
chat card listing what's new in this version, with a "Don't show
again" affordance.

## Priority for fix-up

If picking three to ship first:

1. **F4 (onboarding wall)** — the highest-impact friction. New users
   bounce off here.
2. **F14 (GM resolution tooltips)** — the resolution card is a flagship
   feature; first-time users need to understand its buttons.
3. **F9 (two-layer memory/goals/objectives explainer)** — the
   actor-vs-page model is currently invisible and confusing.

The rest are cleanup / polish. None require architectural change;
most are 1-3 line note-text or button-tooltip edits.
