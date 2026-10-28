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
  // 菓子器に盛るお菓子（1つの器に1種類）。上から見た絵
  const SWEETS = {
    manju(p) {                                                    // 饅頭
      [[9.2, 10], [14.8, 10], [12, 15]].forEach(([x, y]) => {
        p.disc(x, y, 3, '#d6cbb0'); p.disc(x - 0.3, y - 0.3, 2.6, '#f7f2e6');
        p.px(x - 1, y - 1, '#ffffff'); p.px(x + 1, y + 1, '#e6a8b6');   // 艶と、焼き印のような桃色
      });
    },
    sakura(p) {                                                   // 桜の干菓子（五弁の小さな花）
      [[8.5, 8.5], [15.5, 8.5], [8.5, 15.5], [15.5, 15.5]].forEach(([x, y]) => {
        for (let k = 0; k < 5; k++) {
          const [px, py] = around(x, y, 1.5, k * 72 - 90);
          p.disc(px, py, 1, '#ec9fb4');
        }
        p.disc(x, y, 0.8, '#fbe0e6');
      });
    },
    momiji(p) {                                                   // 紅葉の干菓子
      [[8.5, 8.5], [15.5, 8.5], [8.5, 15.5], [15.5, 15.5]].forEach(([x, y], i) => {
        const c = i % 2 ? '#d9662f' : '#e0803a';
        p.disc(x, y, 2, c); p.disc(x - 1.5, y - 0.8, 1, c); p.disc(x + 1.5, y - 0.8, 1, c);   // 三つに分かれた葉
        p.px(x, y + 2, '#9a3f1c'); p.px(x, y + 1, '#b8501f');
      });
    },
    kinton(p) {                                                   // きんとん
      p.disc(12, 12, 5.2, '#d8b447');
      p.speckleDisc(12, 12, 5.2, '#ecd27a', 0.4, 5);
      p.speckleDisc(12, 12, 5.2, '#b8942e', 0.2, 9);
      p.disc(12.3, 12.3, 1.2, '#7a5a3a');
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
        if (state === 'kiru') lid(12);            // 蓋を亭主の方（左）へ少しずらす
        else if (state !== 'open') lid(15);
      }
    },

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
        p.disc(10.3, 10.3, 7, '#6e5232');                 // 内側の影
        p.disc(10.6, 10.6, 6.2, '#b38c58');               // 見込み
        p.disc(11, 11, 2, '#a07d4c');                     // 茶溜まり
        if (state === 'yu') {
          p.disc(10.6, 10.6, 6, '#9fb8bb');
          p.px(8, 8, '#e4f0f0'); p.px(9, 8, '#e4f0f0');
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
    chashaku: {
      w: 30, h: 6, mirror: true, draw(p, state) {
        p.rect(6, 2, 23, 2, '#c9a96c');
        p.rect(6, 2, 23, 1, '#e2c890');
        p.rect(1, 1, 6, 4, '#c9a96c');                    // 櫂先
        p.rect(1, 1, 6, 1, '#e2c890');
        if (state === 'fuse') { p.rect(2, 2, 4, 1, '#e8d098'); }   // 伏せ：背が見える
        else { p.rect(2, 2, 4, 2, '#ad8c54'); }                     // 上向き：くぼみが見える
        p.clear(1, 1); p.clear(1, 4);
        p.rect(17, 1, 1, 4, '#8a6a3a');                   // 節
        p.rect(28, 2, 1, 2, '#7a5a30');                   // 切止
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

    // 菓子器（陶器の丸い器）。1つの器には、同じ種類のお菓子だけを入れる。
    // state … お菓子の種類：manju（饅頭）/ sakura（桜の干菓子）/ momiji（紅葉の干菓子）/ kinton（きんとん）。省略すると manju。
    // お菓子の種類を足したいときは、下の SWEETS に書き足し、pixel-art-side.js の SWEET_COLOR にも色を足す
    kashiki: {
      w: 24, h: 24, draw(p, state) {
        p.disc(12.4, 12.8, 11.4, '#6f6656');                           // 器の影
        p.ball(12, 12, 11.2, '#b7ad96', '#f1ead8', '#fffaf0');         // 釉薬のかかった、丸い器
        p.ring(12, 12, 11, 8.4, '#ebe3cf');                            // ふち
        for (let a = 0; a < 360; a += 30) {                            // ふちの染付の点
          const [x, y] = around(12, 12, 9.7, a);
          p.px(x, y, '#7a98c0');
        }
        p.ring(12, 12, 8.6, 8, '#cfc5ad');                             // 内側の線
        p.disc(12, 12, 8, '#dcd2bb');                                  // 器の内側
        p.disc(12.3, 12.3, 7.2, '#f0e9d8');
        (SWEETS[state] || SWEETS.manju)(p);
      }
    },

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
    const fx = x, fy = y + (h - lw), fw = lw;               // 炉縁は 45×45 の正方形（上に 3 点のすき間）
    p.rect(x, y, lw, h, '#1d1b22');                         // 切り口（影）
    p.rect(x, y, lw, 1, '#8d8650'); p.rect(x, y, 1, h, '#8d8650');
    p.rect(x + lw, y, HERI, h, '#1d1b22');                  // 炉を切ったほうの畳の縁
    for (let j = 1; j < h; j += 4) p.px(x + lw + 1, y + j, '#34323e');
    // 炉縁（黒塗り）
    p.rect(fx, fy, fw, fw, '#14121a');
    p.rect(fx, fy, fw, 1, '#3c394a'); p.rect(fx, fy, 1, fw, '#3c394a');            // 艶（左・上）
    p.rect(fx + fw - 1, fy, 1, fw, '#0a090d'); p.rect(fx, fy + fw - 1, fw, 1, '#0a090d');
    p.rect(fx + 2, fy + 2, fw - 4, 1, '#2a2733'); p.rect(fx + 2, fy + 2, 1, fw - 4, '#2a2733');   // 角の面取り
    const ix = fx + FR, iy = fy + FR, iw = fw - FR * 2;
    p.rect(ix - 1, iy - 1, iw + 2, iw + 2, '#0a090d');                               // 内側の縁
    // 灰
    p.rect(ix, iy, iw, iw, '#b9b2a2');
    p.speckleRect(ix, iy, iw, iw, '#a39c8c', 0.22, 61);
    p.speckleRect(ix, iy, iw, iw, '#d0c9b8', 0.12, 62);
    p.rect(ix, iy, iw, 2, '#8a8374'); p.rect(ix, iy, 2, iw, '#8a8374');               // 奥と左は少し影
    for (let k = 4; k < iw - 3; k += 5) p.rect(ix + 3, iy + k, iw - 6, 1, '#a59e8e'); // 灰形の筋
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

  return { sprite, anchorOf, room, ROOM, transform, has: name => !!SPRITES[name], SPRITES, painter, around, rng };
})();
