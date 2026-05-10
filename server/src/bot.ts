/**
 * Bot AI for Literature.
 *
 * Difficulty controls how *strategic* the bot plays. All bots follow the
 * legal rules. Higher difficulties layer in more inferences:
 *
 *   easy   — random ask in a set the bot has cards in. Avoids known-no
 *            opponents but does no deduction or strategic scoring.
 *   medium — full direct + deduced knowledge. Tracks teammate engagement
 *            and supports them ("hinting") by re-engaging the same sets.
 *            Aggressively asks in sets the team is close to completing
 *            ("lock-out"). Avoids asking cards proven to be on its team.
 *   hard   — medium + leakage management (penalty for opening fresh sets),
 *            statistical inference for blind guesses, and end-game
 *            opponent-modeling that biases asks toward the most-revealing
 *            opponents.
 */

import {
  ALL_CARDS,
  CARD_TO_SET,
  SET_DEFS,
  SET_LOOKUP,
  type BotDifficulty,
  type Card,
  type SetKey,
  type Team,
} from "@lit-up/shared";
import type { GameState, Player } from "./schema.js";
import type { CardKnowledge, HandStore, Transaction, TransactionLog } from "./rules.js";

export type BotAction =
  | { type: "ask"; targetId: string; card: Card }
  | { type: "declare"; setKey: SetKey }
  | { type: "pass" };

// ── Context bundle passed through scoring ──────────────────────────

interface BotCtx {
  state: GameState;
  hands: HandStore;
  ck: CardKnowledge;
  txLog: TransactionLog;
  bot: Player;
  diff: BotDifficulty;

  myHand: Card[];
  teammates: Player[];
  opponents: Player[];
  teamCards: Set<Card>;
  oppCards: Set<Card>;
  claimed: Set<SetKey>;

  /** Sets at least one of this bot's *teammates* (excluding self) has asked in. */
  teammateAsksInSet: Map<SetKey, number>;
  /** Sets the bot itself has already asked in (for leakage management). */
  selfAsksInSet: Map<SetKey, number>;
  /** Sets that have appeared in any transaction (used by easy bot). */
  openSets: Set<SetKey>;
}

function buildContext(
  state: GameState,
  hands: HandStore,
  ck: CardKnowledge,
  txLog: TransactionLog,
  bot: Player,
): BotCtx {
  const diff = state.botDifficulty;
  const myHand = hands.get(bot.id) ?? [];
  const teammates = [...state.players.values()].filter(
    (p) => p.team === bot.team && p.id !== bot.id,
  );
  const opponents = [...state.players.values()].filter(
    (p) => p.team !== bot.team && (hands.get(p.id) ?? []).length > 0,
  );
  const teamCards = collectTeamCards(state, hands, bot.team);
  const oppCards = collectTeamCards(state, hands, otherTeam(bot.team));
  const claimed = new Set<SetKey>(
    [...state.claimedA, ...state.claimedB].filter(
      (k): k is string => typeof k === "string",
    ),
  );

  const teammateAsksInSet = new Map<SetKey, number>();
  const selfAsksInSet = new Map<SetKey, number>();
  const openSets = new Set<SetKey>();

  for (const tx of txLog) {
    openSets.add(tx.setKey);
    if (tx.askerId === bot.id) {
      selfAsksInSet.set(tx.setKey, (selfAsksInSet.get(tx.setKey) ?? 0) + 1);
    } else if (tx.askerTeam === bot.team) {
      teammateAsksInSet.set(tx.setKey, (teammateAsksInSet.get(tx.setKey) ?? 0) + 1);
    }
  }

  return {
    state,
    hands,
    ck,
    txLog,
    bot,
    diff,
    myHand,
    teammates,
    opponents,
    teamCards,
    oppCards,
    claimed,
    teammateAsksInSet,
    selfAsksInSet,
    openSets,
  };
}

// ── Public entrypoint ──────────────────────────────────────────────

