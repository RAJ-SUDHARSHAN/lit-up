<script lang="ts">
  /**
   * Compact "you" indicator that sits just above the hand fan. Replaces
   * the avatar-and-stack seat-bubble that opponents use, since:
   *   - you can already see your own cards in the fan
   *   - the only actions you take from your own row are Declare and
   *     (when empty-handed) being-passed-to from a teammate seat
   *
   * The element keeps `id="seat-{you.id}"` so the card-flight animation
   * can still find it as a target. It also reflects pending-target state
   * if a bot asks you for a card.
   */

  import Avatar from "./Avatar.svelte";
  import type { PlayerSnapshot, RoomSnapshot } from "../lib/client.svelte";

  interface Props {
    you: PlayerSnapshot;
    room: RoomSnapshot;
    isYourTurn: boolean;
    isEmpty: boolean;
    canDeclare: boolean;
    onDeclare: () => void;
  }

  let { you, room, isYourTurn, isEmpty, canDeclare, onDeclare }: Props = $props();

  let isPendingTarget = $derived(
    room.pendingBotAsk?.targetId === you.id && !!room.pendingBotAsk?.askerId,
  );
</script>

<div
  class="you-tag"
  class:turn={isYourTurn}
  class:empty={isEmpty}
  class:pending-target={isPendingTarget}
  id="seat-{you.id}"
  role="region"
  aria-label="You: {you.name}"
>
  <Avatar name={you.name} avatar={you.avatar} character={you.character} team={you.team} size={32} />
  <span class="you-name">{you.name}</span>

  {#if canDeclare}
    <button type="button" class="you-declare-btn" onclick={onDeclare}>
      Declare
    </button>
  {:else if isYourTurn && isEmpty}
    <span class="you-empty-hint">empty — tap a teammate to pass</span>
  {/if}
</div>

<style>
  .you-tag {
    position: absolute;
    bottom: 178px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 5;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 18px;
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.6);
    border: 1.5px solid var(--panel-border);
    color: var(--text);
    backdrop-filter: blur(10px);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.5);
    transition:
      border-color 0.22s var(--ease-out),
      background 0.22s var(--ease-out),
      box-shadow 0.22s var(--ease-out),
      transform 0.18s var(--ease-out);
    pointer-events: auto;
    max-width: calc(100vw - 24px);
    white-space: nowrap;
  }
  .you-tag.turn {
    border-color: var(--gold);
    background: rgba(251, 191, 36, 0.14);
    animation: you-tag-glow 1.7s ease-in-out infinite;
  }
  @keyframes you-tag-glow {
    0%, 100% { box-shadow: 0 0 0 1px rgba(251, 191, 36, 0.42), 0 0 16px rgba(251, 191, 36, 0.25); }
    50%      { box-shadow: 0 0 0 2px rgba(251, 191, 36, 0.6),  0 0 32px rgba(251, 191, 36, 0.45); }
  }
  .you-tag.pending-target {
    border-color: var(--danger);
    background: rgba(248, 113, 113, 0.12);
    animation: none;
  }

  .you-name {
    font-weight: 700;
    font-size: 0.94rem;
    letter-spacing: 0.01em;
  }
  .you-declare-btn {
    padding: 5px 14px;
    border-radius: 8px;
    background: linear-gradient(135deg, var(--gold-dark), var(--gold));
    color: #2a1a00;
    font-weight: 800;
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    cursor: pointer;
    transition: transform 0.15s var(--ease-out), box-shadow 0.18s var(--ease-out);
  }
  .you-declare-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 14px rgba(251, 191, 36, 0.45);
  }
  .you-empty-hint {
    font-size: 0.78rem;
    color: var(--muted);
    font-style: italic;
  }

  @media (max-width: 760px) {
    .you-tag {
      bottom: 162px;
      padding: 7px 14px;
      gap: 10px;
    }
  }
</style>
