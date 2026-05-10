/* End-to-end smoke test: connect a real client, walk through a full game. */
import { Client, type Room } from "colyseus.js";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    console.error("ASSERT FAIL:", msg);
    process.exit(1);
  }
}
function log(...a: unknown[]) {
  console.log("[e2e]", ...a);
}

async function wait(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

async function main() {
  const c = new Client("http://localhost:2567");

  // 1. Host creates the room.
  const host = await c.create<unknown>("literature", { name: "Alice", avatar: "#ef4444" });
  log("host joined", host.roomId, "session=", host.sessionId);

  let hostState: any = null;
  let hostHand: string[] = [];
  host.onStateChange((s: any) => { hostState = s; });
  host.onMessage("hand", (m: { hand: string[] }) => { hostHand = m.hand; });
  host.onMessage("welcome", (m: any) => log("host welcome:", m));
  host.onMessage("error", (m: any) => log("host error:", m));

  await wait(300);
  assert(hostState, "host should have received initial state");
  assert(hostState.code === host.roomId, `room code on state should match (got ${hostState.code} vs ${host.roomId})`);
  log("initial state ok. code=", hostState.code, "status=", hostState.status, "players=", hostState.players.size);

  // 2. Three more clients join the same room by id.
  const others: Room[] = [];
  for (const name of ["Bob", "Carol", "Dan"]) {
    const room = await c.joinById<unknown>(host.roomId, { name, avatar: "#22c55e" });
    others.push(room);
    log(name, "joined");
    await wait(200);
  }

  assert(hostState.players.size === 4, `expected 4 players, got ${hostState.players.size}`);
  log("4 players in room");

  // 3. Host starts the game.
  host.send("start_game", {});
  await wait(500);
  assert(hostState.status === "playing", `expected playing, got ${hostState.status}`);
  assert(hostHand.length > 0, "host should have a hand");
  log("game started. status=", hostState.status, "host hand size=", hostHand.length);

  // 4. Make sure we can find an opponent and ask a card.
  const me: any = hostState.players.get(host.sessionId);
  const opponents: any[] = [];
  hostState.players.forEach((p: any) => {
    if (p.team !== me.team) opponents.push(p);
  });
  assert(opponents.length > 0, "should have opponents");
  log("you are team", me.team, "opponents:", opponents.map(p => p.name).join(","));

  if (hostState.turnId === host.sessionId) {
    log("we have first turn — sending ask");
    // Ask a card we know we don't have but is in a set we have.
    const SETS: Record<string, string[]> = {
      clubs_low: ["C2","C3","C4","C5","C6","C7"],
      clubs_high: ["C9","C10","CJ","CQ","CK","CA"],
      diamonds_low: ["D2","D3","D4","D5","D6","D7"],
      diamonds_high: ["D9","D10","DJ","DQ","DK","DA"],
      hearts_low: ["H2","H3","H4","H5","H6","H7"],
      hearts_high: ["H9","H10","HJ","HQ","HK","HA"],
      spades_low: ["S2","S3","S4","S5","S6","S7"],
      spades_high: ["S9","S10","SJ","SQ","SK","SA"],
      eights_jokers: ["C8","D8","H8","S8","JR","JB"],
    };
    let asked = false;
    for (const cards of Object.values(SETS)) {
      const have = cards.find((c) => hostHand.includes(c));
      const wanted = cards.find((c) => !hostHand.includes(c));
      if (have && wanted) {
        host.send("ask", { toPlayerId: opponents[0].id, card: wanted });
        log("asked", opponents[0].name, "for", wanted, "(have", have, "in same set)");
        asked = true;
        break;
      }
    }
    if (!asked) log("couldn't find a valid ask — skipping");
  } else {
    log("not our turn — skipping ask");
  }

  await wait(800);
  log("after ask: status=", hostState.status, "actions:", [...hostState.actions].slice(0, 3));

  // 5. Cleanup.
  for (const r of others) await r.leave(true);
  await host.leave(true);
  log("DONE — all assertions passed");
}

main().catch((e) => {
  console.error("FAIL:", e);
  process.exit(1);
});
