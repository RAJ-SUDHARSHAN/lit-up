/**
 * GameClient — wraps Colyseus into a small reactive surface for Svelte.
 *
 * Colyseus has its own listener model; this module bridges it to Svelte 5
 * runes by mirroring the synced schema into a plain JS snapshot on every
 * state change. Components import `game` and read its $state fields directly.
 */

import { Client, type Room } from "colyseus.js";
import {
  AVATAR_COLORS,
  type AskCommand,
  type BotDifficulty,
  type Card,
  type DeclareCommand,
  type GameStatus,
  type JoinOptions,
  type SetKey,
  type SetRoomConfigCommand,
  type Team,
} from "@lit-up/shared";

// ── Snapshot types — plain JS mirrors of the Colyseus schema ──

export interface PlayerSnapshot {
  id: string;
  name: string;
  avatar: string;
  /** Optional emoji glyph for the avatar; empty falls back to first letter. */
  character: string;
  team: Team;
  isBot: boolean;
  isHost: boolean;
  connected: boolean;
  cardCount: number;
}

export interface PendingBotAskSnapshot {
  askerId: string;
  targetId: string;
  card: Card;
}

export interface LastAskSnapshot {
  askerId: string;
  targetId: string;
  card: Card;
  success: boolean;
  at: number;
}

export interface LastDeclareSnapshot {
  declarerId: string;
  setKey: SetKey;
  winningTeam: "" | "A" | "B";
  success: boolean;
  /** Map of card → playerId who held it at declare time. */
  sources: Record<Card, string>;
  at: number;
}

export interface RoomSnapshot {
  code: string;
  status: GameStatus;
  hostId: string;
  turnId: string;
  players: PlayerSnapshot[];
  claimedA: SetKey[];
  claimedB: SetKey[];
  scoreA: number;
  scoreB: number;
  winnerTeam: "" | "A" | "B";
  actions: string[];
  lastAsk: LastAskSnapshot;
  lastDeclare: LastDeclareSnapshot | null;
  pendingBotAsk: PendingBotAskSnapshot | null;
  botDifficulty: BotDifficulty;
  notesEnabled: boolean;
  defaultLogCount: number;
}

export interface Toast {
  id: number;
  text: string;
  kind: "info" | "success" | "error" | "warn" | "celebrate";
}

// ── Server URL discovery ─────────────────────────────────────

function inferServerUrl(): string {
  // Colyseus.js uses HTTP for matchmaking and upgrades the connection to a
  // WebSocket internally — pass a http(s) URL, never ws(s).
  const explicit = (import.meta as ImportMeta & { env: Record<string, string> }).env
    ?.VITE_SERVER_URL;
  if (explicit) return explicit;
  if (typeof window === "undefined") return "http://localhost:2567";
  const proto = window.location.protocol === "https:" ? "https:" : "http:";
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    return `${proto}//${window.location.hostname}:2567`;
  }
  return `${proto}//${window.location.host}`;
}

// ── Class with reactive fields ───────────────────────────────

class GameClient {
  private client = new Client(inferServerUrl());
  private room: Room | null = null;

  // Connection
  status = $state<"idle" | "connecting" | "connected" | "error">("idle");
  view = $state<"landing" | "lobby" | "game">("landing");
  errorBanner = $state<string>("");

  // Identity
  playerId = $state<string>("");
  roomCode = $state<string>("");

  // Mirrored room state
  room$ = $state<RoomSnapshot | null>(null);
  hand = $state<Card[]>([]);

  // Toast queue
  toasts = $state<Toast[]>([]);
  private toastSeq = 0;

  // ── Lifecycle ────────────────────────────────────────────

  async createRoom(name: string, avatar: string, character = ""): Promise<void> {
    if (!name.trim()) {
      this.errorBanner = "Enter a name to host.";
      return;
    }
    this.errorBanner = "";
    this.status = "connecting";
    try {
      const room = await this.client.create<unknown>("literature", {
        name: name.trim(),
        avatar,
        character,
      } satisfies JoinOptions);
      this.bindRoom(room);
    } catch (err) {
      this.status = "error";
      this.errorBanner = errorMessage(err);
    }
  }

  async joinRoom(code: string, name: string, avatar: string, character = ""): Promise<void> {
    const trimmedName = name.trim();
    const normCode = code.trim().toUpperCase().replace(/\s+/g, "");
    if (!trimmedName) {
      this.errorBanner = "Enter a name to join.";
      return;
    }
    if (!normCode) {
      this.errorBanner = "Enter a room code.";
      return;
    }
    this.errorBanner = "";
    this.status = "connecting";
    try {
      const room = await this.client.joinById<unknown>(normCode, {
        name: trimmedName,
        avatar,
        character,
      } satisfies JoinOptions);
      this.bindRoom(room);
    } catch (err) {
      this.status = "error";
      this.errorBanner = errorMessage(err);
    }
  }

  leave(): void {
    this.room?.leave(true);
    this.room = null;
    this.room$ = null;
    this.hand = [];
    this.playerId = "";
    this.roomCode = "";
    this.status = "idle";
    this.view = "landing";
    this.errorBanner = "";
  }

  // ── Commands ─────────────────────────────────────────────

  ask(cmd: AskCommand): void {
    this.room?.send("ask", cmd);
  }
  declare(cmd: DeclareCommand): void {
    this.room?.send("declare", cmd);
  }
  pass(toPlayerId?: string): void {
    this.room?.send("pass", { toPlayerId });
  }
  startGame(): void {
    this.room?.send("start_game", {});
  }
  addBot(): void {
    this.room?.send("add_bot", {});
  }
  removeBots(): void {
    this.room?.send("remove_bots", {});
  }
  shuffleTeams(): void {
    this.room?.send("shuffle_teams", {});
  }
  resetGame(): void {
    this.room?.send("reset_game", {});
  }
  setBotDifficulty(difficulty: BotDifficulty): void {
    this.room?.send("set_bot_difficulty", { difficulty });
  }
  setRoomConfig(cfg: SetRoomConfigCommand): void {
    this.room?.send("set_room_config", cfg);
  }

