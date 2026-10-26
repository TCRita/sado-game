/*
 * 2つの画面（上から／亭主の目線）を並べる係
 * 片方を大きく、もう片方を右下の小窓に出す。小窓をクリックすると入れ替わる。
 */
const Views = (() => {
  let wrap, tip, cTop, cHost, swapBtn;
  let main = 'top';
  let scaleTop = 1, scaleHost = 1, dpr = 1;
  const hl = { hover: null, selected: null, answer: null, answerPlace: null };
  let labels = true;
  let onClick = null;

  function init(els, tools) {
    ({ wrap, tip, cTop, cHost, swapBtn } = els);
    ViewTop.init(tools);
    new ResizeObserver(layout).observe(wrap);
    window.addEventListener('resize', layout);
    [cTop, cHost].forEach(c => {
      c.addEventListener('mousemove', e => onMove(c, e));
      c.addEventListener('mouseleave', () => { hl.hover = null; tip.hidden = true; });
      c.addEventListener('click', e => onPress(c, e));
    });
    swapBtn.addEventListener('click', () => setMain(main === 'top' ? 'host' : 'top'));
    layout();
    requestAnimationFrame(loop);
  }

  function setMain(v) {
    main = v;
    swapBtn.textContent = main === 'top' ? '亭主の目線を大きく' : '上からを大きく';
    layout();
  }

  // 大きさを決める。上からの画面は ViewTop.W×ViewTop.H、亭主の目線は ViewHost.size()
  function layout() {
    const r = wrap.getBoundingClientRect();
    if (!r.width || !r.height) return;
    dpr = window.devicePixelRatio || 1;
    const hs = ViewHost.size();
    const fit = (w, h, bw, bh) => {
      let s = Math.min(bw / w, bh / h);
      const si = Math.floor(s);
      if (si >= 2 && si / s >= 0.85) s = si;           // 整数倍にできるならくっきり
      return Math.max(s, 0.3);
    };
    const mainBox = [r.width - 32, r.height - 32], miniBox = [r.width * 0.3, r.height * 0.36];
    const isTopMain = main === 'top';
    scaleTop = fit(ViewTop.W, ViewTop.H, ...(isTopMain ? mainBox : miniBox));
    scaleHost = fit(hs.w, hs.h, ...(isTopMain ? miniBox : mainBox));
    size(cTop, ViewTop.W * scaleTop, ViewTop.H * scaleTop);
    size(cHost, hs.w * scaleHost, hs.h * scaleHost);
    cTop.className = isTopMain ? 'view main' : 'view mini';
    cHost.className = isTopMain ? 'view mini' : 'view main';
  }
  function size(c, w, h) {
    c.style.width = Math.round(w) + 'px'; c.style.height = Math.round(h) + 'px';
    c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
  }

  function loop(now) {
    Scene.tick(now);
    const pulse = Math.floor(now / 400) % 2;
    let g = cTop.getContext('2d');
    g.setTransform(scaleTop * dpr, 0, 0, scaleTop * dpr, 0, 0);
    g.imageSmoothingEnabled = false;
    ViewTop.draw(g, Object.assign({ labels, pulse }, hl));
    g = cHost.getContext('2d');
    g.setTransform(scaleHost * dpr, 0, 0, scaleHost * dpr, 0, 0);
    g.imageSmoothingEnabled = false;
    ViewHost.draw(g, Object.assign({ pulse }, hl));
    requestAnimationFrame(loop);
  }

  // マウスの位置 → その画面の点
  function local(c, e) {
    const r = c.getBoundingClientRect();
    const s = c === cTop ? scaleTop : scaleHost;
    return { x: (e.clientX - r.left) / s, y: (e.clientY - r.top) / s };
  }
  function itemAt(c, p) { return c === cTop ? ViewTop.hit(p.x, p.y) : ViewHost.hit(p.x, p.y); }

  function onMove(c, e) {
    const it = itemAt(c, local(c, e));
    hl.hover = it ? it.tool.id : null;
    c.style.cursor = it || c.classList.contains('mini') ? 'pointer' : 'default';
    if (it) {
      const t = it.tool, wr = wrap.getBoundingClientRect();
      tip.textContent = t.yomi ? `${t.name}（${t.yomi}）` : t.name;
      tip.style.left = (e.clientX - wr.left + 14) + 'px';
      tip.style.top = (e.clientY - wr.top + 14) + 'px';
      tip.hidden = false;
    } else tip.hidden = true;
  }

  function onPress(c, e) {
    if (c.classList.contains('mini')) { setMain(c === cTop ? 'top' : 'host'); return; }
    const p = local(c, e);
    const it = itemAt(c, p);
    const world = c === cTop ? p : ViewHost.toWorld(p.x, p.y);
    if (onClick) onClick(it ? it.tool : null, world);
  }

  return {
    init, setMain, layout,
    main: () => main,
    onClick(fn) { onClick = fn; },
    select(id) { hl.selected = id; },
    showAnswer(id, place) { hl.answer = id || null; hl.answerPlace = place || null; },
    setLabels(v) { labels = v; },
    setHostCamera(c) { ViewHost.setCamera(c); layout(); }
  };
})();
