(() => {
  'use strict';

  const RED = 'red';
  const BLACK = 'black';
  const SIZE = 8;

  const state = {
    board: [],
    turn: RED,
    mode: 'pvc',
    selected: null,
    legalMoves: [],
    mustCaptureFrom: null,
    history: [],
    gameOver: false,
    aiThinking: false
  };

  const els = {
    board: document.getElementById('board'),
    redLabel: document.getElementById('redLabel'),
    blackLabel: document.getElementById('blackLabel'),
    redScore: document.getElementById('redScore'),
    blackScore: document.getElementById('blackScore'),
    playerRed: document.getElementById('playerRed'),
    playerBlack: document.getElementById('playerBlack'),
    turnPill: document.getElementById('turnPill'),
    status: document.getElementById('status'),
    newGameBtn: document.getElementById('newGameBtn'),
    undoBtn: document.getElementById('undoBtn'),
    modeBtns: document.querySelectorAll('.mode-btn'),
    winOverlay: document.getElementById('winOverlay'),
    winTitle: document.getElementById('winTitle'),
    winMessage: document.getElementById('winMessage'),
    playAgainBtn: document.getElementById('playAgainBtn')
  };

  function init() {
    try {
      buildBoard();
      bindEvents();
      newGame();
    } catch (e) {
      console.error('Init error:', e.message, e.stack);
      els.status.textContent = 'Failed to start game: ' + e.message;
    }
  }

  function bindEvents() {
    els.newGameBtn.addEventListener('click', newGame);
    els.undoBtn.addEventListener('click', undo);
    els.playAgainBtn.addEventListener('click', () => {
      els.winOverlay.classList.remove('show');
      newGame();
    });
    els.modeBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        els.modeBtns.forEach((b) => b.classList.toggle('active', b === btn));
        state.mode = btn.dataset.mode;
        newGame();
      });
    });
  }

  function buildBoard() {
    els.board.innerHTML = '';
    for (let r = 0; r < SIZE; r += 1) {
      for (let c = 0; c < SIZE; c += 1) {
        const cell = document.createElement('div');
        const isDark = (r + c) % 2 === 1;
        cell.className = `cell ${isDark ? 'dark playable' : 'light'}`;
        cell.dataset.row = r;
        cell.dataset.col = c;
        cell.addEventListener('click', () => onCellClick(r, c));
        els.board.appendChild(cell);
      }
    }
  }

  function newGame() {
    state.board = createInitialBoard();
    state.turn = RED;
    state.selected = null;
    state.legalMoves = [];
    state.mustCaptureFrom = null;
    state.history = [];
    state.gameOver = false;
    state.aiThinking = false;

    if (state.mode === 'pvc') {
      els.redLabel.textContent = 'You';
      els.blackLabel.textContent = 'Computer';
    } else {
      els.redLabel.textContent = 'Player 1';
      els.blackLabel.textContent = 'Player 2';
    }

    render();
  }

  function createInitialBoard() {
    const board = [];
    for (let r = 0; r < SIZE; r += 1) {
      const row = [];
      for (let c = 0; c < SIZE; c += 1) {
        const isDark = (r + c) % 2 === 1;
        if (isDark && r < 3) row.push({ color: BLACK, king: false });
        else if (isDark && r > 4) row.push({ color: RED, king: false });
        else row.push(null);
      }
      board.push(row);
    }
    return board;
  }

  function snapshot() {
    return {
      board: state.board.map((row) => row.map((p) => (p ? { ...p } : null))),
      turn: state.turn,
      mustCaptureFrom: state.mustCaptureFrom ? { ...state.mustCaptureFrom } : null
    };
  }

  function restore(snap) {
    state.board = snap.board.map((row) => row.map((p) => (p ? { ...p } : null)));
    state.turn = snap.turn;
    state.mustCaptureFrom = snap.mustCaptureFrom ? { ...snap.mustCaptureFrom } : null;
    state.selected = null;
    state.legalMoves = [];
    state.gameOver = false;
  }

  function undo() {
    if (state.aiThinking) return;
    if (!state.history.length) return;
    let snap = state.history.pop();
    if (state.mode === 'pvc' && state.history.length && snap.turn === BLACK) {
      // Roll back the AI's last move too so it returns to player's turn
      snap = state.history.pop();
    }
    restore(snap);
    render();
  }

  function getPieceMoves(r, c, capturesOnly = false) {
    const piece = state.board[r][c];
    if (!piece) return [];
    const moves = [];
    const dirs = piece.king
      ? [[-1, -1], [-1, 1], [1, -1], [1, 1]]
      : piece.color === RED
        ? [[-1, -1], [-1, 1]]
        : [[1, -1], [1, 1]];

    // Captures
    for (const [dr, dc] of dirs) {
      const mr = r + dr;
      const mc = c + dc;
      const lr = r + dr * 2;
      const lc = c + dc * 2;
      if (lr < 0 || lr >= SIZE || lc < 0 || lc >= SIZE) continue;
      const middle = state.board[mr] && state.board[mr][mc];
      const landing = state.board[lr] && state.board[lr][lc];
      if (middle && middle.color !== piece.color && !landing) {
        moves.push({ from: { r, c }, to: { r: lr, c: lc }, capture: { r: mr, c: mc } });
      }
    }

    if (capturesOnly) return moves;
    if (moves.length) return moves; // Captures are mandatory

    // Simple moves
    for (const [dr, dc] of dirs) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) continue;
      if (!state.board[nr][nc]) {
        moves.push({ from: { r, c }, to: { r: nr, c: nc }, capture: null });
      }
    }
    return moves;
  }

  function getAllMoves(color) {
    const allCaptures = [];
    const allSimple = [];
    for (let r = 0; r < SIZE; r += 1) {
      for (let c = 0; c < SIZE; c += 1) {
        const p = state.board[r][c];
        if (!p || p.color !== color) continue;
        const moves = getPieceMoves(r, c);
        for (const m of moves) {
          if (m.capture) allCaptures.push(m);
          else allSimple.push(m);
        }
      }
    }
    return allCaptures.length ? allCaptures : allSimple;
  }

  function getLegalMovesForSelection(r, c) {
    if (state.mustCaptureFrom) {
      if (state.mustCaptureFrom.r !== r || state.mustCaptureFrom.c !== c) return [];
      return getPieceMoves(r, c, true);
    }
    const allMoves = getAllMoves(state.turn);
    const hasCapture = allMoves.some((m) => m.capture);
    const moves = getPieceMoves(r, c);
    if (hasCapture) return moves.filter((m) => m.capture);
    return moves;
  }

  function onCellClick(r, c) {
    if (state.gameOver || state.aiThinking) return;
    if (state.mode === 'pvc' && state.turn === BLACK) return;

    const piece = state.board[r][c];

    // Click on own piece - select it
    if (piece && piece.color === state.turn) {
      if (state.mustCaptureFrom && (state.mustCaptureFrom.r !== r || state.mustCaptureFrom.c !== c)) {
        return; // Mid-chain, can't switch pieces
      }
      state.selected = { r, c };
      state.legalMoves = getLegalMovesForSelection(r, c);
      render();
      return;
    }

    // Click on a target square
    if (state.selected) {
      const move = state.legalMoves.find((m) => m.to.r === r && m.to.c === c);
      if (move) {
        applyMove(move);
      }
    }
  }

  function applyMove(move) {
    state.history.push(snapshot());

    const piece = state.board[move.from.r][move.from.c];
    state.board[move.to.r][move.to.c] = piece;
    state.board[move.from.r][move.from.c] = null;
    if (move.capture) {
      state.board[move.capture.r][move.capture.c] = null;
    }

    // King promotion
    let justKinged = false;
    if (!piece.king) {
      if (piece.color === RED && move.to.r === 0) { piece.king = true; justKinged = true; }
      if (piece.color === BLACK && move.to.r === SIZE - 1) { piece.king = true; justKinged = true; }
    }

    // Chain captures: only if we just captured AND not just kinged AND more captures available
    if (move.capture && !justKinged) {
      const more = getPieceMoves(move.to.r, move.to.c, true);
      if (more.length) {
        state.mustCaptureFrom = { r: move.to.r, c: move.to.c };
        state.selected = { r: move.to.r, c: move.to.c };
        state.legalMoves = more;
        render();
        return;
      }
    }

    state.mustCaptureFrom = null;
    state.selected = null;
    state.legalMoves = [];
    state.turn = state.turn === RED ? BLACK : RED;
    render();

    if (checkGameOver()) return;

    if (state.mode === 'pvc' && state.turn === BLACK) {
      state.aiThinking = true;
      setTimeout(aiTurn, 600);
    }
  }

  function aiTurn() {
    try {
      while (state.turn === BLACK && !state.gameOver) {
        const move = pickBestMove(BLACK);
        if (!move) break;
        // Inline apply for AI to keep chain logic
        state.history.push(snapshot());
        const piece = state.board[move.from.r][move.from.c];
        state.board[move.to.r][move.to.c] = piece;
        state.board[move.from.r][move.from.c] = null;
        if (move.capture) state.board[move.capture.r][move.capture.c] = null;
        let justKinged = false;
        if (!piece.king) {
          if (piece.color === BLACK && move.to.r === SIZE - 1) { piece.king = true; justKinged = true; }
        }
        if (move.capture && !justKinged) {
          const more = getPieceMoves(move.to.r, move.to.c, true);
          if (more.length) {
            state.mustCaptureFrom = { r: move.to.r, c: move.to.c };
            continue;
          }
        }
        state.mustCaptureFrom = null;
        state.turn = RED;
      }
      state.aiThinking = false;
      render();
      checkGameOver();
    } catch (e) {
      console.error('AI error:', e.message, e.stack);
      state.aiThinking = false;
      render();
    }
  }

  function pickBestMove(color) {
    let moves;
    if (state.mustCaptureFrom) {
      moves = getPieceMoves(state.mustCaptureFrom.r, state.mustCaptureFrom.c, true);
    } else {
      moves = getAllMoves(color);
    }
    if (!moves.length) return null;

    // Score each move with a 2-ply lookahead
    let bestScore = -Infinity;
    let bestMoves = [];
    for (const m of moves) {
      const snap = snapshot();
      // Apply move
      const piece = state.board[m.from.r][m.from.c];
      state.board[m.to.r][m.to.c] = piece;
      state.board[m.from.r][m.from.c] = null;
      if (m.capture) state.board[m.capture.r][m.capture.c] = null;
      const wasKing = piece.king;
      if (!piece.king && color === BLACK && m.to.r === SIZE - 1) piece.king = true;
      if (!piece.king && color === RED && m.to.r === 0) piece.king = true;

      let score = evaluate(color);
      // Penalize for opponent's best capture response
      const oppMoves = getAllMoves(color === BLACK ? RED : BLACK);
      let worstCounter = 0;
      for (const om of oppMoves) {
        if (om.capture) worstCounter = Math.max(worstCounter, 3);
      }
      score -= worstCounter;

      // Restore
      piece.king = wasKing;
      restore(snap);

      if (score > bestScore) {
        bestScore = score;
        bestMoves = [m];
      } else if (score === bestScore) {
        bestMoves.push(m);
      }
    }
    return bestMoves[Math.floor(Math.random() * bestMoves.length)];
  }

  function evaluate(color) {
    let score = 0;
    for (let r = 0; r < SIZE; r += 1) {
      for (let c = 0; c < SIZE; c += 1) {
        const p = state.board[r][c];
        if (!p) continue;
        const v = p.king ? 5 : 3;
        // Advancement bonus
        const adv = p.color === BLACK ? r : SIZE - 1 - r;
        const total = v + adv * 0.1;
        score += p.color === color ? total : -total;
      }
    }
    return score;
  }

  function checkGameOver() {
    const moves = getAllMoves(state.turn);
    if (!moves.length) {
      state.gameOver = true;
      const winner = state.turn === RED ? BLACK : RED;
      showWin(winner);
      return true;
    }
    const counts = countPieces();
    if (counts.red === 0 || counts.black === 0) {
      state.gameOver = true;
      showWin(counts.red === 0 ? BLACK : RED);
      return true;
    }
    return false;
  }

  function countPieces() {
    let red = 0;
    let black = 0;
    for (let r = 0; r < SIZE; r += 1) {
      for (let c = 0; c < SIZE; c += 1) {
        const p = state.board[r][c];
        if (!p) continue;
        if (p.color === RED) red += 1;
        else black += 1;
      }
    }
    return { red, black };
  }

  function showWin(winner) {
    const counts = countPieces();
    let title;
    let msg;
    if (state.mode === 'pvc') {
      title = winner === RED ? 'You win! 🎉' : 'Computer wins';
      msg = winner === RED ? 'Nicely played.' : 'Try again — you got this.';
    } else {
      title = winner === RED ? 'Red wins! 🎉' : 'Black wins! 🎉';
      msg = `Final pieces: Red ${counts.red}, Black ${counts.black}`;
    }
    els.winTitle.textContent = title;
    els.winMessage.textContent = msg;
    els.winOverlay.classList.add('show');
  }

  function render() {
    const cells = els.board.children;
    const counts = countPieces();
    els.redScore.textContent = counts.red;
    els.blackScore.textContent = counts.black;
    els.playerRed.classList.toggle('active', state.turn === RED && !state.gameOver);
    els.playerBlack.classList.toggle('active', state.turn === BLACK && !state.gameOver);

    let turnText;
    if (state.gameOver) {
      turnText = 'Game over';
    } else if (state.mode === 'pvc') {
      turnText = state.turn === RED ? 'Your turn' : 'Computer thinking...';
    } else {
      turnText = state.turn === RED ? "Red's turn" : "Black's turn";
    }
    els.turnPill.textContent = turnText;

    let statusText;
    if (state.gameOver) {
      statusText = 'Game over — start a new game.';
    } else if (state.aiThinking) {
      statusText = 'Computer is making its move...';
    } else if (state.mustCaptureFrom) {
      statusText = 'Chain capture — keep jumping!';
    } else if (state.selected) {
      statusText = state.legalMoves.length ? 'Pick a highlighted square.' : 'No moves for this piece.';
    } else {
      const all = getAllMoves(state.turn);
      const hasCap = all.some((m) => m.capture);
      statusText = hasCap ? 'Capture available — must jump!' : 'Select a piece to move.';
    }
    els.status.textContent = statusText;

    // Build movable-piece set
    const allMoves = state.gameOver ? [] : getAllMoves(state.turn);
    const movableSet = new Set();
    if (state.mustCaptureFrom) {
      movableSet.add(`${state.mustCaptureFrom.r},${state.mustCaptureFrom.c}`);
    } else if (!state.aiThinking && (state.mode === 'pvp' || state.turn === RED)) {
      for (const m of allMoves) movableSet.add(`${m.from.r},${m.from.c}`);
    }

    for (let i = 0; i < cells.length; i += 1) {
      const cell = cells[i];
      const r = Number(cell.dataset.row);
      const c = Number(cell.dataset.col);
      cell.classList.remove('selected', 'highlight', 'capture-target');
      cell.innerHTML = '';

      const piece = state.board[r][c];
      if (piece) {
        const div = document.createElement('div');
        div.className = `piece ${piece.color}${piece.king ? ' king' : ''}`;
        if (movableSet.has(`${r},${c}`)) div.classList.add('movable');
        cell.appendChild(div);
      }

      if (state.selected && state.selected.r === r && state.selected.c === c) {
        cell.classList.add('selected');
      }
      const move = state.legalMoves.find((m) => m.to.r === r && m.to.c === c);
      if (move) {
        cell.classList.add(move.capture ? 'capture-target' : 'highlight');
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
