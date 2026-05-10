<script lang="ts">
  import { AVATAR_CHARACTERS, AVATAR_ILLUSTRATIONS, illustrationUrl } from "@lit-up/shared";

  interface Props {
    value: string;
    /** Used to render a live preview of the avatar with the picked glyph. */
    name: string;
    avatar: string;
    onChange: (character: string) => void;
  }

  let { value, name, avatar, onChange }: Props = $props();

  let initial = $derived(name ? name.slice(0, 1).toUpperCase() : "?");
</script>

<div class="char-section" role="radiogroup" aria-label="Avatar character">
  <div class="char-section-label">Illustrated</div>
  <div class="char-grid">
    {#each AVATAR_ILLUSTRATIONS as art (art)}
      {@const seed = art.slice("art:".length)}
      <button
        type="button"
        class="char-btn art"
        class:selected={value === art}
        role="radio"
        aria-checked={value === art}
        aria-label="Avatar {seed}"
        onclick={() => onChange(art)}
      >
        <img src={illustrationUrl(seed)} alt="" loading="lazy" draggable="false" />
      </button>
    {/each}
  </div>

  <div class="char-section-label">Emoji</div>
  <div class="char-grid">
    <button
      type="button"
      class="char-btn letter"
      class:selected={value === ""}
      role="radio"
      aria-checked={value === ""}
      aria-label="Use my initial"
      title="Use the first letter of your name"
      style="background:{avatar};"
      onclick={() => onChange("")}
    >
      {initial}
    </button>

    {#each AVATAR_CHARACTERS as ch (ch)}
      <button
        type="button"
        class="char-btn"
        class:selected={value === ch}
        role="radio"
        aria-checked={value === ch}
        aria-label={ch}
        onclick={() => onChange(ch)}
      >
        {ch}
      </button>
    {/each}
  </div>
</div>

<style>
  .char-section { display: flex; flex-direction: column; gap: 8px; }
  .char-section-label {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--muted);
    font-weight: 700;
  }
  .char-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(40px, 1fr));
    gap: 6px;
    max-width: 360px;
  }
  .char-btn {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.05);
    border: 1.5px solid var(--panel-border);
    font-size: 1.15rem;
    line-height: 1;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.15s var(--ease-spring), border-color 0.15s, background 0.15s;
    overflow: hidden;
    padding: 0;
  }
  .char-btn:hover {
    transform: translateY(-2px) scale(1.05);
    background: rgba(255, 255, 255, 0.1);
  }
  .char-btn.selected {
    border-color: var(--accent);
    box-shadow: 0 0 0 1px rgba(52, 211, 153, 0.45);
  }
  .char-btn.letter {
    color: #fff;
    font-weight: 800;
    font-size: 1rem;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
  }
  .char-btn.art {
    background: rgba(255, 255, 255, 0.04);
  }
  .char-btn.art img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
</style>