export function decideBotAction(
  state: GameState,
  hands: HandStore,
  ck: CardKnowledge,
  txLog: TransactionLog,
  bot: Player,
): BotAction {
  if ((hands.get(bot.id) ?? []).length === 0) return { type: "pass" };

  const ctx = buildContext(state, hands, ck, txLog, bot);

  // 1. Declare immediately when the team holds a complete set. Bots only
  //    declare on certainty — never on a hopeful guess.
  for (const s of SET_DEFS) {
    if (ctx.claimed.has(s.key)) continue;
    if (s.cards.every((c) => ctx.teamCards.has(c))) {
      return { type: "declare", setKey: s.key };
    }
  }

  if (ctx.opponents.length === 0) return { type: "pass" };

  // 2. Build candidate asks.
  const candidates = buildCandidates(ctx);
  if (candidates.length === 0) return { type: "pass" };

  candidates.sort((a, b) => b.score - a.score);
  const topScore = candidates[0].score;
  const top = candidates.filter((c) => c.score === topScore);
  const pick = top[Math.floor(Math.random() * top.length)];
  return { type: "ask", targetId: pick.targetId, card: pick.card };
}

// ── Candidate generation ───────────────────────────────────────────

interface Candidate {
  card: Card;
  targetId: string;
  score: number;
  /** "known" = direct positive; "deduced" = N-1 ruled out; "blind" = guess. */
  confidence: "known" | "deduced" | "blind";
}

function buildCandidates(ctx: BotCtx): Candidate[] {
  const out: Candidate[] = [];
  const askable = ALL_CARDS.filter((c) => isAskable(c, ctx));

  for (const card of askable) {
    const setKey = CARD_TO_SET.get(card)!;

    // Skip cards that have been logically eliminated from all opponents —
    // they must be on the bot's team, asking would be wasted/illegal.
    const possible = possibleHolders(card, ctx);
    if (possible.length === 0) continue;

    // Easy: never act outside open sets unless every set is closed.
    if (ctx.diff === "easy" && !ctx.openSets.has(setKey) && ctx.openSets.size > 0) {
      continue;
    }

    const direct = directHolder(card, ctx);
    if (direct) {
      out.push({
        card,
        targetId: direct.id,
        score: scoreAsk(card, "known", ctx),
        confidence: "known",
      });
      continue;
    }

    // Deduction: medium+ only.
    if (ctx.diff !== "easy" && possible.length === 1) {
      out.push({
        card,
        targetId: possible[0].id,
        score: scoreAsk(card, "deduced", ctx),
        confidence: "deduced",
      });
      continue;
    }

    // Blind guess. Pick the most-likely opponent (or the only viable one).
    const target = pickBlindTarget(card, possible, ctx);
    if (target) {
      out.push({
        card,
        targetId: target.id,
        score: scoreAsk(card, "blind", ctx),
        confidence: "blind",
      });
    }
  }

  return out;
}

/** Strict ask legality: own a card in the same set, don't already hold the card,
 *  the set is unclaimed, and the card is real. */
function isAskable(card: Card, ctx: BotCtx): boolean {
  const setKey = CARD_TO_SET.get(card);
  if (!setKey) return false;
  if (ctx.claimed.has(setKey)) return false;
  if (ctx.myHand.includes(card)) return false;
  return ctx.myHand.some((c) => CARD_TO_SET.get(c) === setKey);
}

function directHolder(card: Card, ctx: BotCtx): Player | null {
  const info = ctx.ck.get(card);
  if (!info?.holder) return null;
  return ctx.opponents.find((o) => o.id === info.holder) ?? null;
}

function possibleHolders(card: Card, ctx: BotCtx): Player[] {
  const info = ctx.ck.get(card);
  if (!info) return ctx.opponents;
  if (info.holder) {
    const p = ctx.opponents.find((o) => o.id === info.holder);
    return p ? [p] : [];
  }
  return ctx.opponents.filter((p) => !info.absent.has(p.id));
}

/**
 * For a blind guess, prefer the opponent who:
 *   - hard: has the most cards (highest Bayesian prior of holding any card)
 *   - medium: same, falling back to random
 *   - easy: random
 */
