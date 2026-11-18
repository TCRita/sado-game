/*
 * 亭主の目線の画面を描く係（点前座に座って、少し見下ろした景色）
 * 道具の位置は Scene（上からの画面と同じ座標）から計算するので、2つの画面は自動的にそろう。
 * 単位はドット絵の細かい点（上からの画面の S 倍）。拡大は呼び出す側（views.js）が行う。
 */
const ViewHost = (() => {
  const S = PixelArtSide.S, K = PixelArtSide.K;
  const HOR = 30;             // 画面の上の、壁が見える高さ
  const WALL_Y = PixelArt.ROOM.y0;   // 上からの画面で、ここより向こうは壁
  // rot（度）… カメラの向き。亭主が座っている向き（真上が 0、右が 90）に合わせると、座った人の目線の景色になる。
  // px, py … カメラが回る中心（亭主の座る位置）。x0〜x1 / far〜near は、回したあとの景色での範囲。
  let cam = { x0: 0, x1: PixelArt.ROOM.W, far: 0, near: PixelArt.ROOM.H, rot: 0, px: 0, py: 0 };
  let bg = null;
  let drawn = [];             // 直近に描いた道具（クリック判定用）
  const flatCache = {}, alphaCache = new Map();

  function setCamera(c) { cam = Object.assign({ x0: 0, x1: PixelArt.ROOM.W, far: 0, near: PixelArt.ROOM.H, rot: 0, px: 0, py: 0 }, c); bg = null; }
  function invalidate() { bg = null; }
  function size() {
    return { w: Math.round((cam.x1 - cam.x0) * S), h: Math.round((HOR + (cam.near - cam.far) * K + 6) * S) };
  }
  // 部屋の中の点 → カメラの向きに合わせて回した点（rot が 0 なら、そのまま）
  function toView(p) {
    if (!cam.rot) return p;
    const a = cam.rot * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), ux = p.x - cam.px, uy = p.y - cam.py;
    return { x: cam.px + ux * c + uy * s, y: cam.py - ux * s + uy * c, z: p.z };
  }
  function toRoom(v) {
    if (!cam.rot) return v;
    const a = cam.rot * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), ux = v.x - cam.px, uy = v.y - cam.py;
    return { x: cam.px + ux * c - uy * s, y: cam.py + ux * s + uy * c };
  }
  const relRot = it => Scene.rotOf(it) - cam.rot;            // カメラから見た、道具の向き（茶碗に仕組んだ物は、茶碗と一緒に回る）
  // 畳の上の点 → 画面（単位は上からの画面と同じ）
  const project = p => { const v = toView(p); return { sx: v.x - cam.x0, sy: HOR + (v.y - cam.far) * K - p.z }; };
  // 画面の細かい点 → 畳の上の点
  const unproject = (X, Y) => toRoom({ x: X / S + cam.x0, y: cam.far + (Y / S - HOR) / K });

  // 背景：上からの畳の絵を、見下ろした形に写す。向こうは壁
  function buildBg() {
    const { w, h } = size();
    const p = PixelArt.painter(w, h);
    const board = ViewTop.boardCanvas();
    const src = board.getContext('2d').getImageData(0, 0, board.width, board.height).data;
    const out = p.ctx.createImageData(w, h);
    const wallBase = (HOR + (WALL_Y - cam.far) * K) * S;
    const rand = PixelArt.rng(7);
    for (let Y = 0; Y < h; Y++) for (let X = 0; X < w; X++) {
      const o = (Y * w + X) * 4;
      let col;
      const wpt = cam.rot ? unproject(X + 0.5, Y + 0.5) : null;
      if (cam.rot && (wpt.x < 0 || wpt.y < 0 || wpt.x >= board.width || wpt.y >= board.height)) {   // 部屋の外（壁）
        const v = rand() < 0.12 ? -14 : rand() < 0.08 ? 10 : 0;
        col = [0xcb + v, 0xb6 + v, 0x8c + v];
      } else if (!cam.rot && Y < wallBase - 2) {                // 壁
        const v = rand() < 0.12 ? -14 : rand() < 0.08 ? 10 : 0;
        col = [0xcb + v, 0xb6 + v, 0x8c + v];
      } else if (!cam.rot && Y < wallBase) {                    // 畳寄せ
        col = [0x6a, 0x4a, 0x2a];
      } else {
        const wp = wpt || unproject(X + 0.5, Y + 0.5);
        const bx = Math.max(0, Math.min(board.width - 1, Math.floor(wp.x)));
        const by = Math.max(0, Math.min(board.height - 1, Math.floor(wp.y)));
        const i = (by * board.width + bx) * 4;
        col = [src[i], src[i + 1], src[i + 2]];
      }
      out.data[o] = col[0]; out.data[o + 1] = col[1]; out.data[o + 2] = col[2]; out.data[o + 3] = 255;
    }
    p.ctx.putImageData(out, 0, 0);
    bg = p.canvas;
  }

  // 亭主の目線の絵がない道具は、上からの絵を奥行き方向につぶして代わりにする（布・菓子器など平たい物）
  function flatSprite(it) {
    const rel = relRot(it), name = Scene.topName(it), key = `${name}|${it.state || ''}|${Math.round(rel / 90)}`;
    if (!flatCache[key]) {
      let c = PixelArt.sprite(name, it.state);
      const turns = (((1 - Math.round(rel / 90)) % 4) + 4) % 4;   // 左90度 ＋ 置いた向き（カメラから見た向き）
      for (let i = 0; i < turns; i++) c = PixelArt.transform(c, 'r270');
      const out = document.createElement('canvas');
      out.width = c.width * S; out.height = Math.max(1, Math.round(c.height * K * S));
      const g = out.getContext('2d');
      g.imageSmoothingEnabled = false;
      g.drawImage(c, 0, 0, out.width, out.height);
      flatCache[key] = out;
    }
    return flatCache[key];
  }

  const mirrorCache = {};
  function spriteOf(it, layer) {
    const rel = relRot(it), name = Scene.hostName(Object.assign({}, it, { rot: rel }));
    if (name) {
      const def = PixelArtSide.SIDE[name];
      if (layer === 'front' && !def.mouth && !def.layered) return null;
      const c = PixelArtSide.sprite(name, name.endsWith('_ang') ? `${it.state || ''}|${Math.round(rel / 5) * 5}` : it.state, layer);
      // 横に寝かせた柄杓は、柄が左向き（rot 180〜360）なら左右反転して使う
      if ((name === 'hishaku_yoko' || name === 'hishaku_naname') && ((rel % 360) + 360) % 360 > 180) {
        const key = `${name}|${it.state || ''}`;
        if (!mirrorCache[key]) mirrorCache[key] = PixelArt.transform(c, 'flip');
        return { c: mirrorCache[key], ax: c.width - def.ax * S, ay: def.ay * S };
      }
      return { c, ax: def.ax * S, ay: def.ay * S };
    }
    if (layer === 'front') return null;
    const c = flatSprite(it);
    return { c, ax: Math.floor(c.width / 2), ay: Math.floor(c.height / 2) };
  }

  function put(ctx, it, layer) {
    const s = spriteOf(it, layer);
    if (!s) return;
    const pr = project(Scene.pos(it));
    const x = Math.round(pr.sx * S - s.ax), y = Math.round(pr.sy * S - s.ay);
    ctx.drawImage(s.c, x, y);
    if (!layer) drawn.push({ it, x, y, c: s.c });
  }

  const visible = it => !Scene.isHidden(it) && !it.tool.person;   // 人（亭主・お客様）は映さない

  // 器 → 中の物 → 器の手前側 → 上に乗せた物 の順に描く
  function drawTree(ctx, it) {
    put(ctx, it, null);
    const kids = Scene.childrenOf(it.tool.id).filter(visible);
    const ins = kids.filter(k => k.how === 'in'), ons = kids.filter(k => k.how !== 'in');
    ins.forEach(k => drawTree(ctx, k));
    if (ins.length) put(ctx, it, 'front');
    ons.forEach(k => drawTree(ctx, k));
  }

  function frame(ctx, d, color, gap) {
    const x = d.x - gap, y = d.y - gap, w = d.c.width + gap * 2, h = d.c.height + gap * 2, L = 8, t = 2;
    ctx.fillStyle = color;
    [[x, y, L, t], [x, y, t, L], [x + w - L, y, L, t], [x + w - t, y, t, L],
     [x, y + h - t, L, t], [x, y + h - L, t, L], [x + w - L, y + h - t, L, t], [x + w - t, y + h - L, t, L]]
      .forEach(r => ctx.fillRect(...r));
  }

  function draw(ctx, opt = {}) {
    if (!bg) buildBg();
    ctx.drawImage(bg, 0, 0);
    drawn = [];
    Scene.roots().filter(visible)
      .filter(it => { const p = toView(Scene.pos(it)); return p.y >= cam.far - 10 && p.y <= cam.near; })
      .sort((a, b) => (a.moving - b.moving) || (toView(Scene.pos(a)).y - toView(Scene.pos(b)).y))
      .forEach(it => drawTree(ctx, it));
    const find = id => drawn.find(d => d.it.tool.id === id);
    const pulse = (opt.pulse || 0) * 2;
    if (opt.answer && find(opt.answer)) frame(ctx, find(opt.answer), '#ff8a5c', 4 + pulse);
    if (opt.answerPlace) {
      const p = Scene.place(opt.answerPlace);
      if (p) {
        const pr = project({ x: p.x, y: p.y, z: 0 });
        frame(ctx, { x: pr.sx * S - 16, y: pr.sy * S - 10, c: { width: 32, height: 20 } }, '#ff8a5c', 0);
      }
    }
    if (opt.selected && find(opt.selected)) frame(ctx, find(opt.selected), '#f6d04d', 4 + pulse);
    if (opt.hover && opt.hover !== opt.selected && find(opt.hover)) frame(ctx, find(opt.hover), '#ffffff', 4);
  }

  // 絵の透明でない所をクリックしたか
  function opaqueAt(c, x, y) {
    if (x < 0 || y < 0 || x >= c.width || y >= c.height) return false;
    let a = alphaCache.get(c);
    if (!a) { a = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; alphaCache.set(c, a); }
    return a[(y * c.width + x) * 4 + 3] > 0;
  }
  function hit(X, Y) {
    for (let i = drawn.length - 1; i >= 0; i--) {
      const d = drawn[i];
      if (opaqueAt(d.c, Math.floor(X - d.x), Math.floor(Y - d.y))) return d.it;
    }
    return null;
  }

  return { setCamera, invalidate, size, draw, hit, toWorld: unproject };
})();
