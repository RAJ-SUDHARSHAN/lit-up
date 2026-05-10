<script lang="ts">
  import { fly } from "svelte/transition";
  import { game } from "../lib/client.svelte";
</script>

<div id="toast-container" aria-live="polite" aria-atomic="false">
  {#each game.toasts as toast (toast.id)}
    <div
      class="toast toast-{toast.kind}"
      transition:fly={{ x: 320, duration: 320 }}
    >
      {toast.text}
    </div>
  {/each}
</div>
