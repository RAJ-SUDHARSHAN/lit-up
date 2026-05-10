<script lang="ts">
  import { flip } from "svelte/animate";
  import { fly } from "svelte/transition";
  import { sortHand, type Card } from "@lit-up/shared";
  import PlayingCard from "./PlayingCard.svelte";

  interface Props {
    hand: Card[];
    /** Cards added in the most recent state change — they get the glow. */
    newlyAddedCards?: Card[];
  }

  let { hand, newlyAddedCards = [] }: Props = $props();
  let sorted = $derived(sortHand(hand));

  /**
   * Per-card transforms for the fan: each card rotates a few degrees off
   * vertical and lifts slightly, with the deepest dip in the middle so the
   * fan curves like a held hand of cards. Indices are relative to the
   * center of the hand so the fan is symmetric.
   */
  function fanTransform(i: number, n: number): { rot: number; ty: number } {
    if (n <= 1) return { rot: 0, ty: 0 };
    const middle = (n - 1) / 2;
    const diff = i - middle;
    // Subtle spread: cap total at ±10° even for big hands.
    const maxRot = Math.min(2, 10 / Math.max(middle, 1));
    const rot = diff * maxRot;
    // Quadratic dip: edges sit slightly lower than center, capped at ~10px.
    const ty = Math.min(10, Math.abs(diff) ** 1.4 * 0.7);
    return { rot, ty };
  }

  /**
   * Card overlap shrinks as the hand gets bigger, so 14 cards fit on a
   * normal viewport without horizontal scrolling.
   */
  function fanOverlap(n: number): number {
    if (n <= 6) return 38;
    if (n <= 10) return 50;
    return 60;
  }
</script>

<section class="hand-fan" aria-label="Your hand of {sorted.length}">
  {#if sorted.length === 0}
    <p class="hand-fan-empty">You're empty-handed.</p>
  {:else}
    <div
      class="hand-fan-cards"
      style="--overlap: {fanOverlap(sorted.length)}px;"
    >
      {#each sorted as card, i (card)}
        {@const t = fanTransform(i, sorted.length)}
        <div
          class="hand-fan-slot"
          style="--rot: {t.rot}deg; --ty: {t.ty}px;"
          animate:flip={{ duration: 350 }}
          in:fly={{ y: 90, duration: 380 }}
          out:fly={{ y: 50, duration: 220 }}
        >
          <PlayingCard {card} isNew={newlyAddedCards.includes(card)} />
        </div>
      {/each}
    </div>
  {/if}
</section>

<style>
  .hand-fan {
    position: absolute;
    left: 50%;
    bottom: 0;
    transform: translateX(-50%);
    z-index: 6;
    pointer-events: none;
    width: 100%;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding-bottom: 0;
  }
  .hand-fan-cards {
    position: relative;
    display: flex;
    align-items: flex-end;
    /* padding-top leaves room for the hover-raise; padding-bottom absorbs
       the extra height that rotated edge cards add to their bounding box. */
    padding: 36px 30px 24px;
  }
  .hand-fan-slot {
    pointer-events: auto;
    margin-left: calc(var(--overlap, 38px) * -1);
    transform: rotate(var(--rot)) translateY(var(--ty));
    transform-origin: bottom center;
    transition:
      transform 0.22s var(--ease-spring),
      margin 0.2s var(--ease-out);
    position: relative;
  }
  .hand-fan-slot:first-child {
    margin-left: 0;
  }
  /* Lift the hovered card straight up, undo the fan rotation, and bring
     it to the front so neighbors don't crop. */
  .hand-fan-slot:hover {
    transform: rotate(0deg) translateY(-32px) scale(1.08);
    z-index: 50;
  }

  .hand-fan-empty {
    margin: 0 0 18px;
    font-size: 0.86rem;
    color: var(--muted);
    font-style: italic;
    pointer-events: auto;
  }

  @media (max-width: 760px) {
    .hand-fan-cards {
      /* Keep the bottom buffer for rotation-extension; only reduce the
         hover headroom and side padding on small screens. */
      padding: 24px 14px 24px;
    }
  }
</style>
