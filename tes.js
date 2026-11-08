(function () {
  if (window.__chessHelperLoaded) {
    alert('Chess Helper sudah aktif!');
    return;
  }
  window.__chessHelperLoaded = true;

  const SF_URL = 'https://cdn.jsdelivr.net/npm/stockfish.js@10.0.2/stockfish.js';

  fetch(SF_URL)
    .then(r => r.text())
    .then(code => {
      const blob = new Blob([code], { type: 'application/javascript' });
      const blobUrl = URL.createObjectURL(blob);
      init(blobUrl);
    })
    .catch(e => alert('Gagal load Stockfish: ' + e.message));

  function init(workerUrl) {
    const worker = new Worker(workerUrl);
    window.__chessHelperWorker = worker;

    // ==== UI PANEL ====
    const panel = document.createElement('div');
    panel.id = 'ch-panel';
    panel.style.cssText = `
      position:fixed; top:60px; right:10px; z-index:999999;
      background:#1e1e1e; color:#fff; border-radius:8px;
      font-family:sans-serif; font-size:12px; border:1px solid #444;
      box-shadow:0 4px 12px rgba(0,0,0,0.6);
      width:220px; user-select:none;
    `;
    panel.innerHTML = `
      <div id="ch-header" style="
        display:flex; justify-content:space-between; align-items:center;
        padding:8px 10px; background:#2a2a2a; border-radius:8px 8px 0 0;
        cursor:move; touch-action:none;
      ">
        <span style="color:#4caf50; font-weight:bold;">♟️ Helper</span>
        <div>
          <button id="ch-min" style="background:#555; color:#fff; border:none; border-radius:3px; width:22px; height:22px; cursor:pointer; margin-right:4px;">—</button>
          <button id="ch-close" style="background:#d32f2f; color:#fff; border:none; border-radius:3px; width:22px; height:22px; cursor:pointer;">×</button>
        </div>
      </div>
      <div id="ch-body" style="padding:10px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <span style="color:#aaa;">Giliran:</span>
          <button id="ch-turn-btn" style="background:#333; color:#ffeb3b; border:1px solid #555; border-radius:4px; padding:2px 8px; cursor:pointer; font-weight:bold;">Putih</button>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
          <span style="color:#aaa;">Langkah:</span>
          <span id="ch-best" style="color:#3b82f6; font-weight:bold;">-</span>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
          <span style="color:#aaa;">Eval:</span>
          <span id="ch-eval" style="color:#4caf50;">-</span>
        </div>
        <div id="ch-status" style="font-size:10px; color:#888; text-align:center;">Init...</div>
      </div>
    `;
    document.body.appendChild(panel);

    // Close & Minimize & Drag (sama seperti sebelumnya)
    document.getElementById('ch-close').onclick = () => {
      panel.remove(); worker.terminate(); URL.revokeObjectURL(workerUrl);
      const ov = document.querySelector('.ch-arrow'); if (ov) ov.remove();
      window.__chessHelperLoaded = false;
    };
    let minimized = false;
    document.getElementById('ch-min').onclick = (e) => {
      e.stopPropagation(); minimized = !minimized;
      document.getElementById('ch-body').style.display = minimized ? 'none' : 'block';
      document.getElementById('ch-min').innerText = minimized ? '+' : '—';
    };
    const header = document.getElementById('ch-header');
    let dragging = false, startX = 0, startY = 0, startLeft = 0, startTop = 0;
    const onStart = (e) => {
      if (e.target.tagName === 'BUTTON') return;
      dragging = true; const rect = panel.getBoundingClientRect();
      startLeft = rect.left; startTop = rect.top;
      panel.style.left = rect.left + 'px'; panel.style.top = rect.top + 'px'; panel.style.right = 'auto';
      const p = e.touches ? e.touches[0] : e; startX = p.clientX; startY = p.clientY; e.preventDefault();
    };
    const onMove = (e) => {
      if (!dragging) return; const p = e.touches ? e.touches[0] : e;
      panel.style.left = (startLeft + p.clientX - startX) + 'px';
      panel.style.top = (startTop + p.clientY - startY) + 'px'; e.preventDefault();
    };
    const onEnd = () => { dragging = false; };
    header.addEventListener('mousedown', onStart); header.addEventListener('touchstart', onStart, { passive: false });
    document.addEventListener('mousemove', onMove); document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('mouseup', onEnd); document.addEventListener('touchend', onEnd);

    // ==== TOMBOL GILIRAN MANUAL ====
    let manualTurn = null; 
    const turnBtn = document.getElementById('ch-turn-btn');
    turnBtn.onclick = () => {
      if (manualTurn === null) manualTurn = 'w';
      else if (manualTurn === 'w') manualTurn = 'b';
      else manualTurn = null;
      turnBtn.innerText = manualTurn === null ? 'Auto' : (manualTurn === 'w' ? 'Putih' : 'Hitam');
      turnBtn.style.color = manualTurn === null ? '#888' : '#ffeb3b';
      currentFen = ''; analyzing = false;
    };

    // ==== ENGINE ====
    worker.postMessage('uci');
    worker.postMessage('isready');
    let currentFen = '';
    let analyzing = false;
    worker.onmessage = (e) => {
      const line = e.data;
      if (typeof line !== 'string') return;
      if (line.startsWith('info') && line.includes(' pv ')) {
        const pvM = line.match(/ pv (\S+)/);
        if (pvM) document.getElementById('ch-best').innerText = pvM[1];
        const cpM = line.match(/score cp (-?\d+)/);
        const mateM = line.match(/score mate (-?\d+)/);
        if (mateM) document.getElementById('ch-eval').innerText = 'M' + mateM[1];
        else if (cpM) {
          const cp = parseInt(cpM[1]) / 100;
          document.getElementById('ch-eval').innerText = (cp > 0 ? '+' : '') + cp.toFixed(2);
        }
      }
      if (line.startsWith('bestmove')) {
        analyzing = false;
        document.getElementById('ch-status').innerText = 'Selesai ✓';
        const mv = line.split(' ')[1];
        if (mv && mv !== '(none)') setTimeout(() => drawArrow(mv), 100);
      }
    };

    // ==== BOARD & FEN LOGIC (DIPERBAIKI TOTAL) ====
    function findBoard() {
      const candidates = document.querySelectorAll('chess-board, wc-chess-board, .board');
      let best = null, maxArea = 0;
      candidates.forEach(b => {
        const r = b.getBoundingClientRect();
        if (r.width * r.height > maxArea && r.width > 150) { maxArea = r.width * r.height; best = b; }
      });
      return best;
    }

    function getFen() {
      const board = findBoard();
      if (!board) return null;
      
      // 1. Tentukan giliran
      let turn = manualTurn;
      if (!turn) {
        // Coba deteksi dari move list (jika ada)
        const moveList = document.querySelector('.vertical-move-list, .play-controller-move-list');
        if (moveList) {
          const moves = moveList.querySelectorAll('.node');
          turn = moves.length % 2 === 0 ? 'w' : 'b'; // genap = putih, ganjil = hitam
        } else {
          turn = 'w'; // default
        }
      }

      // 2. Baca bidak dengan konversi koordinat yang BENAR
      // Chess.com: square-11 = a8 (kiri atas), square-88 = h1 (kanan bawah)
      const map = {};
      board.querySelectorAll('.piece').forEach(p => {
        const cls = p.className.split(/\s+/);
        const sqCls = cls.find(c => c.startsWith('square-'));
        if (!sqCls) return;
        const n = parseInt(sqCls.replace('square-', ''));
        if (isNaN(n)) return;
        
        // Rumus: file = (n % 10) - 1, rank = 8 - floor(n / 10)
        // Contoh: square-52 -> file=1 (b), rank=8-5=3 -> b3 (BENAR)
        const file = (n % 10) - 1; 
        const rank = 8 - Math.floor(n / 10); 
        
        const pieceCls = cls.find(c => /^[wb][pnbrqk]$/.test(c));
        if (!pieceCls) return;
        const sym = pieceCls[0] === 'w' ? pieceCls[1].toUpperCase() : pieceCls[1];
        map[file + ',' + rank] = sym;
      });

      if (Object.keys(map).length === 0) return null;

      // 3. Bangun FEN
      let fen = '';
      for (let r = 7; r >= 0; r--) { // rank 8 (7) sampai 1 (0)
        let empty = 0;
        for (let f = 0; f < 8; f++) { // file a (0) sampai h (7)
          const pc = map[f + ',' + r];
          if (pc) {
            if (empty) { fen += empty; empty = 0; }
            fen += pc;
          } else empty++;
        }
        if (empty) fen += empty;
        if (r > 0) fen += '/';
      }
      
      // Castling (sederhana)
      let castling = '';
      if (map['4,0'] === 'K') {
        if (map['7,0'] === 'R') castling += 'K';
        if (map['0,0'] === 'R') castling += 'Q';
      }
      if (map['4,7'] === 'k') {
        if (map['7,7'] === 'r') castling += 'k';
        if (map['0,7'] === 'r') castling += 'q';
      }
      if (!castling) castling = '-';

      return fen + ' ' + turn + ' ' + castling + ' - 0 1';
    }

    // ==== DRAW ARROW ====
    function drawArrow(uci) {
      const old = document.querySelector('.ch-arrow');
      if (old) old.remove();
      if (!uci || uci.length < 4) return;

      const board = findBoard(); if (!board) return;
      const orient = manualTurn || 'w'; // orientasi berdasarkan giliran manual/default
      const from = uci.substring(0, 2);
      const to = uci.substring(2, 4);

      function pct(sq, o) {
        const f = 'abcdefgh'.indexOf(sq[0]);
        const r = parseInt(sq[1]) - 1;
        return o === 'w' ? { x: f * 100, y: (7 - r) * 100 } : { x: (7 - f) * 100, y: r * 100 };
      }

      const p1 = pct(from, orient);
      const p2 = pct(to, orient);

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
      mk.setAttribute('id', 'arr');
      mk.setAttribute('markerWidth', '4'); mk.setAttribute('markerHeight', '4');
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

    // ==== LOOP ====
    setInterval(() => {
      const fen = getFen();
      if (!fen) {
        document.getElementById('ch-status').innerText = 'Papan tidak terdeteksi';
        return;
      }

      const turnChar = fen.split(' ')[1];
      if (!manualTurn) {
        document.getElementById('ch-turn-btn').innerText = turnChar === 'w' ? 'Putih' : 'Hitam';
      }

      if (fen !== currentFen && !analyzing) {
        currentFen = fen;
        analyzing = true;
        document.getElementById('ch-status').innerText = 'Menganalisis...';
        worker.postMessage('stop');
        worker.postMessage('position fen ' + fen);
        worker.postMessage('go depth 12');
      }
    }, 2000);
  }
})();