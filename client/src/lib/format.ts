/**
 * Formatting helpers shared by views and components.
 */

import { cardShort, SET_LOOKUP, type Card, type SetKey } from "@lit-up/shared";

export function setLabel(key: SetKey): string {
  return SET_LOOKUP[key]?.label ?? key;
}

export function classifyAction(text: string): string {
  if (text.includes("got it")) return "txn-success";
  if (text.includes("no luck")) return "txn-fail";
  if (text.includes("declared") || text.includes("missed declaring") || text.includes("wins")) return "txn-declare";
  if (text.includes("passed")) return "txn-pass";
  return "txn-info";
}

export function cardChip(card: Card): { rank: string; symbol: string; red: boolean } {
  return cardShort(card);
}
