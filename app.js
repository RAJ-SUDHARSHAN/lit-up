// ── Card / set constants ──────────────────────────────────

const AVATAR_COLORS = [
  "#ef4444","#f97316","#eab308","#22c55e",
  "#06b6d4","#3b82f6","#8b5cf6","#ec4899"
];

const SUITS = [
  { key:"C", name:"Clubs"    },
  { key:"D", name:"Diamonds" },
  { key:"H", name:"Hearts"   },
  { key:"S", name:"Spades"   }
];

const LOW_RANKS  = ["2","3","4","5","6","7"];
const HIGH_RANKS = ["9","10","J","Q","K","A"];

const SET_DEFS = [
  ...SUITS.map(s => ({
    key:   `${s.name.toLowerCase()}_low`,
    label: `${s.name} 2–7`,
    cards: LOW_RANKS.map(r => `${s.key}${r}`)
  })),
  ...SUITS.map(s => ({
    key:   `${s.name.toLowerCase()}_high`,
    label: `${s.name} 9–A`,
    cards: HIGH_RANKS.map(r => `${s.key}${r}`)
  })),
  { key:"eights_jokers", label:"8s & Jokers", cards:["C8","D8","H8","S8","JR","JB"] }
];

const SET_LOOKUP  = Object.fromEntries(SET_DEFS.map(s => [s.key, s]));
const CARD_TO_SET = new Map(SET_DEFS.flatMap(set => set.cards.map(c => [c, set.key])));
const ALL_CARDS   = SET_DEFS.flatMap(s => s.cards);

// Hand display: group by suit (low then high per suit), eights last
const HAND_SET_ORDER = [
  "clubs_low","clubs_high","diamonds_low","diamonds_high",
  "hearts_low","hearts_high","spades_low","spades_high","eights_jokers"
];
function handSortKey(card) {
  const si = HAND_SET_ORDER.indexOf(CARD_TO_SET.get(card));
  const ri = SET_LOOKUP[CARD_TO_SET.get(card)]?.cards.indexOf(card) ?? 0;
  return si * 10 + ri;
}
function sortedHand(hand) { return [...hand].sort((a,b) => handSortKey(a) - handSortKey(b)); }

// ── Visual constants ──────────────────────────────────────

const SUIT_SYM   = { C:"♣", D:"♦", H:"♥", S:"♠" };
const SUIT_COLOR = { C:"black", D:"red", H:"red", S:"black" };

// ── Animation state ───────────────────────────────────────

let _pendingNewCards = [];
let _dealAnimation   = false;

// ── Ask interaction state ─────────────────────────────────

const askState = { opponentId: null, cardCode: null, suitFamily: null };

function clearAskState() {
  askState.opponentId = null;
  askState.cardCode   = null;
  askState.suitFamily = null;
}

// ── App state ─────────────────────────────────────────────

const state = {
  peer: null, isHost: false, youId: null,
  roomState: null, roomView: null, yourHand: [],
  connections: new Map(), hostConnection: null,
  avatarSelection: { host: AVATAR_COLORS[0], join: AVATAR_COLORS[4] }
};

const elements = {
  messageBar:       document.getElementById("message-bar"),
  connectionStatus: document.getElementById("connection-status"),
  toggleRules:      document.getElementById("toggle-rules"),
  rulesShortcut:    document.getElementById("rules-shortcut"),
  rulesPanel:       document.getElementById("rules-panel"),
  closeRules:       document.getElementById("close-rules"),
  landing:          document.getElementById("landing"),
  lobby:            document.getElementById("lobby"),
  game:             document.getElementById("game"),
  hostName:         document.getElementById("host-name"),
  joinName:         document.getElementById("join-name"),
  joinCode:         document.getElementById("join-code"),
  hostAvatarPicker: document.getElementById("host-avatar-picker"),
  joinAvatarPicker: document.getElementById("join-avatar-picker"),
  createRoomButton: document.getElementById("create-room"),
  joinRoomButton:   document.getElementById("join-room"),
  roomCode:         document.getElementById("room-code"),
  inviteLink:       document.getElementById("invite-link"),
  copyInvite:       document.getElementById("copy-invite"),
  leaveRoom:        document.getElementById("leave-room"),
  lobbyHostActions: document.getElementById("lobby-host-actions"),
  addBot:           document.getElementById("add-bot"),
  removeBots:       document.getElementById("remove-bots"),
  shuffleTeams:     document.getElementById("shuffle-teams"),
  startGame:        document.getElementById("start-game"),
  lobbyPlayers:     document.getElementById("lobby-players"),
  turnLabel:        document.getElementById("turn-label"),
  scoreboard:       document.getElementById("scoreboard"),
  gamePlayers:      document.getElementById("game-players"),
  handCards:        document.getElementById("hand-cards"),
  cardCountBadge:   document.getElementById("card-count-badge"),
  // hidden selects — still populated for canAsk logic
  askOpponent:      document.getElementById("ask-opponent"),
  askCard:          document.getElementById("ask-card"),
  askButton:        document.getElementById("ask-button"),
  askHint:          document.getElementById("ask-hint"),
  askCardChoices:   document.getElementById("ask-card-choices"),
  askUi:            document.getElementById("ask-ui"),
  declareSet:       document.getElementById("declare-set"),
  declareButton:    document.getElementById("declare-button"),
  passButton:       document.getElementById("pass-button"),
  resetGame:        document.getElementById("reset-game"),
  lastAction:       document.getElementById("last-action"),
  leaveGame:        document.getElementById("leave-game"),
  claimedSetsChips: document.getElementById("claimed-sets-chips"),
};

let messageTimer    = null;
let botTurnTimer    = null;
let botPhase2Active = false;  // true while the 5-s phase-2 timer is running
let logCount        = 3;   // 3 | 5 | 0 (= all)

init();

// ── Init ──────────────────────────────────────────────────

function init() {
  setupAvatarPicker(elements.hostAvatarPicker, "host");
  setupAvatarPicker(elements.joinAvatarPicker, "join");
  bindEvents();
  prefillJoinCode();
  setView("landing");
  setConnectionStatus("Offline");
  initBgCards();
}

function bindEvents() {
  elements.createRoomButton.addEventListener("click", handleCreateRoom);
  elements.joinRoomButton.addEventListener("click", handleJoinRoom);
  elements.copyInvite.addEventListener("click", handleCopyInvite);
  elements.leaveRoom.addEventListener("click", leaveRoom);
  elements.leaveGame.addEventListener("click", leaveRoom);
  elements.addBot.addEventListener("click", () => dispatchAction("add_bot"));
  elements.removeBots.addEventListener("click", () => dispatchAction("remove_bots"));
  elements.shuffleTeams.addEventListener("click", () => dispatchAction("shuffle_teams"));
  elements.startGame.addEventListener("click", () => dispatchAction("start_game"));
  elements.askButton.addEventListener("click", handleAskCard);
  elements.declareButton.addEventListener("click", handleDeclareSet);
  elements.declareSet.addEventListener("change", () => {
    if (state.roomView) buildDeclareAssignmentUI(state.roomView, elements.declareSet.value);
  });
  elements.passButton.addEventListener("click", () => dispatchAction("pass_turn"));
  elements.resetGame.addEventListener("click", () => dispatchAction("reset_game"));
  document.querySelectorAll(".log-count-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      logCount = parseInt(btn.dataset.count);
      document.querySelectorAll(".log-count-btn").forEach(b =>
        b.classList.toggle("active", b === btn));
    });
  });
  document.querySelectorAll(".bot-diff-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      if (!state.isHost || !state.roomState) return;
      state.roomState.botDifficulty = btn.dataset.diff;
      broadcastRoom();
    });
  });

  elements.toggleRules.addEventListener("click", () => toggleRules(true));
  elements.rulesShortcut.addEventListener("click", () => toggleRules(true));
  elements.closeRules.addEventListener("click", () => toggleRules(false));

  window.addEventListener("beforeunload", () => {
    if (!state.isHost && state.hostConnection) {
      safeSend(state.hostConnection, { type:"leave_room" });
    }
  });
}

function setupAvatarPicker(container, type) {
  container.innerHTML = "";
  AVATAR_COLORS.forEach(color => {
    const btn = document.createElement("button");
    btn.type = "button"; btn.className = "avatar-choice";
    btn.style.background = color;
    if (state.avatarSelection[type] === color) btn.classList.add("selected");
    btn.addEventListener("click", () => {
      state.avatarSelection[type] = color;
      setupAvatarPicker(container, type);
    });
    container.appendChild(btn);
  });
}

function prefillJoinCode() {
  const code = new URL(window.location.href).searchParams.get("room");
  if (code) elements.joinCode.value = code.toUpperCase();
}

