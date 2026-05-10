<script lang="ts">
  import { AVATAR_COLORS } from "@lit-up/shared";

  interface Props {
    value: string;
    onChange: (color: string) => void;
  }

  let { value, onChange }: Props = $props();
</script>

<div class="avatar-picker" role="radiogroup" aria-label="Avatar color">
  {#each AVATAR_COLORS as color (color)}
    <button
      type="button"
      class="avatar-choice"
      class:selected={value === color}
      style="background:{color}"
      role="radio"
      aria-checked={value === color}
      aria-label="Color {color}"
      onclick={() => onChange(color)}
    ></button>
  {/each}
</div>
