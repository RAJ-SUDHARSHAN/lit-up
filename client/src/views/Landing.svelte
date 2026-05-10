<script lang="ts">
  import { untrack } from "svelte";
  import { fly } from "svelte/transition";
  import { AVATAR_COLORS, game } from "../lib/client.svelte";
  import AvatarPicker from "../components/AvatarPicker.svelte";
  import CharacterPicker from "../components/CharacterPicker.svelte";
  import Avatar from "../components/Avatar.svelte";

  interface Props {
    prefilledCode?: string;
  }

  let { prefilledCode = "" }: Props = $props();

  /**
   * The Landing flow has two modes — Create or Join — sharing the same
   * identity (name + avatar + character). Splitting the form into two
   * panels duplicated the picker and felt heavy; a single tabbed card
   * keeps the experience focused.
   *
   * If the URL carries a `?room=…` param we open in Join mode by default,
   * which matches the user's intent (they followed a link).
   */
  // We only consult `prefilledCode` at init to pick the starting tab;
  // user clicks on the tabs override this thereafter. `untrack` makes
  // svelte-check happy that we don't intend the tab to reset on prop
  // changes mid-session.
  let mode = $state<"create" | "join">(untrack(() => (prefilledCode ? "join" : "create")));

  let name = $state("");
  let code = $state("");
  let avatar = $state<string>(AVATAR_COLORS[0]);
  let character = $state<string>("");
  let appliedPrefill = $state(false);

  $effect(() => {
    if (!appliedPrefill && prefilledCode) {
      code = prefilledCode;
      appliedPrefill = true;
    }
  });

  function submit() {
    if (mode === "create") game.createRoom(name, avatar, character);
    else game.joinRoom(code, name, avatar, character);
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === "Enter") submit();
  }

  let canSubmit = $derived(
    mode === "create"
      ? name.trim().length > 0
      : name.trim().length > 0 && code.trim().length > 0,
  );
</script>

<section class="hero">
  <div class="hero-wordmark" aria-hidden="true">
    <span class="hero-spade">♠</span>
    <span class="hero-heart">♥</span>
    <span class="hero-diamond">♦</span>
    <span class="hero-club">♣</span>
  </div>
  <h1 class="hero-title">Lit Up</h1>
  <p class="hero-tagline">Real-time Literature, in your browser.</p>
  <ul class="hero-features">
    <li><span class="dot"></span>4 – 10 players, two teams</li>
    <li><span class="dot"></span>Bots fill empty seats</li>
    <li><span class="dot"></span>No accounts, just a room code</li>
  </ul>
</section>

