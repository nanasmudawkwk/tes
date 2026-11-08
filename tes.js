(function () {
  if (window.__chessHelperLoaded) {
    alert('Helper sudah aktif!');
    return;
  }
  window.__chessHelperLoaded = true;

  // ==== LOAD STOCKFISH 19 (Sesuai chessnextmove.com) ====
  // Pakai versi single-threaded agar ringan di HP
  const SF_URL = 'https://cdn.jsdelivr.net/npm/stockfish@19.0.1/bin/stockfish-19-lite-single.js';

  fetch(SF_URL)
    .then(r => r.text())
    .then(code => {
      const blob = new Blob([code], { type: 'application/javascript' });
      init(URL.createObjectURL(blob));
    })
    .catch(e => alert('Gagal load Stockfish 19: ' + e.message));

  function init(workerUrl) {
    const worker = new Worker(workerUrl);

    // ==== UI PANEL ====
    const panel = document.createElement('div');
    panel.id = 'ch-panel';
    panel.style.cssText = 'position:fixed;top:60px;right:10px;z-index:999999;background:#1e1e1e;color:#fff;border-radius:8px;font-family:sans-serif;font-size:12px;border:1px solid #444;box-shadow:0 4px 12px rgba(0,0,0,0.6);width:220px;user-select:none;';
    panel.innerHTML = `
      <div id="ch-header" style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:#2a2a2a;border-radius:8px 8px 0 0;cursor:move;touch-action:none;">
        <span style="color:#4caf50;font-weight:bold;">♟️ SF19</span>
        <div>
          <button id="ch-min" style="background:#555;color:#fff;border:none;border-radius:3px;width:22px;height:22px;cursor:pointer;margin-right:4px;">—</button>
          <button id="ch-close" style="background:#d32f2f;color:#fff;border:none;border-radius:3px;width:22px;height:22px;cursor:pointer;">×</button>
        </div>
      </div>
      <div id="ch-body" style="padding:10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <span style="color:#aaa;">Warna:</span>
          <button id="ch-turn-btn" style="background:#333;color:#ffeb3b;border:1px solid #555;border-radius:4px;padding:2px 8px;cursor:pointer;font-weight:bold;">Auto</button>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
          <span style="color:#aaa;">Langkah:</span>
          <span id="ch-best" style="color:#3b82f6;font-weight:bold;">-</span>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
          <span style="color:#aaa;">Eval:</span>
          <span id="ch-eval" style="color:#4caf50;">-</span>
        </div>
        <div id="ch-status" style="font-size:10px;color:#888;text-align:center;">Init...</div>
      </div>
    `;
    document.body.appendChild(panel);

    // ==== DRAG & CLOSE ====
    const header = document.getElementById('ch-header');
    let dragging = false, sx = 0, sy = 0, sl = 0, st = 0;
    const start = (e) => {
      if (e.target.tagName === 'BUTTON') return;
      dragging = true;
      const r = panel.getBoundingClientRect();
      sl = r.left; st = r.top;
      panel.style.left = r.left + 'px'; panel.style.top = r.top + 'px'; panel.style.right = 'auto';
      const p = e.touches ? e.touches[0] : e;
      sx = p.clientX; sy = p.clientY;
      e.preventDefault();
    };
    const move = (e) => {
      if (!dragging) return;
      const p = e.touches ? e.touches[0] : e;
      panel.style.left = (sl + p.clientX - sx) + 'px';
      panel.style.top = (st + p.clientY - sy) + 'px';
      e.preventDefault();
    };
    const end = () => { dragging = false; };
    header.addEventListener('mousedown', start);
    header.addEventListener('touchstart', start, { passive: false });
    document.addEventListener('mousemove', move);
    document.addEventListener('touchmove', move, { passive: false });
    document.addEventListener('mouseup', end);
    document.addEventListener('touchend', end);

    document.getElementById('ch-close').onclick = () => {
      panel.remove();
      worker.terminate();
      URL.revokeObjectURL(workerUrl);
      const ov = document.querySelector('.ch-arrow'); if (ov) ov.remove();
      window.__chessHelperLoaded = false;
    };
    let minimized = false;
    document.getElementById('ch-min').onclick = (e) => {
      e.stopPropagation();
      minimized = !minimized;
      document.getElementById('ch-body').style.display = minimized ? 'none' : 'block';
      document.getElementById('ch-min').innerText = minimized ? '+' : '—';
    };

    // ==== TOMBOL WARNA MANUAL ====
    let manualColor = null; // null = auto, 'w', 'b'
    const turnBtn = document.getElementById('ch-turn-btn');
    turnBtn.onclick = () => {
      if (manualColor === null) manualColor = 'w';
      else if (manualColor === 'w') manualColor = 'b';
      else manualColor = null;
      turnBtn.innerText = manualColor === null ? 'Auto' : (manualColor === 'w' ? 'Putih' : 'Hitam');
      turnBtn.style.color = manualColor === null ? '#888' : '#ffeb3b';
      currentFen = ''; analyzing = false;
    };

    // ==== ENGINE SETUP ====
    worker.postMessage('uci');
    worker.postMessage('isready');
    let currentFen = '';
    let analyzing = false;

    worker.onmessage = (e) => {
      const line = e.data;
      if (typeof line !== 'string') return;
      if (line.includes(' pv ') && line.includes('score')) {
        const pv = line.match(/ pv (\S+)/);
        if (pv) document.getElementById('ch-best').innerText = pv[1];
        const cp = line.match(/score cp (-?\d+)/);
        const mate = line.match(/score mate (-?\d+)/);
        if (mate) document.getElementById('ch-eval').innerText = 'M' + mate[1];
        else if (cp) {
          const v = parseInt(cp[1]) / 100;
          document.getElementById('ch-eval').innerText = (v > 0 ? '+' : '') + v.toFixed(2);
        }
      }
      if (line.startsWith('bestmove')) {
        analyzing = false;
        document.getElementById('ch-status').innerText = 'Selesai ✓';
        const mv = line.split(' ')[1];
        if (mv && mv !== '(none)') setTimeout(() => drawArrow(mv), 100);
      }
    };

    // ==== DETEKSI PAPAN & WARNA (Teknik TitanChessEngine) ====
    function findBoard() {
      // Selector utama Chess.com saat ini
      let board = document.querySelector('wc-chess-board');
      if (board) return board;
      // Fallback
      return document.querySelector('chess-board') || document.querySelector('#board-play-computer') || document.querySelector('.board');
    }

    function getPlayerColor() {
      const board = findBoard();
      if (!board) return 'w';
      // 1. Cek class flipped
      if (board.classList.contains('flipped')) return 'b';
      // 2. Cek label koordinat '1' (paling akurat)
      const coords = board.querySelectorAll('.coordinate, .coords, [class*="coordinate"]');
      for (let c of coords) {
        if (c.textContent.trim() === '1') {
          const r = c.getBoundingClientRect();
          const br = board.getBoundingClientRect();
          return (r.bottom > br.top + br.height * 0.75) ? 'w' : 'b';
        }
      }
      return 'w'; // default
    }

    // ==== BIKIN FEN ====
    function buildFen() {
      const board = findBoard();
      if (!board) return null;
      const pieces = board.querySelectorAll('.piece');
      if (pieces.length === 0) return null;

      const map = {};
      pieces.forEach(p => {
        const cls = Array.from(p.classList);
        const sqCls = cls.find(c => c.startsWith('square-'));
        if (!sqCls) return;
        const n = parseInt(sqCls.replace('square-', ''));
        if (isNaN(n)) return;

        // Konversi square-XX (Chess.com: square-11 = a8, square-88 = h1)
        const file = (n % 10) - 1;
        const rank = 8 - Math.floor(n / 10);

        // Deteksi bidak (prioritas class pendek: wp, bn, dll)
        let piece = cls.find(c => /^[wb][pnbrqk]$/.test(c));
        if (!piece) {
          // Fallback deteksi dari nama panjang (knight, bishop, dll)
          if (cls.some(c => c.includes('knight'))) piece = cls.some(c => c.includes('w')) ? 'wn' : 'bn';
          else if (cls.some(c => c.includes('bishop'))) piece = cls.some(c => c.includes('w')) ? 'wb' : 'bb';
          else if (cls.some(c => c.includes('rook'))) piece = cls.some(c => c.includes('w')) ? 'wr' : 'br';
          else if (cls.some(c => c.includes('queen'))) piece = cls.some(c => c.includes('w')) ? 'wq' : 'bq';
          else if (cls.some(c => c.includes('king'))) piece = cls.some(c => c.includes('w')) ? 'wk' : 'bk';
          else if (cls.some(c => c.includes('pawn'))) piece = cls.some(c => c.includes('w')) ? 'wp' : 'bp';
        }
        if (!piece) return;
        map[file + ',' + rank] = piece[0] === 'w' ? piece[1].toUpperCase() : piece[1];
      });

      if (Object.keys(map).length === 0) return null;

      // Build FEN
      let fen = '';
      for (let r = 7; r >= 0; r--) {
        let empty = 0;
        for (let f = 0; f < 8; f++) {
          const pc = map[f + ',' + r];
          if (pc) { if (empty) { fen += empty; empty = 0; } fen += pc; }
          else empty++;
        }
        if (empty) fen += empty;
        if (r > 0) fen += '/';
      }

      // Castling
      let castling = '';
      if (map['4,0'] === 'K') { if (map['7,0'] === 'R') castling += 'K'; if (map['0,0'] === 'R') castling += 'Q'; }
      if (map['4,7'] === 'k') { if (map['7,7'] === 'r') castling += 'k'; if (map['0,7'] === 'r') castling += 'q'; }
      if (!castling) castling = '-';

      const turn = manualColor || getPlayerColor();
      return fen + ' ' + turn + ' ' + castling + ' - 0 1';
    }

    // ==== GAMBAR PANAH (Teknik TitanChessEngine) ====
    function drawArrow(uci) {
      const old = document.querySelector('.ch-arrow');
      if (old) old.remove();
      if (!uci || uci.length < 4) return;

      const board = findBoard();
      if (!board) return;

      const flipped = board.classList.contains('flipped');
      const from = uci.substring(0, 2);
      const to = uci.substring(2, 4);

      // Konversi persentase (sama persis dengan userscript yang terbukti)
      function sqToPct(sq) {
        const file = 'abcdefgh'.indexOf(sq[0]);
        const rank = parseInt(sq[1]) - 1;
        let x, y;
        if (flipped) {
          x = (7 - file) * 100;
          y = rank * 100;
        } else {
          x = file * 100;
          y = (7 - rank) * 100;
        }
        return { x, y };
      }

      const p1 = sqToPct(from);
      const p2 = sqToPct(to);

      const ov = document.createElement('div');
      ov.className = 'ch-arrow';
      ov.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:100;';
      if (getComputedStyle(board).position === 'static') board.style.position = 'relative';
      board.appendChild(ov);

      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 800 800');
      svg.style.cssText = 'width:100%;height:100%;position:absolute;top:0;left:0;';

      const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      const mk = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
      mk.setAttribute('id', 'arr'); mk.setAttribute('markerWidth', '4'); mk.setAttribute('markerHeight', '4');
      mk.setAttribute('refX', '2'); mk.setAttribute('refY', '2'); mk.setAttribute('orient', 'auto');
      const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      poly.setAttribute('points', '0,0 4,2 0,4'); poly.setAttribute('fill', '#3b82f6');
      mk.appendChild(poly); defs.appendChild(mk); svg.appendChild(defs);

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', p1.x + 50); line.setAttribute('y1', p1.y + 50);
      line.setAttribute('x2', p2.x + 50); line.setAttribute('y2', p2.y + 50);
      line.setAttribute('stroke', '#3b82f6'); line.setAttribute('stroke-width', '20');
      line.setAttribute('stroke-linecap', 'round'); line.setAttribute('marker-end', 'url(#arr)');
      svg.appendChild(line); ov.appendChild(svg);
    }

    // ==== LOOP ANALISIS ====
    setInterval(() => {
      // Auto-update label warna
      if (manualColor === null) {
        const auto = getPlayerColor();
        turnBtn.innerText = auto === 'w' ? 'Putih' : 'Hitam';
        turnBtn.style.color = '#ffeb3b';
      }

      const fen = buildFen();
      if (!fen) {
        document.getElementById('ch-status').innerText = 'Papan tidak terdeteksi';
        return;
      }

      if (fen !== currentFen && !analyzing) {
        currentFen = fen;
        analyzing = true;
        document.getElementById('ch-status').innerText = 'Menganalisis...';
        worker.postMessage('stop');
        worker.postMessage('position fen ' + fen);
        worker.postMessage('go depth 15'); // Depth 15, seimbang antara akurasi & kecepatan
      }
    }, 2000);
  }
})();