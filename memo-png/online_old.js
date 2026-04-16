// EchoHunt v2.4 - online.js
// MERGED: v2.2 canvas foundation + v2.3 improvements
//
// From v2.2 (preserved as-is, these were working perfectly):
//   ✅ Tactical Pause: isActionInProgress + setTimeout 10s
//   ✅ Smart Pencil: circle color matches cell value (grey/yellow/player color)
//   ✅ Grid-Snap: circles drawn at exact cell center using offsetLeft/Top
//   ✅ Precision Eraser: right-click removes single cell circle
//   ✅ redrawTacticalCanvas() with perfect centering
//   ✅ createBoards() with data-index flat layout
//
// From v2.3 (added on top):
//   ✅ Battle Log panel (formatLogEntrySelf / formatLogEntryEnemy)
//   ✅ assign_player event handler (myPlayerNumber set from server)
//   ✅ Render deployment URL for socket connection
//   ✅ ERASE also clears canvas drawings (drawnCircles = [])
//   ✅ Selected action button glow highlight
//   ✅ BUG FIX: battle log player comparison uses == (int vs string safe)
//   ✅ BUG FIX: error flash in game-message instead of alert()
//   ✅ Cell icons: S1/S2 → 🚢, X → 💥, O → 🔔, M → ✕, ~ → ·

console.log("EchoHunt v2.4 - Merged Edition");

// --- Global Variables ---
let myPlayerNumber = null;
let currentGameState = {};
let selectedAction = null;
let drawnCircles = [];
let isActionInProgress = false;

// ── Sound System (Web Audio API) ─────────────────────────────────────────────
// No external files needed — all sounds generated in browser.
// AudioContext is created on first user interaction (browser security policy).

let audioCtx = null;

function getAudioCtx() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtx;
}

function playSound(type) {
    try {
        const ctx = getAudioCtx();

        if (type === 'hit') {
            // 💥 Direct Hit — dramatic explosion: low boom + noise burst
            playExplosion(ctx);

        } else if (type === 'echo') {
            // 🔔 Echo — sonar ping: rising tone that fades
            playSonarPing(ctx);

        } else if (type === 'miss') {
            // 💧 Miss — soft splash: short low thud
            playSplash(ctx);

        } else if (type === 'move') {
            // 🚢 Move — engine hum: short low rumble
            playEngineHum(ctx);

        } else if (type === 'place') {
            // ⚓ Ship placed — anchor drop: short metallic click
            playAnchor(ctx);

        } else if (type === 'win') {
            // 🏆 Victory — fanfare: ascending notes
            playVictory(ctx);
        }
    } catch (e) {
        // Silently ignore audio errors
    }
}

function playExplosion(ctx) {
    // Low boom
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.4);
    gain.gain.setValueAtTime(0.8, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);

    // Noise burst overlay
    const bufferSize = ctx.sampleRate * 0.3;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const noiseGain = ctx.createGain();
    noise.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noiseGain.gain.setValueAtTime(0.4, ctx.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    noise.start(ctx.currentTime);
    noise.stop(ctx.currentTime + 0.3);
}

function playSonarPing(ctx) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.6);
}

function playSplash(ctx) {
    const bufferSize = ctx.sampleRate * 0.2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;
    const gain = ctx.createGain();
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    noise.start(ctx.currentTime);
    noise.stop(ctx.currentTime + 0.2);
}

function playEngineHum(ctx) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(80, ctx.currentTime);
    osc.frequency.setValueAtTime(100, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.25);
}

function playAnchor(ctx) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'square';
    osc.frequency.setValueAtTime(300, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.1);
}

function playVictory(ctx) {
    // Ascending fanfare: C E G C
    const notes = [262, 330, 392, 524];
    notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.value = freq;
        const t = ctx.currentTime + i * 0.15;
        gain.gain.setValueAtTime(0.4, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        osc.start(t);
        osc.stop(t + 0.3);
    });
}

// --- Connect to Server ---
// v2.3: Render deployment URL
const socket = io(); // local server — change to Render URL for deployment

// --- SETUP ---
document.addEventListener('DOMContentLoaded', () => {
    createBoards();
    addEventListeners();
});