  // ── Derived helpers ──────────────────────────────────────

  get me(): PlayerSnapshot | null {
    if (!this.room$ || !this.playerId) return null;
    return this.room$.players.find((p) => p.id === this.playerId) ?? null;
  }

  get isMyTurn(): boolean {
    return !!this.room$ && this.room$.turnId === this.playerId;
  }

  get isHost(): boolean {
    return !!this.me?.isHost;
  }

  inviteUrl(): string {
    if (!this.roomCode) return "";
    if (typeof window === "undefined") return "";
    const url = new URL(window.location.href);
    url.searchParams.set("room", this.roomCode);
    return url.toString();
  }

  // ── Toast ────────────────────────────────────────────────

  toast(text: string, kind: Toast["kind"] = "info", durationMs = 3500): void {
    const id = ++this.toastSeq;
    this.toasts = [...this.toasts, { id, text, kind }];
    setTimeout(() => {
      this.toasts = this.toasts.filter((t) => t.id !== id);
    }, durationMs);
  }

  // ── Internal: Colyseus binding ───────────────────────────

  private bindRoom(room: Room<unknown>): void {
    this.room = room;

    room.onStateChange((state) => {
      this.room$ = snapshotRoom(state);
      // Keep view in sync with room status.
      const status = (state as { status: GameStatus }).status;
      this.view = status === "lobby" ? "lobby" : "game";
    });

    room.onMessage("welcome", (msg: { playerId: string; roomCode: string }) => {
      this.playerId = msg.playerId;
      this.roomCode = msg.roomCode;
      this.status = "connected";
    });

    room.onMessage("hand", (msg: { hand: Card[] }) => {
      this.hand = msg.hand;
    });

    room.onMessage("error", (msg: { message: string }) => {
      this.toast(msg.message, "error");
    });

    room.onLeave(() => {
      this.toast("Disconnected from room.", "warn");
      this.room = null;
      this.room$ = null;
      this.hand = [];
      this.status = "idle";
      this.view = "landing";
    });

    room.onError((_code, message) => {
      this.toast(message ?? "Connection error.", "error");
    });
  }
}

// ── Snapshot helper ──────────────────────────────────────────

function snapshotRoom(state: unknown): RoomSnapshot {
  // The Colyseus state is a Schema instance; we duck-type rather than import
  // the server's class to avoid a circular package dep at type level.
  const s = state as {
    code: string;
    status: GameStatus;
    hostId: string;
    turnId: string;
    players: { forEach: (cb: (v: PlayerSnapshot, k: string) => void) => void };
    claimedA: SetKey[];
    claimedB: SetKey[];
    scoreA: number;
    scoreB: number;
    winnerTeam: "" | "A" | "B";
    actions: string[];
    lastAsk: LastAskSnapshot;
    pendingBotAsk?: PendingBotAskSnapshot;
    lastDeclare?: {
      declarerId: string;
      setKey: SetKey;
      winningTeam: "" | "A" | "B";
      success: boolean;
      sources: { forEach(cb: (value: string, key: string) => void): void };
      at: number;
    };
    botDifficulty: BotDifficulty;
    notesEnabled?: boolean;
    defaultLogCount?: number;
  };

  const players: PlayerSnapshot[] = [];
  s.players.forEach((p) => {
    players.push({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      character: typeof (p as { character?: string }).character === "string"
        ? (p as { character: string }).character
        : "",
      team: p.team,
      isBot: p.isBot,
      isHost: p.isHost,
      connected: p.connected,
      cardCount: p.cardCount,
    });
  });

  return {
    code: s.code,
    status: s.status,
    hostId: s.hostId,
    turnId: s.turnId,
    players,
    claimedA: [...s.claimedA],
    claimedB: [...s.claimedB],
    scoreA: s.scoreA,
    scoreB: s.scoreB,
    winnerTeam: s.winnerTeam,
    actions: [...s.actions],
    lastAsk: { ...s.lastAsk },
    pendingBotAsk:
      s.pendingBotAsk && s.pendingBotAsk.askerId
        ? {
            askerId: s.pendingBotAsk.askerId,
            targetId: s.pendingBotAsk.targetId,
            card: s.pendingBotAsk.card,
          }
        : null,
    lastDeclare: snapshotLastDeclare(s.lastDeclare),
    botDifficulty: s.botDifficulty,
    notesEnabled: !!s.notesEnabled,
    defaultLogCount: typeof s.defaultLogCount === "number" ? s.defaultLogCount : 5,
  };
}

function snapshotLastDeclare(
  src: { declarerId?: string; setKey?: string; at?: number } | undefined,
): LastDeclareSnapshot | null {
  if (!src || !src.setKey) return null;
  const sources: Record<Card, string> = {};
  const map = (src as unknown as {
    sources?: { forEach(cb: (v: string, k: string) => void): void };
  }).sources;
  if (map && typeof map.forEach === "function") {
    map.forEach((holderId: string, card: string) => {
      sources[card] = holderId;
    });
  }
  return {
    declarerId: (src as { declarerId: string }).declarerId,
    setKey: (src as { setKey: SetKey }).setKey,
    winningTeam: (src as { winningTeam: "" | "A" | "B" }).winningTeam,
    success: (src as { success: boolean }).success,
    sources,
    at: (src as { at: number }).at,
  };
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "Connection failed.";
}

export const game = new GameClient();
export { AVATAR_COLORS };
