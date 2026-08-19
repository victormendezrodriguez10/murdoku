/* MURDOKU · Edición Cumpleaños — motor del juego
   Cada página de caso define window.PUZZLE antes de cargar este script. */
(function () {
  const P = window.PUZZLE;
  const n = P.n;

  // Estado
  let selected = null;                 // id del personaje seleccionado en la bandeja
  const placement = {};                // id -> [fila, col]
  let hintsShown = 0;
  let attempts = 0;

  const $ = (sel) => document.querySelector(sel);

  const roomAt = (r, c) => P.rooms[r][c];
  const isBlocked = (r, c) => P.furniture.some((f) => f.pos[0] === r && f.pos[1] === c);
  const furnitureAt = (r, c) => P.furniture.find((f) => f.pos[0] === r && f.pos[1] === c);
  const personAt = (r, c) => Object.keys(placement).find((id) => placement[id][0] === r && placement[id][1] === c);
  const personById = (id) => P.people.find((p) => p.id === id);

  /* ---------- Tablero ---------- */
  function buildBoard() {
    const table = document.createElement('table');

    // Cabecera de columnas
    const head = document.createElement('tr');
    head.appendChild(cellCoord(''));
    for (let c = 0; c < n; c++) head.appendChild(cellCoord(String(c + 1)));
    table.appendChild(head);

    // Primera casilla de cada habitación (para la etiqueta)
    const labelCell = {};
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++) {
        const k = roomAt(r, c);
        if (!(k in labelCell)) labelCell[k] = [r, c];
      }

    for (let r = 0; r < n; r++) {
      const row = document.createElement('tr');
      row.appendChild(cellCoord(String(r + 1)));
      for (let c = 0; c < n; c++) {
        const td = document.createElement('td');
        td.className = 'cell';
        td.id = `cell-${r}-${c}`;
        const k = roomAt(r, c);
        td.style.background = P.roomColors[k];

        // Muros: borde grueso donde cambia la habitación o en el borde exterior
        const wall = '3px solid var(--wall)';
        const inner = '1px solid rgba(0,0,0,0.35)';
        td.style.borderTop = r === 0 || roomAt(r - 1, c) !== k ? wall : inner;
        td.style.borderLeft = c === 0 || roomAt(r, c - 1) !== k ? wall : inner;
        td.style.borderBottom = r === n - 1 || roomAt(r + 1, c) !== k ? wall : inner;
        td.style.borderRight = c === n - 1 || roomAt(r, c + 1) !== k ? wall : inner;

        if (labelCell[k][0] === r && labelCell[k][1] === c) {
          const lab = document.createElement('span');
          lab.className = 'room-label';
          lab.textContent = P.roomNames[k];
          td.appendChild(lab);
        }

        const furn = furnitureAt(r, c);
        if (furn) {
          td.classList.add('blocked');
          const f = document.createElement('span');
          f.className = 'furn';
          f.textContent = furn.emoji;
          f.title = furn.name;
          td.appendChild(f);
        } else {
          td.addEventListener('click', () => onCellClick(r, c));
        }
        row.appendChild(td);
      }
      table.appendChild(row);
    }
    $('#board').appendChild(table);
  }

  function cellCoord(text) {
    const td = document.createElement('td');
    td.className = 'coord';
    td.textContent = text;
    return td;
  }

  /* ---------- Bandeja ---------- */
  function buildTray() {
    const tray = $('#tray');
    P.people.forEach((p) => {
      const chip = document.createElement('div');
      chip.className = 'chip';
      chip.id = `chip-${p.id}`;
      chip.innerHTML = `<span class="face">${p.emoji}</span><span class="cname">${p.name}</span>`;
      chip.addEventListener('click', () => onChipClick(p.id));
      tray.appendChild(chip);
    });
  }

  function onChipClick(id) {
    if (placement[id]) return; // ya está en el tablero
    selected = selected === id ? null : id;
    refreshTray();
  }

  function onCellClick(r, c) {
    const occupant = personAt(r, c);
    if (occupant) {
      // Retirar ficha
      delete placement[occupant];
      renderCell(r, c);
      if (!selected) selected = occupant;
    } else if (selected) {
      placement[selected] = [r, c];
      renderCell(r, c);
      selected = null;
    }
    refreshTray();
    updateCrosses();
    $('#btn-check').disabled = Object.keys(placement).length !== P.people.length;
  }

  // Una casilla queda cruzada si alguien ya ocupa su fila o su columna
  function isCrossed(r, c) {
    return Object.values(placement).some((pos) => pos[0] === r || pos[1] === c);
  }

  function updateCrosses() {
    // Cruces informativas en las filas/columnas ocupadas
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++) {
        const td = $(`#cell-${r}-${c}`);
        const old = td.querySelector('.cross');
        if (old) old.remove();
        if (personAt(r, c)) continue;
        td.classList.remove('conflict');
        if (isBlocked(r, c)) continue;
        if (isCrossed(r, c)) {
          const x = document.createElement('span');
          x.className = 'cross';
          x.textContent = '✕';
          td.appendChild(x);
        }
      }
    // Personajes que comparten fila o columna se marcan en rojo
    const ids = Object.keys(placement);
    let conflict = false;
    ids.forEach((id) => {
      const [r, c] = placement[id];
      const clash = ids.some((o) => o !== id && (placement[o][0] === r || placement[o][1] === c));
      $(`#cell-${r}-${c}`).classList.toggle('conflict', clash);
      if (clash) conflict = true;
    });
    setFeedback(conflict ? '⚠ Dos personajes comparten fila o columna.' : '', conflict ? 'bad' : '');
  }

  function renderCell(r, c) {
    const td = $(`#cell-${r}-${c}`);
    td.querySelectorAll('.person').forEach((e) => e.remove());
    const id = personAt(r, c);
    if (id) {
      const p = personById(id);
      const span = document.createElement('span');
      span.className = 'person';
      span.innerHTML = `${p.emoji}<span class="pname">${p.name}</span>`;
      td.appendChild(span);
    }
  }

  function refreshTray() {
    P.people.forEach((p) => {
      const chip = $(`#chip-${p.id}`);
      chip.classList.toggle('placed', !!placement[p.id]);
      chip.classList.toggle('selected', selected === p.id);
    });
  }

  /* ---------- Pistas ---------- */
  function buildClues() {
    const box = $('#clue-list');
    P.people.forEach((p) => {
      const div = document.createElement('div');
      div.className = 'clue';
      div.innerHTML = `<span class="face">${p.emoji}</span><span><span class="who">${p.name}${p.victim ? ' (víctima)' : ''}:</span> ${p.clue}</span>`;
      box.appendChild(div);
    });
  }

  /* ---------- Comprobación ---------- */
  function check() {
    attempts++;
    let correct = 0;
    P.people.forEach((p) => {
      const pos = placement[p.id];
      const sol = P.solution[p.id];
      if (pos && pos[0] === sol[0] && pos[1] === sol[1]) correct++;
    });
    if (correct === P.people.length) {
      win();
    } else {
      const board = $('#board');
      board.classList.remove('shake');
      void board.offsetWidth;
      board.classList.add('shake');
      const msg =
        attempts >= 2
          ? `Algo no encaja… hay ${correct} de ${P.people.length} personajes bien colocados. Revisa las pistas.`
          : 'Algo no encaja… revisa las pistas con lupa. 🔍';
      setFeedback(msg, 'bad');
    }
  }

  function setFeedback(text, cls) {
    const f = $('#feedback');
    f.textContent = text;
    f.className = 'feedback' + (cls ? ' ' + cls : '');
  }

  function win() {
    try { localStorage.setItem('murdoku_' + P.id, P.code); } catch (e) {}
    const m = personById(P.murderer);
    const v = P.people.find((p) => p.victim);
    const vRoom = P.roomNames[roomAt(...P.solution[v.id])];
    $('#win-text').innerHTML =
      `${m.emoji} <b>${m.name}</b> estaba a solas con ${v.emoji} ${v.name} en <b>${vRoom}</b>… ` + P.reveal;
    $('#win-code').textContent = P.code;
    $('#overlay-win').classList.add('open');
    confetti();
  }

  function confetti() {
    const colors = ['#d4a24e', '#a33b3b', '#e8ddcc', '#6da36b', '#7d5fb2'];
    for (let i = 0; i < 90; i++) {
      const s = document.createElement('div');
      s.className = 'confetti';
      s.style.left = Math.random() * 100 + 'vw';
      s.style.background = colors[Math.floor(Math.random() * colors.length)];
      s.style.animationDuration = 2.5 + Math.random() * 2.5 + 's';
      s.style.animationDelay = Math.random() * 0.8 + 's';
      s.style.transform = `rotate(${Math.random() * 360}deg)`;
      document.body.appendChild(s);
      setTimeout(() => s.remove(), 6500);
    }
  }

  /* ---------- Botones ---------- */
  function reset() {
    Object.keys(placement).forEach((id) => {
      const [r, c] = placement[id];
      delete placement[id];
      renderCell(r, c);
    });
    selected = null;
    refreshTray();
    updateCrosses();
    setFeedback('');
    $('#btn-check').disabled = true;
  }

  function showHint() {
    if (hintsShown >= P.hints.length) return;
    const div = document.createElement('div');
    div.className = 'hint-revealed';
    div.textContent = '🔎 ' + P.hints[hintsShown];
    $('#hints').appendChild(div);
    hintsShown++;
    if (hintsShown >= P.hints.length) {
      $('#btn-hint').disabled = true;
      $('#btn-hint').textContent = 'No hay más pistas';
    }
  }

  function copyCode() {
    const code = P.code;
    const done = () => {
      $('#btn-copy').textContent = '¡Copiado!';
      setTimeout(() => ($('#btn-copy').textContent = 'Copiar código'), 1800);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).then(done, () => fallbackCopy(code, done));
    } else {
      fallbackCopy(code, done);
    }
  }
  function fallbackCopy(text, done) {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); done(); } catch (e) {}
    ta.remove();
  }

  /* ---------- Init ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    buildBoard();
    buildTray();
    buildClues();
    $('#btn-check').disabled = true;
    $('#btn-check').addEventListener('click', check);
    $('#btn-reset').addEventListener('click', reset);
    $('#btn-hint').addEventListener('click', showHint);
    $('#btn-rules').addEventListener('click', () => $('#overlay-rules').classList.add('open'));
    $('#btn-rules-close').addEventListener('click', () => $('#overlay-rules').classList.remove('open'));
    $('#btn-copy').addEventListener('click', copyCode);
    document.querySelectorAll('.overlay').forEach((ov) => {
      ov.addEventListener('click', (e) => { if (e.target === ov && ov.id === 'overlay-rules') ov.classList.remove('open'); });
    });
  });
})();
