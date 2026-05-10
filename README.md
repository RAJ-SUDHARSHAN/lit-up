# Lit Up — Literature Card Game

A real-time multiplayer Literature card game.

* **Authoritative server** (Colyseus on Node) holds the truth and validates every move.
* **Per-client filtered state** — your hand is sent privately; only public state syncs to all.
* **Reactive UI** in Svelte 5 with smooth card animations via [Motion](https://motion.dev).
* **Reconnect-safe** — drop your phone, walk into a tunnel, come back; your seat is held for 60s.

## Quick start

Requires Node 20+.

```bash
npm install
npm run dev
```

This starts the Colyseus server on `:2567` and the Vite dev server on `:5173`. Open
[http://localhost:5173](http://localhost:5173), create a room, and share the link
(it includes a `?room=CODE` parameter).

To run them separately:

```bash
npm run dev:server   # Colyseus on :2567
npm run dev:client   # Vite on :5173
```

## Architecture

```
lit-up/
├── shared/    Pure constants & types used by both sides
├── server/    Colyseus room + game rules + bot AI (authoritative)
└── client/    Svelte 5 + Vite + Motion (UI only — no game state lives here)
```

### How a turn flows

1. Player clicks an opponent at the table → `targetedId` set in client state.
2. Player picks a card from the ask picker → `room.send("ask", { toPlayerId, card })`.
3. Server validates: it's your turn, you hold a card in the same set, etc.
4. Server mutates `state.players[*].cardCount`, `turnId`, `actions`, `lastAsk`.
5. Colyseus auto-syncs the schema diff to every client.
6. Server sends private `hand` messages to the asker and the target.
7. Clients see `lastAsk.at` change → run the card-flight animation.

### Server

* **Single room class** (`server/src/room.ts`) handles join, leave, and command messages.
* **Pure rule functions** (`server/src/rules.ts`) — `applyAsk`, `applyDeclare`, `applyPass`. They mutate the synced state and a server-only `HandStore` map.
* **Schema** (`server/src/schema.ts`) — only public fields (no hands).
* **Bot AI** (`server/src/bot.ts`) — same three difficulties as the original, with shared card-knowledge tracking that runs on the server, not the host.
* **Reconnect grace** — 60s window, configured in `room.ts`.

### Client

* **`game` singleton** (`client/src/lib/client.svelte.ts`) — wraps the Colyseus connection, mirrors synced state into Svelte 5 runes, exposes commands.
* **Views**: `Landing`, `Lobby`, `Game` — picked by `game.view`.
* **Animations**: card flight uses Motion to fly an overlay card between two DOM rects. Hand reordering uses Svelte's built-in `animate:flip`. Score pop, seat glow, and toasts are CSS-driven.

### Why this stack

| Layer | Pick | Why |
|---|---|---|
| Server | **Colyseus** | Purpose-built for multiplayer rooms — schema diff, lobby, reconnection, monitor, all in one. |
| UI | **Svelte 5** | Smallest runtime of the well-known frameworks; runes give clean reactive state without boilerplate. |
| Animations | **Motion** | Tiny (~5kb), declarative, perfect for the "fly between two DOM rects" pattern. |

## Production

```bash
npm run build
npm start
```

Serve the built `client/dist/` from any static host (Vercel, Netlify, Cloudflare Pages)
and run the server on Railway / Fly.io / Render. Set `VITE_SERVER_URL` at build time
to point the client at the right websocket.

## Legacy

The original single-file vanilla-JS implementation is preserved under [`legacy/`](legacy/)
for reference.
