/**
 * Card-flight animation. Spawns a transient card on a fixed overlay layer
 * and animates from one DOM rect to another. Used when an ask succeeds —
 * the card flies between seats so every viewer sees the transfer.
 *
 * Uses Motion (https://motion.dev) under the hood with hand-rolled physics.
 * Falls back to a no-op if either anchor element is missing.
 */

import { animate } from "motion";
import { cardShort, type Card } from "@lit-up/shared";

const LAYER_ID = "card-flight-layer";

function ensureLayer(): HTMLElement {
  let el = document.getElementById(LAYER_ID);
  if (el) return el;
  el = document.createElement("div");
  el.id = LAYER_ID;
  document.body.appendChild(el);
  return el;
}

export interface CardFlightOpts {
  /** Source element rect; card starts centered here. */
  from: HTMLElement | DOMRect;
  /** Destination element rect; card ends centered here. */
  to: HTMLElement | DOMRect;
  /** If supplied, the card face is rendered (rank + suit). Otherwise card-back. */
  card?: Card;
  /** Total animation duration in seconds. Default 1.7. */
  duration?: number;
}

function rectOf(t: HTMLElement | DOMRect): DOMRect {
  return t instanceof DOMRect ? t : t.getBoundingClientRect();
}

export function flyCard(opts: CardFlightOpts): Promise<void> {
  const layer = ensureLayer();
  const from = rectOf(opts.from);
  const to = rectOf(opts.to);
  const dur = opts.duration ?? 2.4; // Increased from 1.7s for slower, more visible animation

  const el = document.createElement("div");
  el.className = "flying-card" + (opts.card ? " face" : " back");

  if (opts.card) {
    const { rank, symbol, red } = cardShort(opts.card);
    el.classList.add(red ? "red" : "black");
    el.innerHTML =
      `<span class="cr tl">${rank}</span><span class="cs tl">${symbol}</span>` +
      `<span class="cc">${symbol}</span>` +
      `<span class="cr br">${rank}</span><span class="cs br">${symbol}</span>`;
  }

  // The flying card is 84×120; subtract half to center on the source/dest rect.
  const startX = from.left + from.width / 2 - 42;
  const startY = from.top + from.height / 2 - 60;
  const endX = to.left + to.width / 2 - 42;
  const endY = to.top + to.height / 2 - 60;

  // Initial style: positioned at source, invisible until the pop-in plays.
  Object.assign(el.style, {
    position: "fixed",
    left: "0px",
    top: "0px",
    transform: `translate(${startX}px, ${startY}px) scale(0.6) rotate(-8deg)`,
    opacity: "0",
    pointerEvents: "none",
    zIndex: "9995",
  });
  layer.appendChild(el);

  // Single continuous animation: pop → fly → land
  // No delays, pure physical movement across the screen
  const popIn = 0.25;
  const fly = dur - popIn - 0.25;
  const land = 0.25;

  return new Promise<void>((resolve) => {
    const finish = () => {
      el.remove();
      resolve();
    };

    // Phase 1: Pop in at source (quick appearance)
    const popCtrl = animate(
      el,
      {
        opacity: [0, 1],
        scale: [0.6, 1.1],
        rotate: [-10, -2],
      },
      { duration: popIn, ease: "easeOut" },
    );

    // Phase 2: Immediately start flying to destination (smooth, visible motion)
    Promise.resolve(popCtrl).then(() => {
      const flyCtrl = animate(
        el,
        {
          x: [startX, endX],
          y: [startY, endY],
          scale: [1.1, 0.95],
          rotate: [-2, 6],
        },
        {
          duration: fly,
          ease: [0.25, 0.46, 0.45, 0.94], // Smooth easing for natural motion
        },
      );

      // Phase 3: Land and fade (no delays - immediate)
      Promise.resolve(flyCtrl).then(() => {
        animate(
          el,
          { opacity: [1, 0], scale: [0.95, 0.8] },
          { duration: land, ease: "easeIn" },
        ).then(finish, finish);
      });
    });
  });
}

/**
 * Brief shake animation, applied to opponent's seat or the asker's hand on
 * a failed ask. Uses a CSS class toggled for ~450ms.
 */
export function shake(el: HTMLElement, ms = 450): void {
  el.classList.add("shake");
  setTimeout(() => el.classList.remove("shake"), ms);
}
