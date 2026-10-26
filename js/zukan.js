/*
 * 図鑑モード：道具をクリックすると、名前・読み仮名・役割・扱い方を表示します。
 */
const Zukan = (() => {
  let tools = [];
  let panel;

  // 文字をそのまま表示できる形にし、「要確認」に印をつける
  function text(s) {
    const esc = String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    return esc.replace(/要確認/g, '<mark>要確認</mark>');
  }

  function init(toolList, panelEl) { tools = toolList; panel = panelEl; }

  function enter() {
    Scene.loadZukan(tools);
    Views.setHostCamera({ x0: 0, x1: 320, far: -14, near: 250 });
    Views.setMain('top');
    Views.showAnswer(null);
    Views.onClick(tool => { if (tool) show(tool); });
    panel.innerHTML = '<div id="tool-detail"></div><div id="tool-list"></div>';
    buildList();
    showIntro();
  }

  function showIntro() {
    Views.select(null);
    markList(null);
    panel.querySelector('#tool-detail').innerHTML = `
      <div class="intro">
        <h2>図鑑</h2>
        <p>畳の上の道具をクリックすると、名前と説明が出ます。下の一覧から選ぶこともできます。</p>
        <p class="small">大きい画面は上から見た畳（亭主が下、向こうが上）、右下の小窓は亭主の目線です。小窓をクリックすると入れ替わります。<br>図鑑での道具の位置は data/tools.js の pos で直せます。</p>
      </div>`;
  }

  // 見本の絵を拡大して canvas にする
  function enlarged(src, maxW, maxH) {
    const c = document.createElement('canvas');
    c.width = src.width; c.height = src.height;
    c.getContext('2d').drawImage(src, 0, 0);
    const k = Math.max(1, Math.floor(Math.min(maxW / src.width, maxH / src.height)));
    c.style.width = src.width * k + 'px'; c.style.height = src.height * k + 'px';
    return c;
  }

  function show(tool) {
    Views.select(tool.id);
    markList(tool.id);
    const photo = ViewTop.photo(tool.id);
    const box = panel.querySelector('#tool-detail');
    box.innerHTML = `
      <div class="previews"><figure class="p-top"></figure><figure class="p-host"></figure></div>
      <h2 class="tool-name"><ruby>${text(tool.name)}<rt>${text(tool.yomi)}</rt></ruby></h2>
      ${tool.category ? `<p class="category">${text(tool.category)}</p>` : ''}
      <h3>役割</h3>
      <p>${text(tool.role) || '（説明がまだありません）'}</p>
      <h3>扱い方</h3>
      <p>${text(tool.howto) || '（説明がまだありません）'}</p>
      <p class="source">${photo ? `写真：${text(tool.image)}` : `ドット絵で表示中${tool.image ? `（写真を使うときは ${text(tool.image)} に置いてください）` : ''}`}</p>`;

    const name = tool.sprite || tool.id;
    const ft = box.querySelector('.p-top');
    if (photo) { const img = document.createElement('img'); img.src = photo.src; ft.appendChild(img); }
    else ft.appendChild(enlarged(PixelArt.transform(PixelArt.sprite(name, tool.state), 'r270'), 130, 130));
    ft.insertAdjacentHTML('beforeend', '<figcaption>上から</figcaption>');
    const fh = box.querySelector('.p-host');
    const hostName = name === 'hishaku' ? 'hishaku_yoko' : name;
    if (PixelArtSide.has(hostName) && tool.id !== 'teishu') {
      fh.appendChild(enlarged(PixelArtSide.sprite(hostName, tool.state), 130, 130));
      fh.insertAdjacentHTML('beforeend', '<figcaption>亭主の目線</figcaption>');
    } else fh.remove();
  }

  // 分類ごとの道具一覧ボタン
  function buildList() {
    const list = panel.querySelector('#tool-list');
    const groups = {};
    tools.forEach(t => { (groups[t.category || 'その他'] = groups[t.category || 'その他'] || []).push(t); });
    list.innerHTML = '<h3>道具の一覧</h3>' + Object.keys(groups).map(g => `
      <div class="group"><div class="group-name">${text(g)}</div>
        ${groups[g].map(t => `<button data-id="${text(t.id)}">${text(t.name)}</button>`).join('')}
      </div>`).join('');
    list.querySelectorAll('button').forEach(b => {
      b.addEventListener('click', () => show(tools.find(t => t.id === b.dataset.id)));
    });
  }

  function markList(id) {
    panel.querySelectorAll('#tool-list button').forEach(b => b.classList.toggle('active', b.dataset.id === id));
  }

  return { init, enter, show, text };
})();
