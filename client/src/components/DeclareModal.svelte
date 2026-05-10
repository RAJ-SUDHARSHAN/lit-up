<script lang="ts">
  import { fly, fade } from "svelte/transition";
  import {
    CARD_TO_SET,
    cardShort,
    SET_DEFS,
    SET_LOOKUP,
    type Card,
    type SetKey,
  } from "@lit-up/shared";
  import { game } from "../lib/client.svelte";
  import type { PlayerSnapshot, RoomSnapshot } from "../lib/client.svelte";

  interface Props {
    room: RoomSnapshot;
    you: PlayerSnapshot;
    hand: Card[];
    onClose: () => void;
  }

  let { room, you, hand, onClose }: Props = $props();

  let claimed = $derived(new Set<SetKey>([...room.claimedA, ...room.claimedB]));
  let availableSets = $derived(
    SET_DEFS.filter(
      (s) => !claimed.has(s.key) && hand.some((c) => CARD_TO_SET.get(c) === s.key),
    ),
  );
  let teammates = $derived(room.players.filter((p) => p.team === you.team));

  let selectedSet = $state<SetKey>("");
  let assignments = $state<Record<Card, string>>({});

  $effect(() => {
    if (availableSets.length === 0) {
      selectedSet = "";
      return;
    }
    if (!availableSets.some((s) => s.key === selectedSet)) {
      selectedSet = availableSets[0].key;
    }
  });

  $effect(() => {
    if (!selectedSet) {
      assignments = {};
      return;
    }
    const next: Record<Card, string> = {};
    for (const card of SET_LOOKUP[selectedSet].cards) {
      next[card] = hand.includes(card) ? game.playerId : "";
    }
    assignments = next;
  });

  function declare() {
    if (!selectedSet) return;
    const set = SET_LOOKUP[selectedSet];
    if (set.cards.some((c) => !assignments[c])) {
      game.toast("Assign all 6 cards before declaring.", "warn");
      return;
    }
    game.declare({ setKey: selectedSet, assignments: { ...assignments } });
    onClose();
  }

  let canDeclare = $derived(
    room.status === "playing" &&
      room.turnId === game.playerId &&
      availableSets.length > 0,
  );
</script>

<div class="modal-backdrop" onclick={onClose} role="presentation" transition:fade={{ duration: 180 }}></div>

<div class="declare-modal" role="dialog" aria-modal="true" aria-label="Declare a set" transition:fly={{ y: 24, duration: 240 }}>
  <header class="modal-header">
    <div>
      <div class="modal-title">Declare a set</div>
      <div class="modal-sub">Assign every card to the teammate who holds it.</div>
    </div>
    <button class="modal-close" aria-label="Close" onclick={onClose}>×</button>
  </header>

  {#if availableSets.length === 0}
    <p class="muted">No declarable sets in your hand.</p>
    <button class="btn btn-ghost" onclick={onClose}>Close</button>
  {:else}
    <div class="field">
      <span class="field-label">Set</span>
      <select class="input" bind:value={selectedSet}>
        {#each availableSets as s (s.key)}
          <option value={s.key}>{s.label}</option>
        {/each}
      </select>
    </div>

    {#if selectedSet}
      <div class="declare-rows">
        {#each SET_LOOKUP[selectedSet].cards as card (card)}
          {@const info = cardShort(card)}
          <div class="declare-row">
            <span class="declare-card-chip {info.red ? 'red' : 'black'}">
              {info.rank}{info.symbol}
            </span>
            <select class="input" bind:value={assignments[card]}>
              <option value="">who has it?</option>
              {#each teammates as t (t.id)}
                <option value={t.id}>{t.id === game.playerId ? "You" : t.name}</option>
              {/each}
            </select>
          </div>
        {/each}
      </div>

      <div class="modal-actions">
        <button class="btn btn-ghost" onclick={onClose}>Cancel</button>
        <button class="btn btn-gold" onclick={declare} disabled={!canDeclare}>Declare</button>
      </div>
    {/if}
  {/if}
</div>

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    backdrop-filter: blur(4px);
    z-index: 380;
  }
  .declare-modal {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 390;
    width: min(440px, calc(100vw - 24px));
    max-height: calc(100vh - 60px);
    overflow-y: auto;
    background: rgba(10, 22, 14, 0.97);
    border: 1px solid var(--panel-border);
    border-radius: 16px;
    box-shadow: 0 24px 80px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(251, 191, 36, 0.18);
    padding: 22px;
    backdrop-filter: blur(20px);
  }
  .modal-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 16px;
  }
  .modal-title {
    font-size: 1.08rem;
    font-weight: 800;
    color: var(--gold);
  }
  .modal-sub {
    font-size: 0.82rem;
    color: var(--muted);
    margin-top: 2px;
  }
  .modal-close {
    color: var(--muted);
    font-size: 1.6rem;
    line-height: 1;
    width: 32px;
    height: 32px;
    border-radius: 8px;
  }
  .modal-close:hover { background: rgba(255, 255, 255, 0.08); color: var(--text); }

  .declare-rows {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 12px 0;
  }
  .declare-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .declare-card-chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 50px;
    padding: 4px 8px;
    border-radius: 6px;
    background: var(--card-bg);
    font-weight: 800;
    font-size: 0.92rem;
  }
  .declare-card-chip.red { color: var(--card-red); }
  .declare-card-chip.black { color: var(--card-black); }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 12px;
  }
</style>
