/*
 * お点前モード（ガイド付き練習・本番）
 * ・ふつうの手順：正しい道具（または場所）をクリックすると、道具が動いて次へ進む。
 * ・三択の手順（type: quiz）：所作や決まりごとを3つの選択肢から選ぶ。
 * ・文字の手順（type: banner）：「お点前開始！」などを大きく出して、自動で次へ進む。
 */
const Temae = (() => {
  let tools = [], panel, bar, finishEl, bannerEl;
  let tm = null, mode = 'guide';
  let idx = 0, mistakes = 0, answers = 0, startAt = 0, busy = false, done = false;
  let order = null, orderFor = -1, wrongPicks = [], showCorrect = false;
  let gameFor = -1;                  // ミニゲームを始めた手順の番号
  let jumped = false, jumpOpen = false;   // 練習用の「手順へ飛ぶ」

  // 「手順へ飛ぶ」の鍵（data/settings.js の jumpPassword）。開けたら、このタブを閉じるまで覚えておく
  const jumpPassword = () => String((window.SETTINGS || {}).jumpPassword || '');
  function jumpUnlocked() {
    if (!jumpPassword()) return true;
    try { return sessionStorage.getItem('sado-jump') === '1'; } catch (e) { return unlockedHere; }
  }
  let unlockedHere = false;
  function unlockJump() {
    unlockedHere = true;
    try { sessionStorage.setItem('sado-jump', '1'); } catch (e) { /* 覚えられなくても、この画面では使える */ }
  }
  const text = s => Zukan.text(s);

  function init(toolList, els) { tools = toolList; ({ panel, bar, finishEl, bannerEl } = els); }
  const steps = () => (tm && Array.isArray(tm.steps) ? tm.steps : []);
  const step = () => steps()[idx];
  const toolName = id => (tools.find(t => t.id === id) || { name: id }).name;
  const isQuiz = st => st && st.type === 'quiz';
  const isGame = st => st && st.type === 'game';
  const gameEl = () => document.getElementById('game-area');

  // 選択肢を混ぜる（同じ手順のあいだは同じ並び）
  function choicesOf(st) {
    if (orderFor !== idx) {
      order = (st.choices || []).slice().sort(() => Math.random() - 0.5);
      orderFor = idx; wrongPicks = []; showCorrect = false;
    }
    return order;
  }

  function start(temae, m) {
    tm = temae; mode = m;
    idx = 0; mistakes = 0; answers = 0; busy = false; done = false; startAt = Date.now(); orderFor = -1; gameFor = -1; jumped = false;
    finishEl.hidden = true; bannerEl.hidden = true;
    if (typeof ChasenGame !== 'undefined') ChasenGame.stop();
    ViewTop.setRoom(tm.room || {});
    Scene.load(tools, tm.places, tm.setup);
    Views.setHostCamera(tm.hostCamera || { x0: 4, x1: 144, far: -14, near: 165 });
    Views.select(null);
    Views.onClick(onClick);
    bar.hidden = false;
    showStep();
  }

  function stop() { bar.hidden = true; finishEl.hidden = true; bannerEl.hidden = true; tm = null; ViewTop.setRoom(); ViewHost.invalidate(); if (typeof ChasenGame !== 'undefined') ChasenGame.stop(); }

  // 画面上部の帯と、右のパネル
  function showStep(message) {
    const st = step();
    if (!st) return;
    if (st.type === 'banner') { playBanner(st); return; }
    Views.showAnswer(null);
    if (st.view) Views.setMain(st.view === 'host' ? 'host' : 'top');
    const n = `${idx + 1} / ${steps().length}`;
    const quiz = isQuiz(st);
    bar.innerHTML = mode === 'guide' || quiz
      ? `<span class="num">手順 ${n}${quiz ? '・所作の問題' : ''}</span><span class="name">${text(st.name)}</span>`
      : `<span class="num">手順 ${n}</span><span class="name muted">次の動作は何でしょう？</span>`;

    let body;
    const game = isGame(st);
    if (game) {
      body = `
        <div class="step-card">
          <div class="step-num">手順 ${n}・ミニゲーム</div>
          <div class="step-name">${text(st.name)}</div>
          <p>${text(st.description || '')}</p>
        </div>`;
    } else if (quiz) {
      body = `
        <div class="step-card quiz-card">
          <div class="step-num">手順 ${n}・三択</div>
          <div class="q-text">${text(st.question)}</div>
          <div class="choices">${choicesOf(st).map((c, i) => `<button class="choice${wrongPicks.includes(c) ? ' wrong' : ''}${showCorrect && c === st.answer ? ' hint' : ''}" data-i="${i}"${wrongPicks.includes(c) ? ' disabled' : ''}>${text(c)}</button>`).join('')}</div>
        </div>`;
    } else if (mode === 'guide') {
      body = `
        <div class="step-card">
          <div class="step-num">手順 ${n}</div>
          <div class="step-name">${text(st.name)}</div>
          <p>${text(st.description)}</p>
        </div>`;
    } else {
      body = `<div class="step-card"><div class="step-num">手順 ${n}</div><p>正しい道具をクリックしてください。</p></div>`;
    }
    panel.innerHTML = `
      <div class="temae-panel">
        <h2>${text(tm.title)}<small>${mode === 'guide' ? 'ガイド付き練習' : '本番'}</small></h2>
        ${body}
        <div class="message ${message ? message.kind : ''}">${message ? message.html : ''}</div>
        ${mode === 'guide' && !game ? '<button id="answer-btn" class="btn">次は何をしますか？</button>' : ''}
        <div class="score">間違えた回数：<b>${mistakes}</b>　${mode === 'guide' ? `答えを見た回数：<b>${answers}</b>` : ''}</div>
        <button id="restart-btn" class="btn ghost">最初からやり直す</button>
        ${jumpHtml()}
        <p class="small">右下の小窓をクリックすると、上から／亭主の目線を入れ替えられます。</p>
      </div>`;
    bindJump();
    panel.querySelectorAll('.choice').forEach(b => b.addEventListener('click', () => pick(order[+b.dataset.i])));
    const ab = panel.querySelector('#answer-btn');
    if (ab) ab.addEventListener('click', showAnswer);
    panel.querySelector('#restart-btn').addEventListener('click', () => start(tm, mode));
    if (game && !busy && gameFor !== idx) { gameFor = idx; startGame(st); }   // 直前の三択の説明が出ていても、ゲームは1回だけ始める
  }

  // ---- 練習用：手順へ飛ぶ ----
  function stepLabel(s, i) {
    const name = s.type === 'banner' ? `「${s.text}」` : s.name || s.id;
    return `${i + 1}. ${name}${s.type === 'quiz' ? '（三択）' : s.type === 'game' ? '（ミニゲーム）' : ''}`;
  }
  function jumpHtml() {
    if (!jumpOpen) return '<button id="jump-open" class="btn ghost jump-open">手順へ飛ぶ（練習用）</button>';
    if (!jumpUnlocked()) return `
      <div class="jump-box">
        <label>パスワード <input id="jump-pass" type="password" autocomplete="off"></label>
        <button id="jump-unlock" class="btn">開く</button>
        <span id="jump-err" class="jump-err"></span>
      </div>`;
    return `
      <div class="jump-box">
        <select id="jump-select">${steps().map((s, i) => `<option value="${i}"${i === idx ? ' selected' : ''}>${text(stepLabel(s, i))}</option>`).join('')}</select>
        <button id="jump-go" class="btn">飛ぶ</button>
      </div>`;
  }
  function bindJump() {
    const q = sel => panel.querySelector(sel);
    if (q('#jump-open')) q('#jump-open').addEventListener('click', () => { jumpOpen = true; showStep(); });
    if (q('#jump-unlock')) {
      const tryOpen = () => {
        if (q('#jump-pass').value === jumpPassword()) { unlockJump(); showStep(); }
        else { q('#jump-err').textContent = 'パスワードが違います'; q('#jump-pass').select(); }
      };
      q('#jump-unlock').addEventListener('click', tryOpen);
      q('#jump-pass').addEventListener('keydown', e => { if (e.key === 'Enter') tryOpen(); });
      q('#jump-pass').focus();
    }
    if (q('#jump-go')) q('#jump-go').addEventListener('click', () => jumpTo(+q('#jump-select').value));
  }

  // 手順 n から始める。それより前の手順の道具の動きは、一瞬で済ませておく
  async function jumpTo(n) {
    if (busy || !tm || n < 0 || n >= steps().length) return;
    busy = true;
    if (typeof ChasenGame !== 'undefined') ChasenGame.stop();
    finishEl.hidden = true; bannerEl.hidden = true; done = false;
    Views.showAnswer(null);
    Scene.load(tools, tm.places, tm.setup);
    Scene.setInstant(true);
    try {
      for (let i = 0; i < n; i++) {
        const st = steps()[i], tg = targetOf(st);
        if (st.moveTo && tg.tool && !isQuiz(st)) await Scene.move(tg.tool, st.moveTo);
        await Scene.runEffects(st.effects);
      }
    } finally { Scene.setInstant(false); }
    idx = n; orderFor = -1; gameFor = -1; jumped = true; busy = false;
    showStep({ kind: 'answer', html: `手順 ${n + 1} へ飛びました（練習用）。` });
  }

  // ミニゲームの手順：遊び終わったら（または飛ばしたら）次へ進む
  function startGame(st) {
    const el = gameEl();
    if (!el || typeof ChasenGame === 'undefined') { advance({ kind: 'good', html: 'お茶が点ちました。' }); return; }
    Views.setMain('top');
    ChasenGame.play(el, result => advance({ kind: 'good', html: text(result.message) }));
  }

  function targetOf(st) {
    const t = String(st.target || '');
    return t.startsWith('place:') ? { place: t.slice(6) } : { tool: t };
  }

  function showAnswer() {
    const st = step();
    if (!st || busy) return;
    answers++;
    if (isQuiz(st)) {
      showCorrect = true;
      showStep({ kind: 'answer', html: `答え：「${text(st.answer)}」` });
      return;
    }
    const tg = targetOf(st);
    const what = tg.place
      ? `「${text((tm.places[tg.place] || {}).label || tg.place)}」の場所`
      : `「${text(toolName(tg.tool))}」`;
    showStep({ kind: 'answer', html: `答え：${what}をクリックします。<br>${text(st.name)}` });
    Views.showAnswer(tg.tool || null, tg.place || null);
  }

  // 三択で選んだとき
  function pick(choice) {
    const st = step();
    if (busy || done || !isQuiz(st)) return;
    if (choice === st.answer) {
      advance({ kind: 'good', html: `正解！　${text(st.explain || '')}` });
    } else {
      mistakes++;
      wrongPicks.push(choice);
      const html = mode === 'guide'
        ? `「${text(choice)}」ではないようです。${st.hint ? `<br>ヒント：${text(st.hint)}` : '<br>もう一度考えてみましょう。'}`
        : `「${text(choice)}」ではないようです。`;
      showStep({ kind: 'miss', html });
      shake();
    }
  }

  // 畳の上をクリックしたとき
  function onClick(tool, world) {
    const st = step();
    if (busy || done || !st || isQuiz(st) || isGame(st) || st.type === 'banner') return;
    const tg = targetOf(st);
    const ok = tg.place ? Scene.nearPlace(tg.place, world, 18) || (tool && tool.id === 'teishu' && Scene.nearPlace(tg.place, Scene.pos(Scene.item('teishu')), 18))
                        : tool && (tool.id === tg.tool || (st.alsoOk || []).includes(tool.id));   // alsoOk の道具を押しても正解
    if (ok) advance({ kind: 'good', html: 'よくできました。' });
    else if (tool || tg.place) miss(tool);
  }

  async function advance(message) {
    const st = step();
    busy = true;
    Views.showAnswer(null);
    bar.classList.add('ok');
    if (isQuiz(st)) showStep(message);              // 正解の説明を見せながら動かす
    const tg = targetOf(st);
    if (st.moveTo && tg.tool && !isQuiz(st)) await Scene.move(tg.tool, st.moveTo);
    await Scene.runEffects(st.effects);
    if (isQuiz(st)) await new Promise(r => setTimeout(r, 900));
    bar.classList.remove('ok');
    idx++;
    busy = false;
    if (idx >= steps().length) finish();
    else showStep(message);
  }

  function miss(tool) {
    mistakes++;
    const st = step();
    const what = tool ? `「${text(tool.name)}」ではないようです。` : 'そこではないようです。';
    const html = mode === 'guide' ? `${what}<br>ヒント：${text(st.hint || '説明をもう一度読んでみましょう。')}` : what;
    showStep({ kind: 'miss', html });
    shake();
  }
  function shake() { bar.classList.remove('shake'); void bar.offsetWidth; bar.classList.add('shake'); }

  // 「お点前開始！」などを大きく出して、次へ進む
  function playBanner(st) {
    busy = true;
    bar.innerHTML = `<span class="name">${text(st.text)}</span>`;
    bannerEl.innerHTML = `<div class="banner-text">${text(st.text)}</div>`;
    bannerEl.hidden = false;
    setTimeout(() => {
      bannerEl.hidden = true;
      busy = false;
      idx++;
      if (idx >= steps().length) finish(); else showStep();
    }, 1600);
  }

  function finish() {
    done = true;
    const sec = Math.round((Date.now() - startAt) / 1000);
    const title = tm.finishTitle || 'お点前終了';
    bar.innerHTML = `<span class="name">${text(title)}</span>`;
    finishEl.innerHTML = `
      <div class="finish-card">
        <div class="finish-title">${text(title)}</div>
        ${tm.finishMessage ? `<div class="finish-sub">${text(tm.finishMessage)}</div>` : ''}
        <p>${text(tm.title)}（${mode === 'guide' ? 'ガイド付き練習' : '本番'}${jumped ? '・途中から' : ''}）</p>
        <dl>
          <dt>間違えた回数</dt><dd>${mistakes} 回</dd>
          ${mode === 'guide' ? `<dt>答えを見た回数</dt><dd>${answers} 回</dd>` : ''}
          <dt>かかった時間</dt><dd>${Math.floor(sec / 60)} 分 ${sec % 60} 秒</dd>
        </dl>
        <p class="finish-msg">${mistakes === 0 ? '一度も間違えずにできました。' : 'おつかれさまでした。もう一度やってみましょう。'}</p>
        <button class="btn" id="again-btn">もう一度</button>
      </div>`;
    finishEl.hidden = false;
    finishEl.querySelector('#again-btn').addEventListener('click', () => start(tm, mode));
    panel.innerHTML = `<div class="temae-panel"><h2>${text(tm.title)}</h2><p>おつかれさまでした。</p></div>`;
  }

  return { init, start, stop };
})();