// ── View management ───────────────────────────────────────

function setView(view) {
  elements.landing.classList.toggle("active", view === "landing");
  elements.lobby.classList.toggle("active", view === "lobby");
  elements.game.classList.toggle("active", view === "game");
  document.body.classList.toggle("in-game", view === "game");
}

function setConnectionStatus(text) {
  elements.connectionStatus.textContent = text;
  elements.connectionStatus.classList.toggle("online",
    text === "Hosting" || text === "Connected");
}

function showMessage(msg) {
  if (!msg) { elements.messageBar.classList.add("hidden"); elements.messageBar.textContent = ""; return; }
  elements.messageBar.textContent = msg;
  elements.messageBar.classList.remove("hidden");
  clearTimeout(messageTimer);
  messageTimer = setTimeout(() => elements.messageBar.classList.add("hidden"), 4000);
}

function toggleRules(show) {
  elements.rulesPanel.classList.toggle("hidden", !show);
}

// ── Room creation / joining ───────────────────────────────

function handleCreateRoom() {
  const name = elements.hostName.value.trim();
  if (!name) { showMessage("Enter a name to host a room."); return; }
  showMessage("");
  createHostPeer(name, state.avatarSelection.host);
}

function handleJoinRoom() {
  const name = elements.joinName.value.trim();
  const code = normalizeRoomCode(elements.joinCode.value.trim());
  if (!name) { showMessage("Enter a name to join."); return; }
  if (!code) { showMessage("Enter a room code to join."); return; }
  showMessage("");
  createClientPeer(name, state.avatarSelection.join, code);
}

function createHostPeer(name, avatar) {
  cleanupPeer();
  state.isHost = true; state.connections = new Map();
  setConnectionStatus("Connecting...");
  let attempts = 0;

  const tryHost = () => {
    attempts++;
    const code = generateRoomCode();
    const peer = new Peer(code);
    state.peer = peer;

    peer.on("open", id => {
      state.youId = id;
      state.roomState = createRoomState(id, name, avatar, code);
      setConnectionStatus("Hosting");
      broadcastRoom(); updateInviteLink(code);
    });
    peer.on("connection", conn => setupHostConnection(conn));
    peer.on("error", err => {
      if (err.type === "unavailable-id" && attempts < 4) { peer.destroy(); tryHost(); return; }
      showMessage("Unable to host room. Try again.");
      setConnectionStatus("Offline"); resetState();
    });
  };
  tryHost();
}

function createClientPeer(name, avatar, code) {
  cleanupPeer(); state.isHost = false;
  setConnectionStatus("Connecting...");
  const peer = new Peer(); state.peer = peer;

  peer.on("open", id => {
    state.youId = id;
    const conn = peer.connect(code); state.hostConnection = conn;
    conn.on("open",  () => { safeSend(conn,{type:"join_room",payload:{name,avatar,peerId:id}}); setConnectionStatus("Connected"); });
    conn.on("data",  d  => handleClientMessage(d));
    conn.on("close", () => { showMessage("Connection to host lost."); resetState(); });
    conn.on("error", () => { showMessage("Unable to connect to host."); resetState(); });
  });
  peer.on("error", () => { showMessage("Unable to connect to host."); resetState(); });
}

function setupHostConnection(conn) {
  conn.on("data",  d  => handleHostMessage(d, conn));
  conn.on("close", () => handleDisconnect(conn.peer));
  conn.on("error", () => handleDisconnect(conn.peer));
}

// ── Message handlers ──────────────────────────────────────

function handleHostMessage(data, conn) {
  const msg = parseMessage(data);
  if (!msg || !state.roomState) return;
  if (msg.type === "join_room")  { handleJoinRequest(msg.payload, conn); return; }
  if (msg.type === "leave_room") { handleDisconnect(conn.peer); return; }
  if (msg.type === "action") {
    const { actionType, data: d } = msg.payload || {};
    const err = applyAction(state.roomState, conn.peer, actionType, d);
    if (err) { safeSend(conn,{type:"error",payload:{message:err}}); return; }
    broadcastRoom();
  }
}

function handleClientMessage(data) {
  const msg = parseMessage(data);
  if (!msg) return;
  if (msg.type === "room_state") { applyRoomView(msg.payload); return; }
  if (msg.type === "error") showMessage(msg.payload?.message || "Something went wrong.");
}

function handleJoinRequest(payload, conn) {
  const room = state.roomState;
  if (!room || room.status !== "lobby") {
    safeSend(conn,{type:"error",payload:{message:"Room is not accepting players."}}); return;
  }
  if (room.players.length >= 10) {
    safeSend(conn,{type:"error",payload:{message:"Room is full."}}); return;
  }
  const name = payload?.name?.trim();
  if (!name) { safeSend(conn,{type:"error",payload:{message:"Name required."}}); return; }
  if (room.players.some(p => p.name.toLowerCase() === name.toLowerCase())) {
    safeSend(conn,{type:"error",payload:{message:"Name already taken."}}); return;
  }
  const avatar   = payload?.avatar || AVATAR_COLORS[0];
  const playerId = payload?.peerId || conn.peer;
  const team     = room.players.length % 2 === 0 ? "A" : "B";
  room.players.push(createPlayer(playerId, name, avatar, team, false));
  pushAction(room, `${name} joined the room.`);
  state.connections.set(playerId, conn);
  broadcastRoom();
}

// ── Room view + animations ────────────────────────────────

function applyRoomView(payload) {
  if (!payload) return;

  const prevView   = state.roomView;
  const prevHand   = state.yourHand ? [...state.yourHand] : [];
  const prevStatus = prevView?.status;

  state.roomView = payload.room;
  state.yourHand = payload.yourHand || [];
  state.youId    = payload.youId || state.youId;

  const newView = state.roomView;
  const newHand = state.yourHand;

  const gainedCards     = newHand.filter(c => !prevHand.includes(c));
  const lostCards       = prevHand.filter(c => !newHand.includes(c));
  const actionChanged   = newView?.lastAction && newView.lastAction !== prevView?.lastAction;
  const scoreChanged    = (newView?.scores?.A||0) !== (prevView?.scores?.A||0) ||
                          (newView?.scores?.B||0) !== (prevView?.scores?.B||0);
  const turnChanged     = newView?.turnId !== prevView?.turnId;
  const gameJustStarted = prevStatus === "lobby" && newView?.status === "playing";

  _pendingNewCards = gainedCards;
  _dealAnimation   = gameJustStarted;

  updateView();

  _pendingNewCards = [];
  _dealAnimation   = false;

  // Toasts
  if (actionChanged && newView?.lastAction) {
    const a = newView.lastAction;
    let type = "info";
    if (a.includes("received it"))   type = "success";
    else if (a.includes("No luck"))  type = "error";
    else if (a.includes("scores"))   type = "celebrate";
    else if (a.includes("Game over")||a.includes("wins")) type = "celebrate";
    else if (a.includes("passed"))   type = "warn";
    showToast(a, type, 4000);
  }

  // Card flight on success / seat wiggle on failure
  if (actionChanged && newView?.lastAction) {
    const parsed = parseLastAction(newView.lastAction, newView?.players || [], state.youId);
    if (parsed?.success) {
      setTimeout(() => triggerCardFlight(parsed, gainedCards), 60);
    } else if (parsed) {
      requestAnimationFrame(() => {
        // Wiggle the asker's seat bubble
        const bubble = document.querySelector(`#seat-${parsed.askerId} .seat-bubble`);
        if (bubble) { bubble.classList.add("hand-shake"); setTimeout(() => bubble.classList.remove("hand-shake"), 500); }
        // Also shake your hand if you were the one being asked
        if (parsed.targetIsYou) {
          elements.handCards.classList.add("hand-shake");
          setTimeout(() => elements.handCards.classList.remove("hand-shake"), 500);
        }
      });
    }
  }

  // Highlight gained cards
  if (gainedCards.length > 0) {
    requestAnimationFrame(() => {
      gainedCards.forEach(card => {
        const el = document.querySelector(`.hand-card[data-card="${card}"]`);
        if (el) { el.classList.add("card-new"); setTimeout(()=>el.classList.remove("card-new"),1200); }
      });
    });
  }

  // Scoreboard pop
  if (scoreChanged) {
    requestAnimationFrame(() => {
      elements.scoreboard.classList.add("score-pop");
      setTimeout(()=>elements.scoreboard.classList.remove("score-pop"),600);
    });
  }

  // Turn label flash
  if (turnChanged && newView?.turnId === state.youId) {
    elements.turnLabel.classList.add("your-turn");
    setTimeout(()=>elements.turnLabel.classList.remove("your-turn"),1200);
  }
}

