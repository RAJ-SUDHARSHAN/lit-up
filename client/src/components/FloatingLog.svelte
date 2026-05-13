<script lang="ts">
  import { fly, fade } from "svelte/transition";
  import { cardShort } from "@lit-up/shared";
  import { classifyAction } from "../lib/format";
  import type { RoomSnapshot } from "../lib/client.svelte";

  interface Props {
    room: RoomSnapshot;
    /** Pixels from right edge. Increase when sidebar is open. */
    rightOffset?: number;
  }

  let { room, rightOffset = 18 }: Props = $props();

  let open = $state(false);
  let unread = $state(0);
  let prevTopAction = $state<string | undefined>();

  // The host picks how many recent transactions to display in the lobby.
  // 0 = "all" (server-capped at 20). This is locked once the game starts.
  let actions = $derived(
    room.defaultLogCount === 0
      ? room.actions
      : room.actions.slice(0, room.defaultLogCount),
  );

  $effect(() => {
    const top = room.actions[0];
    if (!open && top && top !== prevTopAction) {
      unread += 1;
    }
    prevTopAction = top;
  });

  function toggle() {
    open = !open;
    if (open) unread = 0;
  }

  let pendingAsker = $derived(
    room.pendingBotAsk
      ? room.players.find((p) => p.id === room.pendingBotAsk!.askerId) ?? null
      : null,
  );
  let pendingTarget = $derived(
    room.pendingBotAsk
      ? room.players.find((p) => p.id === room.pendingBotAsk!.targetId) ?? null
      : null,
  );
  let pendingInfo = $derived(room.pendingBotAsk ? cardShort(room.pendingBotAsk.card) : null);
</script>

{#if open}
  <div class="log-panel" role="region" aria-label="Action log" style="right: {rightOffset}px" transition:fly={{ y: 16, duration: 200 }}>
    <header class="log-panel-header">
      <span>Action log</span>
      <button class="log-close" onclick={toggle} aria-label="Close log">×</button>
    </header>
    <div class="log-list">
      {#if room.pendingBotAsk && pendingAsker && pendingTarget && pendingInfo}
        <div class="log-pending">
          <span class="log-pending-text">{pendingAsker.name} → {pendingTarget.name}</span>
          <span class="log-pending-card {pendingInfo.red ? 'red' : 'black'}">
            {pendingInfo.rank}{pendingInfo.symbol}
          </span>
          <span class="log-pending-dots">…</span>
        </div>
      {/if}
      {#if actions.length === 0}
        <p class="muted">Nothing yet.</p>
      {:else}
        {#each actions as txt, i (i + "-" + txt)}
          <div class="log-row {classifyAction(txt)}">{txt}</div>
        {/each}
      {/if}
    </div>
  </div>
{/if}

<button
  class="log-toggle"
  class:active={open}
  style="right: {rightOffset}px"
  onclick={toggle}
  aria-expanded={open}
  aria-label="Toggle action log"
>
  <span class="log-toggle-icon" aria-hidden="true">≡</span>
  <span>Log</span>
  {#if unread > 0 && !open}
    <span class="log-toggle-badge" transition:fade={{ duration: 120 }}>{unread}</span>
  {/if}
</button>

<style>
  .log-toggle {
    position: fixed;
    right: 18px;
    bottom: 18px;
    z-index: 350;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 9px 14px;
    border-radius: 999px;
    background: rgba(8, 18, 12, 0.92);
    border: 1px solid var(--panel-border);
    color: var(--text);
    font-size: 0.84rem;
    font-weight: 700;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
    backdrop-filter: blur(10px);
    transition: transform 0.15s var(--ease-out), background 0.18s, border-color 0.18s;
  }
  .log-toggle:hover {
    transform: translateY(-1px);
    background: rgba(20, 38, 26, 0.95);
    border-color: rgba(52, 211, 153, 0.32);
  }
  .log-toggle.active {
    background: rgba(52, 211, 153, 0.16);
    border-color: var(--accent);
    color: var(--accent);
  }
  .log-toggle-icon {
    font-size: 1rem;
    line-height: 1;
  }
  .log-toggle-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: 999px;
    background: var(--gold);
    color: #2a1a00;
    font-size: 0.68rem;
    font-weight: 800;
    margin-left: 2px;
  }

  .log-panel {
    position: fixed;
    right: 18px;
    bottom: 70px;
    z-index: 350;
    width: min(360px, calc(100vw - 36px));
    max-height: 60vh;
    background: rgba(8, 18, 12, 0.96);
    border: 1px solid var(--panel-border);
    border-radius: 14px;
    box-shadow: 0 16px 50px rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(14px);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .log-panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 14px;
    border-bottom: 1px solid var(--panel-border);
    font-size: 0.74rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--muted);
  }
  .log-close {
    color: var(--muted);
    font-size: 1.2rem;
    line-height: 1;
    width: 24px;
    height: 24px;
    border-radius: 6px;
  }
  .log-close:hover { background: rgba(255, 255, 255, 0.08); color: var(--text); }
  .log-list {
    overflow-y: auto;
    padding: 8px 14px 14px;
    display: flex;
    flex-direction: column;
    gap: 0;
    scrollbar-width: thin;
    scrollbar-color: var(--panel-border) transparent;
  }
  .log-row {
    font-size: 0.82rem;
    line-height: 1.45;
    padding: 6px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    animation: log-row-in 0.32s var(--ease-out);
  }
  .log-row:last-child { border-bottom: none; }
  @keyframes log-row-in {
    from { opacity: 0; transform: translateY(-4px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .log-row.txn-info    { color: var(--text); }
  .log-row.txn-success { color: #6ee7b7; }
  .log-row.txn-fail    { color: #fca5a5; }
  .log-row.txn-declare { color: var(--gold); }
  .log-row.txn-pass    { color: #94a3b8; }

  .log-pending {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 0 10px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    margin-bottom: 4px;
  }
  .log-pending-text {
    font-size: 0.78rem;
    color: var(--gold);
    flex: 1;
    font-weight: 600;
  }
  .log-pending-card {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 50px;
    border-radius: 6px;
    background: var(--card-bg);
    border: 1.5px solid var(--card-border);
    font-weight: 800;
    font-size: 0.78rem;
    animation: pending-pulse-bg 1.1s ease-in-out infinite;
  }
  .log-pending-card.red   { color: var(--card-red); }
  .log-pending-card.black { color: var(--card-black); }
  @keyframes pending-pulse-bg {
    0%, 100% { box-shadow: 1px 3px 8px rgba(0, 0, 0, 0.4), 0 0 0 0 rgba(251, 191, 36, 0); }
    50%      { box-shadow: 1px 3px 8px rgba(0, 0, 0, 0.4), 0 0 0 5px rgba(251, 191, 36, 0.28); }
  }
  .log-pending-dots {
    color: var(--gold);
    animation: dots-pulse 1.5s ease-in-out infinite;
  }
  @keyframes dots-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }
</style>
