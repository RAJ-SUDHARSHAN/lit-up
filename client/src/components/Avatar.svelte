<script lang="ts">
  import { illustrationUrl, isIllustration, type Team } from "@lit-up/shared";

  interface Props {
    /** Display name; first letter is used as the glyph if `character` is empty. */
    name: string;
    /** Hex fill color of the inner circle (the player's chosen color). */
    avatar: string;
    /** Optional emoji glyph, illustration seed (`art:…`), or empty for initial. */
    character?: string;
    /** Team identifier — drives the outer ring color. Omit to skip the ring. */
    team?: Team;
    /** Visual diameter in pixels. */
    size?: number;
    /** When false, no team ring is drawn even if `team` is supplied. */
    showTeamRing?: boolean;
    /** Use a thinner/lighter ring style for ghost contexts (popovers etc.). */
    subtleRing?: boolean;
  }

  let {
    name,
    avatar,
    character = "",
    team,
    size = 36,
    showTeamRing = true,
    subtleRing = false,
  }: Props = $props();

  let illustrated = $derived(isIllustration(character));
  let illustrationSrc = $derived(
    illustrated ? illustrationUrl(character.slice("art:".length)) : "",
  );
  let glyph = $derived(
    illustrated ? "" : (character || (name ? name.slice(0, 1).toUpperCase() : "?")),
  );
  let ringColor = $derived(
    !team || !showTeamRing
      ? null
      : team === "A"
        ? "var(--team-a)"
        : "var(--team-b)",
  );
  /** Ring thickness scales with size so the band reads consistently. */
  let ringWidth = $derived(Math.max(2, Math.round(size * 0.075)));
  /** Glyph size: emoji and letters render reasonably at ~50% of the diameter. */
  let glyphSize = $derived(Math.round(size * 0.5));
  let isEmoji = $derived(!!glyph && /\p{Extended_Pictographic}/u.test(glyph));
</script>

<span
  class="avatar"
  class:has-ring={!!ringColor}
  class:subtle-ring={subtleRing}
  style="
    width:{size}px;
    height:{size}px;
    {ringColor ? `--ring-color:${ringColor}; padding:${ringWidth}px;` : ''}
  "
>
  <span
    class="avatar-fill"
    class:emoji={isEmoji}
    class:illustrated
    style="background:{avatar}; font-size:{glyphSize}px;"
    aria-hidden="true"
  >
    {#if illustrated}
      <img
        class="avatar-illustration"
        src={illustrationSrc}
        alt=""
        loading="lazy"
        draggable="false"
        referrerpolicy="no-referrer"
      />
    {:else}
      {glyph}
    {/if}
  </span>
</span>

<style>
  .avatar {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: transparent;
    flex-shrink: 0;
    box-sizing: border-box;
    transition: box-shadow 0.2s var(--ease-out);
  }
  .avatar.has-ring {
    background: var(--ring-color);
    /* The thin white inner stroke separates the ring from both very dark
       (team B = black) and very light (team A = white) surroundings, so
       the ring reads regardless of background. The outer glow is keyed
       off the ring color via color-mix and stays subtle. */
    box-shadow:
      0 0 0 1px rgba(0, 0, 0, 0.45),
      0 0 0 2px rgba(255, 255, 255, 0.22),
      0 0 14px color-mix(in srgb, var(--ring-color) 30%, transparent);
  }
  .avatar.has-ring.subtle-ring {
    box-shadow:
      0 0 0 1px rgba(0, 0, 0, 0.4),
      0 0 0 2px rgba(255, 255, 255, 0.18);
  }
  .avatar-fill {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    color: #fff;
    font-weight: 800;
    display: flex;
    align-items: center;
    justify-content: center;
    text-transform: uppercase;
    line-height: 1;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
  }
  /* Emoji glyphs already have their own outline; the text-shadow makes
     them look smudged. Strip it when an emoji is detected. */
  .avatar-fill.emoji { text-shadow: none; text-transform: none; }

  /* Illustrated avatars: the SVG fills the inner circle. We clip to a
     circle so DiceBear's square SVG doesn't escape the avatar boundary. */
  .avatar-fill.illustrated { padding: 0; overflow: hidden; }
  .avatar-illustration {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    user-select: none;
    -webkit-user-drag: none;
  }
</style>