// Parse lastAction text to get asker/target player IDs (both success and failure)
function parseLastAction(action, players, youId) {
  if (!action) return null;
  const mOk   = action.match(/^(.+?) asked (.+?) for .+ and received it\./);
  const mFail = action.match(/^(.+?) asked (.+?) for .+\. No luck\./);
  const m = mOk || mFail;
  if (!m) return null;
  const asker  = players.find(p => p.name === m[1]);
  const target = players.find(p => p.name === m[2]);
  return {
    success:     !!mOk,
    askerId:     asker?.id,
    targetId:    target?.id,
    askerIsYou:  asker?.id  === youId,
    targetIsYou: target?.id === youId
  };
}

// Animate a card flying from source seat to destination
function triggerCardFlight(parsed, gainedCards) {
  const layer = document.getElementById("card-flight-layer");
  if (!layer) return;

  let fromEl, toEl, cardCode, showFace;

  if (parsed.askerIsYou) {
    // I received a card — fly from their seat to my hand
    fromEl   = document.getElementById(`seat-${parsed.targetId}`);
    toEl     = elements.handCards;
    cardCode = gainedCards[0];
    showFace = true;
  } else if (parsed.targetIsYou) {
    // I lost a card — fly from my hand area to their seat
    fromEl   = elements.handCards;
    toEl     = document.getElementById(`seat-${parsed.askerId}`);
    cardCode = null; // we don't know the exact card face from state
    showFace = false;
  } else {
    // Two other players — fly between their seats
    fromEl   = document.getElementById(`seat-${parsed.targetId}`);
    toEl     = document.getElementById(`seat-${parsed.askerId}`);
    cardCode = null;
    showFace = false;
  }

  if (!fromEl || !toEl) return;

  const from = fromEl.getBoundingClientRect();
  const to   = toEl.getBoundingClientRect();

  const el = document.createElement("div");
  el.className = "flying-card";

  if (showFace && cardCode) {
    // Copy a real card element's look
    Object.assign(el.style, {
      background: "var(--card-bg)",
      border: "1px solid var(--card-border)",
      color: (SUIT_COLOR[cardCode[0]] || "black") === "red" ? "var(--card-red)" : "var(--card-black)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: "1.4rem"
    });
    el.textContent = SUIT_SYM[cardCode[0]] || "🃏";
  } else {
    // Card back
    Object.assign(el.style, {
      background: "linear-gradient(135deg,#1a3a8a,#1e47b0)",
      border: "1px solid rgba(255,255,255,.25)"
    });
  }

  // Start at source centre (half of 64×92)
  el.style.left      = `${from.left + from.width/2  - 32}px`;
  el.style.top       = `${from.top  + from.height/2 - 46}px`;
  el.style.opacity   = "1";
  el.style.transform = "scale(1.15) rotate(-6deg)";
  layer.appendChild(el);

  // Force paint, then fly to destination
  requestAnimationFrame(() => requestAnimationFrame(() => {
    el.style.left      = `${to.left + to.width/2  - 32}px`;
    el.style.top       = `${to.top  + to.height/2 - 46}px`;
    el.style.opacity   = "0";
    el.style.transform = "scale(0.75) rotate(6deg)";
    setTimeout(() => el.remove(), 1550);
  }));
}

function updateView() {
  if (!state.roomView) { setView("landing"); return; }
  if (state.roomView.status === "lobby") { setView("lobby"); renderLobby(); }
  else { setView("game"); renderGame(); }
}

// ── Lobby rendering ───────────────────────────────────────

function renderLobby() {
  const room = state.roomView;
  if (!room) return;
  elements.roomCode.textContent = room.code;
  updateInviteLink(room.code);
  elements.lobbyHostActions.classList.toggle("hidden",
    !state.isHost || state.youId !== room.hostId);
  elements.startGame.disabled  = !canStartGame(room);
  elements.addBot.disabled     = room.players.length >= 10;
  elements.removeBots.disabled = room.players.every(p => !p.isBot);
  // Sync difficulty picker to room state
  const diff = room.botDifficulty || "medium";
  document.querySelectorAll(".bot-diff-btn").forEach(b =>
    b.classList.toggle("active", b.dataset.diff === diff));
  renderPlayerGrid(elements.lobbyPlayers, room.players, { showCards:false, highlightTurn:false });
}

// ── Game rendering ────────────────────────────────────────

function renderGame() {
  const room = state.roomView;
  if (!room) return;
  renderScoreboard(room);
  renderTableSeats(room);
  renderClaimedSets(room);
  renderHand();
  updateActionControls(room);
  updateTurnLabel(room);
  renderTransactionLog(room);
}

function renderTransactionLog(room) {
  const bar = document.getElementById("last-action-bar");
  if (!bar) return;
  bar.innerHTML = "";

  // ── Pending bot ask (card shown during 5 s sleep) ──────
  if (room.pendingBotAsk) {
    const { askerId, targetId, card } = room.pendingBotAsk;
    const asker  = room.players.find(p => p.id === askerId);
    const target = room.players.find(p => p.id === targetId);
    const sk  = card[0];
    const isR = sk === "D" || sk === "H" || card === "JR";
    const rnk = (card === "JR" || card === "JB") ? "Jo" : card.slice(1);
    const sym = card === "JR" ? "♥" : card === "JB" ? "♠" : SUIT_SYM[sk] || "?";

    const row = document.createElement("div");
    row.className = "txn-pending";
    row.innerHTML = `
      <span class="txn-pending-text">${asker?.name||"Bot"} → ${target?.name||"?"}</span>
      <span class="txn-pending-card ${isR?"red":"black"}">
        <span class="amr">${rnk}</span><span class="ams">${sym}</span>
      </span>
      <span class="txn-pending-dots">…</span>`;
    bar.appendChild(row);
  }

  // ── Completed transactions ─────────────────────────────
  const actions = room.lastActions || (room.lastAction ? [room.lastAction] : []);
  const shown   = logCount === 0 ? actions : actions.slice(0, logCount);
  shown.forEach((txt, i) => {
    const div = document.createElement("div");
    let cls = i === 0 ? "txn-latest" : "txn-older";
    if (txt.includes("received it"))                               cls += " txn-success";
    else if (txt.includes("No luck"))                              cls += " txn-fail";
    else if (txt.includes("scores") || txt.includes("Game over"))  cls += " txn-declare";
    else if (txt.includes("passed"))                               cls += " txn-pass";
    div.className = `txn-item ${cls}`;
    div.textContent = txt;
    bar.appendChild(div);
  });

  // Play again (host, game over)
  if (room.status === "ended" && state.isHost) {
    const btn = document.createElement("button");
    btn.className = "txn-reset-btn";
    btn.textContent = "Play again";
    btn.addEventListener("click", () => dispatchAction("reset_game"));
    bar.appendChild(btn);
  }
}

function updateTurnLabel(room) {
  const el = elements.turnLabel;
  if (room.status === "ended") {
    el.textContent = room.winnerTeam ? `Team ${room.winnerTeam} wins! 🎉` : "Game ended.";
    return;
  }
  const cur = room.players.find(p => p.id === room.turnId);
  el.textContent = cur
    ? (cur.id === state.youId ? "Your turn!" : `${cur.name}'s turn`)
    : "Waiting...";
}

// ── Scoreboard (topbar) ───────────────────────────────────

function renderScoreboard(room) {
  const A = room.claimedSets?.A || [];
  const B = room.claimedSets?.B || [];
  elements.scoreboard.innerHTML = "";
  elements.scoreboard.appendChild(buildScoreCard("Team A","score-a", A));
  elements.scoreboard.appendChild(buildScoreCard("Team B","score-b", B));
}

function buildScoreCard(label, cls, sets) {
  const d = document.createElement("div");
  d.className = `score-card ${cls}`;
  d.innerHTML = `<h4>${label}</h4><div class="score-number">${sets.length}</div>
    <div class="score-sets-label">${
      sets.length === 0 ? "—" : sets.map(k=>SET_LOOKUP[k]?.label||k).join(", ")
    }</div>`;
  return d;
}

// ── Claimed sets chips on table ───────────────────────────

function renderClaimedSets(room) {
  if (!elements.claimedSetsChips) return;
  const A = room.claimedSets?.A || [];
  const B = room.claimedSets?.B || [];
  elements.claimedSetsChips.innerHTML = "";
  [...A.map(k=>({k,t:"A"})), ...B.map(k=>({k,t:"B"}))].forEach(({k,t}) => {
    const chip = document.createElement("div");
    chip.className = `claimed-chip chip-${t.toLowerCase()}`;
    chip.textContent = SET_LOOKUP[k]?.label || k;
    elements.claimedSetsChips.appendChild(chip);
  });
}

