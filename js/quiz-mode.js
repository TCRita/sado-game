/*
 * 三択モード：所作や決まりごとの三択問題を、くり返し解く
 * ・問題は、お点前データの三択の手順（type: quiz）と、data/quiz.js の問題集から集める
 * ・間違えた問題は、少しあとにもう一度出る
 */
const QuizMode = (() => {
  let area, panel;
  let pool = [], queue = [], cur = null, order = [], answered = false;
  let stats = { right: 0, wrong: 0, streak: 0, best: 0 };
  const misses = {};          // 問題id → 間違えた回数
  let filter = 'all';
  const text = s => Zukan.text(s);

  function init(els) { ({ area, panel } = els); }

  // 問題を集める
  function collect() {
    const list = [];
    DataStore.temaeList.forEach(tm => (tm.steps || []).forEach(st => {
      if (st.type === 'quiz') list.push(Object.assign({ category: tm.title }, st, { _key: `${tm.id}/${st.id}` }));
    }));
    (DataStore.quiz || []).forEach(q => list.push(Object.assign({}, q, { _key: `quiz/${q.id || q.question}` })));
    return list.filter(q => Array.isArray(q.choices) && q.choices.includes(q.answer));
  }
  const shuffle = a => a.map(v => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(v => v[1]);
  const filtered = () => filter === 'all' ? pool : filter === 'nigate' ? pool.filter(q => misses[q._key]) : pool.filter(q => q.category === filter);

  function enter() {
    pool = collect();
    queue = [];
    area.hidden = false;
    next();
  }
  function leave() { area.hidden = true; }

  function next() {
    if (!queue.length) queue = shuffle(filtered());
    cur = queue.shift() || null;
    order = cur ? shuffle(cur.choices) : [];
    answered = false;
    render();
  }

  function pick(choice) {
    if (answered || !cur) return;
    answered = choice;
    if (choice === cur.answer) {
      stats.right++; stats.streak++; stats.best = Math.max(stats.best, stats.streak);
    } else {
      stats.wrong++; stats.streak = 0;
      misses[cur._key] = (misses[cur._key] || 0) + 1;
      queue.splice(Math.min(3, queue.length), 0, cur);   // 間違えた問題は少しあとにもう一度
    }
    render();
  }

  function render() {
    if (!cur) {
      area.innerHTML = `<div class="quiz-box"><p>${filter === 'nigate' ? 'まだ間違えた問題はありません。' : '問題がありません。'}</p></div>`;
    } else {
      const ok = answered && answered === cur.answer;
      area.innerHTML = `
        <div class="quiz-box">
          <div class="q-cat">${text(cur.category || '')}${cur.name ? `・${text(cur.name)}` : ''}</div>
          <div class="q-text big">${text(cur.question)}</div>
          <div class="choices big">${order.map((c, i) => {
            let cls = 'choice';
            if (answered) cls += c === cur.answer ? ' right' : c === answered ? ' wrong' : ' dim';
            return `<button class="${cls}" data-i="${i}"${answered ? ' disabled' : ''}><span class="no">${'ABC'[i] || i + 1}</span>${text(c)}</button>`;
          }).join('')}</div>
          ${answered ? `
            <div class="q-result ${ok ? 'good' : 'miss'}">${ok ? '正解！' : `ざんねん。正解は「${text(cur.answer)}」`}</div>
            ${cur.explain ? `<p class="q-explain">${text(cur.explain)}</p>` : ''}
            <button class="btn" id="next-q">次の問題へ</button>` : ''}
        </div>`;
      area.querySelectorAll('.choice').forEach(b => b.addEventListener('click', () => pick(order[+b.dataset.i])));
      const nb = area.querySelector('#next-q');
      if (nb) { nb.addEventListener('click', next); nb.focus(); }
    }
    renderPanel();
  }

  function renderPanel() {
    const total = stats.right + stats.wrong;
    const cats = [...new Set(pool.map(q => q.category).filter(Boolean))];
    const nigate = pool.filter(q => misses[q._key]).sort((a, b) => misses[b._key] - misses[a._key]);
    panel.innerHTML = `
      <div class="temae-panel">
        <h2>三択<small>くり返し練習</small></h2>
        <div class="stat-grid">
          <div><span>正解</span><b>${stats.right}</b></div>
          <div><span>不正解</span><b>${stats.wrong}</b></div>
          <div><span>正答率</span><b>${total ? Math.round(stats.right / total * 100) : 0}%</b></div>
          <div><span>連続正解</span><b>${stats.streak}</b></div>
        </div>
        <p class="small">最高連続正解：${stats.best}　問題数：${pool.length}</p>
        <h3 class="side-h">出題する問題</h3>
        <select id="q-filter" class="q-filter">
          <option value="all">すべて</option>
          ${cats.map(c => `<option value="${text(c)}"${filter === c ? ' selected' : ''}>${text(c)}</option>`).join('')}
          <option value="nigate"${filter === 'nigate' ? ' selected' : ''}>苦手な問題だけ</option>
        </select>
        ${nigate.length ? `<h3 class="side-h">苦手な問題</h3><ul class="nigate">${nigate.slice(0, 8).map(q => `<li>${text(q.name || q.question)}<span>×${misses[q._key]}</span></li>`).join('')}</ul>` : ''}
        <p class="small">間違えた問題は、少しあとにもう一度出ます。問題は data/quiz.js と、お点前データの三択の手順から集めています。</p>
      </div>`;
    const sel = panel.querySelector('#q-filter');
    if (filter === 'all') sel.value = 'all';
    sel.addEventListener('change', () => { filter = sel.value; queue = []; next(); });
  }

  return { init, enter, leave };
})();
