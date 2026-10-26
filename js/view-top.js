/*
 * 上から見た画面を描く係（亭主が下、向こう＝風炉先が上）
 * 単位は画面の点（1点＝1cm。大きさは PixelArt.ROOM の W × H）。拡大は呼び出す側（views.js）が行う。
 */
const ViewTop = (() => {
  const W = PixelArt.ROOM.W, H = PixelArt.ROOM.H;
  let board = null;
  const photos = {};          // 道具id → 読み込めた写真

  // 畳の上に出す場所の名前
  const LABELS = [
    { text: '風炉先', x: 52, y: 11 },
    { text: '炉', x: 132, y: 126 },
    { text: '勝手付', x: 1, y: 118 },
    { text: '点前畳', x: 23, y: 205 },
    { text: '踏込畳', x: 23, y: 397 },
    { text: '客畳', x: 119, y: 301 },
    { text: '茶道口', x: 100, y: 414 }
  ];

  function init(tools) {
    board = PixelArt.room();
    tools.forEach(t => {
      if (!t.image) return;
      const img = new Image();
      img.onload = () => { photos[t.id] = img; };
      img.src = t.image;
    });
  }

  // 絵と基準点。絵はもともと「亭主が左」の向きで描いてあるので、左に90度回して使う
  function spriteOf(it) {
    const name = Scene.topName(it);
    return { sp: PixelArt.sprite(name, it.state), a: PixelArt.anchorOf(name, it.state) };
  }
  const angleOf = it => -90 + (it.rot || 0);

  // 画面上で道具が占める四角
  function box(it) {
    const p = Scene.pos(it);
    if (it.tool.hit) return { x0: p.x - it.tool.hit.w / 2, y0: p.y - it.tool.hit.h / 2, x1: p.x + it.tool.hit.w / 2, y1: p.y + it.tool.hit.h / 2 };
    const photo = photos[it.tool.id];
    if (photo) {
      const s = it.tool.size || { w: 20, h: 20 };
      return { x0: p.x - s.w / 2, y0: p.y - s.h / 2, x1: p.x + s.w / 2, y1: p.y + s.h / 2 };
    }
    const { sp, a } = spriteOf(it);
    const r = angleOf(it) * Math.PI / 180, c = Math.round(Math.cos(r)), s = Math.round(Math.sin(r));
    const xs = [], ys = [];
    [[-a.x, -a.y], [sp.width - a.x, -a.y], [-a.x, sp.height - a.y], [sp.width - a.x, sp.height - a.y]].forEach(([x, y]) => {
      xs.push(x * c - y * s); ys.push(x * s + y * c);
    });
    return { x0: p.x + Math.min(...xs), y0: p.y + Math.min(...ys), x1: p.x + Math.max(...xs), y1: p.y + Math.max(...ys) };
  }

  function drawItem(ctx, it) {
    const p = Scene.pos(it);
    ctx.save();
    ctx.translate(Math.round(p.x), Math.round(p.y));
    const photo = photos[it.tool.id];
    if (photo) {
      const s = it.tool.size || { w: 20, h: 20 };
      ctx.rotate((it.rot || 0) * Math.PI / 180);      // 写真は画面の向きのまま使う
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(photo, -s.w / 2, -s.h / 2, s.w, s.h);
      ctx.imageSmoothingEnabled = false;
    } else {
      const { sp, a } = spriteOf(it);
      ctx.rotate(angleOf(it) * Math.PI / 180);
      ctx.drawImage(sp, -a.x, -a.y);
    }
    ctx.restore();
  }

  // 角かっこで囲む
  function frame(ctx, b, color, gap) {
    const x = Math.round(b.x0) - gap, y = Math.round(b.y0) - gap;
    const w = Math.round(b.x1 - b.x0) + gap * 2, h = Math.round(b.y1 - b.y0) + gap * 2, L = Math.min(4, Math.floor(Math.min(w, h) / 2));
    ctx.fillStyle = color;
    [[x, y, L, 1], [x, y, 1, L], [x + w - L, y, L, 1], [x + w - 1, y, 1, L],
     [x, y + h - 1, L, 1], [x, y + h - L, 1, L], [x + w - L, y + h - 1, L, 1], [x + w - 1, y + h - L, 1, L]]
      .forEach(r => ctx.fillRect(...r));
  }

  function drawLabels(ctx) {
    ctx.font = '5px "Hiragino Sans", "Yu Gothic", sans-serif';
    LABELS.forEach(l => {
      const tw = ctx.measureText(l.text).width;
      ctx.fillStyle = '#1e1814'; ctx.globalAlpha = 0.55;
      ctx.fillRect(l.x - 1, l.y - 5, tw + 2, 6.5);
      ctx.globalAlpha = 1; ctx.fillStyle = '#f3eee2';
      ctx.fillText(l.text, l.x, l.y);
    });
  }

  // 場所の印（答えを見せるときなど）
  function drawPlace(ctx, name, color) {
    const p = Scene.place(name);
    if (!p) return;
    frame(ctx, { x0: p.x - 8, y0: p.y - 8, x1: p.x + 8, y1: p.y + 8 }, color, 0);
  }

  // opt: { labels, hover, selected, answer, answerPlace, pulse }
  function draw(ctx, opt = {}) {
    ctx.drawImage(board, 0, 0);
    const order = Scene.topOrder().filter(it => !Scene.isHidden(it));
    order.forEach(it => drawItem(ctx, it));
    if (opt.labels) drawLabels(ctx);
    const find = id => order.find(it => it.tool.id === id);
    if (opt.answer && find(opt.answer)) frame(ctx, box(find(opt.answer)), '#ff8a5c', 2 + opt.pulse);
    if (opt.answerPlace) drawPlace(ctx, opt.answerPlace, '#ff8a5c');
    if (opt.selected && find(opt.selected)) frame(ctx, box(find(opt.selected)), '#f6d04d', 2 + opt.pulse);
    if (opt.hover && opt.hover !== opt.selected && find(opt.hover)) frame(ctx, box(find(opt.hover)), '#ffffff', 2);
  }

  // その点にある一番上の道具
  function hit(x, y) {
    const order = Scene.topOrder().filter(it => !Scene.isHidden(it));
    for (let i = order.length - 1; i >= 0; i--) {
      const b = box(order[i]);
      if (x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1) return order[i];
    }
    return null;
  }

  return { W, H, init, draw, hit, boardCanvas: () => board, photo: id => photos[id] };
})();