// ── Table seat rendering ──────────────────────────────────

function renderTableSeats(room) {
  const container = elements.gamePlayers;
  container.innerHTML = "";

  const players  = room.players;
  const youIndex = players.findIndex(p => p.id === state.youId);
  const n        = players.length;

  players.forEach((player, i) => {
    const relIdx  = ((i - youIndex) + n) % n;
    const angle   = (270 + relIdx * 360 / n) * Math.PI / 180;

    // Ellipse radii as % of container
    const rx = 40, ry = 36, cx = 50, cy = 46;
    const x  = cx + rx * Math.cos(angle);
    const y  = cy + ry * Math.sin(angle);

    const seat = createSeatElement(player, room, x, y);
    container.appendChild(seat);
  });
}

function createSeatElement(player, room, xPct, yPct) {
  const isYou      = player.id === state.youId;
  const isTurn     = player.id === room.turnId;
  const isOpponent = player.team !== (room.players.find(p=>p.id===state.youId)?.team);
  const canAsk     = room.status==="playing" && room.turnId===state.youId && isOpponent
                     && (player.cardCount||0) > 0;

  const seat = document.createElement("div");
  seat.className = "table-seat";
  seat.id        = `seat-${player.id}`;
  seat.style.left = `${xPct}%`;
  seat.style.top  = `${yPct}%`;

  if (isYou)            seat.classList.add("you-seat");
  if (isTurn)           seat.classList.add("current-turn");
  if (isOpponent)       seat.classList.add("is-opponent");

  // Pending bot ask highlighting
  if (room.pendingBotAsk?.askerId  === player.id) seat.classList.add("pending-asker");
  if (room.pendingBotAsk?.targetId === player.id) seat.classList.add("pending-target");

  const bubble = document.createElement("div");
  bubble.className = "seat-bubble";

  // Avatar
  const avatar = document.createElement("div");
  avatar.className = "seat-avatar";
  avatar.style.background = player.avatar;
  avatar.textContent = player.name.slice(0,1);

  // Name row with team dot
  const nameRow = document.createElement("div");
  nameRow.className = "seat-name-row";
  const dot = document.createElement("span");
  dot.className = "seat-team-dot";
  dot.style.background = player.team === "A" ? "var(--team-a)" : "var(--team-b)";
  const nameEl = document.createElement("span");
  nameEl.className = "seat-name";
  nameEl.textContent = isYou ? `${player.name} ★` : player.name;
  nameRow.appendChild(dot); nameRow.appendChild(nameEl);

  // Turn badge
  if (isTurn) {
    const badge = document.createElement("div");
    badge.className = "seat-turn-badge";
    badge.textContent = isYou ? "YOUR TURN" : "TURN";
    bubble.appendChild(badge);
  }

  // Card stack
  const stack = createCardStack(player.cardCount || 0);

  bubble.appendChild(avatar);
  bubble.appendChild(nameRow);
  bubble.appendChild(stack);

  // Show last-asked card on this player's seat until next transaction
  const la = room.lastAsk;
  if (la?.askerId === player.id && la?.card) {
    const sk  = la.card[0];
    const isR = sk === "D" || sk === "H" || la.card === "JR";
    const rnk = (la.card === "JR" || la.card === "JB") ? "Jo" : la.card.slice(1);
    const sym = la.card === "JR" ? "♥" : la.card === "JB" ? "♠" : SUIT_SYM[sk] || "?";
    const ind = document.createElement("div");
    ind.className = `seat-last-ask-card ${la.success ? "success" : "fail"}`;
    ind.style.color = isR ? "var(--card-red)" : "var(--card-black)";
    ind.textContent = `${rnk}${sym}`;
    bubble.appendChild(ind);
  }

  seat.appendChild(bubble);

  // Click handler for asking
  if (canAsk) {
    bubble.style.cursor = "pointer";
    bubble.addEventListener("click", () => handleSeatClick(player, room));
  }

  // Pass button on teammate seats when I have no cards
  const myTeam = room.players.find(p => p.id === state.youId)?.team;
  const canPassHere = room.status === "playing"
    && room.turnId === state.youId
    && state.yourHand.length === 0
    && player.team === myTeam
    && player.id !== state.youId
    && (player.cardCount || 0) > 0;

  if (canPassHere) {
    const passBtn = document.createElement("button");
    passBtn.type = "button";
    passBtn.className = "seat-pass-btn";
    passBtn.textContent = "Pass here";
    passBtn.addEventListener("click", e => {
      e.stopPropagation();
      dispatchAction("pass_turn", { toPlayerId: player.id });
    });
    bubble.appendChild(passBtn);
  }

  return seat;
}

function createCardStack(count) {
  const wrap = document.createElement("div");
  wrap.className = "card-stack";

  if (count === 0) {
    const e = document.createElement("span");
    e.className = "card-stack-empty"; e.textContent = "Empty";
    wrap.appendChild(e); return wrap;
  }

  const show = Math.min(count, 7);
  for (let i = 0; i < show; i++) {
    const back = document.createElement("div");
    back.className = "card-back";
    back.style.left  = `${i * 9}px`;
    back.style.zIndex = String(i);
    wrap.appendChild(back);
  }
  wrap.style.width = `${show * 9 + 28 + 22}px`;

  const countEl = document.createElement("span");
  countEl.className = "card-stack-count";
  countEl.textContent = String(count);
  wrap.appendChild(countEl);

  return wrap;
}

// ── Click a seat to target an opponent ───────────────────

function handleSeatClick(targetPlayer, room) {
  // Deselect if same player
  if (askState.opponentId === targetPlayer.id) {
    clearAskState();
    document.querySelectorAll(".table-seat.targeted").forEach(el => el.classList.remove("targeted"));
    updateAskUI(room);
    return;
  }

  // Mark targeted
  document.querySelectorAll(".table-seat.targeted").forEach(el => el.classList.remove("targeted"));
  document.getElementById(`seat-${targetPlayer.id}`)?.classList.add("targeted");

  askState.opponentId = targetPlayer.id;
  askState.cardCode   = null;

  // Sync the hidden select
  elements.askOpponent.value = targetPlayer.id;

  updateAskUI(room);
}

// ── Ask UI — two-tier picker ──────────────────────────────

const ASK_FAMILIES = [
  { key:"C",  sym:"♣", cls:"",    label:"Clubs" },
  { key:"D",  sym:"♦", cls:"red", label:"Diamonds" },
  { key:"H",  sym:"♥", cls:"red", label:"Hearts" },
  { key:"S",  sym:"♠", cls:"",    label:"Spades" },
  { key:"8J", sym:"8s",cls:"gold",label:"8s & Jokers" }
];

function updateAskUI(room) {
  const isTurn = room?.status === "playing" && room?.turnId === state.youId;
  const claimed = new Set([...(room?.claimedSets?.A||[]), ...(room?.claimedSets?.B||[])]);
  const hasOpponents = (room?.players||[]).some(
    p => p.team !== (room.players.find(q=>q.id===state.youId)?.team) && (p.cardCount||0) > 0
  );

  elements.askUi.classList.toggle("hidden", !isTurn || !hasOpponents);
  if (!isTurn || !hasOpponents) return;

  if (!askState.opponentId) {
    elements.askHint.textContent = "Click an opponent at the table";
    elements.askCardChoices.innerHTML = "";
    elements.askButton.disabled = true;
    return;
  }

  const oppName = room.players.find(p=>p.id===askState.opponentId)?.name || "opponent";
  elements.askHint.textContent = `Asking ${oppName}:`;
  elements.askCardChoices.innerHTML = "";

  // ── Row 1: suit / family tiles ─────────────────────────
  const familyRow = document.createElement("div");
  familyRow.className = "ask-family-row";

  ASK_FAMILIES.forEach(fam => {
    const hasCards = canAskFromFamily(fam.key, state.yourHand, claimed);
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = `ask-suit-tile${fam.cls ? " "+fam.cls : ""}${askState.suitFamily===fam.key ? " selected" : ""}`;
    tile.textContent = fam.sym;
    tile.title = fam.label;
    tile.disabled = !hasCards;
    tile.addEventListener("click", () => {
      askState.suitFamily = askState.suitFamily === fam.key ? null : fam.key;
      askState.cardCode   = null;
      updateAskUI(room);
    });
    familyRow.appendChild(tile);
  });
  elements.askCardChoices.appendChild(familyRow);

  // ── Rows 2+: low & high sets for selected family ───────
  if (askState.suitFamily) {
    getSetsForFamily(askState.suitFamily).forEach(setKey => {
      if (claimed.has(setKey)) return;
      const set = SET_LOOKUP[setKey];
      if (!set) return;
      if (!state.yourHand.some(c => CARD_TO_SET.get(c) === setKey)) return;
      const askableInSet = set.cards.filter(c => !state.yourHand.includes(c));
      if (askableInSet.length === 0) return;

      const setRow = document.createElement("div");
      setRow.className = "ask-set-row";

      const lbl = document.createElement("div");
      lbl.className = "ask-set-row-label";
      lbl.textContent = set.label;
      setRow.appendChild(lbl);

      const cardsWrap = document.createElement("div");
      cardsWrap.className = "ask-set-cards";

      askableInSet.forEach(card => {
        const suitKey = card[0];
        const rank = (card === "JR" || card === "JB") ? "Jo" : card.slice(1);
        const sym  = card === "JR" ? "♥" : card === "JB" ? "♠" : SUIT_SYM[suitKey] || "?";
        const isRed = suitKey === "D" || suitKey === "H" || card === "JR";

        const mini = document.createElement("div");
        mini.className = `ask-mini-card ${isRed ? "red" : "black"}`;
        mini.dataset.card = card;
        mini.title = cardLabel(card);
        mini.innerHTML = `<span class="amr">${rank}</span><span class="ams">${sym}</span>`;
        if (askState.cardCode === card) mini.classList.add("selected");
        mini.addEventListener("click", () => {
          askState.cardCode      = card;
          elements.askCard.value = card;
          handleAskCard();   // dispatch immediately — no Ask button needed
        });
        cardsWrap.appendChild(mini);
      });

      setRow.appendChild(cardsWrap);
      elements.askCardChoices.appendChild(setRow);
    });
  }

  elements.askButton.disabled = !askState.cardCode;
}

