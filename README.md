# Lit Up - Literature Card Game

This is a lightweight, static web app for playing Literature with friends. The
host creates a room, shares the code, and the host browser keeps the game state
synced to other players using PeerJS (WebRTC data channels).

## Run locally

WebRTC features work best on `localhost` or HTTPS. You can run a quick local
server from the project root:

```bash
python3 -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000) in a browser.

## How to play

- Create a room and share the code or invite link.
- Join with 4 to 10 players, with an even number of players.
- The host can add bots in the lobby for quick testing.
- Ask for cards, declare sets, and race to claim 5 sets first.

For full rules, see [Pagat](https://www.pagat.com/quartet/literature.html).
