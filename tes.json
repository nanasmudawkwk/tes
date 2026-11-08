(function() {
  // Load Stockfish
  const script = document.createElement('script');
  script.src = "https://cdn.jsdelivr.net/npm/stockfish.js@10.0.2/stockfish.js";
  document.body.appendChild(script);

  script.onload = function() {
    // Panel UI
    const panel = document.createElement('div');
    panel.id = 'ch-panel';
    panel.style.cssText = 'position:fixed;top:10px;right:10px;z-index:99999;background:#1e1e1e;color:#fff;padding:10px;border-radius:8px;font-family:sans-serif;font-size:12px;border:1px solid #444;min-width:180px;box-shadow:0 4px 12px rgba(0,0,0,0.5);';
    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
        <span style="color:#4caf50;font-weight:bold;">♟️ Helper</span>
        <span id="ch-turn" style="color:#ffeb3b;">...</span>
      </div>
      <div id="ch-status" style="font-size:10px;color:#aaa;">Init...</div>
      <div id="ch-best" style="font-size:16px;color:#ffeb3b;margin-top:4px;">-</div>
      <button id="ch-close" style="margin-top:8px;background:#d32f2f;color:#fff;border:none;padding:4px 8px;border-radius:4px;width:100%;cursor:pointer;">Tutup</button>
    `;
    document.body.appendChild(panel);
    document.getElementById('ch-close').onclick = () => {
      panel.remove();
      if (window.__sfWorker) window.__sfWorker.terminate();
      const ov = document.querySelector('.ch-arrow'); if (ov) ov.remove();
    };

    // Worker
    const worker = new Worker("https://cdn.jsdelivr.net/npm/stockfish.js@10.0.2/stockfish.js");
    window.__sfWorker = worker;
    worker.postMessage('uci');
    worker.postMessage('isready');

    let currentFen = '';
    let analyzing = false;

    worker.onmessage = function(e) {
      const line = e.data;
      if (line.startsWith('info') && line.includes(' pv ')) {
        const m = line.match(/ pv (\S+)/);
        if (m) document.getElementById('ch-best').innerText = m[1];
      }
      if (line.startsWith('bestmove')) {
        analyzing = false;
        document.getElementById('ch-status').innerText = 'Selesai';
        const mv = line.split(' ')[1];
        if (mv && mv !== '(none)') setTimeout(() => drawArrow(mv), 100);
      }
    };

    // Board detection
    function getBoard() {
      return document.querySelector('chess-board, wc-chess-board, .board');
    }
    function getOrientation(b) {
      if (b.classList.contains('flipped')) return 'b';
      const coords = b.querySelectorAll('.coordinate, .coords');
      for (const c of coords) {
        if (c.textContent.trim() === '1') {
          const r = c.getBoundingClientRect(), br = b.getBoundingClientRect();
          return (r.bottom > br.top + br.height * 0.75) ? 'w' : 'b';
        }
      }
      return 'w';
    }
    function getFen() {
      const b = getBoard(); if (!b) return null;
      const turn = getOrientation(b);
      const map = {};
      b.querySelectorAll('.piece').forEach(p => {
        const cls = p.className.split(' ');
        const sq = cls.find(c => c.startsWith('square-'));
        if (!sq) return;
        const n = parseInt(sq.replace('square-', ''));
        const f = (n % 10) - 1, r = 8 - Math.floor(n / 10);
        const t = cls.find(c => /^[wb][pnbrqk]$/.test(c));
        if (t) map[f + ',' + r] = t[0] === 'w' ? t[1].toUpperCase() : t[1];
      });
      let fen = '';
      for (let r = 7; r >= 0; r--) {
        let e = 0;
        for (let f = 0; f < 8; f++) {
          const pc = map[f + ',' + r];
          if (pc) { if (e) { fen += e; e = 0; } fen += pc; } else e++;
        }
        if (e) fen += e;
        if (r > 0) fen += '/';
      }
      return fen + ' ' + turn + ' - - 0 1';
    }

    // Draw arrow
    function drawArrow(uci) {
      const old = document.querySelector('.ch-arrow'); if (old) old.remove();
      if (!uci || uci.length < 4) return;
      const b = getBoard(); if (!b) return;
      const orient = getOrientation(b);
      const from = uci.substring(0, 2), to = uci.substring(2, 4);
      function pct(sq, o) {
        const f = 'abcdefgh'.indexOf(sq[0]), r = parseInt(sq[1]) - 1;
        return o === 'w' ? { x: f * 100, y: (7 - r) * 100 } : { x: (7 - f) * 100, y: r * 100 };
      }
      const p1 = pct(from, orient), p2 = pct(to, orient);
      const ov = document.createElement('div');
      ov.className = 'ch-arrow';
      ov.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:100;';
      if (getComputedStyle(b).position === 'static') b.style.position = 'relative';
      b.appendChild(ov);
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

    // Loop
    setInterval(() => {
      const fen = getFen();
      if (!fen) { document.getElementById('ch-status').innerText = 'Papan tidak terdeteksi'; return; }
      document.getElementById('ch-turn').innerText = fen.split(' ')[1] === 'w' ? 'Putih' : 'Hitam';
      if (fen !== currentFen && !analyzing) {
        currentFen = fen; analyzing = true;
        document.getElementById('ch-status').innerText = 'Menganalisis...';
        worker.postMessage('stop');
        worker.postMessage('position fen ' + fen);
        worker.postMessage('go depth 10');
      }
    }, 2000);
  };
})();