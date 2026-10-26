/*
 * 茶筅でお茶を点てるミニゲーム（手順の "type": "game", "game": "chasen" で呼ばれる）
 *  1. トントン   … 底に沈んだ抹茶を浮き立たせる。光る輪に合わせて3回
 *  2. シャカシャカ … 奥・手前を交互に、すばやく一定のリズムで。空気を含ませて黄緑色に
 *  3. 泡を整える … 上の方だけを、ゆっくりかきたてて大きな泡を消す
 *  4. 「の」の字 … 最後に「の」の字を書いて、茶筅を静かに引き上げる
 * 操作：スペース（またはクリック）＝トン・の ／ ↑↓キー（または ボタン）＝奥・手前
 */
const ChasenGame = (() => {
  const SIZE = 320;
  const BEAT = 900;                         // トントンの間（ミリ秒）
  const SHAKA_GOAL = 40;                    // シャカシャカで必要な点
  const AWA_GOAL = 6;                       // 泡を整える回数
  const PHASES = [
    { id: 'ton',   title: '① トントン',     text: '底に沈んだ抹茶を浮き立たせます。輪が茶碗の縁に重なった瞬間に「トン」（スペース／クリック）を3回。' },
    { id: 'shaka', title: '② シャカシャカ', text: '奥・手前（↑↓キー か 下のボタン）を交互に、すばやく一定のリズムで。空気を含ませて、深い緑を黄緑色にしましょう。' },
    { id: 'awa',   title: '③ 泡を整える',   text: '上の方だけを、ゆっくり大きくかきたてて、大きな泡を消します。（↑↓ を交互に、ゆっくり）' },
    { id: 'no',    title: '④ 「の」の字',   text: '最後に「の」の字を書いて、茶筅を静かに引き上げます。（スペース／ボタン）' }
  ];

  let host = null, cv = null, g = null, raf = 0, onDone = null;
  let s = null;                               // ゲームの状態

  const rnd = (a, b) => a + Math.random() * (b - a);
  const lerp = (a, b, t) => a + (b - a) * t;
  const mix = (c1, c2, t) => {
    const p = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
    const a = p(c1), b = p(c2);
    return `rgb(${a.map((v, i) => Math.round(lerp(v, b[i], t))).join(',')})`;
  };

  function play(container, done) {
    host = container; onDone = done;
    s = { phase: 0, t0: performance.now(), tonHits: 0, flash: 0, shaka: 0, awa: 0, lastT: 0, lastDir: 0,
          whisk: 0, whiskTo: 0, good: 0, bad: 0, msg: '', msgKind: '', bubbles: [], noT: 0, finished: false };
    host.innerHTML = `
      <div class="game-box">
        <div class="game-head"><span class="game-title"></span><button class="btn ghost game-skip">ミニゲームを飛ばす</button></div>
        <p class="game-text"></p>
        <canvas class="game-cv" width="${SIZE * 2}" height="${SIZE * 2}"></canvas>
        <div class="game-bar"><div class="game-fill"></div></div>
        <div class="game-msg"></div>
        <div class="game-btns">
          <button class="btn game-up">奥 ↑</button>
          <button class="btn game-down">手前 ↓</button>
          <button class="btn game-tap">トン（スペース）</button>
        </div>
      </div>`;
    host.hidden = false;
    cv = host.querySelector('.game-cv'); g = cv.getContext('2d');
    g.setTransform(2, 0, 0, 2, 0, 0);
    host.querySelector('.game-skip').addEventListener('click', () => finish(true));
    host.querySelector('.game-up').addEventListener('click', () => stroke(1));
    host.querySelector('.game-down').addEventListener('click', () => stroke(-1));
    host.querySelector('.game-tap').addEventListener('click', tap);
    cv.addEventListener('click', tap);
    window.addEventListener('keydown', onKey);
    showPhase();
    raf = requestAnimationFrame(loop);
  }

  function stop() {
    cancelAnimationFrame(raf);
    window.removeEventListener('keydown', onKey);
    if (host) { host.hidden = true; host.innerHTML = ''; }
    s = null;
  }

  function onKey(e) {
    if (!s) return;
    if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); tap(); }
    else if (e.code === 'ArrowUp' || e.code === 'KeyW') { e.preventDefault(); stroke(1); }
    else if (e.code === 'ArrowDown' || e.code === 'KeyS') { e.preventDefault(); stroke(-1); }
  }

  const ph = () => PHASES[s.phase].id;
  function say(msg, kind) { s.msg = msg; s.msgKind = kind; }

  function showPhase() {
    const p = PHASES[s.phase];
    host.querySelector('.game-title').textContent = p.title;
    host.querySelector('.game-text').textContent = p.text;
    const stroke = p.id === 'shaka' || p.id === 'awa';
    host.querySelector('.game-up').hidden = !stroke;
    host.querySelector('.game-down').hidden = !stroke;
    const tapBtn = host.querySelector('.game-tap');
    tapBtn.hidden = stroke;
    tapBtn.textContent = p.id === 'no' ? '「の」の字を書く（スペース）' : 'トン（スペース）';
    s.t0 = performance.now(); s.lastT = 0; s.lastDir = 0;
    say('', '');
  }

  function next() {
    s.phase++;
    if (s.phase >= PHASES.length) finish(false); else showPhase();
  }

  // スペース・クリック
  function tap() {
    if (!s || s.finished) return;
    const now = performance.now();
    if (ph() === 'ton') {
      const k = ((now - s.t0) % BEAT) / BEAT;            // 0 で縁に重なる
      const off = Math.min(k, 1 - k) * BEAT;
      if (off < 170) {
        s.tonHits++; s.good++; s.flash = 1; s.whisk = -18;
        say(['トン', 'トン', 'トン！ 抹茶が浮いてきました'][Math.min(2, s.tonHits - 1)], 'good');
        if (s.tonHits >= 3) setTimeout(next, 700);
      } else {
        s.bad++;
        say(k < 0.5 ? '少し遅い。輪が縁に重なる瞬間に' : '少し早い。輪が縁に重なるのを待って', 'miss');
      }
    } else if (ph() === 'no') {
      if (!s.noT) { s.noT = now; say('「の」の字を書いて、静かに引き上げます', 'good'); setTimeout(next, 1500); }
    }
  }

  // 奥・手前（dir: 1 = 奥、-1 = 手前）
  function stroke(dir) {
    if (!s || s.finished) return;
    const id = ph();
    if (id !== 'shaka' && id !== 'awa') return;
    const now = performance.now(), dt = s.lastT ? now - s.lastT : 9999;
    s.whiskTo = dir;
    if (dir === s.lastDir) { s.bad++; say('奥・手前を交互に', 'miss'); s.lastT = now; return; }
    s.lastDir = dir; s.lastT = now;
    if (id === 'shaka') {
      let gain;
      if (dt < 70)       { gain = 0.3; s.bad++;  say('速すぎ。手首だけで雑になっています', 'miss'); }
      else if (dt < 200) { gain = 1;   s.good++; say('いい調子！ シャカシャカ', 'good'); }
      else if (dt < 360) { gain = 0.4;           say('もう少し速く', 'warn'); }
      else               { gain = 0.1; s.bad++;  say('遅い。すばやく一定のリズムで', 'miss'); }
      s.shaka = Math.min(SHAKA_GOAL, s.shaka + gain);
      for (let i = 0; i < 3; i++) addBubble(gain);
      if (s.shaka >= SHAKA_GOAL) { say('黄緑色になりました。次は泡を整えます', 'good'); s.lastDir = 0; setTimeout(next, 800); }
    } else {
      if (dt < 300) { s.bad++; say('速い。上の方だけを、ゆっくり大きく', 'miss'); return; }
      if (dt > 1500 && s.awa > 0) { say('止まらずに、ゆっくり続けて', 'warn'); }
      s.awa++; s.good++;
      say(`ゆっくり… 大きな泡が消えていきます（${s.awa} / ${AWA_GOAL}）`, 'good');
      s.bubbles.forEach(b => { if (b.r > 3) b.r *= 0.7; });
      if (s.awa >= AWA_GOAL) { s.lastDir = 0; setTimeout(next, 600); }
    }
  }

  function addBubble(gain) {
    if (s.bubbles.length > 260) s.bubbles.shift();
    const a = rnd(0, Math.PI * 2), d = Math.sqrt(Math.random()) * 92;
    const big = Math.random() < 0.35 * (1 - s.shaka / SHAKA_GOAL) + (gain < 1 ? 0.3 : 0);
    s.bubbles.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, r: big ? rnd(3.5, 7) : rnd(1, 2.4) });
  }

  function finish(skipped) {
    if (!s || s.finished) return;
    s.finished = true;
    const total = s.good + s.bad, ratio = total ? s.good / total : 1;
    const result = skipped
      ? { skipped: true, message: 'ミニゲームを飛ばしました。お茶が点ちました。' }
      : { skipped: false, ratio,
          message: ratio >= 0.8 ? '見事な点前です！ きめ細かい泡が立ちました。'
                 : ratio >= 0.55 ? 'よく点てられました。'
                 : 'お茶が点ちました。次はリズムを意識してみましょう。' };
    const cb = onDone;
    setTimeout(() => { stop(); if (cb) cb(result); }, skipped ? 0 : 400);
  }

  // ---- 描く ----
  function loop(now) {
    if (!s) return;
    draw(now);
    raf = requestAnimationFrame(loop);
  }

  function draw(now) {
    const c = SIZE / 2, R = 120, TEA = 100;
    const id = ph();
    g.clearRect(0, 0, SIZE, SIZE);
    // 茶碗（上から）
    g.fillStyle = '#5e4224'; g.beginPath(); g.arc(c, c, R + 8, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#a07a48'; g.beginPath(); g.arc(c, c, R + 4, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#c4a068'; g.beginPath(); g.arc(c, c, R, 0, Math.PI * 2); g.fill();
    // お茶の色：深い緑 → 黄緑
    const prog = s.shaka / SHAKA_GOAL;
    const base = id === 'ton' ? mix('#2c3f14', '#3d5a1e', s.tonHits / 3) : mix('#3d5a1e', '#9cc04e', prog);
    g.fillStyle = base; g.beginPath(); g.arc(c, c, TEA, 0, Math.PI * 2); g.fill();
    if (id === 'ton') {                                   // 底に沈んだ粉
      g.fillStyle = 'rgba(30,45,12,0.6)';
      for (let i = 0; i < 18 - s.tonHits * 5; i++) { g.beginPath(); g.arc(c + Math.sin(i * 7.3) * 50, c + Math.cos(i * 3.1) * 50, 6, 0, Math.PI * 2); g.fill(); }
    }
    // 泡
    g.save(); g.beginPath(); g.arc(c, c, TEA, 0, Math.PI * 2); g.clip();
    if (prog > 0.2) { g.fillStyle = `rgba(220,235,170,${Math.min(0.55, (prog - 0.2) * 0.8)})`; g.fillRect(0, 0, SIZE, SIZE); }
    s.bubbles.forEach(b => {
      g.fillStyle = 'rgba(235,245,200,0.75)'; g.beginPath(); g.arc(c + b.x, c + b.y, b.r, 0, Math.PI * 2); g.fill();
      if (b.r > 3) { g.strokeStyle = 'rgba(120,150,60,0.6)'; g.lineWidth = 0.8; g.stroke(); }
    });
    g.restore();
    // トントンの輪
    if (id === 'ton') {
      const k = ((now - s.t0) % BEAT) / BEAT;
      const r = lerp(R + 70, R + 2, k);
      g.strokeStyle = `rgba(255,214,120,${0.4 + 0.6 * k})`; g.lineWidth = 4;
      g.beginPath(); g.arc(c, c, r, 0, Math.PI * 2); g.stroke();
    }
    if (s.flash > 0) {
      g.strokeStyle = `rgba(255,240,180,${s.flash})`; g.lineWidth = 6;
      g.beginPath(); g.arc(c, c, R + 6, 0, Math.PI * 2); g.stroke();
      s.flash = Math.max(0, s.flash - 0.05);
    }
    // 茶筅（上から見た穂先の輪）。奥・手前に動く
    s.whisk = lerp(s.whisk, s.whiskTo * (id === 'awa' ? 22 : 40), 0.35);
    if (id === 'ton') s.whiskTo = 0;
    let wx = c, wy = c - s.whisk;
    if (id === 'no' && s.noT) {                             // 「の」の字の軌跡
      const t = Math.min(1, (now - s.noT) / 1200), a = t * Math.PI * 3.2;
      const rr = lerp(10, 55, t);
      wx = c + Math.sin(a) * rr; wy = c - Math.cos(a) * rr * 0.9 - t * 20;
    }
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.beginPath(); g.arc(wx + 4, wy + 5, 26, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#e6dcc0'; g.beginPath(); g.arc(wx, wy, 26, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#cfc29c'; g.lineWidth = 1;
    for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; g.beginPath(); g.moveTo(wx + Math.cos(a) * 9, wy + Math.sin(a) * 9); g.lineTo(wx + Math.cos(a) * 25, wy + Math.sin(a) * 25); g.stroke(); }
    g.fillStyle = '#2a2010'; g.beginPath(); g.arc(wx, wy, 9, 0, Math.PI * 2); g.fill();     // 糸
    g.fillStyle = '#c9a96c'; g.beginPath(); g.arc(wx, wy, 6, 0, Math.PI * 2); g.fill();     // 柄

    // 進み具合とメッセージ
    const fill = id === 'ton' ? s.tonHits / 3 : id === 'shaka' ? prog : id === 'awa' ? s.awa / AWA_GOAL : (s.noT ? 1 : 0);
    host.querySelector('.game-fill').style.width = `${Math.round(fill * 100)}%`;
    const m = host.querySelector('.game-msg');
    if (m.textContent !== s.msg) { m.textContent = s.msg; m.className = 'game-msg ' + s.msgKind; }
  }

  return { play, stop };
})();