// ── Hand rendering ────────────────────────────────────────

function renderHand() {
  elements.handCards.innerHTML = "";

  if (!state.yourHand || state.yourHand.length === 0) {
    const empty = document.createElement("p");
    empty.className = "muted"; empty.textContent = "No cards in hand.";
    elements.handCards.appendChild(empty);
    if (elements.cardCountBadge) elements.cardCountBadge.textContent = "0";
    return;
  }

  const sorted = [...state.yourHand].sort();
  sorted.forEach((card, i) => {
    const isNew = _pendingNewCards.includes(card);
    const el = createCardElement(card, {
      flyIn: isNew,
      deal:  !isNew && _dealAnimation,
      delay: _dealAnimation ? i * 45 : 0
    });
    elements.handCards.appendChild(el);
  });

  if (elements.cardCountBadge) elements.cardCountBadge.textContent = String(sorted.length);
}

// ── Playing card element ──────────────────────────────────

function createCardElement(card, opts = {}) {
  const el = document.createElement("div");
  el.className = "hand-card"; el.dataset.card = card;

  if (card === "JR" || card === "JB") {
    const isRed = card === "JR";
    el.classList.add(isRed ? "red" : "black", "joker");
    const sym = isRed ? "♥" : "♠";
    el.innerHTML = `<span class="cr tl">Jo</span><span class="cs tl">${sym}</span><span class="cc">🃏</span><span class="cr br">Jo</span><span class="cs br">${sym}</span>`;
  } else {
    const suitKey = card[0]; const rank = card.slice(1);
    const sym = SUIT_SYM[suitKey]||"?";
    el.classList.add(SUIT_COLOR[suitKey]||"black");
    el.innerHTML = `<span class="cr tl">${rank}</span><span class="cs tl">${sym}</span><span class="cc">${sym}</span><span class="cr br">${rank}</span><span class="cs br">${sym}</span>`;
  }

  if (opts.deal) {
    el.classList.add("card-deal");
    el.style.setProperty("--cd", `${opts.delay||0}ms`);
    el.style.setProperty("--dr", `${(Math.random()-.5)*22}deg`);
  } else if (opts.flyIn) {
    el.classList.add("card-fly-in");
    el.style.setProperty("--cd", `${opts.delay||0}ms`);
  }
  return el;
}

// ── Lobby player grid ─────────────────────────────────────

function renderPlayerGrid(container, players, options) {
  container.innerHTML = "";
  players.forEach(player => {
    const card = document.createElement("div");
    card.className = `player-card${player.team==="B"?" team-b-card":""}`;
    const avatar = document.createElement("div");
    avatar.className = "player-avatar"; avatar.style.background = player.avatar;
    avatar.textContent = player.name.slice(0,1);
    const meta = document.createElement("div");
    meta.className = "player-meta";
    const displayName = player.id===state.youId ? `${player.name} (you)` : player.name;
    const cardCount = options.showCards ? `${player.cardCount||0} cards` : "Ready";
    const botLabel = player.isBot ? " · Bot" : "";
    const statusText = player.connected===false ? "<span>⚠ Disconnected</span>" : "";
    meta.innerHTML = `<strong>${displayName}</strong><span>${cardCount}${botLabel}</span>${statusText}`;
    const team = document.createElement("span");
    team.className = `team-pill${player.team==="B"?" team-b":""}`;
    team.textContent = `Team ${player.team}`;
    card.appendChild(avatar); card.appendChild(meta); card.appendChild(team);
    container.appendChild(card);
  });
}

// ── Action controls ───────────────────────────────────────

function updateActionControls(room) {
  const player  = room.players.find(p => p.id === state.youId);
  const isTurn  = room.turnId === state.youId;
  const canAct  = room.status === "playing" && isTurn;
  const claimed = new Set([...(room.claimedSets?.A||[]), ...(room.claimedSets?.B||[])]);

  // Populate hidden selects (for canAsk checks)
  const opponents = room.players.filter(
    p => p.team !== player?.team && (p.cardCount||0) > 0
  );
  elements.askOpponent.innerHTML = opponents.map(op =>
    `<option value="${op.id}">${op.name}</option>`).join("");

  const askable = buildAskableCards(state.yourHand, claimed);
  elements.askCard.innerHTML = askable.map(c =>
    `<option value="${c}">${cardLabel(c)}</option>`).join("");

  // Update ask UI
  updateAskUI(room);

  // Declare
  const availSets = SET_DEFS.filter(s =>
    !claimed.has(s.key) && state.yourHand.some(c => CARD_TO_SET.get(c) === s.key)
  );
  elements.declareSet.innerHTML = availSets.map(s =>
    `<option value="${s.key}">${s.label}</option>`).join("");
  elements.declareSet.disabled    = !canAct || availSets.length === 0;
  elements.declareButton.disabled = !canAct || availSets.length === 0;

  // Pass
  elements.passButton.disabled = !(canAct && state.yourHand.length === 0);
  elements.resetGame.classList.toggle("hidden",
    !state.isHost || room.status !== "ended");

  // Build declare assignment UI for the currently-selected set
  buildDeclareAssignmentUI(room, elements.declareSet.value);
}

function handleAskCard() {
  if (!askState.opponentId || !askState.cardCode) {
    showToast("Select an opponent, then pick a card.", "warn"); return;
  }
  dispatchAction("ask_card", { toPlayerId: askState.opponentId, card: askState.cardCode });
  // Clear targeting visuals
  document.querySelectorAll(".table-seat.targeted").forEach(el => el.classList.remove("targeted"));
  clearAskState();
}

function handleDeclareSet() {
  const setKey = elements.declareSet.value;
  if (!setKey) { showMessage("Select a set to declare."); return; }
  const assignments = {};
  document.querySelectorAll(".declare-row[data-card]").forEach(row => {
    const card = row.dataset.card;
    const sel  = row.querySelector("select");
    if (sel && sel.value) assignments[card] = sel.value;
  });
  const set = SET_LOOKUP[setKey];
  if (set && Object.keys(assignments).length < set.cards.length) {
    showMessage("Assign all 6 cards to teammates before declaring."); return;
  }
  dispatchAction("declare_set", { setKey, assignments });
}

// ── Action dispatch ───────────────────────────────────────

function dispatchAction(actionType, data = {}) {
  if (!state.roomView) return;
  if (state.isHost && state.roomState) {
    const err = applyAction(state.roomState, state.youId, actionType, data);
    if (err) { showMessage(err); return; }
    broadcastRoom();
  } else if (state.hostConnection) {
    safeSend(state.hostConnection, { type:"action", payload:{ actionType, data } });
  }
}

// ── Game logic ────────────────────────────────────────────