// ── Server event listeners ────────────────────────────────────────────────────

socket.on('connect', () => console.log("Connected:", socket.id));

// v2.3: assign_player sets myPlayerNumber from server
socket.on('assign_player', (data) => {
    myPlayerNumber = data.player; // kept as int to match v2.2 comparisons
});

socket.on('message', (d) => {
    document.getElementById('game-message').textContent = d.data;
});

// v2.3: error flash instead of alert()
socket.on('error_message', (d) => {
    showErrorFlash(d.message);
    isActionInProgress = false;
    updateDisplay();
});

socket.on('game_found', (d) => {
    document.getElementById('game-message').textContent = "Game Found! Getting ready...";
    socket.emit('player_ready', { game_id: d.game_id });
});

// v2.2 Tactical Pause logic — preserved exactly
socket.on('game_update', (gs) => {
    const oldPhase = currentGameState.phase;
    currentGameState = gs;
    myPlayerNumber = gs.my_player_number; // also set here for reliability

    // FIX: When a new game starts, clear canvas circles for this player
    if (gs.phase === 'SETUP_P1' && oldPhase === 'GAME_OVER') {
        drawnCircles = [];
        clearCanvas();
    }

    updateDisplay();
    updateBattleLog(gs.battle_log || []); // v2.3: battle log update

    const myTurn = `P${myPlayerNumber}_TURN`;

    // v2.2: If it was my turn AND still my turn → action succeeded → start Tactical Pause
    console.log("🔍 PAUSE CHECK — isActionInProgress:", isActionInProgress,
        "| oldPhase:", oldPhase, "| newPhase:", currentGameState.phase,
        "| myTurn:", myTurn);
    if (isActionInProgress && oldPhase === myTurn && currentGameState.phase === myTurn) {
        console.log("✅ Starting 10s Tactical Pause!");
        setTimeout(() => {
            console.log("⏱️ Tactical Pause over. Sending next_turn.");
            sendAction('next_turn', { fromPause: true });
        }, 10000);
    } else {
        console.log("⛔ Pause NOT started — resetting isActionInProgress.");
        isActionInProgress = false;
        updateDisplay();
    }
});

// ── Event Listeners ───────────────────────────────────────────────────────────

function addEventListeners() {
    document.getElementById('primary-board').addEventListener('click', handleBoardClick);
    // v2.2: mousedown (not click) to detect left vs right button
    document.getElementById('tracking-board').addEventListener('mousedown', handleTacticalClick);
    document.getElementById('tracking-board').addEventListener('contextmenu', e => e.preventDefault());

    document.getElementById('btn-move').addEventListener('click', () => chooseAction('move'));
    document.getElementById('btn-hit').addEventListener('click', () => chooseAction('hit'));

    document.getElementById('btn-play-again').addEventListener('click', () => {
        // FIX: clear canvas circles for BOTH players on play again
        drawnCircles = [];
        clearCanvas();
        lastLogLength = 0;
        sendAction('new_game');
    });

    // ERASE clears canvas drawings AND server tracking board markers
    document.getElementById('btn-erase').addEventListener('click', () => {
        drawnCircles = [];
        clearCanvas();
        sendAction('erase_tracking');
    });
}

// ── Send Actions to Server ────────────────────────────────────────────────────

// v2.2: fromPause flag lets next_turn bypass the action lock
function sendAction(type, data = {}) {
    if (isActionInProgress && !data.fromPause) return;
    if (type === 'hit' || type === 'move') {
        isActionInProgress = true;
    }
    const { fromPause, ...actionData } = data;
    socket.emit('handle_action', {
        action_type: type,
        game_id: currentGameState.game_id,
        ...actionData
    });
}

function chooseAction(action) {
    if (currentGameState.phase !== `P${myPlayerNumber}_TURN` || isActionInProgress) return;
    selectedAction = action;
    updateDisplay();
}

// ── Board Click Handler ───────────────────────────────────────────────────────

