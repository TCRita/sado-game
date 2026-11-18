/*
 * ドット絵（ピクセルアート）を、画像ファイルを使わずにコードで描く係
 * すべて真上から見た姿です。1マス＝画面上の1ドット。
 * 新しい道具の絵を足すときは、下の SPRITES に { w, h, draw } を1つ追加します。
 */
const PixelArt = (() => {

  // 種つき乱数（毎回同じ模様になる）
  function rng(seed) {
    let s = seed | 0 || 1;
    return () => {
      s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
      return (s >>> 0) / 4294967296;
    };
  }

  // 描画用の小さな画用紙と、点・四角・円などの筆
  function painter(w, h) {
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');

    const p = {
      canvas, ctx, w, h,
      px(x, y, col) { ctx.fillStyle = col; ctx.fillRect(Math.floor(x), Math.floor(y), 1, 1); },
      rect(x, y, rw, rh, col) { ctx.fillStyle = col; ctx.fillRect(x, y, rw, rh); },
      clear(x, y, rw = 1, rh = 1) { ctx.clearRect(x, y, rw, rh); },

      // 条件に合うマスを塗る（円や輪の土台）
      each(cx, cy, r, test, col) {
        ctx.fillStyle = col;
        for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++) {
          for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
            const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
            if (test(dx, dy, Math.sqrt(dx * dx + dy * dy))) ctx.fillRect(x, y, 1, 1);
          }
        }
      },
      // 楕円を塗る
      ellipse(cx, cy, rx, ry, col) {
        p.each(cx, cy, Math.max(rx, ry), (dx, dy) => (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1, col);
      },
      // 円を塗る
      disc(cx, cy, r, col) { p.each(cx, cy, r, (dx, dy, d) => d <= r, col); },
      // 輪（内側の半径 inner より外、r 以下）
      ring(cx, cy, r, inner, col) { p.each(cx, cy, r, (dx, dy, d) => d <= r && d > inner, col); },
      // 立体感のある円：影 → 本体 → 左上の光
      ball(cx, cy, r, dark, base, light) {
        p.disc(cx, cy, r, dark);
        const bx = cx - 0.6, by = cy - 0.6, br = r - 1;
        p.disc(bx, by, br, base);
        if (!light) return;
        const edge = Math.max(1.2, br * 0.18);
        p.each(bx, by, br, (dx, dy, d) => d <= br && d > br - edge && (dx + dy) < -br * 0.55, light);
        p.disc(bx - br * 0.42, by - br * 0.42, Math.max(0.7, br * 0.12), light);
      },
      // 線（t は太さ）
      line(x0, y0, x1, y1, col, t = 1) {
        ctx.fillStyle = col;
        x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
        const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
        let err = dx + dy;
        const o = Math.floor(t / 2);
        for (;;) {
          ctx.fillRect(x0 - o, y0 - o, t, t);
          if (x0 === x1 && y0 === y1) break;
          const e2 = 2 * err;
          if (e2 >= dy) { err += dy; x0 += sx; }
          if (e2 <= dx) { err += dx; y0 += sy; }
        }
      },
      // 横から見た形を、上の行から順に「半分の幅」で塗る（左を明るく、右を暗く）
      profile(cx, y0, halfWidths, col) {
        halfWidths.forEach((hw, i) => {
          const y = y0 + i;
          for (let x = Math.floor(cx - hw); x <= Math.ceil(cx + hw); x++) {
            const t = (x + 0.5 - cx) / hw;
            if (Math.abs(t) > 1) continue;
            ctx.fillStyle = t < -0.7 ? (col.light || col.base) : t > 0.62 ? (col.dark || col.base) : col.base;
            ctx.fillRect(x, y, 1, 1);
          }
        });
      },
      // 円の中にまばらな点を散らす（質感）
      speckleDisc(cx, cy, r, col, density, seed) {
        const rand = rng(seed);
        p.each(cx, cy, r, (dx, dy, d) => d <= r && rand() < density, col);
      },
      // 四角の中にまばらな点を散らす
      speckleRect(x, y, rw, rh, col, density, seed) {
        const rand = rng(seed);
        ctx.fillStyle = col;
        for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) if (rand() < density) ctx.fillRect(x + i, y + j, 1, 1);
      }
    };
    return p;
  }

  // 円周上の点
  const around = (cx, cy, r, deg) => [cx + r * Math.cos(deg * Math.PI / 180), cy + r * Math.sin(deg * Math.PI / 180)];

  // ===================================================================
  //  道具のドット絵
  //  state … 見た目の状態（茶碗の湯・抹茶、釜の蓋の有無など）
  // ===================================================================
  // ===================================================================
  //  菓子器とお菓子
  //  菓子器の state は「器:お菓子」（例 "rinka:sakuramochi"）。お菓子だけ（"manju"）なら丸鉢に盛る。
  //  state を書かない（または "season"）ときは、いまの月に合った組み合わせ（KASHIKI_SEASON）にする。
  //  1つの器には、同じ種類のお菓子だけを盛る。
  // ===================================================================
  // 月ごとの組み合わせ（器:お菓子）
  const KASHIKI_SEASON = {
    1: 'rinka:hanabira',   2: 'kaku:tsubaki',    3: 'rinka:sakuramochi', 4: 'funa:dango',
    5: 'funa:kashiwa',     6: 'kaku:minazuki',   7: 'maru:mizuyokan',    8: 'maru:kuzu',
    9: 'kaku:ohagi',      10: 'maru:kinton',    11: 'rinka:inoko',      12: 'kaku:manju'
  };
  // 器の名前・お菓子の名前（美術館・図鑑の説明用）
  const VESSELS = { maru: '染付の丸鉢', rinka: '赤絵の輪花鉢', kaku: '織部の四方鉢', funa: '志野の舟形鉢' };
  const SWEET_NAMES = {
    manju: '饅頭', sakura: '桜の干菓子', momiji: '紅葉の干菓子', kinton: '栗きんとん',
    sakuramochi: '桜餅', dango: '花見団子', ayu: '若鮎', kuzu: '葛饅頭',
    tsukimi: '月見団子', tsubaki: '椿餅', hanabira: '花びら餅',
    minazuki: '水無月', inoko: '亥の子餅', ohagi: 'おはぎ', kashiwa: '柏餅', kusamochi: '草餅',
    mizuyokan: '水羊羹', nerikiri: '練り切り（桜）',
    yatsuhashi: '生八ッ橋', fumanju: '麩饅頭', warabi: 'わらび餅', konpeito: '金平糖', wasanbon: '和三盆',
    rakugan: '落雁', aruhei: '有平糖', kohaku: '琥珀糖', suhama: '州浜', matsukaze: '松風',
    monaka: '最中', yokan: '羊羹', kanoko: '鹿の子', kimishigure: '黄身しぐれ', daifuku: '大福', kintsuba: 'きんつば'
  };
  function kashikiParts(state) {
    let st = String(state || '');
    if (!st || st === 'season') st = KASHIKI_SEASON[new Date().getMonth() + 1];
    const [v, s] = st.includes(':') ? st.split(':') : ['maru', st];
    return { vessel: VESSELS[v] ? v : 'maru', sweet: SWEET_NAMES[s] ? s : 'manju' };
  }

  // お菓子（上から見た絵）。(cx, cy) は器の真ん中。器の内側（半径 約8）に収まるように盛る
  const SWEETS = {
    manju(p, cx, cy) {                                            // 饅頭
      [[-2.8, -2], [2.8, -2], [0, 3]].forEach(([dx, dy]) => {
        const x = cx + dx, y = cy + dy;
        p.disc(x, y, 3, '#d6cbb0'); p.disc(x - 0.3, y - 0.3, 2.6, '#f7f2e6');
        p.px(x - 1, y - 1, '#ffffff'); p.px(x + 1, y + 1, '#e6a8b6');   // 艶と、焼き印のような桃色
      });
    },
    sakura(p, cx, cy) {                                           // 桜の干菓子（五弁の小さな花）
      [[-3.5, -3.5], [3.5, -3.5], [-3.5, 3.5], [3.5, 3.5]].forEach(([dx, dy]) => {
        const x = cx + dx, y = cy + dy;
        for (let k = 0; k < 5; k++) { const [px, py] = around(x, y, 1.5, k * 72 - 90); p.disc(px, py, 1, '#ec9fb4'); }
        p.disc(x, y, 0.8, '#fbe0e6');
      });
    },
    momiji(p, cx, cy) {                                           // 紅葉の干菓子
      [[-3.5, -3.5], [3.5, -3.5], [-3.5, 3.5], [3.5, 3.5]].forEach(([dx, dy], i) => {
        const x = cx + dx, y = cy + dy, c = i % 2 ? '#d9662f' : '#e0803a';
        p.disc(x, y, 2, c); p.disc(x - 1.5, y - 0.8, 1, c); p.disc(x + 1.5, y - 0.8, 1, c);   // 三つに分かれた葉
        p.px(x, y + 2, '#9a3f1c'); p.px(x, y + 1, '#b8501f');
      });
    },
    kinton(p, cx, cy) {                                           // 栗きんとん（そぼろ状の栗の餡）
      [[-2.6, -1.8], [2.8, -1.4], [0, 3]].forEach(([dx, dy]) => {
        const x = cx + dx, y = cy + dy;
        p.disc(x, y, 2.8, '#c9a040'); p.speckleDisc(x, y, 2.8, '#ecd27a', 0.45, 5 + dx); p.speckleDisc(x, y, 2.8, '#a8822a', 0.2, 9 + dy);
      });
    },
    sakuramochi(p, cx, cy) {                                      // 桜餅（道明寺。桜の葉で包んだ桃色の餅）
      [[-3, -2], [3, -1.5], [0, 3.5]].forEach(([dx, dy]) => {
        const x = cx + dx, y = cy + dy;
        p.ellipse(x + 0.6, y + 0.4, 3.4, 2.6, '#5f7f34'); p.px(x + 2, y + 1, '#8aa858');   // 桜の葉
        p.disc(x - 0.4, y - 0.3, 2.3, '#eea2b8');                                         // 餅
        p.speckleDisc(x - 0.4, y - 0.3, 2.3, '#f8cad6', 0.4, 11 + dx);                    // 道明寺の粒
      });
    },
    dango(p, cx, cy) {                                            // 花見団子（桃・白・緑の三色。串に刺す）
      [-2.6, 2.6].forEach(dy => {
        const y = cy + dy;
        p.rect(cx - 6, y, 12, 1, '#c8a86a');                                              // 串
        ['#f0a8bc', '#f6f3ea', '#9cc070'].forEach((c, i) => {
          const x = cx - 3.6 + i * 3.6;
          p.disc(x, y + 0.5, 1.8, c); p.px(x - 1, y - 0.5, '#ffffff');
        });
      });
    },
    ayu(p, cx, cy) {                                              // 若鮎（カステラ生地で求肥を包んだ、鮎の形）
      [-2.6, 2.8].forEach((dy, i) => {
        const x = cx + (i ? 0.8 : -0.8), y = cy + dy;
        p.ellipse(x, y, 5.2, 2.1, '#d4ad6c');                                             // 体
        p.rect(x + 4.6, y - 1.5, 1.4, 3, '#c49a58');                                      // 尾びれ
        p.rect(x - 2, y - 1, 1, 2, '#8a5a2a'); p.rect(x + 0.5, y - 1, 1, 2, '#8a5a2a');   // 焼き印のひれ
        p.px(x - 3.8, y - 0.6, '#2a1a10');                                                // 目
      });
    },
    kuzu(p, cx, cy) {                                             // 葛饅頭（透きとおった葛で、こし餡を包む）
      [[-3, -2], [3, -2], [0, 3]].forEach(([dx, dy]) => {
        const x = cx + dx, y = cy + dy;
        p.disc(x, y, 3, '#c8d8d2'); p.disc(x, y, 2.6, '#dfece7');
        p.disc(x + 0.2, y + 0.2, 1.4, '#5a3a34');                                          // 透けて見える餡
        p.px(x - 1.4, y - 1.4, '#ffffff');
      });
    },
    tsukimi(p, cx, cy) {                                          // 月見団子（白い団子を三段に積む）
      const ball = (x, y) => { p.disc(x, y, 1.9, '#d6cfbe'); p.disc(x - 0.3, y - 0.3, 1.6, '#faf8f0'); };
      [[-3.6, 2.6], [0, 2.6], [3.6, 2.6], [-1.8, -0.4], [1.8, -0.4], [0, -3.2]].forEach(([dx, dy]) => ball(cx + dx, cy + dy));
    },
    tsubaki(p, cx, cy) {                                          // 椿餅（道明寺の餅を、二枚の椿の葉ではさむ）
      [-3.2, 3.4].forEach(dx => {
        const x = cx + dx;
        p.ellipse(x, cy - 3.3, 1.8, 2.6, '#2f5a2a'); p.ellipse(x, cy + 3.3, 1.8, 2.6, '#2f5a2a');   // 椿の葉
        p.px(x, cy - 4, '#5a8a48'); p.px(x, cy + 4, '#5a8a48');
        p.ellipse(x, cy, 2.4, 2, '#f2eee2'); p.speckleDisc(x, cy, 2, '#ffffff', 0.3, 13 + dx);     // 餅
      });
    },
    minazuki(p, cx, cy) {                                         // 水無月（白い外郎の三角の上を、小豆がすき間なくおおう）
      [[-3.2, 0.5, 1], [3.2, -0.5, -1]].forEach(([dx, dy, f], i) => {
        const x = cx + dx, y = cy + dy, inT = (ex, ey, k) => { const v = ey * f; return v >= -4 + k && v <= 3.4 - k * 0.3 && Math.abs(ex) <= (v + 4 - k) * 0.5; };
        p.each(x, y, 5, (ex, ey) => inT(ex, ey, 0), '#f4f0e6');          // 外郎（ふちに白く見える）
        p.each(x, y, 5, (ex, ey) => inT(ex, ey, 1.2), '#5a1e1e');        // 小豆
        const r = rng(71 + i);
        p.each(x, y, 5, (ex, ey) => inT(ex, ey, 1.6) && r() < 0.35, '#8a3a34');
      });
    },
    inoko(p, cx, cy) {                                            // 亥の子餅（うり坊のような、縞のある茶色の餅）
      [[-3, -2.4], [3, -2], [0, 3.2]].forEach(([dx, dy]) => {
        const x = cx + dx, y = cy + dy;
        p.ellipse(x, y, 3.2, 2.3, '#8a5e3a'); p.ellipse(x - 0.3, y - 0.3, 2.8, 1.9, '#a8764a');
        [-1.2, 0, 1.2].forEach(k => p.rect(x + k, y - 1.6, 0.6, 3.2, '#6a4428'));   // 縞
      });
    },
    ohagi(p, cx, cy) {                                            // おはぎ（もち米を、つぶ餡で包む）
      [[-3, -2.2], [3, -2], [0, 3.2]].forEach(([dx, dy]) => {
        const x = cx + dx, y = cy + dy;
        p.ellipse(x, y, 3.3, 2.6, '#4a2620'); p.ellipse(x - 0.3, y - 0.3, 2.9, 2.2, '#6a3430');
        p.speckleDisc(x, y, 2.5, '#2e1612', 0.35, 41 + dx); p.px(x - 1, y - 1, '#a86a5e');
      });
    },
    kashiwa(p, cx, cy) {                                          // 柏餅（白い餅を、柏の葉で包む）
      [[-2.8, -2.4], [2.8, -1.8], [0, 3.2]].forEach(([dx, dy]) => {
        const x = cx + dx, y = cy + dy;
        p.ellipse(x, y, 3.6, 2.6, '#4f6e30'); p.rect(x - 3, y, 6, 1, '#3a5424');                      // 柏の葉（真ん中で二つ折り）
        p.ellipse(x, y - 1.2, 2.6, 1.1, '#f4f0e4');                                                  // 葉のあいだから見える白い餅
      });
    },
    kusamochi(p, cx, cy) {                                        // 草餅（よもぎの緑の餅）
      [[-2.8, -2], [2.8, -2], [0, 3]].forEach(([dx, dy]) => {
        const x = cx + dx, y = cy + dy;
        p.disc(x, y, 3, '#4e6a34'); p.disc(x - 0.3, y - 0.3, 2.6, '#6e8a48');
        p.speckleDisc(x, y, 2.4, '#3e5428', 0.12, 51 + dx); p.px(x - 1, y - 1, '#9ab47a');
      });
    },
    mizuyokan(p, cx, cy) {                                        // 水羊羹（四角く切った、つやのある小豆色）
      [[-3, -2.6], [3, -2.2], [0, 3]].forEach(([dx, dy]) => {
        const x = cx + dx, y = cy + dy;
        p.rect(x - 2.6, y - 1.8, 5.2, 3.6, '#4a1e1e'); p.rect(x - 2.2, y - 1.4, 4.4, 2.8, '#6a2a2a');
        p.rect(x - 1.8, y - 1.2, 2.4, 0.8, '#a4605a');                                               // つや
      });
    },
    nerikiri(p, cx, cy) {                                         // 練り切り（桜の形。桃色に、黄色のしべ）
      [[-3.4, -2.4], [3.4, -2.4], [0, 3.2]].forEach(([dx, dy]) => {
        const x = cx + dx, y = cy + dy;
        for (let k = 0; k < 5; k++) { const [px, py] = around(x, y, 1.6, k * 72 - 90); p.disc(px, py, 1.3, '#f3b4c4'); }
        p.disc(x, y, 1.2, '#f8d4de'); p.px(x, y, '#e8c048');
      });
    },
    hanabira(p, cx, cy) {                                         // 花びら餅（白い餅を二つに折り、桃色の菱と牛蒡をはさむ）
      [-2.6, 2.8].forEach((dy, i) => {
        const x = cx + (i ? 0.6 : -0.6), y = cy + dy;
        p.ellipse(x, y, 4.6, 2.3, '#e8e2d6'); p.ellipse(x - 0.2, y - 0.2, 4.2, 2, '#fbf8f2');      // 餅
        p.ellipse(x, y + 0.6, 2.4, 0.9, '#f2b8c6');                                               // 桃色の菱餅
        p.rect(x - 6, y - 0.3, 3, 1, '#8a6a42'); p.rect(x + 4, y - 0.3, 2, 1, '#8a6a42');         // 牛蒡
      });
    }
  };

  // ---- お菓子を1つだけ大きく、はっきり見せる絵（32 × 32。少し斜め上から見た形。図鑑・美術館で使う）----
  const OL = '#3a2a22';                                           // ふちどりの色
  const big = {
    shadow(p) { p.ellipse(16, 27.5, 11, 2.6, 'rgba(0,0,0,0.18)'); },
    dome(p, cx, cy, rx, ry, fill, light, ol = OL) {               // ふちどりした、まるい形
      p.ellipse(cx, cy, rx + 1, ry + 1, ol); p.ellipse(cx, cy, rx, ry, fill);
      p.ellipse(cx - rx * 0.35, cy - ry * 0.4, rx * 0.35, ry * 0.25, light);
    },
    tri(p, ax, ay, bx, by, cx, cy, col) {                         // 三角形をぬる
      const minx = Math.min(ax, bx, cx), maxx = Math.max(ax, bx, cx), miny = Math.min(ay, by, cy), maxy = Math.max(ay, by, cy);
      const sgn = (x1, y1, x2, y2, x3, y3) => (x1 - x3) * (y2 - y3) - (x2 - x3) * (y1 - y3);
      for (let y = Math.floor(miny); y <= maxy; y++) for (let x = Math.floor(minx); x <= maxx; x++) {
        const px = x + 0.5, py = y + 0.5, d1 = sgn(px, py, ax, ay, bx, by), d2 = sgn(px, py, bx, by, cx, cy), d3 = sgn(px, py, cx, cy, ax, ay);
        if (!((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))) p.rect(x, y, 1, 1, col);
      }
    },
    leaf(p, cx, cy, rx, ry, col, vein) {                          // 葉（真ん中に葉脈）
      p.ellipse(cx, cy, rx + 1, ry + 1, '#1e2a14'); p.ellipse(cx, cy, rx, ry, col);
      p.rect(cx - rx + 2, Math.round(cy), rx * 2 - 4, 1, vein);
      for (let k = -2; k <= 2; k++) p.line(cx + k * rx / 3, cy, cx + k * rx / 3 + 2, cy - ry * 0.6, vein);
    }
  };
  const OKASHI_BIG = {
    manju(p) { big.shadow(p); big.dome(p, 16, 18, 12, 8.5, '#f4ecdc', '#fffaf0'); p.ellipse(16, 21, 11, 4, '#e6dac4'); p.ring(16, 14.5, 3.4, 2.4, '#9a6a3a'); p.disc(16, 14.5, 1, '#9a6a3a'); },
    sakura(p) {
      for (let k = 0; k < 5; k++) { const [x, y] = around(16, 16, 7, k * 72 - 90); p.disc(x, y, 6, '#b05878'); }
      for (let k = 0; k < 5; k++) { const [x, y] = around(16, 16, 7, k * 72 - 90); p.disc(x, y, 5, '#f2a6bc'); const [nx, ny] = around(16, 16, 12, k * 72 - 90); p.disc(nx, ny, 1.2, 'rgba(0,0,0,0)'); p.rect(Math.round(nx) - 0.5, Math.round(ny) - 0.5, 1, 1, '#b05878'); }
      p.disc(16, 16, 4, '#fbd6e0'); for (let k = 0; k < 5; k++) { const [x, y] = around(16, 16, 2.4, k * 72); p.px(x, y, '#e8b830'); }
    },
    momiji(p) {                                                   // 紅葉：5つに分かれた、幅の広い葉
      const tips = [[16, 2], [28, 10], [25, 24], [7, 24], [4, 10]];
      tips.forEach(([x, y]) => { const a = Math.atan2(y - 16, x - 16), nx = -Math.sin(a) * 5.5, ny = Math.cos(a) * 5.5; big.tri(p, x, y, 16 + nx, 16 + ny, 16 - nx, 16 - ny, '#7a2a10'); });
      tips.forEach(([x, y]) => { const a = Math.atan2(y - 16, x - 16), nx = -Math.sin(a) * 4.2, ny = Math.cos(a) * 4.2; big.tri(p, x - Math.cos(a), y - Math.sin(a), 16 + nx, 16 + ny, 16 - nx, 16 - ny, '#e2702e'); });
      p.disc(16, 16, 6.5, '#e2702e');
      tips.forEach(([x, y]) => p.line(16, 16, x - (x - 16) * 0.15, y - (y - 16) * 0.15, '#b84a1c'));   // 葉脈
      p.line(16, 20, 16, 30, '#7a3a18', 1.5);                                                  // 柄
    },
    kinton(p) { big.shadow(p); big.dome(p, 16, 17, 11, 9, '#d4a838', '#f0d070'); p.speckleDisc(16, 17, 10, '#f2dc8a', 0.35, 5); p.speckleDisc(16, 17, 10, '#a8801e', 0.25, 9); },
    sakuramochi(p) { big.shadow(p); big.leaf(p, 17, 19, 13, 7, '#5f8034', '#3e5a20'); big.dome(p, 15, 15, 9, 7.5, '#eea2b8', '#fbd2de'); p.speckleDisc(15, 15, 8, '#f8c8d6', 0.35, 11); p.speckleDisc(15, 15, 8, '#d888a0', 0.15, 13); },
    dango(p) {
      p.line(4, 28, 28, 4, '#8a6a3a', 1.5); p.line(4, 28, 28, 4, '#d8b878', 0.5);
      [[9, 23, '#f0a8bc'], [16, 16, '#f8f6ee'], [23, 9, '#9cc070']].forEach(([x, y, c]) => big.dome(p, x, y, 5.2, 5.2, c, '#ffffff'));
    },
    ayu(p) {
      big.shadow(p);
      p.ellipse(15, 16, 12.5, 6.5, OL); p.ellipse(15, 16, 11.5, 5.5, '#d8b070');
      big.tri(p, 25, 16, 31, 9, 31, 23, OL); big.tri(p, 26, 16, 30, 11, 30, 21, '#c49a58');   // 尾びれ
      p.ellipse(13, 18, 9, 2, '#f0d8a8');                                                     // 求肥が見えるおなか
      [10, 14, 18].forEach(x => p.rect(x, 11, 1.5, 5, '#7a4a20'));                            // 焼き印
      p.disc(6.5, 14.5, 1.4, '#ffffff'); p.disc(6.5, 14.5, 0.8, '#1a1010');                    // 目
    },
    kuzu(p) { big.shadow(p); big.dome(p, 16, 17, 11.5, 9, '#d4e6e0', '#ffffff', '#7a9a94'); p.ellipse(16, 18.5, 6, 4.5, '#5a3a34'); p.ellipse(16, 18.5, 4.5, 3.2, '#6e4a42'); p.ellipse(11, 13, 2.5, 1.5, '#ffffff'); },
    tsukimi(p) {
      p.rect(4, 22, 24, 4, '#7a5a38'); p.rect(4, 22, 24, 1, '#a8885a');                       // 三方の台
      [[9, 18], [16, 18], [23, 18], [12.5, 12], [19.5, 12], [16, 6]].forEach(([x, y]) => big.dome(p, x, y, 3.8, 3.6, '#fbf9f2', '#ffffff', '#8a8070'));
    },
    tsubaki(p) {
      big.leaf(p, 16, 9, 12, 5, '#2f5a2a', '#1e3e1a'); big.leaf(p, 16, 23, 12, 5, '#2f5a2a', '#1e3e1a');
      big.dome(p, 16, 16, 8.5, 5.5, '#f2eee2', '#ffffff'); p.speckleDisc(16, 16, 6, '#ffffff', 0.3, 13);
    },
    hanabira(p) {
      big.shadow(p);
      p.line(2, 17, 30, 15, '#5a3a20', 2.5); p.line(2, 17, 30, 15, '#9a7244', 1);              // 牛蒡
      p.ellipse(16, 17, 12, 8, OL); p.ellipse(16, 17, 11, 7, '#fbf8f2');
      p.ellipse(16, 19.5, 9, 3, '#f2b8c6'); p.ellipse(16, 20, 7, 1.8, '#f8d0da');            // 透ける桃色の菱
      p.line(5, 16, 27, 16, '#e0d8c8');                                                       // 折り目
    },
    minazuki(p) {                                                 // 水無月：白い外郎の三角。上の面は、小豆がすき間なくのっている
      big.shadow(p);
      big.tri(p, 16, 3, 2, 21, 30, 21, OL); p.rect(2, 21, 29, 7, OL);
      p.rect(3, 21, 27, 6, '#f6f2e8'); p.rect(3, 21, 27, 1, '#e4ddcc'); p.rect(3, 25, 27, 2, '#e8e2d4');   // 外郎の側面（白く、少し透ける）
      big.tri(p, 16, 5, 4, 21, 28, 21, '#4a1616');                                          // 上の面：小豆の蜜
      const r = rng(81);
      for (let y = 7; y < 21; y += 2.2) for (let x = 4; x < 28; x += 2.6) {
        const xx = x + (Math.floor(y) % 2 ? 1.3 : 0) + (r() - 0.5), w = (y - 5) * 0.5;
        if (Math.abs(xx - 16) > w - 0.8) continue;
        p.ellipse(xx, y, 1.4, 1, '#7a2a28'); p.px(xx - 0.6, y - 0.6, '#c06a5e');             // 小豆の粒とつや
      }
    },
    inoko(p) {
      big.shadow(p); big.dome(p, 16, 17, 12, 8, '#a8744a', '#c8946a');
      [11, 16, 21].forEach(x => { p.line(x - 1, 10, x + 1, 24, '#5a3418', 1.5); });            // うり坊の縞
      p.speckleDisc(16, 17, 9, '#2a1a10', 0.06, 21);                                          // ごま
    },
    ohagi(p) { big.shadow(p); big.dome(p, 16, 17, 12, 8.5, '#5a2c26', '#8a4a40'); p.speckleDisc(16, 17, 10, '#2a1010', 0.3, 41); p.speckleDisc(16, 17, 10, '#9a5a4e', 0.12, 43); },
    kashiwa(p) {
      big.shadow(p);
      p.ellipse(16, 18, 14, 9, '#1e2a14'); p.ellipse(16, 18, 13, 8, '#56743a');               // 柏の葉
      for (let k = 0; k < 6; k++) p.disc(5 + k * 4.4, 10.5 + (k % 2), 2, '#56743a');          // 葉のふちの、なみなみ
      p.rect(4, 18, 24, 1, '#3a5424');
      big.dome(p, 16, 16, 8, 5.5, '#f6f2e8', '#ffffff');                                      // 葉から見える白い餅
    },
    kusamochi(p) { big.shadow(p); big.dome(p, 16, 17, 11.5, 8.5, '#5e7a3c', '#8aa864'); p.speckleDisc(16, 17, 10, '#3e5428', 0.3, 51); p.speckleDisc(16, 17, 10, '#a8c088', 0.08, 53); },
    mizuyokan(p) {
      big.shadow(p);
      p.rect(5, 8, 22, 18, OL); p.rect(6, 9, 20, 16, '#5e2222');                              // 四角い羊羹
      p.rect(6, 9, 20, 5, '#7a3030');                                                         // 上の面
      p.rect(8, 10, 9, 2, '#c47870'); p.rect(8, 16, 2, 6, '#8a3a36');                         // つや
    },
    yatsuhashi(p) {                                               // 生八ッ橋：ニッキの香る薄い生地を三角に折り、餡をはさむ
      big.shadow(p);
      big.tri(p, 4, 25, 28, 25, 16, 4, OL);
      big.tri(p, 6, 24, 26, 24, 16, 6, '#efe0c0');                                          // 生地
      p.ellipse(16, 22, 7, 2.6, '#4a2620'); p.ellipse(15, 21.5, 3, 1, '#7a4a40');              // 中の餡が見える
      big.tri(p, 6, 24, 26, 24, 16, 13, '#e4d0a8');                                         // 手前に折った生地
      p.line(16, 6, 16, 13, '#d4bc90');
      const r = rng(91); p.each(16, 16, 14, (dx, dy) => { const y = 16 + dy; return y > 7 && y < 24 && Math.abs(dx) < (y - 5) * 0.5 && r() < 0.08; }, '#c8a070');   // ニッキの粉（生地の上だけ）
      p.ellipse(16, 18, 6, 2.2, '#efe0c0'); p.ellipse(16, 17.5, 5, 1.4, '#f8eed8');           // 餡のふくらみ
    },
    fumanju(p) {                                                  // 麩饅頭：笹の葉で包んだ、もちもちの生麩
      big.shadow(p);
      big.leaf(p, 16, 19, 14, 7, '#3f6a2a', '#2a4a1c');                                    // 笹の葉
      big.dome(p, 16, 16, 10, 7, '#a8c890', '#e0f0d0');                                   // よもぎの生麩
      p.ellipse(16, 18, 9, 3, '#94b47c'); p.ellipse(16, 18.5, 4, 1.4, '#6a4a3a');           // 透けるこし餡
      p.line(6, 13, 12, 22, '#3f6a2a', 2); p.line(26, 13, 20, 22, '#3f6a2a', 2);           // 葉が包む
    },
    warabi(p) {                                                   // わらび餅：ぷるぷるの餅に、きな粉をまぶす
      big.shadow(p);
      const r = rng(95);
      [[10, 19], [21, 20], [15, 12], [24, 12]].forEach(([x, y]) => {
        p.ellipse(x, y, 5.6, 4.6, '#6a5a40'); p.ellipse(x, y, 4.8, 3.8, '#c8bc98');
        p.ellipse(x - 1.5, y - 1.5, 1.6, 1, '#f4ecd6');
        p.each(x, y, 6, (dx, dy) => (dx * dx) / 23 + (dy * dy) / 14.4 <= 1 && r() < 0.45, '#d6a85a');   // きな粉
      });
    },
    konpeito(p) {                                                 // 金平糖：小さな角のある、色とりどりの砂糖の粒
      const cols = ['#fbf8f0', '#f6b8c8', '#f6e08a', '#b8e0a0', '#a8d0f0', '#fbf8f0', '#f6b8c8', '#f6e08a', '#fbf8f0', '#b8e0a0', '#a8d0f0'];
      [[9, 20], [15, 22], [21, 20], [26, 23], [12, 14], [18, 15], [24, 15], [6, 25], [15, 8], [21, 9], [10, 26]].forEach(([x, y], i) => {
        for (let k = 0; k < 8; k++) { const [bx, by] = around(x, y, 2.6, k * 45 + i * 7); p.px(bx, by, '#8a8070'); }
        p.disc(x, y, 2.4, '#8a8070'); p.disc(x, y, 2, cols[i]);
        for (let k = 0; k < 8; k++) { const [bx, by] = around(x, y, 2.4, k * 45 + i * 7); p.px(bx, by, cols[i]); }
        p.px(x - 1, y - 1, '#ffffff');
      });
    },
    wasanbon(p) {                                                 // 和三盆：きめ細かい砂糖を、花・葉・貝の型で押した干菓子
      big.shadow(p);
      for (let k = 0; k < 5; k++) { const [x, y] = around(10, 11, 3.2, k * 72 - 90); p.disc(x, y, 3.2, '#c88a9a'); }
      for (let k = 0; k < 5; k++) { const [x, y] = around(10, 11, 3.2, k * 72 - 90); p.disc(x, y, 2.6, '#f6ccd6'); } p.disc(10, 11, 1.4, '#fbe6ec');   // 桜
      p.ellipse(22, 11, 6, 3.6, '#7e9a5e'); p.ellipse(22, 11, 5.2, 2.8, '#c8dcae'); p.line(17, 11, 27, 11, '#9ab47a');                     // 葉
      p.ellipse(16, 22, 7, 5, '#a89a80');                                                                                                // 貝
      p.ellipse(16, 22, 6.2, 4.3, '#f8f2e4');
      for (let k = -2; k <= 2; k++) p.line(16, 26, 16 + k * 2.6, 18.5, '#e0d6c0');
    },
    rakugan(p) {                                                  // 落雁：米の粉と砂糖を木型で押し固めた干菓子
      big.shadow(p);
      [[4, 8, '#f4ecd8'], [17, 12, '#f6d2da']].forEach(([x, y, c]) => {
        p.rect(x - 1, y - 1, 13, 13, '#9a8c70'); p.rect(x, y, 11, 11, c);
        p.ring(x + 5.5, y + 5.5, 4.2, 3.2, '#d8ccb0'); p.disc(x + 5.5, y + 5.5, 1.6, '#d8ccb0');     // 押した紋
        p.rect(x, y, 11, 1, '#ffffff');
      });
    },
    aruhei(p) {                                                   // 有平糖：煮詰めた砂糖を引きのばし、ねじって形にした飴
      for (let i = 0; i < 26; i++) {
        const t = i / 25, x = 4 + t * 24, y = 16 + Math.sin(t * Math.PI * 2.2) * 8;
        p.disc(x, y, 3.2, '#9a7a7a'); p.disc(x, y, 2.6, i % 4 < 2 ? '#fbf6f0' : '#e8607a');
        p.px(x - 1, y - 1, '#ffffff');
      }
    },
    kohaku(p) {                                                   // 琥珀糖：寒天と砂糖を固め、外はしゃり、中はぷるん
      big.shadow(p);
      [[9, 12, '#a8d4ec'], [20, 10, '#f4b4c4'], [14, 21, '#c8e4a0'], [24, 21, '#d4b8ec'], [6, 22, '#f6e09a']].forEach(([x, y, c]) => {
        big.tri(p, x - 4.5, y + 3, x + 4.5, y + 3.5, x - 1, y - 5, '#8a8090');
        big.tri(p, x + 4.5, y + 3.5, x + 4, y - 3, x - 1, y - 5, '#8a8090');
        big.tri(p, x - 3.5, y + 2.5, x + 3.5, y + 2.6, x - 1, y - 4, c);
        big.tri(p, x + 3.5, y + 2.6, x + 3.2, y - 2.2, x - 1, y - 4, c);
        p.px(x - 1, y - 2, '#ffffff'); p.px(x, y - 1, '#ffffff');                            // 外の砂糖のしゃり
      });
    },
    suhama(p) {                                                   // 州浜：きな粉と水飴を練り、州浜（入り江）の形にしたもの
      big.shadow(p);
      [[11, 14, '#8eb05e', '#c4dca0'], [21, 19, '#d8b45a', '#f0dc98']].forEach(([x, y, c, l]) => {
        [[-3, 1.5], [3, 1.5], [0, -2.6]].forEach(([dx, dy]) => p.disc(x + dx, y + dy, 4.6, '#5a5a3a'));
        [[-3, 1.5], [3, 1.5], [0, -2.6]].forEach(([dx, dy]) => p.disc(x + dx, y + dy, 3.9, c));
        p.disc(x - 1, y - 1, 1.6, l);
      });
    },
    matsukaze(p) {                                                // 松風：小麦粉の生地を焼き、表にけしの実をふった、京都の干菓子
      big.shadow(p);
      p.rect(3, 9, 26, 17, OL); p.rect(4, 10, 24, 11, '#b97a38'); p.rect(4, 21, 24, 4, '#efe0bc');   // 焼き色の表と、白い裏
      const r = rng(107); p.each(16, 15, 13, (dx, dy) => Math.abs(dx) < 11 && dy > -5 && dy < 5 && r() < 0.22, '#f4ecd6');   // けしの実
      p.rect(5, 11, 22, 1, '#d89a54');
    },
    monaka(p) {                                                   // 最中：餅米の皮を焼いた種に、餡をはさむ
      big.shadow(p);
      p.ellipse(16, 21, 12, 3, '#4a2620');                                                  // はみ出した餡
      for (let k = 0; k < 6; k++) { const [x, y] = around(16, 16, 6.5, k * 60); p.disc(x, y, 5.8, '#8a6a3a'); }
      for (let k = 0; k < 6; k++) { const [x, y] = around(16, 16, 6.5, k * 60); p.disc(x, y, 5, '#e2c486'); }
      p.disc(16, 16, 6, '#e2c486'); p.ring(16, 16, 6, 5, '#c8a468');
      for (let k = 0; k < 6; k++) { const [x, y] = around(16, 16, 9, k * 60 + 30); p.line(16, 16, x, y, '#c8a468'); }   // 型の模様
    },
    yokan(p) {                                                    // 羊羹：小豆の餡を寒天で固めた、つやのある棹物
      big.shadow(p);
      p.rect(3, 10, 18, 15, OL); p.rect(4, 11, 16, 13, '#3a1216'); p.rect(4, 11, 16, 3, '#5a2024');   // 棹
      p.rect(6, 12, 8, 1, '#a0545a');                                                       // つや
      p.rect(21, 13, 9, 13, OL); p.rect(22, 14, 7, 11, '#4a181c'); p.rect(23, 15, 2, 6, '#7a3036');  // 切った一切れ
    },
    kanoko(p) {                                                   // 鹿の子：餡の玉のまわりに、蜜煮の小豆をつける
      big.shadow(p);
      p.ellipse(16, 17, 12, 10, OL); p.ellipse(16, 17, 11, 9, '#4a1a1a');
      const r = rng(111);
      for (let y = 9; y < 26; y += 2.4) for (let x = 6; x < 27; x += 2.8) {
        const xx = x + (Math.floor(y) % 2 ? 1.4 : 0) + (r() - 0.5) * 0.6;
        if (((xx - 16) ** 2) / 110 + ((y - 17) ** 2) / 72 > 1) continue;
        p.ellipse(xx, y, 1.5, 1.1, '#8a2e2a'); p.px(xx - 0.6, y - 0.6, '#d07a6e');
      }
    },
    kimishigure(p) {                                              // 黄身しぐれ：黄身餡を蒸して、上がひび割れた形
      big.shadow(p); big.dome(p, 16, 17, 11.5, 9, '#f2cc5a', '#fbe6a0');
      p.line(10, 12, 15, 16, '#7a3a28', 1.5); p.line(15, 16, 13, 21, '#7a3a28', 1.5); p.line(15, 16, 22, 14, '#7a3a28', 1.5); p.line(22, 14, 24, 19, '#7a3a28', 1);   // ひびから見える餡
    },
    daifuku(p) {                                                  // 大福：やわらかい餅で餡を包み、粉をまぶす
      big.shadow(p); big.dome(p, 16, 18, 12, 8.5, '#f8f4ec', '#ffffff', '#8a8278');
      p.ellipse(16, 18.5, 6, 3.5, '#e2d8dc');                                               // うっすら透ける餡
      const r = rng(115); p.each(16, 18, 13, (dx, dy) => (dx * dx) / 144 + (dy * dy) / 72 <= 1 && r() < 0.12, '#ffffff');   // 粉
    },
    kintsuba(p) {                                                 // きんつば：寒天で固めた小豆に、薄い衣をつけて焼く
      big.shadow(p);
      p.rect(5, 6, 22, 21, OL); p.rect(6, 12, 20, 14, '#6a2e26'); p.rect(6, 7, 20, 5, '#8a4434');   // 前の面・上の面
      const r = rng(119); p.each(16, 18, 11, (dx, dy) => Math.abs(dx) < 9.5 && dy > -5 && dy < 7.5 && r() < 0.3, '#4a1a16');   // 小豆の粒
      p.rect(6, 12, 20, 1, '#c8885a'); p.rect(6, 7, 20, 1, '#d8a070');                       // 焼いた衣のふち
    },
    nerikiri(p) {
      big.shadow(p);
      for (let k = 0; k < 5; k++) { const [x, y] = around(16, 16, 6.5, k * 72 - 90); p.disc(x, y, 6.6, '#a86a7c'); }
      for (let k = 0; k < 5; k++) { const [x, y] = around(16, 16, 6.5, k * 72 - 90); p.disc(x, y, 5.6, '#f4b8c8'); p.disc(x, y, 3, '#fad4de'); }
      for (let k = 0; k < 5; k++) { const [x, y] = around(16, 16, 11, k * 72 - 90); p.rect(Math.round(x), Math.round(y), 1, 1, '#a86a7c'); }   // 花びらの切れ込み
      p.disc(16, 16, 3, '#f0d060'); p.speckleDisc(16, 16, 3, '#d8a830', 0.4, 61);             // きんとんのしべ
    }
  };

  // 菓子器（陶器）。上から見た絵。(cx, cy) は器の真ん中。28 × 28 の中に描く
  const VESSEL_DRAW = {
    maru(p, cx, cy) {                                             // 染付の丸鉢：白い釉に、ふちの藍の点
      p.disc(cx + 0.4, cy + 0.8, 11.4, '#6f6656');
      p.ball(cx, cy, 11.2, '#b7ad96', '#f1ead8', '#fffaf0');
      p.ring(cx, cy, 11, 8.4, '#ebe3cf');
      for (let a = 0; a < 360; a += 30) { const [x, y] = around(cx, cy, 9.7, a); p.px(x, y, '#7a98c0'); }
      p.ring(cx, cy, 8.6, 8, '#cfc5ad');
      p.disc(cx, cy, 8, '#dcd2bb'); p.disc(cx + 0.3, cy + 0.3, 7.2, '#f0e9d8');
    },
    rinka(p, cx, cy) {                                            // 赤絵の輪花鉢：ふちが花びらのように五つにうねる。ふちに朱の線
      const R = a => 10.4 + 2 * Math.abs(Math.cos(2.5 * a));      // 丸い花びらが5枚。花びらの間は、くぼむ
      p.each(cx + 0.4, cy + 0.8, 13.5, (dx, dy, d) => d <= R(Math.atan2(dy, dx)), '#6f6656');
      p.each(cx, cy, 13.5, (dx, dy, d) => d <= R(Math.atan2(dy, dx)), '#efe4cc');
      p.each(cx, cy, 13.5, (dx, dy, d) => { const r = R(Math.atan2(dy, dx)); return d <= r && d > r - 1.1; }, '#c8483a');   // 朱のふち
      p.each(cx, cy, 13.5, (dx, dy, d) => { const r = R(Math.atan2(dy, dx)); return d <= r - 1.1 && d > r - 2 && dx + dy < -3; }, '#fffaf0');
      for (let k = 0; k < 5; k++) { const [x, y] = around(cx, cy, 9.4, k * 72); p.disc(x, y, 0.9, '#d0604a'); }   // 赤絵の小花
      p.disc(cx, cy, 8, '#e2d6bc'); p.disc(cx + 0.3, cy + 0.3, 7.2, '#f4ecdc');
    },
    kaku(p, cx, cy) {                                             // 織部の四方鉢：角を丸めた四角。片側に緑の釉、反対側に鉄絵の縞
      const H = 11.5, rr = 3;
      const inSq = (dx, dy, h, r) => { const ax = Math.abs(dx), ay = Math.abs(dy); if (ax > h || ay > h) return false; if (ax > h - r && ay > h - r) return Math.hypot(ax - (h - r), ay - (h - r)) <= r; return true; };
      p.each(cx + 0.5, cy + 0.8, 16, (dx, dy) => inSq(dx, dy, H, rr), '#6f6656');
      p.each(cx, cy, 16, (dx, dy) => inSq(dx, dy, H, rr), '#e8dcc0');                       // 白い釉
      p.each(cx, cy, 16, (dx, dy) => inSq(dx, dy, H, rr) && dx + dy < -6, '#4f7a3a');          // 織部の緑（左上）
      p.each(cx, cy, 16, (dx, dy) => inSq(dx, dy, H, rr) && dx + dy < -9 && (dx * 7 + dy * 3) % 4 < 1, '#3a5e2a');
      for (let k = 0; k < 3; k++) p.rect(cx + 5 + k * 2, cy + 4, 1, 6, '#6a4a2a');             // 鉄絵の縞（右下）
      p.each(cx, cy, 16, (dx, dy) => inSq(dx, dy, H, rr) && !inSq(dx, dy, H - 1, rr), '#a89870');   // ふち
      p.each(cx, cy, 16, (dx, dy) => inSq(dx, dy, 8, 2), '#e4d8bc');                         // 内側
      p.each(cx + 0.3, cy + 0.3, 16, (dx, dy) => inSq(dx, dy, 7.3, 2), '#f2eadc');
    },
    funa(p, cx, cy) {                                             // 志野の舟形鉢：横長の舟の形。白い長石釉に、ほんのり緋色
      p.ellipse(cx + 0.4, cy + 0.8, 13.4, 9.4, '#6f6656');
      p.ellipse(cx, cy, 13.2, 9.2, '#d8ccb6');
      p.ellipse(cx, cy, 12.6, 8.6, '#f3ede2');
      const inF = (dx, dy, a, b) => (dx * dx) / (a * a) + (dy * dy) / (b * b) <= 1;
      const r1 = rng(31), r2 = rng(37);
      p.each(cx, cy, 14, (dx, dy) => inF(dx, dy, 12.6, 8.6) && r1() < 0.06, '#e2a070');      // 緋色
      p.each(cx, cy, 14, (dx, dy) => (dx * dx) / (12.6 * 12.6) + (dy * dy) / (8.6 * 8.6) <= 1 && (dx * dx) / (11 * 11) + (dy * dy) / (7.2 * 7.2) > 1 && dx > 4, '#e8b088');
      p.ellipse(cx, cy, 10.6, 6.8, '#e6dccb'); p.ellipse(cx + 0.3, cy + 0.3, 9.8, 6.2, '#f6f1e8');
      p.each(cx, cy, 14, (dx, dy) => inF(dx, dy, 12.4, 8.4) && r2() < 0.05, '#ffffff');      // 釉の小さな穴（柚子肌）
    }
  };

  const PERSON_W = 66, PERSON_H = 58;   // 座った人の絵の大きさ（前後66 × 肩幅58）。personBig で描く
  const SPRITES = {

    // 亭主（真上から見て、右を向いて座っている）。1ドット＝1cm に合わせて、座った人の大きさ（約50cm）にしてある
    teishu: { w: PERSON_W, h: PERSON_H, draw(p) { personBig(p, { body: '#2f3a5e', bodyD: '#19213a', lap: '#34406a', lapD: '#1d2640', hi: '#3c4a74' }); } },

    // お客様（亭主と同じ形で、着物の色を変えたもの）
    kyaku: { w: PERSON_W, h: PERSON_H, draw(p) { personBig(p, { body: '#4a5e3a', bodyD: '#2a3620', lap: '#56704a', lapD: '#2e3c24', hi: '#62784e' }); } },

    // 風炉先屏風（二つ折り。真上から見た線）
    // 蝶番を点前畳の向こうの角に置き、直角に折って「釜の奥」と「勝手付」の2面に立てる。1面 約88cm
    // （絵は「亭主が左」の向き。画面では左に90度回るので、x の線が向こう側、y の線が勝手付側になる）
    furosaki: {
      w: 92, h: 92,
      anchor() { return { x: 89, y: 2 }; },       // 置くときの基準点は蝶番（折れ目の角）
      draw(p) {
        p.line(89, 2, 89, 90, '#3a2a1c', 4);       // 釜の奥の面
        p.line(89, 2, 1, 2, '#3a2a1c', 4);         // 勝手付の面
        p.line(89, 2, 89, 90, '#e9e0c8', 2);
        p.line(89, 2, 1, 2, '#e9e0c8', 2);
        p.rect(87, 0, 4, 4, '#2a1c12');            // 蝶番
        p.rect(87, 88, 4, 4, '#2a1c12'); p.rect(0, 0, 4, 4, '#2a1c12');
      }
    },

    // 風炉（鉄・敷板の上）。亭主側（左）の前が大きく開いている
    furo: {
      // 敷板 約32cm 角。風炉の胴は 約30cm
      w: 32, h: 32, draw(p) {
        p.rect(0, 0, 32, 32, '#1e100c');                  // 敷板（塗り）
        p.rect(1, 1, 30, 30, '#3a2018');
        p.rect(1, 1, 30, 1, '#5a342a'); p.rect(1, 1, 1, 30, '#4e2c22');
        p.ball(16, 16, 14.5, '#241e1a', '#463c34', '#6e6052'); // 胴
        p.speckleDisc(16, 16, 13.8, '#3a312a', 0.15, 17); // 鉄の肌
        p.ring(16, 16, 12.6, 11.5, '#5e5246');            // 口縁
        p.disc(16, 16, 11.5, '#17130f');                  // 内側
        p.ring(16, 16, 11.5, 9.5, '#9a9488');             // 灰
        p.speckleDisc(16, 16, 11.5, '#b2ac9e', 0.15, 11);
        p.disc(16, 16, 9.5, '#17130f');
        // 前の開き（亭主側）：上から見ると口縁が切れて、中の灰が見える
        p.each(16, 16, 15, (dx, dy, d) => dx < 0 && Math.abs(dy) <= 6 && d > 9.5 && d <= 13, '#9a9488');
        p.each(16, 16, 15, (dx, dy, d) => dx < 0 && Math.abs(dy) <= 6 && d > 13 && d <= 14.8, '#2e2722');
        p.each(16, 16, 15, (dx, dy, d) => dx < 0 && Math.abs(Math.abs(dy) - 6.5) < 0.5 && d > 9.5 && d <= 14.8, '#6e6052');
        // 五徳の爪
        [0, 120, 240].forEach(a => { const [x, y] = around(16, 16, 10.6, a); p.rect(Math.floor(x) - 1, Math.floor(y) - 1, 2, 2, '#5e574c'); });
      }
    },

    // 釜（state: closed / open）。直径 約20cm
    kama: {
      w: 22, h: 22, draw(p, state) {
        p.rect(9, 0, 4, 2, '#2a2622'); p.rect(9, 20, 4, 2, '#2a2622'); // 鐶付（亭主から見て左右）
        p.ball(11, 11, 10, '#1a1816', '#35312c', '#5a554e');
        // 霰（あられ）の肌
        for (let y = 2; y < 21; y += 3) for (let x = 2; x < 21; x += 3) {
          const d = Math.hypot(x + 0.5 - 11, y + 0.5 - 11);
          if (d > 7.4 && d < 9.2) p.px(x, y, '#24211e');
        }
        if (state === 'open' || state === 'kiru') {
          p.disc(11, 11, 6.3, '#0d1216');
          p.disc(11, 11, 5.5, '#2a4a5c');
          p.speckleDisc(11, 11, 5, '#3d6578', 0.25, 5);
          p.px(8, 8, '#8ab8cc'); p.px(9, 8, '#8ab8cc'); p.px(8, 9, '#8ab8cc');
          if (state === 'kiru') {
            // 蓋を亭主の方（左）へ少しずらして掛ける。右に湯気の出るすき間が残る
            p.ring(8.7, 11, 7.3, 6.5, '#121010');
            p.ball(8.7, 11, 6.5, '#3a3026', '#5a4a38', '#867058');
            p.disc(8.7, 11, 1.5, '#2a221a');
            p.px(8, 10, '#a08a68');
            p.px(17, 9, '#e8e4dc'); p.px(18, 11, '#e8e4dc'); p.px(17, 13, '#d8d4cc');
          }
        } else {
          p.ring(11, 11, 7.3, 6.5, '#121010');
          p.ball(11, 11, 6.5, '#3a3026', '#5a4a38', '#867058'); // 唐銅の蓋
          p.disc(11, 11, 1.5, '#2a221a');                       // つまみ
          p.px(10, 10, '#a08a68');
        }
      }
    },

    // 炉の釜（炉にはまっている形）。羽（はば）が炉縁の内側いっぱいに広がる。直径 約27cm（羽まで）
    // state: closed / kiru（蓋を手前に切る）/ open
    kama_ro: {
      w: 30, h: 30, draw(p, state) {
        p.rect(13, 0, 4, 3, '#2a2622'); p.rect(13, 27, 4, 3, '#2a2622');   // 鐶付（亭主から見て左右）
        p.disc(15, 15, 14.2, '#1a1816');                                    // 羽（釜のまわりのつば）
        p.ring(15, 15, 14.2, 12.6, '#3e3a35');
        p.each(15, 15, 15, (dx, dy, d) => d <= 14 && d > 12.8 && (dx + dy) < -8, '#5a554e');
        p.ball(15, 15, 11.6, '#1a1816', '#35312c', '#5a554e');              // 釜の肩
        for (let y = 3; y < 28; y += 3) for (let x = 3; x < 28; x += 3) {   // 霰
          const d = Math.hypot(x + 0.5 - 15, y + 0.5 - 15);
          if (d > 8.6 && d < 10.8) p.px(x, y, '#24211e');
        }
        const lid = cx => {
          p.ring(cx, 15, 8.2, 7.4, '#121010');
          p.ball(cx, 15, 7.4, '#3a3026', '#5a4a38', '#867058');             // 唐銅の蓋
          p.disc(cx, 15, 1.7, '#2a221a');                                   // つまみ
          p.px(cx - 1, 14, '#a08a68');
        };
        if (state === 'open' || state === 'kiru') {
          p.disc(15, 15, 7.4, '#0d1216'); p.disc(15, 15, 6.6, '#2a4a5c');
          p.speckleDisc(15, 15, 6, '#3d6578', 0.25, 5);
          p.px(12, 12, '#8ab8cc'); p.px(13, 12, '#8ab8cc'); p.px(12, 13, '#8ab8cc');
        }
        if (state === 'kiru') lid(11);            // 蓋を亭主の方（左）へずらす（反対側の湯の口が大きくあく）
        else if (state !== 'open') lid(15);
      }
    },

    // ---- 棚 ----
    // 丸卓（まるじょく）：真塗（黒の漆塗り）の木の棚。丸い天板と地板を、木の柱3本でつなぐ。天板の径 約36cm（要確認）
    // state に "b" が入っていれば、柱は向こうに2本・手前に1本（入っていなければ、向こうに1本・手前に2本）
    // 絵は「亭主が左」の向き
    tana_maru: {
      w: 40, h: 40, draw(p, state) {
        p.disc(20.6, 21, 18.6, 'rgba(0,0,0,0.3)');                       // 影
        p.disc(20, 20, 18.4, '#060505');                                 // 天板のふち
        p.disc(20, 20, 17.6, '#16120f');                                 // 真塗の天板
        p.each(20, 20, 18, (dx, dy, d) => d <= 16.8 && d > 14.6 && dx + dy < -14, '#4a4038');   // 漆のつや（左上）
        p.each(20, 20, 18, (dx, dy, d) => d <= 9 && d > 7.6 && dx + dy < -8, '#2e2722');
        const posts = /(^|-)b($|-)/.test(String(state || '')) ? [60, 180, 300] : [0, 120, 240];
        posts.forEach(a => { const [x, y] = around(20, 20, 15.8, a); p.disc(x, y, 1.5, '#2a2420'); });   // 柱の頭（うっすら）
      }
    },
    // 四方卓（よほうじょく）：四角い天板と地板を、柱4本でつないだ二段の棚。一辺 約36cm（要確認）
    tana_yoho: {
      w: 40, h: 40, draw(p) {
        p.rect(3, 3, 36, 36, 'rgba(0,0,0,0.25)');
        p.rect(2, 2, 36, 36, '#8a6a3e'); p.rect(3, 3, 34, 34, '#d2b484');   // 天板
        for (let k = 0; k < 6; k++) p.rect(4, 6 + k * 5.5, 32, 1, k % 2 ? '#c4a676' : '#caac7c');
        p.rect(3, 3, 34, 1, '#e8d2a8'); p.rect(3, 3, 1, 34, '#e8d2a8');
        [[5, 5], [35, 5], [5, 35], [35, 35]].forEach(([x, y]) => { p.rect(x - 1.5, y - 1.5, 3, 3, '#6a4e2a'); p.px(x, y, '#9a7a4a'); });   // 柱の頭
      }
    },

    // 炉（炉縁をはめ込んだ姿）。横45 + 右の畳の縁3 の 48 × 48。図鑑・美術館用
    ro_open: { w: 48, h: 48, draw(p) { roOpen(p, { x: 0, y: 0, w: 48, h: 48 }); } },

    // 釜の蓋（単体）。直径 約13cm
    kamafuta: {
      w: 14, h: 14, draw(p) {
        p.ball(7, 7, 6.5, '#3a3026', '#5a4a38', '#867058');
        p.disc(7, 7, 1.5, '#2a221a');
        p.px(6, 6, '#a08a68');
      }
    },

    // 水指の蓋（水指の左側に立てかけた形。真上からは細い板に見える）
    // 絵は「亭主が左」の向きで描くので、横長に描くと、画面（上から）では縦に長く見える（亭主の目線の絵と同じ向き）
    mizusashi_futa: {
      w: 20, h: 5, draw(p) {
        p.rect(1, 1, 18, 3, '#e2ded2');
        p.rect(1, 1, 18, 1, '#f6f3ea'); p.rect(1, 3, 18, 1, '#a8a49a');
        p.clear(1, 1); p.clear(1, 3); p.clear(18, 1); p.clear(18, 3);
        p.rect(9, 0, 2, 1, '#cfcabd');                    // つまみ
      }
    },

    // 水指（染付・共蓋。state: closed / open）。直径 約22cm
    mizusashi: {
      w: 22, h: 22, draw(p, state) {
        p.ball(11, 11, 10.5, '#9d998f', '#d9d5c9', '#f4f1e8');
        for (let a = 0; a < 360; a += 30) {               // 縁の染付模様
          const [x, y] = around(11, 11, 9.4, a);
          p.px(x, y, '#2e4c8c');
          const [x2, y2] = around(11, 11, 9.4, a + 15);
          p.px(x2, y2, '#5a78b4');
        }
        if (state === 'open') {
          p.disc(11, 11, 8.2, '#b8b4a8');
          p.disc(11, 11, 7.5, '#3a6a86');
          p.speckleDisc(11, 11, 6.8, '#4f82a0', 0.25, 9);
          p.px(8, 7, '#a8d0e0'); p.px(9, 7, '#a8d0e0');
        } else {
          p.ball(11, 11, 8.4, '#a8a498', '#e4e0d4', '#f8f6ee'); // 共蓋（本体と同じ焼き物）
          p.ring(11, 11, 6.4, 5.6, '#4a6aa8');            // 蓋の染付の輪
          p.disc(11, 11, 2.2, '#cfcabd');                 // つまみ
          p.disc(10.6, 10.6, 1.4, '#f4f1e8');
          p.px(11, 11, '#2e4c8c');
        }
      }
    },

    // 建水（唐銅）。直径 約16cm
    // state: nigori（湯や水を捨てたあと。少し濁った水がたまっている）
    kensui: {
      w: 16, h: 16, draw(p, state) {
        p.ball(8, 8, 7.6, '#4a3b20', '#8a7240', '#bba062');
        p.ring(8, 8, 6.3, 5.5, '#5e4c2a');
        p.disc(8.2, 8.2, 5.5, '#33291a');
        p.disc(8.5, 8.5, 4.4, '#3c3020');
        if (state === 'nigori') {
          p.disc(8, 8, 5.2, '#7d7a5a'); p.disc(8, 8, 4.4, '#9c9a74');
          p.speckleDisc(8, 8, 4.4, '#b8b58c', 0.25, 13);
          p.px(6, 6, '#d8d6b0'); p.px(7, 6, '#d8d6b0');
        }
        p.px(4, 3, '#d8c080'); p.px(3, 4, '#d8c080');
      }
    },

    // 蓋置（竹）。直径 約7cm（屏風と敷板の間に入る大きさ）
    futaoki: {
      w: 7, h: 7, draw(p) {
        p.ball(3.5, 3.5, 3.4, '#7a6430', '#b8a05a', '#dcc67e');
        p.disc(3.7, 3.7, 1.9, '#3a2e18');
        p.disc(3.9, 3.9, 1.1, '#241a0c');
      }
    },

    // 柄杓（左が合、右へ柄が伸びる）
    // 柄杓。state に "ro"（炉用）/ "furo"（風炉用・省略時）、"-flip" で左右反転（合が右、柄が左）
    // 風炉用は柄が短く合が小さい、炉用は柄が長く合が大きい
    hishaku: {
      size(state) { const ro = hishakuType(state) === 'ro'; return { w: ro ? 63 : 47, h: 12 }; },
      // 置くときの基準点は合の中心
      anchor(state) {
        const ro = hishakuType(state) === 'ro', W = ro ? 63 : 47, c = Math.floor((ro ? 5.5 : 4.5) + 1);
        return { x: String(state || '').includes('flip') ? W - c : c, y: 6 };
      },
      draw(p, state) {
        const ro = hishakuType(state) === 'ro';
        const W = ro ? 63 : 47, cupR = ro ? 5.5 : 4.5, cupC = cupR + 1, handle = ro ? 50 : 36;   // 風炉用は柄 約36cm
        const f = String(state || '').includes('flip');
        const R = (x, y, w, h, c) => p.rect(f ? W - x - w : x, y, w, h, c);
        const X = x => f ? W - x : x;
        const h0 = Math.ceil(cupC + cupR) - 1;
        R(h0, 5, handle, 2, '#b8975a');                   // 柄
        R(h0, 5, handle, 1, '#e2c890');
        R(h0 + handle - 1, 5, 1, 2, '#8a6a3a');           // 切止
        R(h0 - 1, 4, 3, 4, '#a8884e');                    // 柄の付け根
        p.ball(X(cupC), 6, cupR, '#7a5a30', '#c9a96c', '#e8d098'); // 合
        if (String(state || '').includes('fuse')) {        // 合を伏せた形：底が見える
          p.ring(X(cupC), 6, cupR - 0.8, cupR - 1.6, '#a8884e');
          p.disc(X(cupC) - 0.6, 5.4, 1, '#e8d098');
        } else {
          p.disc(X(cupC) + 0.3, 6.3, cupR - 1.6, '#5a4022');
          p.disc(X(cupC) + 0.7, 6.7, cupR - 2.5, '#6e5230');
        }
      }
    },

    // 棗（利休型 中棗・真塗。上から見ると蓋の甲が見える）
    natsume: {
      w: 12, h: 12, draw(p) {
        p.ball(6, 6, 5.6, '#060505', '#1d1815', '#5a524c');
        p.ring(6, 6, 3.6, 3.0, '#141110');                // 甲のふくらみの境
        p.px(4, 4, '#8a8078');                            // 艶
      }
    },

    // 茶碗（state: empty / yu / matcha / matcha_yu / usucha）
    chawan: {
      w: 20, h: 20, draw(p, state) {
        p.ball(10, 10, 9, '#5e4224', '#a07a48', '#cfab72');
        p.rect(1, 8, 2, 4, '#2e4c8c'); p.px(1, 9, '#6f8fc4');   // 正面の印（絵の左のふち。回転しないとき、手前＝亭主の方を向く）
        p.disc(10.3, 10.3, 7, '#6e5232');                 // 内側の影
        p.disc(10.6, 10.6, 6.2, '#b38c58');               // 見込み
        p.disc(11, 11, 2, '#a07d4c');                     // 茶溜まり
        if (state === 'yu') {
          p.disc(10.6, 10.6, 6, '#a9c4b8');                         // 湯（ほんのり温かい色）
          p.px(8, 8, '#e4f0f0'); p.px(9, 8, '#e4f0f0');
          [[7, 6], [12, 5], [10, 9], [14, 8], [8, 12]].forEach(([x, y]) => p.px(x, y, '#f6fbfb'));   // 湯気
        } else if (state === 'mizu') {
          p.disc(10.6, 10.6, 6, '#6f9cc4');                         // 水（青く、冷たそうに）
          p.disc(10.4, 10.4, 4.6, '#86b1d4');
          p.px(8, 8, '#d8ecf8'); p.px(9, 8, '#d8ecf8'); p.px(8, 9, '#d8ecf8');
        } else if (state === 'matcha') {
          p.disc(11, 11, 2.6, '#5d8a2c');
          p.px(10, 10, '#7fae3e'); p.px(12, 11, '#4c7424');
        } else if (state === 'matcha_yu') {
          p.disc(10.6, 10.6, 6, '#6c8c38');
          p.speckleDisc(10.6, 10.6, 5.5, '#587a2c', 0.2, 3);
        } else if (state === 'usucha') {
          p.disc(10.6, 10.6, 6, '#86aa44');
          p.speckleDisc(10.6, 10.6, 5.6, '#bcd682', 0.35, 7);
          p.disc(10.6, 10.6, 2, '#a4c662');
        }
      }
    },

    // 茶筅（上から見た穂先）
    chasen: {
      w: 10, h: 10, draw(p) {
        p.disc(5, 5, 4.6, '#d9cfb2');
        p.ring(5, 5, 4.6, 3.6, '#efe7cf');
        for (let a = 0; a < 360; a += 45) { const [x, y] = around(5, 5, 4, a); p.px(x, y, '#b8ab86'); }
        p.disc(5, 5, 2.4, '#a89a70');
        p.disc(5, 5, 1.2, '#7a6c48');
      }
    },

    // 茶筅を茶碗に仕組んだ形（柄を亭主側＝左へ寝かせ、穂が奥へ扇のように広がって茶巾にもたれる）
    chasen_shikumi: {
      w: 14, h: 12, draw(p) {
        const fan = (dx, dy, d, r) => dx > 0 && Math.abs(Math.atan2(dy, dx)) < 1.05 && d <= r;
        p.each(6, 6, 6.6, (dx, dy, d) => fan(dx, dy, d, 6.6), '#d8cca8');   // 穂の外形
        p.each(6, 6, 6.6, (dx, dy, d) => fan(dx, dy, d, 6), '#ece2c8');
        for (let a = -55; a <= 55; a += 14) { const [x, y] = around(6, 6, 6, a); p.line(6, 6, x, y, '#c4b388'); }
        p.each(6, 6, 4, (dx, dy, d) => fan(dx, dy, d, 3.4) && Math.abs(dy) < 1.6, '#c8b080'); // 内穂
        p.rect(5, 4, 1, 4, '#2a2010');                    // 糸
        p.rect(1, 4, 4, 4, '#c9a96c');                    // 柄
        p.rect(1, 4, 4, 1, '#e2c890'); p.rect(1, 7, 4, 1, '#8a6a3a');
        p.rect(0, 4, 1, 4, '#e2c890'); p.rect(0, 5, 1, 2, '#6e5230'); // 柄の切り口
      }
    },

    // 茶筅通しのとき、茶碗の中で横に構えた茶筅（柄が左。rot 270 で柄が右になる）
    chasen_toshi: {
      w: 14, h: 12, draw(p) { SPRITES.chasen_shikumi.draw(p); }
    },

    // 帛紗を腰につけた形（帯に挟んで左腰に下げている。真上からは細い帯に見える）
    fukusa_koshi: {
      w: 10, h: 4, draw(p) {
        p.rect(0, 0, 10, 4, '#7a1a14');
        p.rect(0, 1, 10, 2, '#c8322a');
        p.rect(0, 1, 10, 1, '#e0524a');
      }
    },

    // 茶巾（畳んだ麻の布を、さらに半分に折った形）。画面では長い方が前後（亭主の方）を向く
    chakin: {
      w: 8, h: 6, draw(p) {
        p.rect(1, 1, 6, 4, '#f3f0e7');
        p.rect(1, 3, 6, 1, '#e0dcd0');                    // 長い方の折り目
        p.rect(1, 4, 6, 1, '#c9c5b8');
        p.rect(6, 1, 1, 4, '#d2cec2');                    // 半分に折った「わ」（亭主の方を向く）
        p.speckleRect(2, 1, 4, 3, '#fffdf6', 0.15, 4);
      }
    },

    // 茶巾を茶碗の奥の壁に立て掛けた形（右が奥）
    chakin_tate: {
      w: 5, h: 9, draw(p) {
        p.rect(0, 0, 5, 9, '#f3f0e7');
        p.rect(4, 0, 1, 9, '#c9c5b8');
        p.rect(0, 0, 4, 1, '#fbf9f2');
        p.rect(0, 4, 4, 1, '#e0dcd0');
      }
    },

    // 茶杓。描くときは左が櫂先だが、mirror で反転して右（向こう）を櫂先にする。state: fuse（伏せ）/ up（上向き）
    // 茶杓。長さ 約18cm。節は、ほぼ真ん中（置くときの基準点は中心＝節のあたり）
    chashaku: {
      w: 18, h: 6, mirror: true, draw(p, state) {
        p.rect(4, 2, 13, 2, '#c9a96c');
        p.rect(4, 2, 13, 1, '#e2c890');
        p.rect(1, 1, 5, 4, '#c9a96c');                    // 櫂先
        p.rect(1, 1, 5, 1, '#e2c890');
        if (state === 'fuse') { p.rect(2, 2, 3, 1, '#e8d098'); }   // 伏せ：背が見える
        else { p.rect(2, 2, 3, 2, '#ad8c54'); }                     // 上向き：くぼみが見える
        p.clear(1, 1); p.clear(1, 4);
        p.rect(9, 1, 1, 4, '#8a6a3a');                    // 節
        p.rect(16, 2, 1, 2, '#7a5a30');                   // 切止
      }
    },

    // 帛紗（朱・畳んだ形）
    fukusa: {
      w: 14, h: 14, draw(p) {
        p.rect(2, 3, 10, 8, '#b93a2a');
        p.rect(2, 7, 10, 1, '#a3301f');                   // 折り目
        p.rect(2, 3, 10, 1, '#dc6448');
        p.rect(2, 3, 1, 8, '#d55a40');
        p.rect(2, 10, 10, 1, '#7e2216');
        p.rect(11, 3, 1, 8, '#8a2618');
        p.px(5, 5, '#e98a6e'); p.px(8, 9, '#e98a6e');
      }
    },

    // 菓子器（陶器）。state は「器:お菓子」。書かなければ、いまの月の組み合わせ（上の KASHIKI_SEASON）
    kashiki: {
      w: 28, h: 28, draw(p, state) {
        const k = kashikiParts(state);
        VESSEL_DRAW[k.vessel](p, 14, 14);
        if (SWEETS[k.sweet]) SWEETS[k.sweet](p, 14, 14);
        else {                                                    // 小さな絵がないお菓子は、大きい絵を小さくして3つ盛る
          const b = sprite('okashi', k.sweet);
          p.ctx.imageSmoothingEnabled = false;
          [[-4.5, -3.5], [4.5, -3.5], [0, 3.5]].forEach(([dx, dy]) => p.ctx.drawImage(b, Math.round(14 + dx - 5), Math.round(14 + dy - 5), 10, 10));
        }
      }
    },

    // お菓子を1つ大きく、はっきり見せる絵。state はお菓子の名前（菓子器の state でもよい）
    okashi: { w: 32, h: 32, draw(p, state) { const k = kashikiParts(state); OKASHI_BIG[k.sweet](p); } },

    // 絵が見つからないとき用の仮の四角
    _unknown: {
      w: 12, h: 12, draw(p) {
        p.rect(0, 0, 12, 12, '#8a2a4a');
        p.rect(1, 1, 10, 10, '#e6a8c0');
        p.rect(4, 3, 4, 1, '#8a2a4a'); p.rect(7, 4, 1, 2, '#8a2a4a');
        p.rect(5, 6, 2, 1, '#8a2a4a'); p.rect(5, 8, 2, 1, '#8a2a4a');
      }
    }
  };

  // 座っている人（真上から見た姿・右向き）。着物の色だけ変えて使い回す
  // もとは 28×30 の絵。PERSON 倍に拡大して描く（1ドット＝1cm で、座った人が約50cm）
  const PERSON = 1.7;
  // 実際の座った人は、前後（膝〜背中）が長く、肩幅はそれより狭い。もとの絵（48×51）を、前後に長く引きのばして使う
  function personBig(p, k) {
    const t = painter(48, 51);
    person(t, k);
    p.ctx.imageSmoothingEnabled = false;
    p.ctx.drawImage(t.canvas, 0, 0, PERSON_W, PERSON_H);
  }
  function person(p, k) {
    const s = PERSON, v = n => n * s, r = n => Math.round(n * s);
    const rect = (x, y, w, h, c) => p.rect(r(x), r(y), Math.max(1, r(w)), Math.max(1, r(h)), c);
    p.ellipse(v(19), v(15), v(6.5), v(10), k.lapD);              // 膝の影
    p.ellipse(v(18.8), v(14.6), v(5.6), v(9), k.lap);            // 膝
    p.ellipse(v(10), v(15), v(7.5), v(12.5), k.bodyD);           // 肩・背中の影
    p.ellipse(v(10), v(14.6), v(6.6), v(11.4), k.body);          // 肩・背中
    rect(4, 6, 1, 18, k.hi);                                     // 背中の光
    rect(16, 12, 1, 6, '#e8e4da');                               // 半襟
    rect(15, 11, 1, 1, '#e8e4da'); rect(15, 18, 1, 1, '#e8e4da');
    rect(21, 11, 2, 2, '#e6c4a2'); rect(21, 17, 2, 2, '#e6c4a2'); // 膝の上の手
    rect(22, 11, 1, 1, '#f4dcc0'); rect(22, 17, 1, 1, '#f4dcc0');
    p.disc(v(6.5), v(15), v(2.2), '#121010');                    // 髷
    p.ball(v(11), v(15), v(5.2), '#0b0a0a', '#1c1a1a', '#4a4440'); // 頭
  }

  // 描いた絵は覚えておいて使い回す
  const cache = {};
  function sprite(name, state) {
    const def = SPRITES[name] || SPRITES._unknown;
    const key = (SPRITES[name] ? name : '_unknown') + '|' + (state || '');
    if (!cache[key]) {
      const size = def.size ? def.size(state) : def;
      const p = painter(size.w, size.h);
      def.draw(p, state);
      cache[key] = def.mirror ? transform(p.canvas, 'flip') : p.canvas;
    }
    return cache[key];
  }

  // 置くときの基準点（絵の中の座標）。指定がなければ絵の中心
  function anchorOf(name, state) {
    const def = SPRITES[name];
    if (def && def.anchor) {
      const a = def.anchor(state);
      return def.mirror ? { x: sprite(name, state).width - a.x, y: a.y } : a;
    }
    const c = sprite(name, state);
    return { x: Math.floor(c.width / 2), y: Math.floor(c.height / 2) };
  }

  function hishakuType(state) { return /(^|-)ro($|-)/.test(String(state || '')) ? 'ro' : 'furo'; }

  // 絵を左右反転（'flip'）または左に90度回転（'r270'）した新しい絵を作る
  function transform(src, kind) {
    const w = src.width, h = src.height, rot = kind === 'r270';
    const out = document.createElement('canvas');
    out.width = rot ? h : w; out.height = rot ? w : h;
    const si = src.getContext('2d').getImageData(0, 0, w, h);
    const oc = out.getContext('2d');
    const oi = oc.createImageData(out.width, out.height);
    for (let y = 0; y < out.height; y++) for (let x = 0; x < out.width; x++) {
      const sx = rot ? w - 1 - y : w - 1 - x, sy = rot ? x : y;
      const a = (sy * w + sx) * 4, b = (y * out.width + x) * 4;
      for (let k = 0; k < 4; k++) oi.data[b + k] = si.data[a + k];
    }
    oc.putImageData(oi, 0, 0);
    return out;
  }

  // ===================================================================
  //  背景（部屋・畳・茶道口・壁）
  //  1ドット＝1cm。京間（畳1枚 191cm × 95.5cm）の六畳間を、亭主が下・風炉先が上の向きで描く。
  //  95.5cm はドットにできないので、畳はすべて同じ 96 × 192 にそろえてある。
  //  畳の並びを変えたいときは、下の ROOM.tatami を書き換えます（x, y は左上の角、w が横幅、h が縦の長さ）。
  // ===================================================================
  const ROOM = {
    W: 320, H: 462,                 // 画面全体の大きさ
    x0: 18, y0: 18, x1: 306, y1: 402,   // 部屋の内側（左が勝手付の壁、上が風炉先の壁、下に茶道口）
    door: { x: 22, w: 80 },         // 茶道口（下の壁の開いている所）
    ro: { x: 117, y: 114, w: 48, h: 48, mat: { x: 114, y: 114, seed: 51 } },   // 炉（客畳の、亭主に近い角。畳の境目の線にぴったり接する。mat はとなりの畳の目の線をそろえるための、その畳の位置）
    tatami: [
      { name: '点前畳', x: 18,  y: 18,  w: 96,  h: 192 },
      { name: '踏込畳', x: 18,  y: 210, w: 96,  h: 192 },
      { name: '客畳',   x: 114, y: 18,  w: 192, h: 96 },
      { name: '客畳',   x: 114, y: 114, w: 96,  h: 192 },
      { name: '客畳',   x: 210, y: 114, w: 96,  h: 192 },
      { name: '客畳',   x: 114, y: 306, w: 192, h: 96 }
    ]
  };

  // 畳1枚。縁（へり）は長い方の2辺につく。畳の目は長い方向に並ぶ
  function tatami(p, t, seed) {
    const { x, y, w, h } = t, tall = h > w, HERI = 3;
    p.rect(x, y, w, h, '#b8b06c');
    if (tall) { for (let i = 0; i < w; i++) if ((i >> 1) & 1) p.rect(x + i, y, 1, h, '#aca462'); }   // 畳の目（長い方向に線が通る）
    else      { for (let j = 0; j < h; j++) if ((j >> 1) & 1) p.rect(x, y + j, w, 1, '#aca462'); }
    if (tall) { for (let j = 6; j < h; j += 9) p.speckleRect(x, y + j, w, 1, '#a39b5c', 0.5, seed + j); } // 横糸
    else      { for (let i = 6; i < w; i += 9) p.speckleRect(x + i, y, 1, h, '#a39b5c', 0.5, seed + i); }
    p.speckleRect(x, y, w, h, '#c8c07e', 0.04, seed + 1);
    p.speckleRect(x, y, w, h, '#9c9558', 0.03, seed + 2);
    // 畳の境目（縁のない短い辺）
    if (tall) { p.rect(x, y, w, 1, '#8d8650'); p.rect(x, y + h - 1, w, 1, '#8d8650'); }
    else      { p.rect(x, y, 1, h, '#8d8650'); p.rect(x + w - 1, y, 1, h, '#8d8650'); }
    // 縁
    const heri = (hx, hy, hw, hh) => {
      p.rect(hx, hy, hw, hh, '#25232b');
      if (tall) { for (let j = 1; j < hh; j += 4) p.px(hx + 1, hy + j, '#3a3844'); }
      else      { for (let i = 1; i < hw; i += 4) p.px(hx + i, hy + 1, '#3a3844'); }
    };
    if (tall) { heri(x, y, HERI, h); heri(x + w - HERI, y, HERI, h); }
    else      { heri(x, y, w, HERI); heri(x, y + h - HERI, w, HERI); }
  }

  // 炉（風炉の季節の姿）。炉蓋畳（炉に畳で蓋をしたもの）。半畳の1/4（48×48）をいっぱいに使う。
  // 畳の中身は、下の畳（r.mat）の絵をそのまま使う。右の辺には、
  // 炉蓋畳の縁と、炉を切ったほうの畳の縁が、2本並んで見える（写真のとおり）
  function ro(p, r) {
    const { x, y, w, h } = r, m = r.mat, HERI = 3;
    const lw = w - HERI;                                    // 炉蓋畳の幅（右の3点は、切ったほうの畳の縁）
    const ix = x + 1, iy = y + 1, iw = lw - 2, ih = h - 2;
    // 蓋の畳の中は、下の畳の絵をそのまま使う（同じ素材・同じ線）。切れ目の線と縁だけを上に描く
    p.rect(x, y, lw, 1, '#8d8650'); p.rect(x, y + h - 1, lw, 1, '#8d8650');   // 炉の切れ目（まわりの線）
    p.rect(x, y, 1, h, '#8d8650');
    p.rect(ix + iw - HERI, y, HERI, h, '#2d2b33');                          // 炉蓋畳の縁（右の1辺。上下の切れ目の線も縁でうめる）
    for (let j = 1; j < h; j += 4) p.px(ix + iw - HERI + 1, y + j, '#434150');
    p.rect(x + lw - 1, y, 1, h, '#3a3844');                                  // 2本の縁の間の線
    p.rect(x + lw, y, HERI, h, '#1d1b22');                                   // 炉を切ったほうの畳の縁
    for (let j = 1; j < h; j += 4) p.px(x + lw + 1, y + j, '#34323e');
  }

  // 炉（冬の姿）。炉蓋畳を外して、炉縁（黒塗りの木枠）をはめ込んだ形。中は灰（釜は別の道具として上に置く）。
  // 切った畳の右の辺には、風炉の季節と同じ縁が見える。炉縁の右の辺は、その縁にぴったり接する
  function roOpen(p, r) {
    const { x, y, w, h } = r, HERI = 3;
    const lw = w - HERI, FR = 6;                           // 切ったところの幅 / 炉縁の木枠の太さ
    p.rect(x + lw, y, HERI, h, '#1d1b22');                  // 炉を切ったほうの畳の縁
    for (let j = 1; j < h; j += 4) p.px(x + lw + 1, y + j, '#34323e');
    // 炉縁（黒塗り）。切ったところ（45×48）いっぱいに、すきまなくはめ込む
    p.rect(x, y, lw, h, '#14121a');
    p.rect(x, y, lw, 1, '#2e2b38'); p.rect(x, y, 1, h, '#2e2b38');                   // 艶（左・上）
    p.rect(x + lw - 1, y, 1, h, '#0a090d'); p.rect(x, y + h - 1, lw, 1, '#0a090d');
    const ix = x + FR, iy = y + FR, iw = lw - FR * 2, ih = h - FR * 2;
    p.rect(ix - 1, iy - 1, iw + 2, ih + 2, '#0a090d');                               // 内側の縁
    // 灰
    p.rect(ix, iy, iw, ih, '#b9b2a2');
    p.speckleRect(ix, iy, iw, ih, '#a39c8c', 0.22, 61);
    p.speckleRect(ix, iy, iw, ih, '#d0c9b8', 0.12, 62);
    p.rect(ix, iy, iw, 2, '#8a8374'); p.rect(ix, iy, 2, ih, '#8a8374');               // 奥と左は少し影
    for (let k = 4; k < ih - 3; k += 5) p.rect(ix + 3, iy + k, iw - 6, 1, '#a59e8e'); // 灰形の筋
  }

  function room(opt = {}) {
    const R = ROOM, p = painter(R.W, R.H);
    // 壁
    p.rect(0, 0, R.W, R.H, '#cbb68c');
    p.speckleRect(0, 0, R.W, R.H, '#b9a379', 0.12, 21);
    p.speckleRect(0, 0, R.W, R.H, '#dac8a0', 0.08, 22);
    // 茶道口の外の板の間（水屋側）
    const fy = R.y1 + 2;
    p.rect(0, fy, R.W, R.H - fy, '#7b5636');
    for (let x = 0; x < R.W; x += 9) p.rect(x, fy, 1, R.H - fy, '#5e4028');
    p.speckleRect(0, fy, R.W, R.H - fy, '#8a6442', 0.15, 23);
    // 畳寄せ（部屋のまわりの木）
    p.rect(R.x0 - 2, R.y0 - 2, R.x1 - R.x0 + 4, R.y1 - R.y0 + 4, '#6a4a2a');
    // 畳
    R.tatami.forEach((t, i) => tatami(p, t, 31 + i * 10));
    if (R.ro) (opt.ro === 'open' ? roOpen : ro)(p, R.ro);
    // 敷居（茶道口）
    p.rect(R.door.x, R.y1, R.door.w, 4, '#9a7650');
    p.rect(R.door.x, R.y1 + 2, R.door.w, 1, '#6e5236');
    p.rect(R.door.x, R.y1, R.door.w, 1, '#b8946a');
    return p.canvas;
  }

  return { sprite, anchorOf, room, ROOM, transform, has: name => !!SPRITES[name], SPRITES, painter, around, rng, kashikiParts, KASHIKI_SEASON, VESSELS, SWEET_NAMES };
})();
