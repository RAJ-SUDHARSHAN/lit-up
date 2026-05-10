<script lang="ts">
  import { fly, fade } from "svelte/transition";

  interface Props {
    open: boolean;
    onClose: () => void;
  }

  let { open, onClose }: Props = $props();
</script>

{#if open}
  <div
    class="rules-backdrop"
    onclick={onClose}
    role="presentation"
    transition:fade={{ duration: 180 }}
  ></div>
  <div
    class="rules-panel"
    role="dialog"
    aria-modal="true"
    aria-label="Quick rules"
    transition:fly={{ x: 400, duration: 280 }}
  >
    <header>
      <h3>Quick Rules</h3>
      <button class="btn btn-ghost btn-sm" onclick={onClose}>Close</button>
    </header>
    <ul class="rules-list">
      <li>Play with 4–10 players in two even teams.</li>
      <li>To ask a card, you must hold one from the same set.</li>
      <li>Got it? Keep your turn. Missed? Turn passes to them.</li>
      <li>Declare a set when your team holds all 6.</li>
      <li>Wrong declaration? The other team scores.</li>
      <li>First team to 5 sets wins.</li>
    </ul>
    <div>
      <strong style="font-size:.78rem;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);">
        The 9 sets
      </strong>
      <p class="muted" style="margin-top:6px;font-size:.86rem;line-height:1.6;">
        Each suit: Low (2–7) and High (9–A). Plus one wild set: all four 8s and both Jokers.
      </p>
    </div>
    <p class="muted" style="font-size:.82rem;">
      Full rules: <a href="https://www.pagat.com/quartet/literature.html" target="_blank" rel="noreferrer">Pagat</a>
    </p>
  </div>
{/if}