function handleBoardClick(e) {
    if (!e.target.classList.contains('cell') || isActionInProgress) return;
    const r = Math.floor(e.target.dataset.index / 5);
    const c = e.target.dataset.index % 5;
    const phase = currentGameState.phase;
    const myTurn = `P${myPlayerNumber}_TURN`;
    const actionData = { row: r, col: c };

    if (
        (myPlayerNumber === 1 && phase === 'SETUP_P1') ||
        (myPlayerNumber === 2 && phase === 'SETUP_P2')
    ) {
        if (e.target.closest('.board').id === 'primary-board') {
            sendAction('place-ship', actionData);
        }
    } else if (phase === myTurn) {
        if (!selectedAction) {
            showErrorFlash("Please choose MOVE or HIT first.");
            return;
        }
        if (e.target.closest('.board').id !== 'primary-board') {
            showErrorFlash("Please click on the ACTION BOARD (left).");
            return;
        }
        if (selectedAction === 'hit') sendAction('hit', actionData);
        else if (selectedAction === 'move') sendAction('move', actionData);
    }
}

// ── Tactical Canvas — v2.2 Smart Pencil + Grid-Snap + Precision Eraser ───────

// v2.2 mod 81st: Smart Pencil with right-click eraser and color-matched circles
// BUG FIX: Allow drawing during Tactical Pause (isActionInProgress) AND on your turn.
function handleTacticalClick(event) {
    const myTurn = `P${myPlayerNumber}_TURN`;
    const canDraw = currentGameState.phase === myTurn || isActionInProgress;
    console.log("🖊️ PENCIL CLICK — phase:", currentGameState.phase,
        "| myTurn:", myTurn, "| isActionInProgress:", isActionInProgress,
        "| canDraw:", canDraw, "| target:", event.target.className);
    if (!canDraw) return;
    if (!event.target.classList.contains('cell')) return;

    event.preventDefault();
    const cellIndex = parseInt(event.target.dataset.index);

    // Right-click: Precision Eraser — remove single cell circle
    if (event.button === 2) {
        drawnCircles = drawnCircles.filter(c => c.index !== cellIndex);
    }
    // Left-click: Smart Pencil — draw color-matched circle
    else if (event.button === 0) {
        // Don't draw if a circle already exists here
        if (drawnCircles.some(c => c.index === cellIndex)) return;

        // Smart Pencil: color matches the cell's current value
        const trackingBoardData = currentGameState[`p${myPlayerNumber}_tracking_board`].flat();
        const cellValue = trackingBoardData[cellIndex];

        let drawColor;
        if (cellValue === 'M') {
            drawColor = 'rgba(128, 128, 128, 0.5)';       // Grey — confirmed Miss
        } else if (cellValue === 'O' || cellValue === 'X') {
            drawColor = 'rgba(255, 223, 0, 0.5)';          // Yellow — Echo or Hit
        } else {
            // Unknown square — use player's tactical color
            drawColor = (myPlayerNumber === 1)
                ? 'rgba(102, 252, 241, 0.4)'   // Cyan for Player 1
                : 'rgba(255, 77, 77, 0.4)';    // Red for Player 2
        }

        drawnCircles.push({ index: cellIndex, color: drawColor });
    }

    redrawTacticalCanvas();
}

