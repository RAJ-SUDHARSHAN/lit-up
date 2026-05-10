<script lang="ts">
  import { onMount, tick } from "svelte";
  import { fly, fade } from "svelte/transition";
  import type { PlayerSnapshot } from "../lib/client.svelte";
  import Avatar from "./Avatar.svelte";

  interface Props {
    target: PlayerSnapshot;
    /** Used as a per-room namespace so notes don't bleed across rooms. */
    roomCode: string;
    onClose: () => void;
  }

  let { target, roomCode, onClose }: Props = $props();

  /** Notes are stored client-side only — never synced to the server or
   *  other players. sessionStorage keeps them across reloads within the
   *  same browser tab but clears them when the tab closes. */
  let storageKey = $derived(`lit-up:${roomCode}:notes:${target.id}`);
  let value = $state<string>("");

  function readNote(key: string): string {
    try { return sessionStorage.getItem(key) ?? ""; } catch { return ""; }
  }

  // Hydrate from storage whenever the target/room changes. Game.svelte
  // re-mounts this component on each new target, but if Svelte ever
  // reuses the instance, this keeps the textarea in sync.
  $effect(() => {
    value = readNote(storageKey);
  });
  let popoverEl: HTMLDivElement | null = $state(null);
  let posStyle = $state("left:0;top:0;");
  let positioned = $state(false);

  function persist() {
    try { sessionStorage.setItem(storageKey, value); } catch {
      // Storage may be disabled in strict-privacy mode; quietly drop.
    }
  }

  function positionToSeat() {
    const seat = document.getElementById(`seat-${target.id}`);
    if (!seat || !popoverEl) return;
    const seatRect = seat.getBoundingClientRect();
    const popRect = popoverEl.getBoundingClientRect();
    const margin = 12;

    let left = seatRect.left + seatRect.width / 2 - popRect.width / 2;
    let top = seatRect.top - popRect.height - margin;
    if (top < margin) top = seatRect.bottom + margin;
    if (top + popRect.height > window.innerHeight - margin) {
      top = window.innerHeight - margin - popRect.height;
    }
    if (left + popRect.width > window.innerWidth - margin) {
      left = window.innerWidth - margin - popRect.width;
    }
    if (left < margin) left = margin;

    posStyle = `left:${left}px; top:${top}px;`;
    positioned = true;
  }

  onMount(() => {
    positionToSeat();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { persist(); onClose(); } };
    const onResize = () => positionToSeat();
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      persist();
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  });

  // Re-position whenever content changes the popover height.
  $effect(() => {
    void value;
    if (positioned) tick().then(() => positionToSeat());
  });

  function close() {
    persist();
    onClose();
  }
</script>

<div class="notes-backdrop" role="presentation" onclick={close} transition:fade={{ duration: 150 }}></div>

<div
  class="notes-popover"
  class:positioned
  bind:this={popoverEl}
  style={posStyle}
  role="dialog"
  aria-modal="true"
  aria-label="Notes about {target.name}"
  tabindex="-1"
  out:fly={{ y: -8, duration: 160 }}
  onclick={(e) => e.stopPropagation()}
  onkeydown={(e) => e.stopPropagation()}
>
  <header>
    <Avatar name={target.name} avatar={target.avatar} character={target.character} team={target.team} size={30} />
    <div class="notes-titles">
      <strong>Notes — {target.name}</strong>
      <small>Private to you, saved in this tab.</small>
    </div>
    <button class="notes-close" aria-label="Close" onclick={close}>×</button>
  </header>
  <textarea
    class="notes-textarea"
    placeholder="What do they hold? What sets are they short on?"
    bind:value
    oninput={persist}
    rows="6"
  ></textarea>
</div>

<style>
  .notes-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.32);
    backdrop-filter: blur(2px);
    z-index: 350;
  }
  .notes-popover {
    position: fixed;
    z-index: 360;
    width: min(320px, calc(100vw - 24px));
    background: rgba(8, 18, 12, 0.97);
    border: 1px solid var(--panel-border);
    border-radius: 14px;
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(96, 165, 250, 0.18);
    padding: 14px;
    backdrop-filter: blur(16px);

    opacity: 0;
    transform: translateY(-4px) scale(0.97);
    transition: opacity 0.18s var(--ease-out), transform 0.22s var(--ease-spring);
  }
  .notes-popover.positioned {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
  }
  .notes-titles { flex: 1; min-width: 0; }
  .notes-titles strong { display: block; font-size: 0.92rem; }
  .notes-titles small { color: var(--muted); font-size: 0.74rem; }
  .notes-close {
    color: var(--muted);
    font-size: 1.4rem;
    line-height: 1;
    width: 28px;
    height: 28px;
    border-radius: 6px;
  }
  .notes-close:hover { background: rgba(255, 255, 255, 0.08); color: var(--text); }

  .notes-textarea {
    width: 100%;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid var(--panel-border);
    border-radius: 8px;
    color: var(--text);
    padding: 9px 11px;
    font: inherit;
    font-size: 0.86rem;
    line-height: 1.45;
    resize: vertical;
    min-height: 100px;
    transition: border-color 0.18s var(--ease-out), box-shadow 0.18s var(--ease-out);
  }
  .notes-textarea:focus {
    outline: none;
    border-color: var(--info);
    box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.16);
  }
</style>
