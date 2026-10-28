/*
 * 道具がいまどこにあるか・何に乗っているかを覚えておく係
 * 上からの画面も亭主の目線の画面も、ここを見て描くので、2つの画面は必ず同じ状態になる。
 * 座標は上からの画面と同じ（横200 × 縦320、亭主が下・向こうが上）。z は畳からの高さ。
 */
const Scene = (() => {
  const MOVE_MS = 450;          // 道具が動く時間（ミリ秒）
  let tools = [];
  let items = {};               // 道具id → 状態
  let places = {};
  let tweens = [];              // 動いている途中の道具
  let instant = false;          // true なら動きを省いてすぐ置く（確認用）

  // ---- 絵の名前 ----
  function topName(it) {
    const base = it.tool.sprite || it.tool.id;
    return it.pose && PixelArt.has(base + '_' + it.pose) ? base + '_' + it.pose : base;
  }
  function hostName(it) {
    const base = it.tool.sprite || it.tool.id;
    if (it.pose && PixelArtSide.has(base + '_' + it.pose)) return base + '_' + it.pose;
    if (base === 'hishaku') {
      const r = (((it.rot || 0) % 360) + 360) % 360;      // 横向き（右か左）に近ければ、横に寝かせた形。斜めに掛けたときも、これを使う
      return (r >= 45 && r < 135) || (r >= 225 && r < 315) ? 'hishaku_yoko' : 'hishaku_hiki';
    }
    return PixelArtSide.has(base) ? base : null;
  }
  // 上に乗せる高さ・中に入れる高さ
  function heights(it) {
    const n = hostName(it), def = n && PixelArtSide.SIDE[n];
    return { top: def && def.top != null ? def.top : 2, inner: def && def.inner != null ? def.inner : 0 };
  }

  // ---- 位置 ----
  function pos(it) {
    if (it.parent && items[it.parent]) {
      const p = items[it.parent], pp = pos(p), h = heights(p);
      return { x: pp.x + it.dx, y: pp.y + it.dy, z: pp.z + (it.how === 'in' ? h.inner : h.top) + it.dz };
    }
    return { x: it.x, y: it.y, z: it.z };
  }

  // 置き場所の指定（"場所の名前" または { place / on / how / dx / dy / dz / rot / state / pose }）を当てはめる
  function apply(it, ref) {
    const r = typeof ref === 'string' ? { place: ref } : (ref || {});
    if (r.on) {
      it.parent = r.on; it.how = r.how || 'on';
      it.dx = r.dx || 0; it.dy = r.dy || 0; it.dz = r.dz || 0;
    } else if (r.place || r.x !== undefined) {
      const p = r.place ? (places[r.place] || { x: it.x, y: it.y }) : { x: r.x, y: r.y };
      it.parent = null;
      it.x = p.x + (r.dx || 0); it.y = p.y + (r.dy || 0);
      it.z = r.dz !== undefined ? r.dz : (p.dz || 0);   // 場所に dz があれば、その高さに持ち上げる
    }
    if (r.rot !== undefined) it.rot = r.rot;
    if (r.state !== undefined) it.state = r.state;
    if (r.pose !== undefined) it.pose = r.pose;
    it.hidden = !!r.hidden;          // "hidden": true なら、はじめは隠しておく（運ぶ番に show で出す）
  }

  function makeItem(t) {
    return { tool: t, x: 0, y: 0, z: 0, rot: 0, state: t.state || null, pose: '', hidden: true,
             parent: null, how: 'on', dx: 0, dy: 0, dz: 0, moving: false };
  }

  // お点前のはじめの配置にする
  function load(toolList, placeMap, setup) {
    tools = toolList; places = placeMap || {}; items = {}; tweens = [];
    tools.forEach(t => { items[t.id] = makeItem(t); });
    Object.keys(setup || {}).forEach(id => { if (items[id]) apply(items[id], setup[id]); });
  }
  // 図鑑の配置にする（tools.js の pos）
  function loadZukan(toolList) {
    const setup = {};
    toolList.forEach(t => { if (t.zukan !== false && t.pos) setup[t.id] = t.pos; });
    load(toolList, {}, setup);
  }

  // ---- 動き ----
  function move(id, ref, ms = MOVE_MS) {
    const it = items[id];
    if (!it) return Promise.resolve();
    if (instant) { apply(it, ref); return Promise.resolve(); }
    const from = pos(it);
    const probe = Object.assign({}, it);
    apply(probe, ref);
    const to = pos(probe);
    Object.assign(it, { parent: null, x: from.x, y: from.y, z: from.z, moving: true, hidden: false });
    return new Promise(res => tweens.push({ it, from, to, ref, t0: performance.now(), ms, res }));
  }

  function tick(now) {
    tweens = tweens.filter(tw => {
      const k = Math.min(1, (now - tw.t0) / tw.ms);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      const it = tw.it;
      it.x = tw.from.x + (tw.to.x - tw.from.x) * e;
      it.y = tw.from.y + (tw.to.y - tw.from.y) * e;
      it.z = tw.from.z + (tw.to.z - tw.from.z) * e + Math.sin(k * Math.PI) * 4;   // 少し持ち上げて運ぶ
      if (k < 1) return true;
      it.moving = false;
      apply(it, tw.ref);
      tw.res();
      return false;
    });
  }

  const wait = ms => instant ? Promise.resolve() : new Promise(r => setTimeout(r, ms));

  // effects の1つ分を、置き場所の指定にまとめる
  function refOf(ef) {
    const r = Object.assign({}, typeof ef.to === 'string' ? { place: ef.to } : (ef.to || {}));
    ['on', 'how', 'dx', 'dy', 'dz', 'rot', 'state', 'pose'].forEach(k => { if (ef[k] !== undefined) r[k] = ef[k]; });
    return r;
  }

  async function runEffects(list) {
    for (const ef of list || []) {
      const it = items[ef.tool];
      if (!it) continue;
      if (ef.type === 'move') await move(ef.tool, refOf(ef));
      else if (ef.type === 'state') { it.state = ef.state; await wait(300); }
      else if (ef.type === 'show') { apply(it, refOf(ef)); await wait(250); }
      else if (ef.type === 'hide') { it.hidden = true; await wait(150); }
    }
  }

  // ---- 描く順番など ----
  const all = () => tools.map(t => items[t.id]).filter(Boolean);
  const childrenOf = id => all().filter(it => it.parent === id);
  const roots = () => all().filter(it => !it.parent || !items[it.parent]);
  function isHidden(it) {
    if (it.hidden) return true;
    return it.parent && items[it.parent] ? isHidden(items[it.parent]) : false;
  }
  // 上からの画面の描く順（親のあとに、中に入れた物 → 上に乗せた物。動いている物は最後）
  function topOrder() {
    const out = [];
    const visit = it => {
      out.push(it);
      const kids = childrenOf(it.tool.id);
      kids.filter(k => k.how === 'in').forEach(visit);
      kids.filter(k => k.how !== 'in').forEach(visit);
    };
    roots().filter(it => !it.moving).forEach(visit);
    roots().filter(it => it.moving).forEach(visit);
    return out;
  }
  function nearPlace(name, pt, r = 14) {
    const p = places[name];
    return !!(p && pt && Math.hypot(pt.x - p.x, pt.y - p.y) <= r);
  }

  return {
    load, loadZukan, move, runEffects, tick, pos, topName, hostName,
    item: id => items[id], roots, childrenOf, topOrder, isHidden, nearPlace,
    place: n => places[n], busy: () => tweens.length > 0,
    setInstant(v) { instant = v; }
  };
})();