// Grid-Snap: circles drawn at exact cell center.
// Uses canvas size / 5 to calculate each cell center mathematically —
// this is the most reliable method regardless of CSS layout.
// Explicitly clear the canvas — used on PLAY AGAIN and ERASE
function clearCanvas() {
    const canvas = document.getElementById('tactical-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function redrawTacticalCanvas() {
    const canvas = document.getElementById('tactical-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Re-sync canvas size to board every time we draw
    const board = document.getElementById('tracking-board');
    if (board && board.offsetWidth > 0) {
        canvas.width = board.offsetWidth;
        canvas.height = board.offsetHeight;
    }

    if (canvas.width === 0 || canvas.height === 0) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    console.log("🎨 redrawTacticalCanvas — circles:", drawnCircles.length,
        "| canvas:", canvas.width, "x", canvas.height);

    if (drawnCircles.length === 0) return;

    // F2 FIX: Account for CSS Grid gap (2px) between cells.
    // Board total width = 5 cells * 60px + 4 gaps * 2px + 2px border*2 = 314px
    // Cell size is fixed at 60px. Gap is 2px.
    // So each cell center = col * (60 + 2) + 30, but offset by border (2px).
    // Most reliable: use actual cell DOM positions via querySelectorAll.
    const COLS = 5;
    const GAP = 2;   // matches gap:2px in CSS
    const CELL = 60; // matches width/height:60px in CSS
    const BORDER = 2; // board border

    drawnCircles.forEach(circle => {
        const col = circle.index % COLS;
        const row = Math.floor(circle.index / COLS);

        // Center = border + col*(cell+gap) + cell/2
        const x = BORDER + col * (CELL + GAP) + CELL / 2;
        const y = BORDER + row * (CELL + GAP) + CELL / 2;

        ctx.fillStyle = circle.color;
        ctx.beginPath();
        ctx.arc(x, y, CELL * 0.28, 0, 2 * Math.PI);
        ctx.fill();
    });
}

// ── Board Creation ────────────────────────────────────────────────────────────

// v2.2: flat data-index layout (25 cells, index 0–24)
function createBoards() {
    const p = document.getElementById('primary-board');
    const t = document.getElementById('tracking-board');
    if (!p || !t) return;

    // Build primary board
    p.innerHTML = '';
    for (let i = 0; i < 25; i++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.index = i;
        p.appendChild(cell);
    }

    // Build tracking board — canvas first, then cells on top
    // BUG FIX: create canvas element explicitly so it is never overwritten by innerHTML
    t.innerHTML = '';
    const canvas = document.createElement('canvas');
    canvas.id = 'tactical-canvas';
    t.appendChild(canvas);

    for (let i = 0; i < 25; i++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.index = i;
        t.appendChild(cell);
    }

    // Size canvas after DOM settles — use offsetWidth/Height for pixel size
    // Then re-sync on window resize
    function syncCanvas() {
        const c = document.getElementById('tactical-canvas');
        const b = document.getElementById('tracking-board');
        if (c && b && b.offsetWidth > 0) {
            c.width = b.offsetWidth;
            c.height = b.offsetHeight;
        }
    }
    setTimeout(syncCanvas, 150);
    window.addEventListener('resize', () => { syncCanvas(); redrawTacticalCanvas(); });
}

// ── Display Update ────────────────────────────────────────────────────────────

// Cell display: replace raw values with icons
const CELL_DISPLAY = {
    '~': '·',
    'S1': '🚢', 'S2': '🚢',
    'X': '💥',
    'O': '🔔',
    'M': '✕',
};

function updateDisplay() {
    if (!currentGameState || !currentGameState.phase) return;

    const phase = currentGameState.phase;
    document.getElementById('game-message').textContent = currentGameState.message;

    const myTurn = `P${myPlayerNumber}_TURN`;
    const showTurn = phase === myTurn && !isActionInProgress;
    const showAgain = phase === 'GAME_OVER';

    document.getElementById('action-controls').style.display =
        (showTurn || showAgain) ? 'block' : 'none';
    document.getElementById('btn-move').style.display = showTurn ? 'inline-block' : 'none';
    document.getElementById('btn-hit').style.display = showTurn ? 'inline-block' : 'none';
    document.getElementById('btn-play-again').style.display = showAgain ? 'inline-block' : 'none';

    if (!showTurn) selectedAction = null;

    // v2.3: selected button glow
    document.getElementById('btn-move').classList.toggle('selected', selectedAction === 'move');
    document.getElementById('btn-hit').classList.toggle('selected', selectedAction === 'hit');

    // Render primary board
    const p_board = currentGameState[`p${myPlayerNumber}_primary_board`].flat();
    document.querySelectorAll('#primary-board .cell').forEach((cell, i) => {
        cell.className = 'cell';
        cell.textContent = CELL_DISPLAY[p_board[i]] ?? p_board[i];
        if (p_board[i] && p_board[i].startsWith('S')) {
            cell.classList.add(myPlayerNumber === 1 ? 'ship-1' : 'ship-2');
        }
    });

    // Render tracking board — update cells in-place, NEVER destroy the canvas element.
    // BUG FIX: previously t.innerHTML was cleared, destroying the canvas and breaking Smart Pencil.
    const t_board = currentGameState[`p${myPlayerNumber}_tracking_board`].flat();
    const trackingCells = document.querySelectorAll('#tracking-board .cell');
    trackingCells.forEach((cell, i) => {
        cell.className = 'cell';
        cell.textContent = CELL_DISPLAY[t_board[i]] ?? t_board[i];
        if (t_board[i] === 'M') cell.classList.add('miss');
        if (t_board[i] === 'O') cell.classList.add('echo');
        if (t_board[i] === 'X') cell.classList.add('hit');
    });

    // Redraw circles on top after board refresh
    redrawTacticalCanvas();
}

// ── Error Flash ───────────────────────────────────────────────────────────────

function showErrorFlash(msg) {
    const el = document.getElementById('game-message');
    const original = el.textContent;
    el.textContent = '⚠️ ' + msg;
    el.style.color = '#ff4d4d';
    setTimeout(() => {
        el.textContent = original;
        el.style.color = '';
    }, 2500);
}

// ── Battle Log ────────────────────────────────────────────────────────────────

function updateBattleLog(log) {
    const logDiv = document.getElementById('log-entries');
    if (!logDiv) return;

    // F1 FIX: Show player number in Battle Log header
    const header = document.getElementById('log-player-label');
    if (header && myPlayerNumber) {
        header.textContent = `Player ${myPlayerNumber}`;
    }

    logDiv.innerHTML = '';

    // Track new entries to play sounds
    const prevLength = logDiv.children.length;

    log.forEach(entry => {
        // Skip ghost entries where result is literally true (Python return value)
        if (entry.result === true) return;

        const line = document.createElement('div');
        line.classList.add('log-entry');

        if (entry.player == myPlayerNumber) {
            line.textContent = formatLogEntrySelf(entry);
            line.classList.add(getLogClass(entry));
        } else {
            line.textContent = formatLogEntryEnemy(entry);
            line.classList.add('log-move');
        }

        logDiv.appendChild(line);
    });

    // Play sound for the latest new entry
    if (log.length > 0) {
        const latest = log[log.length - 1];
        if (latest.result !== true) {
            if (latest.event === 'PLACE') {
                playSound('place');
            } else if (latest.event === 'MOVE') {
                playSound('move');
            } else if (latest.event === 'HIT_ATTEMPT') {
                if (latest.result === 'HIT') {
                    playSound('hit');
                    // Delay victory fanfare slightly after explosion
                    if (latest.player == myPlayerNumber) {
                        setTimeout(() => playSound('win'), 500);
                    }
                } else if (latest.result === 'ECHO') {
                    playSound('echo');
                } else if (latest.result === 'MISS') {
                    playSound('miss');
                }
            }
        }
    }

    // F1 FIX: Scroll the panel container to show latest entry at bottom
    const panel = document.getElementById('battle-log');
    if (panel) {
        // Use setTimeout to scroll after DOM updates
        setTimeout(() => { panel.scrollTop = panel.scrollHeight; }, 0);
    }
}

function getLogClass(entry) {
    if (entry.event !== 'HIT_ATTEMPT') return 'log-move';
    if (entry.result === 'HIT') return 'log-hit';
    if (entry.result === 'ECHO') return 'log-close';
    return 'log-miss';
}

function formatLogEntrySelf(entry) {
    switch (entry.event) {
        case 'NEW_GAME':        return '🆕 New game started';
        case 'PLACE':           return `📍 You placed your ship at (${entry.row}, ${entry.col})`;
        case 'MOVE':            return `🚢 You moved ${entry.result}`;
        case 'HIT_ATTEMPT':     return `🎯 You attacked (${entry.row}, ${entry.col}) → ${entry.result}`;
        case 'ERASE_TRACKING':  return '🗑️ You erased your tracking board';
        default:                return `Your action: ${entry.event}`;
    }
}

function formatLogEntryEnemy(entry) {
    switch (entry.event) {
        case 'NEW_GAME':        return '🆕 New game started';
        case 'PLACE':           return 'Enemy placed their ship';
        case 'MOVE':            return `Enemy moved ${entry.result}`;
        case 'HIT_ATTEMPT':     return `Enemy attacked grid (${entry.row}, ${entry.col})`;
        case 'ERASE_TRACKING':  return 'Enemy erased their tracking board';
        default:                return `Enemy action: ${entry.event}`;
    }
}
