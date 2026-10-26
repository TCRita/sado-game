/*
 * 見本：道具を重ねたときの絵（上から／亭主の目線）
 * ・上からの絵も、亭主が下・向こうが上になる向きで描いています（左右が2つの絵でそろう）。
 * ・亭主の目線は手元を寄って見る画面なので、上からの S 倍の細かさで描いています。
 */
const Mihon = (() => {
  const P = PixelArt.painter;
  const T = PixelArt.transform;
  const S = PixelArtSide;
  const Z = S.S;   // 亭主の目線の細かさ

  // ---- 背景 ----
  // 上から（畳。亭主から見て畳の目は左右に走る）
  function bgTop(w, h) {
    const p = P(w, h);
    p.rect(0, 0, w, h, '#b8b06c');
    for (let j = 0; j < h; j++) if ((j >> 1) & 1) p.rect(0, j, w, 1, '#aca462');
    p.speckleRect(0, 0, w, h, '#c8c07e', 0.04, 3);
    p.rect(0, h - 3, w, 3, '#25232b');                    // 手前の縁（亭主側）
    return p;
  }
  // 亭主の目線（奥に壁、手前に畳）。w, h は上からの画面と同じ単位で、実際は Z 倍の大きさ
  function bgHost(w, h) {
    const p = P(w * Z, h * Z);
    p.rect(0, 0, w * Z, h * Z, '#b8b06c');
    p.rect(0, 0, w * Z, 6 * Z, '#cbb68c');                // 向こうの壁
    p.speckleRect(0, 0, w * Z, 6 * Z, '#b9a379', 0.15, 5);
    p.rect(0, 6 * Z, w * Z, Z, '#6a4a2a');                // 畳寄せ
    for (let j = 7 * Z; j < h * Z; j++) if ((j >> 1) & 1) p.rect(0, j, w * Z, 1, '#b2aa68'); // 畳の目
    p.speckleRect(0, 7 * Z, w * Z, (h - 7) * Z, '#c8c07e', 0.03, 9);
    return p;
  }

  // 上から：中心 (x, y) に置く。亭主が下になる向きへ回す（rot:false で回さない）、flip で左右反転
  function top(p, name, state, x, y, opt = {}) {
    let s = PixelArt.sprite(name, state);
    if (opt.flip) s = T(s, 'flip');
    if (opt.rot !== false) s = T(s, 'r270');
    p.ctx.drawImage(s, Math.round(x) - Math.floor(s.width / 2), Math.round(y) - Math.floor(s.height / 2));
  }
  // 上から：蓋置に引いた柄杓。合の中心を (x, y) に、柄は手前（下）へ
  function topHishakuHiki(p, type, x, y) {
    const s = T(PixelArt.sprite('hishaku', type + '-flip'), 'r270');
    const cupC = type === 'ro' ? 6.5 : 5.5;
    p.ctx.drawImage(s, Math.round(x) - 6, Math.round(y - (cupC - 1)));
  }
  const host = (p, name, state, x, y, layer) => S.put(p.ctx, name, state, x, y, layer);

  // 風炉に掛けた釜（亭主の目線）
  function furoKama(p, x, y, kamaState) {
    host(p, 'furo', null, x, y);                          // 風炉（全体）
    host(p, 'kama', kamaState, x, y - 11);                // 釜（風炉の中の五徳に乗る）
    host(p, 'furo', null, x, y, 'front');                 // 風炉の手前側で釜の下を隠す
  }

  function build() {
    const cards = [];

    // 1. 風炉に掛けた釜
    {
      const t = bgTop(72, 64), h = bgHost(72, 66);
      top(t, 'furo', null, 36, 32); top(t, 'kama', 'closed', 36, 32);
      furoKama(h, 36, 47, 'closed');
      cards.push({
        title: '風炉に掛けた釜',
        views: [['上から', t.canvas], ['亭主の目線', h.canvas]],
        order: '風炉（全体）→ 釜 → 風炉（手前側だけ）',
        note: '前が大きく開いた鉄の風炉です。開きから五徳の脚・釜の底・灰が見えます。電熱器なので火は描いていません。'
      });
    }

    // 2. 蓋置に柄杓を引く（風炉用）
    {
      const t = bgTop(72, 72), h = bgHost(72, 56);
      top(t, 'futaoki', null, 36, 14);
      topHishakuHiki(t, 'furo', 36, 14);
      host(h, 'futaoki', null, 36, 20);
      host(h, 'hishaku_hiki', 'furo', 36, 20 - S.SIDE.futaoki.height);
      cards.push({
        title: '蓋置に柄杓を引いた形（風炉用）',
        views: [['上から', t.canvas], ['亭主の目線', h.canvas]],
        order: '蓋置 → 柄杓（合を蓋置の上に、柄を手前へ）',
        note: '亭主の目線では、柄がこちらへまっすぐ伸びてきます。'
      });
    }

    // 3. 柄杓：風炉用と炉用
    {
      const t = bgTop(72, 52), h = bgHost(72, 52);
      [['furo', 14], ['ro', 38]].forEach(([type, y]) => {
        t.ctx.drawImage(PixelArt.sprite('hishaku', type), 4, y - 6);
      });
      host(h, 'hishaku_yoko', 'furo', 9, 20);
      host(h, 'hishaku_yoko', 'ro', 9, 44);
      const zoom = type => { const z = P(16 * Z, 8 * Z); S.put(z.ctx, 'kiridome', type, 0, 0); return z.canvas; };
      cards.push({
        title: '柄杓：風炉用と炉用',
        views: [['上から（上：風炉用／下：炉用）', t.canvas], ['亭主の目線（横に寝かせた形）', h.canvas],
                ['切止 風炉用（拡大）', zoom('furo'), 4], ['切止 炉用（拡大）', zoom('ro'), 4]],
        order: '風炉用＝合が小さく柄が短い ／ 炉用＝合が大きく柄が長い',
        note: '切止（柄の端の切り口）は、風炉用は内側（身）を、炉用は外側（皮目）を斜めに切ります。拡大図は上が皮目、下が身です。'
      });
    }

    // 4. 蓋置に釜の蓋
    {
      const t = bgTop(72, 64), h = bgHost(72, 52);
      top(t, 'futaoki', null, 36, 32); top(t, 'kamafuta', null, 36, 32);
      host(h, 'futaoki', null, 36, 40);
      host(h, 'kamafuta', null, 36, 40 - S.SIDE.futaoki.height);
      cards.push({
        title: '蓋置に乗せた釜の蓋',
        views: [['上から', t.canvas], ['亭主の目線', h.canvas]],
        order: '蓋置 → 釜の蓋',
        note: '（形は前回のまま、亭主の目線に描き直しました）'
      });
    }

    // 5. 茶碗の仕組み
    {
      const t = bgTop(72, 64), h = bgHost(72, 52);
      top(t, 'chawan', 'empty', 36, 32);
      top(t, 'chakin_tate', null, 36, 26);                // 奥の壁に立て掛けた茶巾
      top(t, 'chasen_shikumi', null, 35, 34);             // 穂先を茶巾にあずけ、柄を手前へ
      top(t, 'chashaku', 'fuse', 43, 32); // 右の縁に、櫂先を向こうにして
      const rim = 42 - S.SIDE.chawan.mouth.dy;            // 茶碗の口の中心の高さ
      host(h, 'chawan', 'empty', 36, 42);
      host(h, 'chakin_tate', null, 36.5, rim + 2);        // 奥の壁に立て掛けた茶巾
      host(h, 'chawan', 'empty', 36, 42, 'front');
      host(h, 'chasen_shikumi', null, 35, rim + 1);       // 柄が手前の縁を越えて、切り口がこちらを向く
      host(h, 'chashaku', 'fuse', 43.5, rim);             // 右の縁を前後にまたぐ
      cards.push({
        title: '茶碗の仕組み（茶巾・茶筅・茶杓）',
        views: [['上から', t.canvas], ['亭主の目線', h.canvas]],
        order: '茶碗（全体）→ 茶巾 → 茶碗（手前側だけ）→ 茶筅 → 茶杓',
        note: '茶巾を奥の壁に立て掛け、茶筅は穂先を茶巾にあずけて柄を手前の縁に寝かせています。茶杓は右の縁に、櫂先を向こうにして渡しています。'
      });
    }

    // 6. 棗の上の茶杓
    {
      const t = bgTop(72, 64), h = bgHost(72, 52);
      top(t, 'natsume', null, 36, 32);
      top(t, 'chashaku', 'up', 36, 30);   // 節が棗の真ん中に来るように
      host(h, 'natsume', null, 36, 40);
      host(h, 'chashaku', 'up', 36, 40 - S.SIDE.natsume.top);
      cards.push({
        title: '棗の上に置いた茶杓',
        views: [['上から', t.canvas], ['亭主の目線', h.canvas]],
        order: '棗 → 茶杓',
        note: '利休型の中棗（真塗）です。茶杓を上向きにして、節が棗の真ん中に来るように置いています。'
      });
    }

    // 7. 釜の蓋を切る
    {
      const t = bgTop(150, 64), h = bgHost(150, 66);
      [['closed', 25], ['kiru', 75], ['open', 125]].forEach(([st, x]) => {
        top(t, 'furo', null, x, 32); top(t, 'kama', st, x, 32);
        furoKama(h, x, 47, st);
      });
      cards.push({
        title: '釜の蓋を手前に切る',
        views: [['上から', t.canvas, 3], ['亭主の目線', h.canvas, 3]],
        captions: ['蓋を閉めた', '手前に切った', '開けた'],
        order: '釜の絵の状態を切り替えるだけ（closed / kiru / open）',
        note: '「切った」は蓋を亭主の方へ少しずらし、向こう側のすき間から湯気が上がる形です。'
      });
    }

    return cards;
  }

  return { build };
})();