<section class="entry-card">
  <div class="entry-tabs" role="tablist" aria-label="Mode">
    <button
      type="button"
      role="tab"
      aria-selected={mode === "create"}
      class:active={mode === "create"}
      onclick={() => (mode = "create")}
    >
      <span class="tab-icon">＋</span>
      Create room
    </button>
    <button
      type="button"
      role="tab"
      aria-selected={mode === "join"}
      class:active={mode === "join"}
      onclick={() => (mode = "join")}
    >
      <span class="tab-icon">→</span>
      Join room
    </button>
  </div>

  <div class="entry-body">
    <div class="entry-preview" aria-hidden="true">
      <Avatar {name} {avatar} {character} size={88} />
      <div class="entry-preview-name">{name.trim() || (mode === "create" ? "your name" : "join as…")}</div>
    </div>

    <div class="entry-fields">
      <label class="field">
        <span class="field-label">Name</span>
        <input
          class="input"
          type="text"
          bind:value={name}
          placeholder="Your name"
          maxlength={20}
          autocomplete="off"
          onkeydown={onKey}
        />
      </label>

      {#if mode === "join"}
        <label class="field" transition:fly={{ y: -6, duration: 180 }}>
          <span class="field-label">Room code</span>
          <input
            class="input mono"
            type="text"
            bind:value={code}
            placeholder="ABC123"
            maxlength={12}
            autocomplete="off"
            oninput={(e) => (code = e.currentTarget.value.toUpperCase())}
            onkeydown={onKey}
          />
        </label>
      {/if}

      <div class="field">
        <span class="field-label">Color</span>
        <AvatarPicker value={avatar} onChange={(c) => (avatar = c)} />
      </div>

      <div class="field">
        <span class="field-label">Character</span>
        <CharacterPicker
          value={character}
          {name}
          {avatar}
          onChange={(c) => (character = c)}
        />
      </div>

      <button
        type="button"
        class="btn btn-primary entry-submit"
        disabled={!canSubmit}
        onclick={submit}
      >
        {mode === "create" ? "Create room" : "Join room"}
      </button>
    </div>
  </div>
</section>

<section class="how">
  <h3>How to play</h3>
  <ol>
    <li><strong>Set up.</strong> Create a room (or join one) and pick an avatar.</li>
    <li><strong>Play.</strong> Ask opponents for cards from sets you already hold one of.</li>
    <li><strong>Score.</strong> Declare a set when your team holds all 6 of its cards.</li>
    <li><strong>Win.</strong> First team to 5 sets takes the game.</li>
  </ol>
  <p class="how-link">Full rules at <a href="https://www.pagat.com/quartet/literature.html" target="_blank" rel="noreferrer">Pagat</a>.</p>
</section>

<style>
  /* ── Hero ───────────────────────────────────────────── */
  .hero {
    text-align: center;
    padding: 22px 14px 8px;
    margin-bottom: 4px;
    position: relative;
  }
  .hero-wordmark {
    display: inline-flex;
    gap: 14px;
    font-size: 1.3rem;
    margin-bottom: 8px;
    opacity: 0.55;
    letter-spacing: 0.2em;
  }
  .hero-spade   { color: var(--text); }
  .hero-heart   { color: var(--card-red); }
  .hero-diamond { color: var(--card-red); }
  .hero-club    { color: var(--text); }
  .hero-title {
    margin: 0 0 4px;
    font-size: clamp(2.6rem, 9vw, 4rem);
    font-weight: 900;
    letter-spacing: -0.04em;
    background: linear-gradient(135deg, #fde68a, var(--gold), #fbbf24, #34d399);
    background-size: 200% 200%;
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    animation: hero-shimmer 8s ease-in-out infinite;
    line-height: 1;
  }
  @keyframes hero-shimmer {
    0%, 100% { background-position: 0% 50%; }
    50%      { background-position: 100% 50%; }
  }
  .hero-tagline {
    margin: 0 0 14px;
    color: var(--text-soft);
    font-size: 1.05rem;
    font-weight: 500;
  }
  .hero-features {
    list-style: none;
    margin: 0;
    padding: 0;
    display: inline-flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 6px 14px;
    font-size: 0.84rem;
    color: var(--muted);
  }
  .hero-features li {
    display: inline-flex;
    align-items: center;
    gap: 7px;
  }
  .hero-features .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--accent);
    box-shadow: 0 0 10px rgba(52, 211, 153, 0.7);
  }

  /* ── Entry card ─────────────────────────────────────── */
  .entry-card {
    margin: 0 auto;
    max-width: 720px;
    background:
      linear-gradient(180deg, rgba(20, 38, 26, 0.55), rgba(8, 18, 12, 0.65));
    border: 1px solid var(--panel-border);
    border-radius: 18px;
    box-shadow:
      0 16px 50px rgba(0, 0, 0, 0.5),
      inset 0 0 0 1px rgba(255, 255, 255, 0.02);
    overflow: hidden;
    position: relative;
  }
  /* Subtle accent strip across the top of the card. */
  .entry-card::before {
    content: "";
    position: absolute;
    inset: 0 0 auto 0;
    height: 2px;
    background: linear-gradient(90deg, transparent, var(--accent), var(--gold), transparent);
    opacity: 0.55;
  }

  .entry-tabs {
    display: grid;
    grid-template-columns: 1fr 1fr;
    border-bottom: 1px solid var(--panel-border);
  }
  .entry-tabs button {
    padding: 14px 16px;
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--muted);
    background: transparent;
    cursor: pointer;
    transition: color 0.18s var(--ease-out), background 0.18s var(--ease-out);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    position: relative;
  }
  .entry-tabs button:hover {
    color: var(--text);
    background: rgba(255, 255, 255, 0.03);
  }
  .entry-tabs button.active {
    color: var(--accent);
  }
  .entry-tabs button.active::after {
    content: "";
    position: absolute;
    bottom: 0;
    left: 14%;
    right: 14%;
    height: 2px;
    background: var(--accent);
    border-radius: 2px 2px 0 0;
  }
  .entry-tabs .tab-icon {
    font-size: 1.05rem;
    opacity: 0.85;
  }

  .entry-body {
    display: grid;
    gap: 22px;
    padding: 22px;
  }
  @media (min-width: 640px) {
    .entry-body {
      grid-template-columns: minmax(150px, 200px) 1fr;
      align-items: start;
    }
  }

  .entry-preview {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 12px;
    border-radius: 14px;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid var(--panel-border);
  }
  .entry-preview-name {
    font-size: 0.84rem;
    color: var(--text-soft);
    font-weight: 600;
    word-break: break-word;
    text-align: center;
    max-width: 160px;
  }

  .entry-fields {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .entry-fields .field {
    margin-bottom: 0;
  }

  .input.mono {
    font-family: "JetBrains Mono", "SF Mono", ui-monospace, monospace;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .entry-submit {
    margin-top: 4px;
    height: 46px;
    font-size: 0.98rem;
  }

  /* ── How to play ────────────────────────────────────── */
  .how {
    margin: 28px auto 0;
    max-width: 720px;
    padding: 22px;
    background: rgba(0, 0, 0, 0.28);
    border: 1px solid var(--panel-border);
    border-radius: 14px;
  }
  .how h3 {
    margin: 0 0 12px;
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--muted);
    font-weight: 700;
  }
  .how ol {
    list-style: none;
    counter-reset: step;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 10px;
  }
  .how li {
    counter-increment: step;
    padding-left: 36px;
    position: relative;
    color: var(--text-soft);
    line-height: 1.55;
    font-size: 0.92rem;
  }
  .how li::before {
    content: counter(step);
    position: absolute;
    left: 0;
    top: 0;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: rgba(52, 211, 153, 0.16);
    border: 1px solid rgba(52, 211, 153, 0.4);
    color: var(--accent);
    font-weight: 800;
    font-size: 0.78rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .how li strong {
    color: var(--text);
  }
  .how-link {
    margin: 14px 0 0;
    font-size: 0.84rem;
    color: var(--muted);
  }
</style>
