<script lang="ts">
  import { onMount, tick } from "svelte";
  import { fly, fade } from "svelte/transition";
  import {
    cardShort,
    CARD_TO_SET,
    SET_LOOKUP,
    SUITS,
    type Card,
    type SetKey,
  } from "@lit-up/shared";
  import { game } from "../lib/client.svelte";
  import { sound } from "../lib/sounds.svelte";
  import type { PlayerSnapshot, RoomSnapshot } from "../lib/client.svelte";
  import Avatar from "./Avatar.svelte";

  interface Props {
    target: PlayerSnapshot;
    room: RoomSnapshot;
    hand: Card[];
    onClose: () => void;
  }

  let { target, room, hand, onClose }: Props = $props();

  type Family = "C" | "D" | "H" | "S" | "8J";

  let suitFamily = $state<Family | null>(null);
  let popoverEl: HTMLDivElement | null = $state(null);
  /**
   * Start fully transparent and at (0, 0). The element renders invisibly so
   * we can measure it, then `positioned = true` triggers a CSS-driven fade-in
   * at the correct location. This avoids the "appear in the middle, then jump
   * to the seat" flash from the previous implementation.
   */
  let posStyle = $state("left:0;top:0;");
  let positioned = $state(false);

  const FAMILIES: ReadonlyArray<{ key: Family; label: string; sym: string; cls: string }> = [
    { key: "C", label: "Clubs", sym: "♣", cls: "" },
    { key: "D", label: "Diamonds", sym: "♦", cls: "red" },
    { key: "H", label: "Hearts", sym: "♥", cls: "red" },
    { key: "S", label: "Spades", sym: "♠", cls: "" },
    { key: "8J", label: "8s & Jokers", sym: "8s", cls: "gold" },
  ];

  let claimed = $derived(new Set<SetKey>([...room.claimedA, ...room.claimedB]));

  function setsForFamily(fam: Family): SetKey[] {
    if (fam === "8J") return ["eights_jokers"];
    const suit = SUITS.find((s) => s.key === fam);
    return suit
      ? [`${suit.name.toLowerCase()}_low`, `${suit.name.toLowerCase()}_high`]
      : [];
  }
  function familyHasAskable(fam: Family): boolean {
    return setsForFamily(fam).some(
      (sk) => !claimed.has(sk) && hand.some((c) => CARD_TO_SET.get(c) === sk),
    );
  }
  function askableInSet(setKey: SetKey): Card[] {
    if (claimed.has(setKey)) return [];
    if (!hand.some((c) => CARD_TO_SET.get(c) === setKey)) return [];
    return SET_LOOKUP[setKey].cards.filter((c) => !hand.includes(c));
  }
  function clickCard(card: Card) {
    sound.play("ask");
    game.ask({ toPlayerId: target.id, card });
    onClose();
  }

  /** Position the popover next to the targeted seat, clamped to viewport. */
  function positionToSeat() {
    const seat = document.getElementById(`seat-${target.id}`);
    if (!seat || !popoverEl) return;
    const seatRect = seat.getBoundingClientRect();
    const popRect = popoverEl.getBoundingClientRect();
    const margin = 12;

    // Default: centered horizontally on the seat, *above* the seat (since
    // the YOU seat is at the bottom and the seats most often clicked sit
    // above it; clamping below handles edge cases).
    let left = seatRect.left + seatRect.width / 2 - popRect.width / 2;
    let top = seatRect.top - popRect.height - margin;

    // If it would overflow the top of the viewport, place below the seat.
    if (top < margin) top = seatRect.bottom + margin;
    // If still off-screen at bottom, dock to the bottom of the viewport.
    if (top + popRect.height > window.innerHeight - margin) {
      top = window.innerHeight - margin - popRect.height;
    }
    if (top < margin) top = margin;

    // Horizontally clamp.
    if (left + popRect.width > window.innerWidth - margin) {
      left = window.innerWidth - margin - popRect.width;
    }
    if (left < margin) left = margin;

    posStyle = `left:${left}px; top:${top}px;`;
    positioned = true;
  }

  onMount(() => {
    // Measure & position synchronously before the browser paints, so the
    // popover is visible only at its final location. `bind:this` is set
    // before onMount fires, so popoverEl is guaranteed to exist here.
    positionToSeat();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onResize = () => positionToSeat();
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  });

  // Re-clamp once content (suit row → cards) changes height.
  $effect(() => {
    void suitFamily;
    if (positioned) {
      // Use tick so DOM has reflowed with the new content before measuring.
      tick().then(() => positionToSeat());
    }
  });
</script>

<div class="popover-backdrop" onclick={onClose} role="presentation" transition:fade={{ duration: 150 }}></div>

