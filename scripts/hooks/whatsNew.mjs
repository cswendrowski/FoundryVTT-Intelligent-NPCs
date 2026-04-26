/**
 * Module-version "What's new" notifier.
 *
 * Tracks the last module version a given user has seen via a per-user
 * client setting. On ready, if the active module version is newer than
 * the last-seen version (and the GM hasn't muted the feature), posts a
 * single GM-only chat card listing the highlights since their last load.
 *
 * Add new entries to RELEASE_NOTES below as features ship. Newest first.
 * Each entry is shown if the user's last-seen version is older than its
 * `since` field. Use simple semver comparisons.
 */

const RELEASE_NOTES = [
    {
        since: "2.0.0",
        title: "v2 — declarative side-effects, objectives, GM resolution",
        bullets: [
            "<b>Reasoning</b> shows up under each NPC reply as a GM-only collapsible — peek into the NPC's planning step.",
            "<b>GM Resolution cards</b>: NPCs can now ask the GM to adjudicate contested actions (climbs, sneaks, persuasion) with Approve / Deny / Custom buttons.",
            "<b>Objectives</b> field on the NPC sheet — markdown checklist (<code>- [ ] Find the keg thief</code>) drives the NPC toward its tactical sub-goals. Best on the Quality tier.",
            "<b>Memory updates</b>: NPCs now self-append memory entries when something material happens (a name, a deal, a betrayal). The CoreMemory loop continues to compact long histories.",
            "<b>Multi-SFX</b>: an NPC can play multiple sounds in one beat (door-slam + gasp).",
        ],
    },
    {
        since: "2.1.0",
        title: "v2.1 — UX polish",
        bullets: [
            "Actor INPC config now has a one-click <b>Create new page from this actor</b> button when no journal page is wired.",
            "<b>iNpcs</b> button on the Journal sidebar (renamed from the old longer label) opens the catalog browser.",
            "Imported NPCs in the catalog now show a <b>Create Actor</b> button alongside Open Journal — drag-and-drop ready.",
            "Per-NPC <b>Combat Banter</b> override on the actor INPC config — silence individual NPCs without disabling the world setting.",
            "GM Resolution buttons now have hover-tooltips explaining what Approve / Deny / Custom each do.",
        ],
    },
];

function compareSemver(a, b) {
    const pa = a.split(".").map(n => parseInt(n, 10) || 0);
    const pb = b.split(".").map(n => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const av = pa[i] ?? 0;
        const bv = pb[i] ?? 0;
        if (av !== bv) return av < bv ? -1 : 1;
    }
    return 0;
}

export async function showWhatsNewIfNeeded() {
    if ( !game.user.isGM ) return;

    const muted = game.settings.get("intelligent-npcs", "muteWhatsNew");
    if ( muted ) return;

    const moduleVersion = game.modules.get("intelligent-npcs")?.version ?? "0.0.0";
    if ( moduleVersion === "#{VERSION}#" ) return;  // dev / unreleased build

    const lastSeen = game.settings.get("intelligent-npcs", "lastSeenVersion") || "0.0.0";
    if ( compareSemver(lastSeen, moduleVersion) >= 0 ) return;

    // Collect entries the user hasn't seen yet.
    const fresh = RELEASE_NOTES.filter(n => compareSemver(lastSeen, n.since) < 0);
    if ( fresh.length === 0 ) {
        await game.settings.set("intelligent-npcs", "lastSeenVersion", moduleVersion);
        return;
    }

    const sections = fresh.map(n => `
        <h3 style="margin: 0.6em 0 0.3em; color: #6e0000;">${n.title}</h3>
        <ul style="margin: 0; padding-left: 1.2em;">
            ${n.bullets.map(b => `<li style="margin: 0.2em 0;">${b}</li>`).join("")}
        </ul>
    `).join("");

    const content = `
        <div class="inpc-whats-new">
            <h2 style="margin-top: 0;"><i class="fas fa-sparkles"></i> Intelligent NPCs ${moduleVersion}</h2>
            <p class="notes">Here's what's new since you last loaded.</p>
            ${sections}
            <p class="notes" style="margin-top: 0.6em;">You can mute this card via <i>Game Settings → Intelligent NPCs → Mute "What's New" cards</i>.</p>
        </div>
    `;

    await ChatMessage.create({
        user: game.user.id,
        whisper: game.users.filter(u => u.isGM).map(u => u.id),
        content: content,
        flags: { "intelligent-npcs": { whatsNew: true } },
    });

    await game.settings.set("intelligent-npcs", "lastSeenVersion", moduleVersion);
}