function applyAction(room, playerId, actionType, data) {
  const player = room.players.find(p => p.id === playerId);
  if (!player) return "Player not found.";

  switch (actionType) {
    case "shuffle_teams":
      if (playerId !== room.hostId)   return "Only the host can shuffle teams.";
      if (room.status !== "lobby")    return "Only in lobby.";
      shuffleArray(room.players); assignTeams(room.players);
      pushAction(room, "Teams shuffled."); return null;

    case "start_game":
      if (playerId !== room.hostId)   return "Only the host can start.";
      if (!canStartGame(room))        return "Need 4+ even players.";
      startGame(room); pushAction(room, "Game started — cards dealt!"); return null;

    case "add_bot":
      if (playerId !== room.hostId)   return "Only the host can add bots.";
      if (room.status !== "lobby")    return "Only in lobby.";
      return addBotToRoom(room);

    case "remove_bots":
      if (playerId !== room.hostId)   return "Only the host can remove bots.";
      if (room.status !== "lobby")    return "Only in lobby.";
      removeBotsFromRoom(room); pushAction(room, "Bots removed."); return null;

    case "ask_card":    return handleAskAction(room, player, data);
    case "declare_set": return handleDeclareAction(room, player, data);
    case "pass_turn":   return handlePassAction(room, player, data);

    case "reset_game":
      if (playerId !== room.hostId) return "Only the host can reset.";
      resetGame(room); pushAction(room, "Game reset."); return null;

    default: return "Unknown action.";
  }
}

function handleAskAction(room, player, data) {
  if (room.status !== "playing") return "Game not started.";
  if (room.turnId !== player.id) return "Not your turn.";
  if (player.hand.length === 0)  return "No cards to ask with.";

  const { toPlayerId, card } = data || {};
  const target = room.players.find(p => p.id === toPlayerId);
  if (!target)                             return "Opponent not found.";
  if (target.team === player.team)         return "Can only ask opponents.";
  if (target.hand.length === 0)            return "Opponent has no cards.";
  if (!CARD_TO_SET.has(card))              return "Invalid card.";

  const setKey = CARD_TO_SET.get(card);
  if (isSetClaimed(room, setKey))          return "Set already claimed.";
  if (!player.hand.some(c => CARD_TO_SET.get(c) === setKey)) return "Must hold a card in the same set.";
  if (player.hand.includes(card))          return "You already have that card.";

  const success = target.hand.includes(card);
  room.lastAsk = { askerId: player.id, targetId: target.id, card, success };
  if (!room.cardKnowledge) room.cardKnowledge = {};
  const ck = room.cardKnowledge;

  if (success) {
    target.hand = target.hand.filter(c => c !== card);
    player.hand.push(card);
    // Everyone saw the card move to the asker — positive knowledge, reset absence
    ck[card] = { holder: player.id, absent: [] };
    pushAction(room, `${player.name} asked ${target.name} for ${cardLabel(card)} and received it.`);
    room.turnId = player.id;
  } else {
    // Everyone saw the target doesn't have it — add to absence list
    if (!ck[card]) ck[card] = { holder: null, absent: [] };
    if (ck[card].holder === target.id) ck[card].holder = null; // stale positive knowledge
    if (!ck[card].absent.includes(target.id)) ck[card].absent.push(target.id);
    pushAction(room, `${player.name} asked ${target.name} for ${cardLabel(card)}. No luck.`);
    room.turnId = target.id;
  }
  ensureValidTurn(room); return null;
}

function handleDeclareAction(room, player, data) {
  if (room.status !== "playing") return "Game not started.";
  if (room.turnId !== player.id) return "Not your turn.";

  const set = SET_LOOKUP[data?.setKey];
  if (!set) return "Unknown set.";
  if (isSetClaimed(room, set.key)) return "Set already claimed.";

  const assignments = data?.assignments || {};
  const teammateIds = room.players.filter(p => p.team === player.team).map(p => p.id);

  // Every card must be assigned to a teammate, and the assignment must match their actual hand
  const allAssigned = set.cards.every(c => teammateIds.includes(assignments[c]));
  const success = allAssigned && set.cards.every(card => {
    const holder = room.players.find(p => p.id === assignments[card]);
    return holder && holder.hand.includes(card);
  });

  const winningTeam = success ? player.team : otherTeam(player.team);
  room.players.forEach(m => { m.hand = m.hand.filter(c => !set.cards.includes(c)); });
  room.claimedSets[winningTeam].push(set.key);
  room.scores[winningTeam] = room.claimedSets[winningTeam].length;
  const declareMsg = success
    ? `${player.name} declared ${set.label}! Team ${winningTeam} scores.`
    : `${player.name} declared ${set.label} incorrectly. Team ${winningTeam} scores.`;

  if (room.scores[winningTeam] >= 5 || totalClaimedSets(room) >= SET_DEFS.length) {
    room.status = "ended"; room.winnerTeam = winningTeam;
    pushAction(room, declareMsg + " Game over!");
    return null;
  }
  pushAction(room, declareMsg);
  ensureValidTurn(room); return null;
}

function handlePassAction(room, player, data) {
  if (room.status !== "playing") return "Game not started.";
  if (room.turnId !== player.id) return "Not your turn.";
  if (player.hand.length > 0)   return "Can only pass when empty-handed.";
  let nextId = data?.toPlayerId;
  if (nextId) {
    const target = room.players.find(p => p.id === nextId);
    if (!target || target.team !== player.team || target.id === player.id || target.hand.length === 0)
      return "Cannot pass to that player.";
  } else {
    nextId = findNextPlayerWithCards(room, player.id, player.team);
  }
  if (!nextId) return "No teammate has cards.";
  room.turnId = nextId;
  pushAction(room, `${player.name} passed to ${room.players.find(p=>p.id===nextId)?.name||"teammate"}.`);
  return null;
}

// ── Turn helpers ──────────────────────────────────────────

function ensureValidTurn(room) {
  const cur = room.players.find(p => p.id === room.turnId);
  if (cur && cur.hand.length > 0) return;
  const next = findNextPlayerWithCards(room, room.turnId);
  if (next) room.turnId = next;
}

function findNextPlayerWithCards(room, currentId, team) {
  const p = room.players; if (!p.length) return null;
  let start = p.findIndex(x => x.id === currentId); if (start < 0) start = 0;
  for (let off = 1; off <= p.length; off++) {
    const pl = p[(start+off)%p.length];
    if (pl.hand.length === 0) continue;
    if (team && pl.team !== team) continue;
    return pl.id;
  }
  return null;
}

// ── Game lifecycle ────────────────────────────────────────

function startGame(room) {
  room.status = "playing"; room.claimedSets = {A:[],B:[]}; room.scores = {A:0,B:0}; room.winnerTeam = null;
  room.players.forEach(p => p.hand = []);
  const deck = shuffleArray([...ALL_CARDS]);
  deck.forEach((card, i) => room.players[i % room.players.length].hand.push(card));
  room.turnId = room.players.find(p => p.hand.length > 0)?.id || null;
}

function resetGame(room) {
  room.status = "lobby"; room.claimedSets = {A:[],B:[]}; room.scores = {A:0,B:0}; room.winnerTeam = null;
  room.lastActions = []; room.pendingBotAsk = null; room.lastAsk = null; room.cardKnowledge = {};
  room.players = room.players.filter(p => p.connected !== false || p.id === room.hostId);
  room.players.forEach(p => { p.hand = []; p.connected = true; });
  assignTeams(room.players); room.turnId = room.hostId;
}

function handleDisconnect(playerId) {
  const room = state.roomState; if (!room) return;
  const player = room.players.find(p => p.id === playerId); if (!player) return;
  player.connected = false; state.connections.delete(playerId);
  if (room.status === "lobby") {
    room.players = room.players.filter(p => p.id !== playerId);
    assignTeams(room.players); pushAction(room, `${player.name} left.`);
  } else {
    room.status = "ended"; room.winnerTeam = null;
    pushAction(room, `${player.name} disconnected. Host can reset.`);
  }
  broadcastRoom();
}

// ── Broadcast ─────────────────────────────────────────────

function broadcastRoom() {
  if (!state.roomState) return;
  state.roomState.players.forEach(player => {
    const payload = buildRoomView(state.roomState, player.id);
    if (player.id === state.youId) applyRoomView(payload);
    else {
      const conn = state.connections.get(player.id);
      if (conn && conn.open) safeSend(conn, { type:"room_state", payload });
    }
  });
  if (state.isHost) scheduleBotTurn();
}

// ── Bot AI ─────────────────────────────────────────────────

