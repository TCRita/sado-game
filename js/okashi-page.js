/*
 * お菓子の美術館のページを組み立てる
 * 説明は data/okashi.js（window.OKASHI）、絵は js/pixel-art.js の okashi（お菓子1つ）と kashiki（器に盛った形）から取る。
 */
(function () {
  const $ = id => document.getElementById(id);
  const text = s => String(s == null ? '' : s)
    .replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
    .replace(/要確認/g, '<mark>要確認</mark>');

  function enlarged(src, size) {
    const c = document.createElement('canvas');
    c.width = src.width; c.height = src.height;
    c.getContext('2d').drawImage(src, 0, 0);
    const k = Math.max(1, Math.floor(size / Math.max(src.width, src.height)));
    c.style.width = src.width * k + 'px'; c.style.height = src.height * k + 'px';
    return c;
  }
  const badges = o => `<div class="badges"><span class="badge">${text(o.kind)}</span><span class="badge">${text(o.season)}</span>${o.kyoto ? '<span class="badge kyoto">京都</span>' : ''}</div>`;

  function openDetail(o) {
    const d = $('detail');
    d.innerHTML = `
      <button class="d-close" aria-label="閉じる">×</button>
      <div class="d-wrap">
        <div class="d-art"></div>
        <div class="d-text">
          <h2>${text(o.name)}</h2>
          <div class="yomi">${text(o.yomi)}</div>
          ${badges(o)}
          <h3>どんなお菓子</h3><p>${text(o.text)}</p>
          ${o.note ? `<h3>豆知識</h3><p>${text(o.note)}</p>` : ''}
          <h3>器に盛ると</h3><div class="utsuwa"></div>
        </div>
      </div>`;
    const art = d.querySelector('.d-art');
    art.appendChild(enlarged(PixelArt.sprite('okashi', o.id), 256));
    const u = d.querySelector('.utsuwa');
    Object.keys(PixelArt.VESSELS).forEach(v => {
      const f = document.createElement('figure');
      f.appendChild(enlarged(PixelArt.sprite('kashiki', `${v}:${o.id}`), 84));
      f.insertAdjacentHTML('beforeend', `<figcaption>${text(PixelArt.VESSELS[v])}</figcaption>`);
      u.appendChild(f);
    });
    d.querySelector('.d-close').addEventListener('click', () => d.close());
    d.addEventListener('click', e => { if (e.target === d) d.close(); });
    d.showModal();
  }

  document.addEventListener('DOMContentLoaded', () => {
    const list = window.OKASHI || [];
    const groups = [
      ['生菓子', '水分の多い、その日のうちにいただくお菓子。濃茶では、主に生菓子を出します（要確認）。', o => o.kind.startsWith('生菓子')],
      ['半生菓子', '生菓子と干菓子のあいだの、少し日持ちのするお菓子。', o => o.kind.startsWith('半生')],
      ['干菓子・砂糖菓子', '水分の少ない、乾いたお菓子。薄茶では、干菓子を出すことが多いです。', o => o.kind.startsWith('干菓子')]
    ];
    const rooms = $('rooms');
    groups.forEach(([name, intro, test]) => {
      const sec = document.createElement('section');
      sec.className = 'room';
      sec.innerHTML = `<h2>${text(name)}</h2><p class="intro">${text(intro)}</p><div class="gallery"></div>`;
      const g = sec.querySelector('.gallery');
      list.filter(test).forEach(o => {
        const el = document.createElement('div');
        el.className = 'exhibit';
        el.innerHTML = `<div class="spot"><div class="frame okashi"></div></div>
          <div class="plate"><span class="name">${text(o.name)}</span><span class="yomi">${text(o.yomi)}</span>
          ${badges(o)}<div class="motif">${text(o.text)}</div></div>`;
        el.querySelector('.frame').appendChild(enlarged(PixelArt.sprite('okashi', o.id), 140));
        el.addEventListener('click', () => openDetail(o));
        g.appendChild(el);
      });
      rooms.appendChild(sec);
    });
  });
})();