<div
  class="action-popover"
  class:positioned
  bind:this={popoverEl}
  style={posStyle}
  role="dialog"
  aria-modal="true"
  aria-label="Ask {target.name} for a card"
  tabindex="-1"
  out:fly={{ y: -8, duration: 160 }}
  onclick={(e) => e.stopPropagation()}
  onkeydown={(e) => e.stopPropagation()}
>
  <header class="popover-header">
    <div class="popover-target">
      <Avatar name={target.name} avatar={target.avatar} character={target.character} team={target.team} size={34} />
      <div class="popover-target-text">
        <div class="popover-target-name">Ask {target.name}</div>
        <div class="popover-target-sub">
          {target.cardCount} card{target.cardCount === 1 ? "" : "s"} · pick a suit
        </div>
      </div>
    </div>
    <button type="button" class="popover-close" aria-label="Close" onclick={onClose}>×</button>
  </header>

  <div class="popover-suits">
    {#each FAMILIES as fam (fam.key)}
      {@const enabled = familyHasAskable(fam.key)}
      <button
        type="button"
        class="popover-suit-tile {fam.cls}"
        class:selected={suitFamily === fam.key}
        disabled={!enabled}
        title={fam.label}
        onclick={() => (suitFamily = suitFamily === fam.key ? null : fam.key)}
      >
        {fam.sym}
      </button>
    {/each}
  </div>

  {#if suitFamily}
    <div class="popover-cards">
      {#each setsForFamily(suitFamily) as setKey (setKey)}
        {@const cards = askableInSet(setKey)}
        {#if cards.length > 0}
          <div class="popover-set-row">
            <div class="popover-set-label">{SET_LOOKUP[setKey].label}</div>
            <div class="popover-set-cards">
              {#each cards as card (card)}
                {@const info = cardShort(card)}
                <button
                  type="button"
                  class="mini-card {info.red ? 'red' : 'black'}"
                  data-card={card}
                  onclick={() => clickCard(card)}
                  aria-label="Ask for {info.rank}{info.symbol}"
                >
                  <span class="amr">{info.rank}</span>
                  <span class="ams">{info.symbol}</span>
                </button>
              {/each}
            </div>
          </div>
        {/if}
      {/each}
    </div>
  {:else}
    <p class="popover-hint">Pick a suit you have, then click the card to ask for.</p>
  {/if}
</div>

<style>
  .popover-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.32);
    backdrop-filter: blur(2px);
    z-index: 350;
  }
  .action-popover {
    position: fixed;
    z-index: 360;
    width: min(360px, calc(100vw - 24px));
    background: rgba(8, 18, 12, 0.96);
    border: 1px solid var(--panel-border);
    border-radius: 14px;
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(52, 211, 153, 0.18);
    padding: 14px 14px 16px;
    backdrop-filter: blur(16px);

    /* Hidden until positioned to avoid the center-then-snap flash. */
    opacity: 0;
    transform: translateY(-4px) scale(0.97);
    transition:
      opacity 0.18s var(--ease-out),
      transform 0.22s var(--ease-spring);
  }
  .action-popover.positioned {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  .popover-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 12px;
  }
  .popover-target {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 1;
    min-width: 0;
  }
  .popover-target-text { min-width: 0; }
  .popover-target-name {
    font-weight: 700;
    font-size: 0.95rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .popover-target-sub {
    font-size: 0.74rem;
    color: var(--muted);
  }
  .popover-close {
    color: var(--muted);
    font-size: 1.5rem;
    line-height: 1;
    width: 30px;
    height: 30px;
    border-radius: 8px;
    transition: background 0.15s, color 0.15s;
  }
  .popover-close:hover {
    background: rgba(255, 255, 255, 0.08);
    color: var(--text);
  }

  .popover-suits {
    display: flex;
    gap: 6px;
    margin-bottom: 12px;
  }
  .popover-suit-tile {
    flex: 1;
    height: 50px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.05);
    border: 1.5px solid var(--panel-border);
    color: var(--text);
    font-size: 1.45rem;
    transition: transform 0.15s var(--ease-out), background 0.15s, border-color 0.15s;
  }
  .popover-suit-tile:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.12);
    transform: translateY(-2px);
  }
  .popover-suit-tile.selected {
    background: rgba(52, 211, 153, 0.18);
    border-color: var(--accent);
    box-shadow: 0 0 0 1px rgba(52, 211, 153, 0.4);
  }
  .popover-suit-tile.red { color: var(--card-red); }
  .popover-suit-tile.gold { color: var(--gold); font-size: 0.95rem; font-weight: 800; }
  .popover-suit-tile:disabled { opacity: 0.25; cursor: not-allowed; }

  .popover-cards {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .popover-set-row {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .popover-set-label {
    font-size: 0.66rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--muted);
  }
  .popover-set-cards {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .popover-hint {
    font-size: 0.78rem;
    color: var(--muted);
    margin: 0;
    font-style: italic;
  }
</style>
