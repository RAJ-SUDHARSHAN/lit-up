/**
 * Cards & sets for Literature.
 *
 * The deck is 54 cards: standard 52 + two Jokers.
 * Cards are encoded as 2-char strings: suit-letter + rank.
 *   "C2".."C7", "C9".."CA"  — clubs
 *   "D2".."D7", "D9".."DA"  — diamonds
 *   "H2".."H7", "H9".."HA"  — hearts
 *   "S2".."S7", "S9".."SA"  — spades
 *   "JR" / "JB"             — red/black joker
 *
 * The 9 sets:
 *   - 4 "low" sets   (one per suit, ranks 2–7)
 *   - 4 "high" sets  (one per suit, ranks 9–A)
 *   - 1 "wild" set   (all four 8s + both Jokers)
 */

export type Team = "A" | "B";
export type Suit = "C" | "D" | "H" | "S";
export type Card = string;
export type SetKey = string;

export const SUITS: ReadonlyArray<{ key: Suit; name: string }> = [
  { key: "C", name: "Clubs" },
  { key: "D", name: "Diamonds" },
  { key: "H", name: "Hearts" },
  { key: "S", name: "Spades" },
];

export const SUIT_SYMBOL: Record<Suit, string> = {
  C: "♣",
  D: "♦",
  H: "♥",
  S: "♠",
};

export const SUIT_COLOR: Record<Suit, "red" | "black"> = {
  C: "black",
  D: "red",
  H: "red",
  S: "black",
};

export const LOW_RANKS = ["2", "3", "4", "5", "6", "7"] as const;
export const HIGH_RANKS = ["9", "10", "J", "Q", "K", "A"] as const;

export interface SetDef {
  key: SetKey;
  label: string;
  family: "low" | "high" | "wild";
  suit: Suit | null;
  cards: Card[];
}

export const SET_DEFS: ReadonlyArray<SetDef> = [
  ...SUITS.map<SetDef>((s) => ({
    key: `${s.name.toLowerCase()}_low`,
    label: `${s.name} 2–7`,
    family: "low",
    suit: s.key,
    cards: LOW_RANKS.map((r) => `${s.key}${r}`),
  })),
  ...SUITS.map<SetDef>((s) => ({
    key: `${s.name.toLowerCase()}_high`,
    label: `${s.name} 9–A`,
    family: "high",
    suit: s.key,
    cards: HIGH_RANKS.map((r) => `${s.key}${r}`),
  })),
  {
    key: "eights_jokers",
    label: "8s & Jokers",
    family: "wild",
    suit: null,
    cards: ["C8", "D8", "H8", "S8", "JR", "JB"],
  },
];

export const SET_LOOKUP: Record<SetKey, SetDef> = Object.fromEntries(
  SET_DEFS.map((s) => [s.key, s]),
);

export const CARD_TO_SET = new Map<Card, SetKey>(
  SET_DEFS.flatMap((s) => s.cards.map((c) => [c, s.key] as const)),
);

export const ALL_CARDS: ReadonlyArray<Card> = SET_DEFS.flatMap((s) => s.cards);

/** Display order for hand: per-suit (low → high), wild last. */
export const HAND_SET_ORDER: ReadonlyArray<SetKey> = [
  "clubs_low", "clubs_high",
  "diamonds_low", "diamonds_high",
  "hearts_low", "hearts_high",
  "spades_low", "spades_high",
  "eights_jokers",
];

export function handSortKey(card: Card): number {
  const setKey = CARD_TO_SET.get(card)!;
  const setIndex = HAND_SET_ORDER.indexOf(setKey);
  const cardIndex = SET_LOOKUP[setKey].cards.indexOf(card);
  return setIndex * 10 + cardIndex;
}

export function sortHand(hand: Card[]): Card[] {
  return [...hand].sort((a, b) => handSortKey(a) - handSortKey(b));
}

export function cardLabel(card: Card): string {
  if (card === "JR") return "Red Joker";
  if (card === "JB") return "Black Joker";
  const suit = SUITS.find((s) => s.key === card[0]);
  return `${suit?.name ?? "?"} ${card.slice(1)}`;
}

export function cardShort(card: Card): { rank: string; symbol: string; red: boolean } {
  if (card === "JR") return { rank: "Jo", symbol: "♥", red: true };
  if (card === "JB") return { rank: "Jo", symbol: "♠", red: false };
  const suit = card[0] as Suit;
  return {
    rank: card.slice(1),
    symbol: SUIT_SYMBOL[suit],
    red: SUIT_COLOR[suit] === "red",
  };
}

export function isValidCard(card: string): card is Card {
  return CARD_TO_SET.has(card);
}