function scheduleBotTurn() {
  if (!state.roomState || !state.isHost) return;
  if (botPhase2Active) return;  // phase-2 timer is already running — don't touch it
  clearTimeout(botTurnTimer);
  const room = state.roomState;
  if (room.status !== "playing") return;
  const cur = room.players.find(p => p.id === room.turnId);
  if (!cur || !cur.isBot) return;

  botTurnTimer = setTimeout(() => {
    if (room.status !== "playing") return;
    if (room.turnId !== cur.id) { broadcastRoom(); return; } // turn moved — nudge next player
    const action = decideBotAction(room, cur);

    if (action.type === "ask") {
      // Phase 1 — announce the ask; card visible to all for 5 s
      room.pendingBotAsk = { askerId: cur.id, targetId: action.targetId, card: action.card };
      botPhase2Active = true;   // lock out scheduleBotTurn until phase 2 fires
      broadcastRoom();          // safe — scheduleBotTurn will bail due to flag above
      // Phase 2 — apply result
      botTurnTimer = setTimeout(() => {
        botPhase2Active = false;
        room.pendingBotAsk = null;
        // Only apply the ask if it's still this bot's turn and game is live
        if (room.status === "playing" && room.turnId === cur.id) {
          const err = handleAskAction(room, cur, { toPlayerId: action.targetId, card: action.card });
          if (err) { pushAction(room, err); ensureValidTurn(room); }
        }
        broadcastRoom(); // always broadcast so the next turn (whoever's) starts
      }, 5000);
    } else {
      room.pendingBotAsk = null;
      const err = applyBotNonAskAction(room, cur, action);
      if (err) { pushAction(room, err); ensureValidTurn(room); }
      broadcastRoom();
    }
  }, 600);
}

// Decide best action.
// All bots have "perfect memory" — they track every ask result and can deduce card locations.
// Difficulty controls strategy depth, not information access.
//
// easy   — reactive: only acts on cards from "open" sets (sets with any transaction history);
//          no deduction, pure direct knowledge + random fallback within active sets.
// medium — focused: uses direct knowledge + deduction (if N-1 opponents can't have a card,
//          the last one must); prioritises sets where own team has the most cards.
// hard   — strategic: full deduction, scores by team progress AND opponent blocking;
//          in blind-guess fallback, picks the set/opponent with best statistical chance.
function decideBotAction(room, bot) {
  if (bot.hand.length === 0) return { type: "pass" };

  const diff       = room.botDifficulty || "medium";
  const teamCards  = getTeamCards(room, bot.team);
  const oppTeam    = bot.team === "A" ? "B" : "A";
  const oppTCards  = getTeamCards(room, oppTeam);
  const claimed    = new Set([...(room.claimedSets?.A||[]), ...(room.claimedSets?.B||[])]);
  const opponents  = room.players.filter(p => p.team !== bot.team && p.hand.length > 0);
  const ck         = room.cardKnowledge || {};

  // 1. Declare immediately when team owns a complete set
  const claimable = SET_DEFS.filter(s =>
    !claimed.has(s.key) && s.cards.every(c => teamCards.has(c))
  );
  if (claimable.length > 0) return { type: "declare", setKey: claimable[0].key };

  if (opponents.length === 0) return { type: "pass" };

  const askable = buildAskableCards(bot.hand, claimed);
  if (askable.length === 0) return { type: "pass" };

  // "Open sets" for easy bots: sets that have appeared in at least one transaction
  const openSets = new Set(Object.keys(ck).map(c => CARD_TO_SET.get(c)));

  // Find which opponent holds a card, using difficulty-appropriate reasoning
  function findHolder(card) {
    const info = ck[card];
    // Direct positive knowledge (seen card move to this player)
    if (info?.holder) return opponents.find(p => p.id === info.holder) || null;
    // Deduction: medium/hard only — if all opponents but one are ruled out, that one has it
    if (diff === "easy") return null;
    const possible = opponents.filter(p => !(info?.absent||[]).includes(p.id));
    return possible.length === 1 ? possible[0] : null;
  }

  // Score a candidate ask
  function scoreAsk(card, _holder) {
    const setKey       = CARD_TO_SET.get(card);
    const set          = SET_LOOKUP[setKey];
    const teamCount    = set.cards.filter(c => teamCards.has(c)).length;
    if (diff === "easy")   return teamCount;          // mild set preference
    if (diff === "medium") return teamCount * 10;     // maximise own team's progress
    // hard: team progress + block opponents close to completing this set
    const oppSetCount  = set.cards.filter(c => oppTCards.has(c)).length;
    const blockBonus   = oppSetCount >= 4 ? (oppSetCount - 3) * 20 : 0;
    return teamCount * 10 - oppSetCount * 3 + blockBonus;
  }

  // Build known/deduced candidates
  const candidates = [];
  askable.forEach(card => {
    if (diff === "easy" && !openSets.has(CARD_TO_SET.get(card))) return; // easy: open sets only
    const holder = findHolder(card);
    if (!holder) return;
    candidates.push({ card, targetId: holder.id, score: scoreAsk(card, holder) });
  });

  if (candidates.length > 0) {
    candidates.sort((a, b) => b.score - a.score);
    const top  = candidates.filter(c => c.score === candidates[0].score);
    const pick = top[Math.floor(Math.random() * top.length)];
    return { type: "ask", targetId: pick.targetId, card: pick.card };
  }

  // Blind guess fallback — pick best available card + best available opponent
  // Easy: random within open sets if any, else fully random
  // Medium/Hard: pick card from set with most team cards; pick opponent not ruled out
  const pool = diff === "easy"
    ? (askable.filter(c => openSets.has(CARD_TO_SET.get(c))).length > 0
        ? askable.filter(c => openSets.has(CARD_TO_SET.get(c)))
        : askable)
    : askable;

  const card = pool.reduce((best, c) => {
    const tc  = SET_LOOKUP[CARD_TO_SET.get(c)]?.cards.filter(x => teamCards.has(x)).length || 0;
    const btc = SET_LOOKUP[CARD_TO_SET.get(best)]?.cards.filter(x => teamCards.has(x)).length || 0;
    return tc > btc ? c : best;
  }, pool[0]);

  // Prefer opponents not ruled out for this card
  const info      = ck[card];
  const notRuled  = opponents.filter(p => !(info?.absent||[]).includes(p.id));
  const oppPool   = notRuled.length > 0 ? notRuled : opponents;
  const opp       = oppPool[Math.floor(Math.random() * oppPool.length)];

  return { type: "ask", targetId: opp.id, card };
}

// Apply non-ask bot actions
function applyBotNonAskAction(room, bot, action) {
  if (action.type === "declare") {
    const set = SET_LOOKUP[action.setKey];
    const assignments = {};
    set.cards.forEach(card => {
      const holder = room.players.find(p => p.team === bot.team && p.hand.includes(card));
      if (holder) assignments[card] = holder.id;
    });
    return handleDeclareAction(room, bot, { setKey: action.setKey, assignments });
  }
  const err = handlePassAction(room, bot, {});
  if (!err) ensureValidTurn(room);
  return err;
}

// ── State builders ─────────────────────────────────────────

function buildRoomView(room, playerId) {
  const view = room.players.map(p => ({
    id:p.id, name:p.name, avatar:p.avatar, team:p.team, isBot:p.isBot,
    cardCount:p.hand.length, connected:p.connected!==false, isHost:p.id===room.hostId
  }));
  const cur = room.players.find(p => p.id === playerId);
  return {
    room: {
      code:room.code, status:room.status, hostId:room.hostId, players:view,
      turnId:room.turnId, scores:{...room.scores},
      claimedSets:{ A:[...room.claimedSets.A], B:[...room.claimedSets.B] },
      lastAction:room.lastAction, lastActions:[...(room.lastActions||[])],
      winnerTeam:room.winnerTeam,
      pendingBotAsk: room.pendingBotAsk ? {...room.pendingBotAsk} : null,
      lastAsk:       room.lastAsk       ? {...room.lastAsk}       : null,
      botDifficulty: room.botDifficulty || "medium"
    },
    youId: playerId,
    yourHand: cur ? sortedHand(cur.hand) : []
  };
}

function createRoomState(hostId, name, avatar, code) {
  return {
    code, hostId, status:"lobby",
    players:[createPlayer(hostId, name, avatar, "A", true)],
    claimedSets:{A:[],B:[]}, scores:{A:0,B:0},
    turnId:hostId, lastAction:"Room created.",
    lastActions:["Room created."], winnerTeam:null,
    pendingBotAsk:null, lastAsk:null, cardKnowledge:{}, botDifficulty:"medium"
  };
}

function createPlayer(id, name, avatar, team, isHost, isBot=false) {
  return { id, name, avatar, team, isHost, isBot, hand:[], connected:true };
}

// ── Bot helpers ────────────────────────────────────────────

function botsToAdd(playerCount) {
  if (playerCount === 1) return 3;           // 1 → 4 (minimum playable)
  if (playerCount % 2 === 1) return 1;       // odd → +1 to make even
  return 2;                                   // even → +2 to keep even
}

