/*
 * お道具の美術館のページを組み立てる
 * 展示の説明は data/museum.js、絵は js/pixel-art.js と js/pixel-art-side.js から取る。
 */
(function () {
  const $ = id => document.getElementById(id);
  const text = s => String(s == null ? '' : s)
    .replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
    .replace(/要確認/g, '<mark>要確認</mark>');

  // 絵を拡大した canvas（くっきり見えるよう整数倍）
  function enlarged(src, maxW, maxH) {
    const c = document.createElement('canvas');
    c.width = src.width; c.height = src.height;
    c.getContext('2d').drawImage(src, 0, 0);
    const k = Math.max(1, Math.floor(Math.min(maxW / src.width, maxH / src.height)));
    c.style.width = src.width * k + 'px'; c.style.height = src.height * k + 'px';
    return c;
  }

  // 展示品の絵：上から（亭主が下の向き）と、亭主の目線
  function arts(ex, tool) {
    const name = ex.sprite || tool.sprite || tool.id;
    const out = [{ label: '上から', c: PixelArt.transform(PixelArt.sprite(name, ex.state), 'r270') }];
    const hostName = ex.host || (name === 'hishaku' ? 'hishaku_yoko' : name);
    if (PixelArtSide.has(hostName)) out.push({ label: '亭主の目線', c: PixelArtSide.sprite(hostName, ex.state) });
    return out;
  }

  function openDetail(ex, tool) {
    const d = $('detail');
    d.innerHTML = `
      <button class="d-close" aria-label="閉じる">×</button>
      <div class="d-wrap">
        <div class="d-art"></div>
        <div class="d-text">
          <h2>${text(ex.title || tool.name)}</h2>
          <div class="yomi">${text(tool.yomi)}</div>
          ${tool.category ? `<span class="cat">${text(tool.category)}</span>` : ''}
          <h3>モチーフ</h3><p>${text(ex.motif)}</p>
          ${ex.keiko ? `<h3>お稽古用の品について</h3><p>${text(ex.keiko)}</p>` : ''}
          ${ex.urasenke ? `<h3>裏千家では</h3><p>${text(ex.urasenke)}</p>` : ''}
          <h3>役割</h3><p>${text(tool.role)}</p>
          ${ex.note ? `<h3>豆知識</h3><p>${text(ex.note)}</p>` : ''}
        </div>
      </div>`;
    const art = d.querySelector('.d-art');
    arts(ex, tool).forEach(a => {
      const f = document.createElement('figure');
      f.appendChild(enlarged(a.c, 230, 200));
      f.insertAdjacentHTML('beforeend', `<figcaption>${a.label}</figcaption>`);
      art.appendChild(f);
    });
    d.querySelector('.d-close').addEventListener('click', () => d.close());
    d.addEventListener('click', e => { if (e.target === d) d.close(); });
    d.showModal();
  }

  function renderRoom(room, tools) {
    const sec = document.createElement('section');
    sec.className = 'room';
    sec.innerHTML = `<h2>${text(room.name)}</h2><p class="intro">${text(room.intro)}</p><div class="gallery"></div>`;
    const g = sec.querySelector('.gallery');
    (room.exhibits || []).forEach(ex => {
      const tool = tools.find(t => t.id === ex.tool);
      if (!tool) { g.insertAdjacentHTML('beforeend', `<p>道具「${text(ex.tool)}」が data/tools.js にありません。</p>`); return; }
      const el = document.createElement('div');
      el.className = 'exhibit';
      el.innerHTML = `<div class="spot"><div class="frame"></div></div>
        <div class="plate"><span class="name">${text(ex.title || tool.name)}</span><span class="yomi">${text(tool.yomi)}</span>
        <div class="motif">${text(ex.motif)}</div></div>`;
      const fr = el.querySelector('.frame');
      const list = arts(ex, tool);
      list.forEach(a => fr.appendChild(enlarged(a.c, list.length > 1 ? 96 : 170, 140)));
      el.addEventListener('click', () => openDetail(ex, tool));
      g.appendChild(el);
    });
    return sec;
  }

  function renderSpecial(sp) {
    const sec = document.createElement('section');
    sec.className = 'room';
    sec.innerHTML = `<h2>${text(sp.name)}</h2><p class="intro">${text(sp.intro)}</p>`;
    const cards = Mihon.build();
    (sp.cards || []).forEach(title => {
      const card = cards.find(c => c.title === title);
      if (!card) return;
      const el = document.createElement('div');
      el.className = 'special-card';
      el.innerHTML = `<h3>${text(card.title)}</h3><div class="views"></div><p>${text(card.note)}</p>`;
      const v = el.querySelector('.views');
      card.views.forEach(([label, c, k]) => {
        const f = document.createElement('figure');
        const kk = k || 3;
        c.style.width = c.width * kk + 'px'; c.style.height = c.height * kk + 'px';
        f.appendChild(c);
        if (card.captions) f.insertAdjacentHTML('beforeend', `<div class="caps">${card.captions.map(t => `<span>${text(t)}</span>`).join('')}</div>`);
        f.insertAdjacentHTML('beforeend', `<figcaption>${text(label)}</figcaption>`);
        v.appendChild(f);
      });
      sec.appendChild(el);
    });
    return sec;
  }

  document.addEventListener('DOMContentLoaded', () => {
    DataStore.finalize();
    const M = DataStore.museum;
    if (DataStore.errors.length || !M) {
      $('error').innerHTML = (DataStore.errors.length ? DataStore.errors : ['data/museum.js が読み込めませんでした。']).map(text).join('<br>');
      $('error').hidden = false;
      if (!M) return;
    }
    $('m-title').textContent = M.title || 'お道具の美術館';
    $('m-sub').textContent = M.subtitle || '';
    const rooms = $('rooms');
    M.rooms.forEach(r => rooms.appendChild(renderRoom(r, DataStore.tools)));
    if (M.special) rooms.appendChild(renderSpecial(M.special));
  });
})();
