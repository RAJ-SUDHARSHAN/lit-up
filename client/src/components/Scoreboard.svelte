<script lang="ts">
  import { cardShort, SET_LOOKUP, type SetKey } from "@lit-up/shared";
  import type { RoomSnapshot } from "../lib/client.svelte";

  interface Props {
    room: RoomSnapshot;
  }

  let { room }: Props = $props();

  let prevA = $state(0);
  let prevB = $state(0);
  let popA = $state(false);
  let popB = $state(false);

  $effect(() => {
    if (room.scoreA !== prevA) {
      popA = true;
      prevA = room.scoreA;
      setTimeout(() => (popA = false), 600);
    }
  });
  $effect(() => {
    if (room.scoreB !== prevB) {
      popB = true;
      prevB = room.scoreB;
      setTimeout(() => (popB = false), 600);
    }
  });

  /**
   * The "first card" of a set is its declarative shorthand: 2♣ for clubs-low,
   * 9♣ for clubs-high, 8♣ for the wild set, etc. Each declared set leaves
   * exactly that one card face on the felt as a permanent reminder that
   * the set is locked away.
   */
  function representativeCard(setKey: SetKey): string {
    const set = SET_LOOKUP[setKey];
    return set?.cards[0] ?? "";
  }
</script>

<div class="felt-scoreboard">
  <div class="felt-score-half team-a" class:score-pop={popA}>
    <div class="felt-score-row">
      <div class="felt-score-label">Team A</div>
      <div class="felt-score-num">{room.scoreA}</div>
    </div>
    <div class="felt-claimed-row">
      {#if room.claimedA.length === 0}
        <span class="felt-claimed-empty">—</span>
      {:else}
        {#each room.claimedA as setKey (setKey)}
          {@const card = representativeCard(setKey)}
          {@const info = cardShort(card)}
          <span
            class="claimed-card team-a"
            data-card={card}
            data-set={setKey}
            title={SET_LOOKUP[setKey]?.label}
          >
            <span class="claimed-card-rank {info.red ? 'red' : 'black'}">{info.rank}</span>
            <span class="claimed-card-suit {info.red ? 'red' : 'black'}">{info.symbol}</span>
          </span>
        {/each}
      {/if}
    </div>
  </div>

  <div class="felt-score-divider" aria-hidden="true">·</div>

  <div class="felt-score-half team-b" class:score-pop={popB}>
    <div class="felt-score-row">
      <div class="felt-score-label">Team B</div>
      <div class="felt-score-num">{room.scoreB}</div>
    </div>
    <div class="felt-claimed-row">
      {#if room.claimedB.length === 0}
        <span class="felt-claimed-empty">—</span>
      {:else}
        {#each room.claimedB as setKey (setKey)}
          {@const card = representativeCard(setKey)}
          {@const info = cardShort(card)}
          <span
            class="claimed-card team-b"
            data-card={card}
            data-set={setKey}
            title={SET_LOOKUP[setKey]?.label}
          >
            <span class="claimed-card-rank {info.red ? 'red' : 'black'}">{info.rank}</span>
            <span class="claimed-card-suit {info.red ? 'red' : 'black'}">{info.symbol}</span>
          </span>
        {/each}
      {/if}
    </div>
  </div>
</div>

<style>
  .felt-scoreboard {
    display: flex;
    align-items: stretch;
    gap: 14px;
    padding: 10px 18px;
    background: rgba(0, 0, 0, 0.32);
    border-radius: 14px;
    border: 1px solid rgba(255, 255, 255, 0.06);
    box-shadow: 0 6px 24px rgba(0, 0, 0, 0.45);
    min-width: 280px;
  }
  .felt-score-half {
    flex: 1;
    text-align: center;
    transition: transform 0.4s var(--ease-spring);
    min-width: 0;
  }
  .felt-score-half.score-pop {
    animation: felt-score-pop 0.55s var(--ease-spring);
  }
  @keyframes felt-score-pop {
    0%   { transform: scale(1); }
    40%  { transform: scale(1.16); }
    100% { transform: scale(1); }
  }

  .felt-score-row {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0;
  }
  .felt-score-label {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--muted);
  }
  .team-a .felt-score-label { color: var(--team-a-text); }
  .team-b .felt-score-label { color: var(--team-b-text); }

  .felt-score-num {
    font-size: 2.4rem;
    font-weight: 800;
    line-height: 1;
    margin: 2px 0 4px;
    color: var(--text);
  }

  .felt-claimed-row {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 4px;
    min-height: 36px;
    align-items: center;
  }
  .felt-claimed-empty {
    color: var(--muted);
    font-size: 0.7rem;
    opacity: 0.6;
  }

  /* Mini card face — first card of the declared set, framed in the
     team's monochrome color to attribute it. The dark/black ring around
     team B has a thin white inner stroke (matching the avatar treatment)
     so it stays legible on the dark felt. */
  .claimed-card {
    position: relative;
    width: 28px;
    height: 38px;
    border-radius: 5px;
    background: var(--card-bg);
    box-sizing: border-box;
    border: 2px solid;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: space-between;
    padding: 2px 3px;
    flex-shrink: 0;
    box-shadow: 1px 2px 6px rgba(0, 0, 0, 0.35);
    animation: claimed-card-in 0.45s var(--ease-spring);
  }
  .claimed-card.team-a {
    border-color: var(--team-a);
  }
  .claimed-card.team-b {
    border-color: var(--team-b);
    box-shadow:
      0 0 0 1px rgba(255, 255, 255, 0.22),
      1px 2px 6px rgba(0, 0, 0, 0.45);
  }
  @keyframes claimed-card-in {
    from { opacity: 0; transform: translateY(-6px) scale(0.7); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  .claimed-card-rank {
    font-size: 0.62rem;
    font-weight: 800;
    line-height: 1;
  }
  .claimed-card-suit {
    font-size: 0.7rem;
    line-height: 1;
    align-self: flex-end;
  }
  .claimed-card-rank.red,
  .claimed-card-suit.red { color: var(--card-red); }
  .claimed-card-rank.black,
  .claimed-card-suit.black { color: var(--card-black); }

  .felt-score-divider {
    color: rgba(255, 255, 255, 0.18);
    font-size: 1.2rem;
    align-self: center;
  }
</style>
