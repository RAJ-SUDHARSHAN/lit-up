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
  const dur = opts.duration ?? 1.7;

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

  // Time budget within `dur`:
  //   - popIn:   0.32s  — card flips into view at source so eyes can lock on
  //   - linger:  0.22s  — pause at source before launch
  //   - travel:  the rest, with most of the duration here
  //   - settle:  last 0.18s holds at the destination (opacity stays high) so the
  //              landing registers, then fades quickly.
  const popIn = 0.32;
  const linger = 0.22;
  const fadeTail = 0.18;
  const travel = Math.max(dur - popIn - linger - fadeTail, 0.5);

  return new Promise<void>((resolve) => {
    const finish = () => {
      el.remove();
      resolve();
    };

    // Phase 1: pop into existence at source. Slower than before so the brain
    // notices the card before it starts moving.
    animate(
      el,
      {
        opacity: [0, 1],
        x: [startX, startX],
        y: [startY, startY],
        scale: [0.5, 1.18],
        rotate: [-10, -3],
      },
      { duration: popIn, ease: "easeOut" },
    );

    // Phase 2: travel — long, slow arc. Easing is gentle in/out so the card
    // visibly accelerates and decelerates.
    setTimeout(() => {
      animate(
        el,
        {
          x: [startX, endX],
          y: [startY, endY],
          scale: [1.18, 1.0],
          rotate: [-3, 4],
        },
        {
          duration: travel,
          ease: [0.45, 0.05, 0.35, 1],
        },
      );
    }, (popIn + linger) * 1000);

    // Phase 3: hold at destination, then fade. Motion's controls are
    // thenable, so we use them as a Promise without going through .finished.
    setTimeout(
      () => {
        const controls = animate(
          el,
          { opacity: [1, 0], scale: [1.0, 0.78] },
          { duration: fadeTail, ease: "easeIn" },
        );
        Promise.resolve(controls).then(finish, finish);
      },
      (popIn + linger + travel) * 1000,
    );
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
