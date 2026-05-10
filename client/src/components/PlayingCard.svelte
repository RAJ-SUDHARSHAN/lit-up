<script lang="ts">
  import { cardShort, type Card } from "@lit-up/shared";

  interface Props {
    card: Card;
    interactive?: boolean;
    isNew?: boolean;
    onclick?: () => void;
  }

  let { card, interactive = false, isNew = false, onclick }: Props = $props();

  let info = $derived(cardShort(card));
  let isJoker = $derived(card === "JR" || card === "JB");
</script>

{#if interactive}
  <button
    type="button"
    class="card"
    class:red={info.red}
    class:black={!info.red}
    class:joker={isJoker}
    class:interactive
    class:card-new={isNew}
    data-card={card}
    onclick={onclick}
  >
    <span class="cr tl">{info.rank}</span>
    <span class="cs tl">{info.symbol}</span>
    <span class="cc">{isJoker ? "🃏" : info.symbol}</span>
    <span class="cr br">{info.rank}</span>
    <span class="cs br">{info.symbol}</span>
  </button>
{:else}
  <div
    class="card"
    class:red={info.red}
    class:black={!info.red}
    class:joker={isJoker}
    class:card-new={isNew}
    data-card={card}
  >
    <span class="cr tl">{info.rank}</span>
    <span class="cs tl">{info.symbol}</span>
    <span class="cc">{isJoker ? "🃏" : info.symbol}</span>
    <span class="cr br">{info.rank}</span>
    <span class="cs br">{info.symbol}</span>
  </div>
{/if}
