/**
 * DJ PUB BINGO - Engine
 * Handles State, BroadcastChannel Sync, UI Rendering, and 3D Tumbler
 */
(function() {
  'use strict';

  // --- STATE ---
  const state = {
    venueIdx: 0,
    setIdx: 0,
    calledIds: [],
    latest: null,
    stage: 1, // 1: 1 Line, 2: 2 Lines, 3: Full House
    isPlaying: false,
    autoTimer: null,
    isEjecting: false
  };

  const SYNC = new BroadcastChannel('dj_bingo_bus');
  const IS_TV = window.IS_TV || false;
  
  const COLORS = {
    'B': { c: '#2563EB', c2: '#60A5FA', c3: '#1E3A8A' },
    'I': { c: '#059669', c2: '#34D399', c3: '#064E3B' },
    'N': { c: '#D97706', c2: '#FBBF24', c3: '#78350F' },
    'G': { c: '#EA580C', c2: '#FB923C', c3: '#7C2D12' },
    'O': { c: '#7C3AED', c2: '#A78BFA', c3: '#4C1D95' }
  };

  // --- INIT ---
  document.addEventListener('DOMContentLoaded', () => {
    initTumbler();
    if (!IS_TV) {
      loadState();
      initControls();
      initVerify();
    } else {
      setupTvListener();
      SYNC.postMessage({ type: 'REQ_SYNC' });
    }
    renderAll();
  });

  function getVenue() { return window.BINGO_VENUES[state.venueIdx] || window.BINGO_VENUES[0]; }
  function getSet() { return window.BINGO_SETS[state.setIdx] || window.BINGO_SETS[0]; }

  // --- SYNC ---
  function broadcast() {
    if (IS_TV) return;
    saveState();
    SYNC.postMessage({ type: 'STATE', state: state });
  }

  function setupTvListener() {
    SYNC.onmessage = (e) => {
      const msg = e.data;
      if (msg.type === 'STATE') {
        Object.assign(state, msg.state);
        renderAll();
      } else if (msg.type === 'DRAW') {
        triggerDraw(msg.item);
      } else if (msg.type === 'SPIN') {
        spinTumbler();
      } else if (msg.type === 'WIN') {
        showWinner(msg.data);
      } else if (msg.type === 'HIDE_WIN') {
        hideWinner();
      }
    };
  }

  if (!IS_TV) {
    SYNC.onmessage = (e) => {
      if (e.data.type === 'REQ_SYNC') broadcast();
    };
  }

  function loadState() {
    const s = localStorage.getItem('bingo_state');
    if (s) {
      try {
        const p = JSON.parse(s);
        Object.assign(state, p);
      } catch(e) {}
    }
  }
  
  function saveState() {
    localStorage.setItem('bingo_state', JSON.stringify(state));
  }

  // --- RENDERING ---
  function renderAll() {
    renderHeader();
    renderBoard();
    renderRecent();
    renderBasketState();
  }

  function renderHeader() {
    const venue = getVenue();
    const set = getSet();
    
    document.getElementById('uiVenueName').textContent = venue.title;
    document.getElementById('uiSetName').textContent = set.name;
    
    const max = set.items.length;
    const drawn = state.calledIds.length;
    document.getElementById('uiDrawn').textContent = drawn;
    document.getElementById('uiRemain').textContent = max - drawn;
    document.getElementById('uiProgress').style.width = (drawn / max * 100) + '%';
    
    const stageDots = document.querySelector('.stage-dots');
    if (stageDots) {
      stageDots.innerHTML = [1,2,3].map(i => 
        `<i class="${i < state.stage ? 'done' : (i === state.stage ? 'on' : '')}"></i>`
      ).join('');
    }
    
    document.querySelector('.stage-label').textContent = 'STAGE ' + state.stage;
    document.querySelector('.stage-goal').textContent = state.stage === 1 ? 'One Line' : (state.stage === 2 ? 'Two Lines' : 'Full House');
    document.querySelector('.stage-prize').textContent = state.stage === 1 ? venue.stage1Prize : (state.stage === 2 ? venue.stage2Prize : venue.stage3Prize);
  }

  function renderBoard() {
    const board = document.getElementById('masterBoard');
    const set = getSet();
    const is75 = set.type === '75-ball';
    board.className = 'board ' + (is75 ? 'b75' : 'b90');
    
    let html = '';
    if (is75) {
      ['B','I','N','G','O'].forEach(col => {
        html += `<div class="row-letter" style="--c:${COLORS[col].c}; --c2:${COLORS[col].c2}; --c3:${COLORS[col].c3}">${col}</div>`;
        for (let i=1; i<=15; i++) {
          const num = i + (['B','I','N','G','O'].indexOf(col) * 15);
          const item = set.items.find(x => x.id == num);
          if (!item) continue;
          const called = state.calledIds.includes(item.id);
          const latest = state.latest && state.latest.id === item.id;
          let cls = 'cell';
          if (called) cls += ' called';
          if (latest) cls += ' latest fresh';
          html += `<div class="${cls}" style="--c:${COLORS[col].c}; --c2:${COLORS[col].c2}; --c3:${COLORS[col].c3}">${num}</div>`;
        }
      });
    } else {
      for(let i=1; i<=90; i++) {
        const item = set.items.find(x => x.id == i);
        if (!item) continue;
        const called = state.calledIds.includes(item.id);
        const latest = state.latest && state.latest.id === item.id;
        let cls = 'cell';
        if (called) cls += ' called';
        if (latest) cls += ' latest fresh';
        html += `<div class="${cls}" style="--c:#EA580C; --c2:#FB923C; --c3:#7C2D12">${i}</div>`;
      }
    }
    board.innerHTML = html;
  }

  function renderRecent() {
    const list = document.getElementById('recentList');
    if (state.calledIds.length === 0) {
      list.innerHTML = '<div class="recent-empty">No calls yet</div>';
      return;
    }
    const set = getSet();
    const recent = state.calledIds.slice(-5).reverse();
    list.innerHTML = recent.map((id, i) => {
       const item = set.items.find(x => x.id === id);
       const col = item.col || 'N';
       const c = COLORS[col];
       return `<div class="ball ball--mini ${i===0?'enter':''}" style="--c:${c.c}; --c2:${c.c2}; --c3:${c.c3}">
                 <div class="ball-face">
                   ${item.col ? `<div class="ball-letter">${item.col}</div>` : ''}
                   <div class="ball-num">${item.id}</div>
                 </div>
               </div>`;
    }).join('');
    
    // Ticker
    const ticker = document.getElementById('uiTicker');
    if (state.latest) {
      ticker.textContent = `Latest Call: ${state.latest.col ? state.latest.col + '-' : ''}${state.latest.id} • Waiting for a Bingo...`;
    }
  }

  // --- BASKET & HERO BALL ---
  let tumblerCtx, tumblerAnim;
  const physics = { speed: 0.018, targetSpeed: 0.018, angle: 0, balls: [], particles: [] };
  
  function initTumbler() {
    const canvas = document.getElementById('tumblerCanvas');
    if (!canvas) return;
    tumblerCtx = canvas.getContext('2d');
    
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = (canvas.clientWidth || 320) * dpr;
      canvas.height = (canvas.clientHeight || 140) * dpr;
      if (tumblerCtx) tumblerCtx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener('resize', resize);
    
    for (let i=0; i<30; i++) {
      const col = ['B','I','N','G','O'][i%5];
      physics.balls.push({
        col: col,
        xNorm: (Math.random()-0.5)*1.4,
        angle: Math.random()*Math.PI*2,
        distNorm: 0.4 + Math.random()*0.5
      });
    }
    renderTumbler();
  }
  
  function renderTumbler() {
    tumblerAnim = requestAnimationFrame(renderTumbler);
    const canvas = document.getElementById('tumblerCanvas');
    if (!canvas || !tumblerCtx) return;
    
    const w = canvas.width / (window.devicePixelRatio||1);
    const h = canvas.height / (window.devicePixelRatio||1);
    const ctx = tumblerCtx;
    
    ctx.clearRect(0,0,w,h);
    
    physics.speed += (physics.targetSpeed - physics.speed) * 0.1;
    physics.angle += physics.speed;
    
    const cx = w/2, cy = h/2;
    const R = Math.min(46, h*0.35);
    const L = Math.min(125, w*0.44);
    
    // Draw wireframe
    ctx.lineWidth = 1;
    for(let i=0; i<16; i++) {
      const a = physics.angle + (i/16)*Math.PI*2;
      const s = Math.sin(a);
      if (s < 0) {
        ctx.strokeStyle = `rgba(255,255,255,${0.1 + (1+s)*0.1})`;
        ctx.beginPath();
        ctx.moveTo(cx - L/2, cy + Math.cos(a)*R);
        ctx.lineTo(cx + L/2, cy + Math.cos(a)*R);
        ctx.stroke();
      }
    }
    
    // Draw balls
    physics.balls.forEach(b => {
      let ba = b.angle + physics.angle;
      let bx = cx + b.xNorm * (L/2);
      let by = cy + Math.sin(ba) * (R * b.distNorm);
      let s = Math.cos(ba); // depth
      
      let rad = 5 + (s * 1.5);
      const c = COLORS[b.col];
      ctx.fillStyle = c.c;
      ctx.beginPath();
      ctx.arc(bx, by, rad, 0, Math.PI*2);
      ctx.fill();
    });
    
    // Front wires
    for(let i=0; i<16; i++) {
      const a = physics.angle + (i/16)*Math.PI*2;
      const s = Math.sin(a);
      if (s >= 0) {
        ctx.strokeStyle = `rgba(255,255,255,${0.2 + s*0.3})`;
        ctx.beginPath();
        ctx.moveTo(cx - L/2, cy + Math.cos(a)*R);
        ctx.lineTo(cx + L/2, cy + Math.cos(a)*R);
        ctx.stroke();
      }
    }
  }

  function spinTumbler() {
    physics.targetSpeed = 0.25;
    document.getElementById('uiBasketState').textContent = 'SPINNING';
    document.getElementById('uiBasketState').classList.add('hot');
    if (window.SFX) window.SFX.play('tumbler');
    
    setTimeout(() => {
      physics.targetSpeed = 0.018;
      document.getElementById('uiBasketState').textContent = 'IDLE';
      document.getElementById('uiBasketState').classList.remove('hot');
    }, 1200);
  }

  function renderBasketState() {
    const st = document.getElementById('uiBasketState');
    if (physics.targetSpeed > 0.1) {
      st.textContent = 'SPINNING';
      st.classList.add('hot');
    } else {
      st.textContent = 'IDLE';
      st.classList.remove('hot');
    }
  }

  function triggerDraw(item) {
    state.latest = item;
    state.calledIds.push(item.id);
    
    spinTumbler();
    
    setTimeout(() => {
      showHeroBall(item);
      renderAll();
      if (window.SFX) window.SFX.play('pop');
    }, 800);
  }

  function showHeroBall(item) {
    const c = COLORS[item.col || 'N'];
    const slot = document.getElementById('heroSlot');
    slot.innerHTML = `
      <div class="ball ball--hero drop" style="--c:${c.c}; --c2:${c.c2}; --c3:${c.c3}; --glow:${c.c}88">
        <div class="ball-face">
          ${item.col ? `<div class="ball-letter">${item.col}</div>` : ''}
          <div class="ball-num">${item.id}</div>
        </div>
      </div>`;
    
    document.getElementById('heroRing').classList.add('on');
    document.getElementById('heroBurst').classList.remove('go');
    void document.getElementById('heroBurst').offsetWidth;
    document.getElementById('heroBurst').classList.add('go');
    
    const capT = document.getElementById('capTitle');
    const capS = document.getElementById('capSub');
    capT.classList.remove('reveal'); capS.classList.remove('reveal');
    void capT.offsetWidth; void capS.offsetWidth;
    capT.textContent = item.name || (item.col + ' ' + item.id);
    capS.textContent = item.trivia || 'Mark your cards!';
    capT.classList.add('reveal'); capS.classList.add('reveal');
  }

  // --- DJ CONTROLS (DJ ONLY) ---
  function initControls() {
    // Populate dropdowns
    const selV = document.getElementById('selVenue');
    window.BINGO_VENUES.forEach((v, i) => {
      selV.innerHTML += `<option value="${i}">${v.title}</option>`;
    });
    selV.value = state.venueIdx;
    selV.onchange = (e) => { state.venueIdx = parseInt(e.target.value); broadcast(); renderAll(); };

    const selS = document.getElementById('selSet');
    window.BINGO_SETS.forEach((s, i) => {
      selS.innerHTML += `<option value="${i}">${s.name}</option>`;
    });
    selS.value = state.setIdx;
    selS.onchange = (e) => { state.setIdx = parseInt(e.target.value); resetGame(); };

    document.getElementById('btnNextBall').onclick = doNextBall;
    document.getElementById('btnSpin').onclick = () => { spinTumbler(); SYNC.postMessage({type:'SPIN'}); };
    
    document.getElementById('btnAuto').onclick = () => {
      if (state.autoTimer) {
        clearInterval(state.autoTimer);
        state.autoTimer = null;
        document.getElementById('btnAuto').classList.remove('on');
      } else {
        doNextBall();
        state.autoTimer = setInterval(doNextBall, 10000);
        document.getElementById('btnAuto').classList.add('on');
      }
    };
    
    document.getElementById('btnVerify').onclick = () => {
      document.getElementById('verifyModal').classList.remove('hidden');
      document.getElementById('verifyCardNo').focus();
    };
    
    document.getElementById('btnCloseVerify').onclick = () => {
      document.getElementById('verifyModal').classList.add('hidden');
      hideWinner();
      SYNC.postMessage({type:'HIDE_WIN'});
    };
    
    document.getElementById('btnTv').onclick = () => {
      window.open('tv.html', '_blank', 'width=1280,height=720,menubar=no,toolbar=no,location=no');
    };
    
    document.getElementById('btnReset').onclick = resetGame;

    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      if (e.code === 'Space') { e.preventDefault(); doNextBall(); }
      if (e.key === 's' || e.key === 'S') { spinTumbler(); SYNC.postMessage({type:'SPIN'}); }
      if (e.key === 'r' || e.key === 'R') { resetGame(); }
      if (e.key === 'v' || e.key === 'V') { document.getElementById('btnVerify').click(); }
    });
  }

  function doNextBall() {
    const set = getSet();
    const available = set.items.filter(x => !state.calledIds.includes(x.id));
    if (available.length === 0) return;
    
    const item = available[Math.floor(Math.random() * available.length)];
    triggerDraw(item);
    SYNC.postMessage({ type: 'DRAW', item: item });
    broadcast();
  }

  function resetGame() {
    state.calledIds = [];
    state.latest = null;
    state.stage = 1;
    if (state.autoTimer) { clearInterval(state.autoTimer); state.autoTimer = null; document.getElementById('btnAuto').classList.remove('on'); }
    
    document.getElementById('heroSlot').innerHTML = '';
    document.getElementById('capTitle').textContent = 'Ready to Play!';
    document.getElementById('capSub').textContent = 'Waiting for DJ...';
    hideWinner();
    SYNC.postMessage({type:'HIDE_WIN'});
    broadcast();
    renderAll();
  }

  // --- VERIFY CARD (DJ ONLY) ---
  function initVerify() {
    const btn = document.getElementById('btnDoVerify');
    const input = document.getElementById('verifyCardNo');
    
    const checkCard = () => {
      const num = parseInt(input.value);
      if (isNaN(num)) return;
      const set = getSet();
      
      let cardData;
      if (set.type === '75-ball') {
        cardData = window.Cards.generate75Card(set, num, 'PUB');
      } else {
        cardData = window.Cards.generate90Card(set, num, 'PUB');
      }
      
      const res = window.Cards.evaluateCard(cardData, state.calledIds);
      
      // Render
      document.getElementById('verifyCardRender').innerHTML = window.Cards.renderCardHTML(cardData, state.calledIds);
      
      const vr = document.getElementById('verifyResult');
      let msg = '';
      let isBingo = false;
      if (state.stage === 1) {
        if (res.lines >= 1) { isBingo = true; msg = "BINGO! 1 LINE!"; } else msg = "Not 1 Line yet.";
      } else if (state.stage === 2) {
        if (res.lines >= 2) { isBingo = true; msg = "BINGO! 2 LINES!"; } else msg = "Not 2 Lines yet.";
      } else {
        if (res.fullHouse) { isBingo = true; msg = "BINGO! FULL HOUSE!"; } else msg = "Not Full House yet.";
      }
      
      vr.className = 'verify-result ' + (isBingo ? 'ok' : 'no');
      vr.innerHTML = `<div class="big">${isBingo ? 'BINGO' : 'NO BINGO'}</div><div class="sub">${msg}</div>`;
      
      if (isBingo) {
        if (window.SFX) window.SFX.play('fanfare');
        showWinner({ stage: state.stage, prize: document.querySelector('.stage-prize').textContent, card: num });
        SYNC.postMessage({ type: 'WIN', data: { stage: state.stage, prize: document.querySelector('.stage-prize').textContent, card: num } });
        // Auto advance stage
        if (state.stage < 3) {
           state.stage++;
           broadcast();
        }
      } else {
        if (window.SFX) window.SFX.play('buzzer');
      }
    };
    
    btn.onclick = checkCard;
    input.onkeydown = (e) => { if (e.key === 'Enter') checkCard(); };
  }

  function showWinner(data) {
    const w = document.getElementById('winnerOverlay');
    if (!w) return;
    w.classList.remove('hidden');
    const stg = data.stage === 1 ? 'ONE LINE' : (data.stage === 2 ? 'TWO LINES' : 'FULL HOUSE');
    document.getElementById('winStage').textContent = stg;
    document.getElementById('winPrize').textContent = data.prize;
    document.getElementById('winCard').textContent = 'CARD #' + data.card;
    if (window.canvasConfetti) {
       window.canvasConfetti({ particleCount: 150, spread: 100, origin: { y: 0.6 } });
    }
  }

  function hideWinner() {
    const w = document.getElementById('winnerOverlay');
    if (w) w.classList.add('hidden');
  }

})();