function addBotToRoom(room) {
  if (room.players.length >= 10) return "Room is full.";
  const count = botsToAdd(room.players.length);
  let added = 0;
  for (let i = 0; i < count; i++) {
    if (room.players.length >= 10) break;
    const num = nextBotNumber(room.players);
    const id  = `bot-${Date.now()}-${Math.random().toString(16).slice(2,6)}`;
    room.players.push(createPlayer(id, `Bot ${num}`, pickBotAvatar(room.players), "A", false, true));
    added++;
  }
  if (added === 0) return "Room is full.";
  assignTeams(room.players);
  pushAction(room, added === 1 ? "1 bot joined." : `${added} bots joined.`);
  return null;
}

function removeBotsFromRoom(room) {
  room.players = room.players.filter(p => !p.isBot);
  assignTeams(room.players);
}

function nextBotNumber(players) {
  const nums = players.filter(p=>p.isBot).map(p=>{ const m=p.name.match(/\d+/); return m?+m[0]:0; });
  return nums.length > 0 ? Math.max(...nums)+1 : 1;
}

function pickBotAvatar(players) {
  const used = new Set(players.map(p=>p.avatar));
  const av   = AVATAR_COLORS.filter(c=>!used.has(c));
  return av.length > 0 ? av[0] : AVATAR_COLORS[Math.floor(Math.random()*AVATAR_COLORS.length)];
}

function assignTeams(players) { players.forEach((p,i) => p.team = i%2===0 ? "A" : "B"); }
function canStartGame(room) { return room.status==="lobby" && room.players.length>=4 && room.players.length%2===0; }

// ── Card utilities ─────────────────────────────────────────

function cardLabel(card) {
  if (card==="JR") return "Red Joker";
  if (card==="JB") return "Black Joker";
  const suit = SUITS.find(s=>s.key===card[0]);
  return `${suit?.name||"?"} ${card.slice(1)}`;
}

function cardShortLabel(card) {
  if (card==="JR") return "♥Jo";
  if (card==="JB") return "♠Jo";
  return `${SUIT_SYM[card[0]]||"?"}${card.slice(1)}`;
}

// ── Declare assignment UI ──────────────────────────────────

function buildDeclareAssignmentUI(room, setKey) {
  const container = document.getElementById("declare-assignments");
  if (!container) return;
  container.innerHTML = "";
  if (!setKey || !room || room.status !== "playing") return;

  const set = SET_LOOKUP[setKey];
  if (!set) return;

  const player = room.players.find(p => p.id === state.youId);
  if (!player) return;
  const teammates = room.players.filter(p => p.team === player.team);

  set.cards.forEach(card => {
    const row = document.createElement("div");
    row.className = "declare-row";
    row.dataset.card = card;

    const label = document.createElement("span");
    label.className = "declare-card-label";
    const suitKey = card === "JR" ? "H" : card === "JB" ? "S" : card[0];
    label.style.color = (suitKey === "H" || suitKey === "D") ? "var(--card-red)" : "var(--text)";
    label.textContent = cardShortLabel(card);

    const sel = document.createElement("select");
    sel.innerHTML = `<option value="">who has it?</option>` +
      teammates.map(t =>
        `<option value="${t.id}">${t.id === state.youId ? "You" : t.name}</option>`
      ).join("");

    // Auto-fill if in your hand
    if (state.yourHand.includes(card)) sel.value = state.youId;

    row.appendChild(label);
    row.appendChild(sel);
    container.appendChild(row);
  });
}

function pushAction(room, text) {
  room.lastAction = text;
  if (!room.lastActions) room.lastActions = [];
  room.lastActions.unshift(text);
  if (room.lastActions.length > 3) room.lastActions.pop();
}

function getSetsForFamily(familyKey) {
  if (familyKey === "8J") return ["eights_jokers"];
  const name = { C:"clubs", D:"diamonds", H:"hearts", S:"spades" }[familyKey];
  return name ? [`${name}_low`, `${name}_high`] : [];
}

function canAskFromFamily(familyKey, hand, claimed) {
  return getSetsForFamily(familyKey).some(sk =>
    !claimed.has(sk) && hand.some(c => CARD_TO_SET.get(c) === sk)
  );
}

function buildAskableCards(hand, claimedSets) {
  if (!hand||hand.length===0) return [];
  const ownedSets = new Set(hand.map(c=>CARD_TO_SET.get(c)));
  return ALL_CARDS.filter(c => {
    const k = CARD_TO_SET.get(c);
    return ownedSets.has(k) && !claimedSets.has(k) && !hand.includes(c);
  });
}

function getTeamCards(room, team) {
  const cards = new Set();
  room.players.filter(p=>p.team===team).forEach(p=>p.hand.forEach(c=>cards.add(c)));
  return cards;
}

function isSetClaimed(room, key) {
  return room.claimedSets.A.includes(key) || room.claimedSets.B.includes(key);
}
function totalClaimedSets(room) { return room.claimedSets.A.length+room.claimedSets.B.length; }
function otherTeam(t) { return t==="A" ? "B" : "A"; }

// ── Toast ──────────────────────────────────────────────────

function showToast(msg, type="info", duration=3800) {
  const c = document.getElementById("toast-container"); if (!c) return;
  const t = document.createElement("div");
  t.className = `toast toast-${type}`; t.textContent = msg; c.appendChild(t);
  requestAnimationFrame(()=>requestAnimationFrame(()=>t.classList.add("show")));
  setTimeout(()=>{
    t.classList.remove("show"); t.classList.add("hide");
    setTimeout(()=>t.remove(), 300);
  }, duration);
}

// ── Background cards ───────────────────────────────────────

function initBgCards() {
  const c = document.getElementById("bg-cards"); if (!c) return;
  [
    {sym:"♠",l:"4%", t:"12%"},{sym:"♥",l:"12%",t:"68%"},{sym:"♦",l:"22%",t:"38%"},
    {sym:"♣",l:"62%",t:"18%"},{sym:"♠",l:"74%",t:"62%"},{sym:"♥",l:"86%",t:"28%"},
    {sym:"♦",l:"91%",t:"78%"},{sym:"♣",l:"46%",t:"80%"},{sym:"♠",l:"38%",t:"50%"},
  ].forEach((item,i) => {
    const el = document.createElement("div");
    el.className="bg-floater"; el.textContent=item.sym;
    el.style.left=item.l; el.style.top=item.t;
    el.style.setProperty("--rot",`${(Math.random()-.5)*40}deg`);
    el.style.setProperty("--dur",`${7+Math.random()*5}s`);
    el.style.setProperty("--del",`${i*.4}s`);
    c.appendChild(el);
  });
}

// ── Utilities ──────────────────────────────────────────────

function shuffleArray(arr) {
  for (let i=arr.length-1; i>0; i--) {
    const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]];
  }
  return arr;
}

function normalizeRoomCode(code) { return code.replace(/\s+/g,"").toUpperCase(); }

function generateRoomCode() {
  const chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({length:6},()=>chars[Math.floor(Math.random()*chars.length)]).join("");
}

function updateInviteLink(code) {
  const origin = window.location.origin==="null"
    ? window.location.href.split("?")[0]
    : `${window.location.origin}${window.location.pathname}`;
  elements.inviteLink.value = `${origin}?room=${code}`;
}

function handleCopyInvite() {
  const link = elements.inviteLink.value; if (!link) return;
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(link).then(()=>showMessage("Invite link copied.")).catch(()=>showMessage("Unable to copy."));
    return;
  }
  elements.inviteLink.select();
  showMessage(document.execCommand("copy") ? "Invite link copied." : "Unable to copy.");
}

function parseMessage(data) {
  if (!data) return null;
  if (typeof data==="object") return data;
  try { return JSON.parse(data); } catch { return null; }
}

function safeSend(conn, payload) { if (conn&&conn.open) conn.send(payload); }

// ── Leave / cleanup ────────────────────────────────────────

function leaveRoom() {
  if (state.isHost) state.connections.forEach(c=>c.close());
  else if (state.hostConnection) { safeSend(state.hostConnection,{type:"leave_room"}); state.hostConnection.close(); }
  resetState();
}

function cleanupPeer() {
  if (state.peer) state.peer.destroy();
  clearTimeout(botTurnTimer); botTurnTimer=null;
  botPhase2Active = false;
  state.peer=null; state.hostConnection=null; state.connections=new Map();
}

function resetState() {
  cleanupPeer();
  state.roomState=null; state.roomView=null; state.yourHand=[];
  state.youId=null; state.isHost=false;
  setConnectionStatus("Offline"); setView("landing");
}