function pickBlindTarget(card: Card, pool: Player[], ctx: BotCtx): Player | null {
  if (pool.length === 0) return null;
  if (pool.length === 1) return pool[0];
  if (ctx.diff === "easy") {
    return pool[Math.floor(Math.random() * pool.length)];
  }
  // Medium + Hard: weight by hand size.
  const weights = pool.map((p) => Math.max(1, ctx.hands.get(p.id)?.length ?? 1));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

// ── Scoring ────────────────────────────────────────────────────────

const CONFIDENCE_MULT: Record<Candidate["confidence"], number> = {
  known: 1.0,
  deduced: 0.85,
  blind: 0.45,
};

function scoreAsk(card: Card, confidence: Candidate["confidence"], ctx: BotCtx): number {
  const setKey = CARD_TO_SET.get(card)!;
  const set = SET_LOOKUP[setKey];
  const teamCount = set.cards.filter((c) => ctx.teamCards.has(c)).length;
  const oppCount = set.cards.filter((c) => ctx.oppCards.has(c)).length;
  const diff = ctx.diff;

  let s = 0;

  // Always: prefer sets with more team progress.
  s += teamCount * 10;

  if (diff === "easy") {
    return s * CONFIDENCE_MULT[confidence];
  }

  // Medium + Hard ──────────────────────────────────────────────────

  // Lock-out: completing a set is the highest-leverage move in the game.
  // teamCount === 5 means asking this card *finishes* the set on success.
  if (teamCount === 5) s += 40;

  // Block opponents close to a declaration. Drains them and gives info
  // even on failure.
  if (oppCount >= 4) s += (oppCount - 3) * 18;

  // Hint / support: prefer sets a teammate has been engaged in. The act
  // of asking re-engages the set publicly so the team can converge.
  const teamAsks = ctx.teammateAsksInSet.get(setKey) ?? 0;
  s += Math.min(teamAsks, 3) * 7;

  // Prefer sets the bot itself is engaged in (continuity).
  const myAsks = ctx.selfAsksInSet.get(setKey) ?? 0;
  s += Math.min(myAsks, 2) * 3;

  // Slight penalty for asking when the opponent team has more cards in the
  // set than the bot's team — risk of "feeding" them positioning info.
  if (oppCount > teamCount) s -= (oppCount - teamCount) * 2;

  if (diff === "hard") {
    // Leakage: opening a fresh set tells everyone you hold cards there.
    // Penalize asking in sets where neither the bot nor a teammate has
    // appeared yet, unless the set is high-progress.
    const setIsLive = (ctx.selfAsksInSet.get(setKey) ?? 0) > 0
      || (ctx.teammateAsksInSet.get(setKey) ?? 0) > 0;
    if (!setIsLive && teamCount < 4) s -= 6;

    // End-game: the smaller the bot's hand, the more decisive each ask
    // should be. Bias toward higher-confidence and higher-team-count.
    if (ctx.myHand.length <= 3) s += teamCount * 4;
  }

  return s * CONFIDENCE_MULT[confidence];
}

// ── Helpers ────────────────────────────────────────────────────────

function collectTeamCards(state: GameState, hands: HandStore, team: Team): Set<Card> {
  const cards = new Set<Card>();
  state.players.forEach((p: Player, id: string) => {
    if (p.team !== team) return;
    const h = hands.get(id) ?? [];
    h.forEach((c) => cards.add(c));
  });
  return cards;
}

function otherTeam(t: Team): Team {
  return t === "A" ? "B" : "A";
}

/**
 * For a successful declare by the bot, fill the assignment map with the actual
 * teammate holding each card. Returns null if the team doesn't actually own the set.
 */
export function buildBotDeclareAssignments(
  state: GameState,
  hands: HandStore,
  bot: Player,
  setKey: SetKey,
): Record<Card, string> | null {
  const set = SET_LOOKUP[setKey];
  if (!set) return null;
  const assignments: Record<Card, string> = {};
  for (const card of set.cards) {
    let found: string | null = null;
    state.players.forEach((p: Player, id: string) => {
      if (p.team !== bot.team) return;
      if ((hands.get(id) ?? []).includes(card)) found = id;
    });
    if (!found) return null;
    assignments[card] = found;
  }
  return assignments;
}

// Re-export for the room module's convenience.
export type { Transaction, TransactionLog };
