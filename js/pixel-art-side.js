/*
 * 亭主の目線で見た道具のドット絵（点前座に座って、少し見下ろした姿）
 * ・手元を寄って見る画面なので、上からの画面の S 倍の細かさで描く
 *   （座標は上からの画面と同じ単位で書き、描くときに S 倍する）
 * ・左右は、上からの画面（亭主が下・向こうが上）とそろえてある
 * ・奥行きは K 倍につぶして描く。向こうにある物ほど画面の上に来る
 * ・ax, ay … 道具が畳に接する面の中心（置くときの基準点）
 * ・mouth … 器の口。中に入れた道具を描いたあと、器の「手前側」だけを描き直して中身の下を隠す
 * ・top / inner … 上に乗せた物・中に入れた物を置く高さ（道具を重ねるときに使う）
 */
const PixelArtSide = (() => {
  const S = 2;      // 細かさ（上からの画面の何倍か）
  const K = 0.6;    // 奥行きのつぶし具合（大きいほど上から見下ろす）

  const IRON = { dark: '#1a1816', base: '#3e3a35', light: '#6e6860' };
  const IRONW = { dark: '#2a2019', base: '#4e3e32', light: '#76604e' };   // 風炉の鉄（少し赤みのある）
  const MOUTH = { dark: '#141210', base: '#24211e', light: '#3c3833' };
  const LID = { dark: '#3a3026', base: '#5a4a38', light: '#867058' };
  const KNOB = { dark: '#1a140e', base: '#2a221a', light: '#4a3e30' };
  const BAMBOO = { dark: '#8a6a3a', base: '#c9a96c', light: '#e2c890' };
  const FUTAOKI = { dark: '#7a6430', base: '#b8a05a', light: '#dcc67e' };
  const LACQUER = { dark: '#060505', base: '#1d1815', light: '#6a5f56' };
  const GLAZE = { dark: '#5e4224', base: '#a07a48', light: '#cfab72' };
  const KODAI = { dark: '#5e4224', base: '#8a6a3e', light: '#a8844e' };
  const CERAMIC = { dark: '#b3a98f', base: '#f1ead8', light: '#fffaf0' };   // 菓子器の釉薬
  // 菓子器のお菓子の色（state と同じ名前。pixel-art.js の SWEETS と合わせる）
  const SWEET_COLOR = { manju: ['#f7f2e6', '#d6cbb0'], sakura: ['#ec9fb4', '#f6bccb'], momiji: ['#d9662f', '#e0803a'], kinton: ['#d8b447', '#ecd27a'] };
  const TINES = { dark: '#b8ab86', base: '#e6dcc0', light: '#f4eedc' };

  // ---- S 倍の細かさの画用紙。座標は上からの画面と同じ単位で渡す ----
  function painterS(w, h) {
    const raw = PixelArt.painter(w * S, h * S);
    return {
      raw, canvas: raw.canvas, ctx: raw.ctx,
      pt(x, y, c) { raw.px(Math.floor(x * S), Math.floor(y * S), c); },          // 細かい1点
      px(x, y, c) { raw.rect(Math.floor(x) * S, Math.floor(y) * S, S, S, c); },  // 粗い1点
      rect(x, y, w, h, c) { raw.rect(Math.round(x * S), Math.round(y * S), Math.round(w * S), Math.round(h * S), c); },
      clear(x, y, w = 1, h = 1) { raw.clear(Math.round(x * S), Math.round(y * S), Math.round(w * S), Math.round(h * S)); },
      ellipse(cx, cy, rx, ry, c) { raw.ellipse(cx * S, cy * S, rx * S, ry * S, c); },
      line(x0, y0, x1, y1, c, t = 1) { raw.line(x0 * S, y0 * S, x1 * S, y1 * S, c, Math.max(1, Math.round(t * S))); },
      fine(x0, y0, x1, y1, c) { raw.line(x0 * S, y0 * S, x1 * S, y1 * S, c, 1); }, // 細い線
      speckleDisc(cx, cy, r, c, d, seed) { raw.speckleDisc(cx * S, cy * S, r * S, c, d, seed); },
      speckleRect(x, y, w, h, c, d, seed) { raw.speckleRect(Math.round(x * S), Math.round(y * S), Math.round(w * S), Math.round(h * S), c, d, seed); }
    };
  }

  // ---- 立体を描く筆 ----
  // 楕円を1枚塗る（左を明るく、右を暗く）
  function slice(q, cx, cy, hw, col) {
    const X0 = cx * S, Y0 = cy * S, rx = hw * S, ry = Math.max(0.6, hw * K * S);
    for (let Y = Math.floor(Y0 - ry); Y <= Math.ceil(Y0 + ry); Y++) {
      for (let X = Math.floor(X0 - rx); X <= Math.ceil(X0 + rx); X++) {
        const dx = X + 0.5 - X0, dy = Y + 0.5 - Y0;
        if ((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) > 1) continue;
        const t = dx / rx;
        q.raw.px(X, Y, t < -0.6 ? col.light : t > 0.55 ? col.dark : col.base);
      }
    }
  }
  // prof（下からの「半分の幅」）を、間をなめらかにつなぎながら積み上げる。戻り値は一番上の中心
  function profAt(prof, f) {
    const i = Math.floor(f), n = prof.length;
    return i >= n - 1 ? prof[n - 1] : prof[i] + (prof[i + 1] - prof[i]) * (f - i);
  }
  function solid(q, cx, cy0, prof, col) {
    const n = prof.length;
    for (let j = 0; j <= (n - 1) * S; j++) slice(q, cx, cy0 - j / S, profAt(prof, j / S), col);
    return cy0 - (n - 1);
  }
  // 平らな楕円（口の内側・水面など）
  function flat(q, cx, cy, hw, color) { q.ellipse(cx, cy, hw, Math.max(0.6, hw * K), color); }
  // 手前側の縁の線（胴の筋など）
  function frontArc(q, cx, cy, hw, color) {
    for (let X = Math.floor((cx - hw) * S); X <= Math.ceil((cx + hw) * S); X++) {
      const dx = (X + 0.5 - cx * S) / (hw * S);
      if (Math.abs(dx) > 1) continue;
      q.raw.px(X, Math.floor((cy + Math.sqrt(1 - dx * dx) * hw * K) * S), color);
    }
  }
  // 湯気
  function steam(q, x, y) {
    q.pt(x, y + 3, '#d8d4cc'); q.pt(x + 0.5, y + 2.5, '#d8d4cc'); q.pt(x + 1, y + 2, '#e8e4dc');
    q.pt(x + 0.5, y + 1.5, '#e8e4dc'); q.pt(x, y + 1, '#ece8e0'); q.pt(x + 0.5, y + 0.5, '#f4f2ec');
  }
  // 器の口より奥と、口の内側を消す（手前側だけを残す）
  function clearMouth(q, cx, cy, r) {
    q.raw.clear(0, 0, q.canvas.width, Math.floor(cy * S));
    const X0 = cx * S, Y0 = cy * S, rx = r * S, ry = r * K * S;
    for (let Y = Math.floor(Y0 - ry); Y <= Math.ceil(Y0 + ry); Y++) {
      for (let X = Math.floor(X0 - rx); X <= Math.ceil(X0 + rx); X++) {
        const dx = (X + 0.5 - X0) / rx, dy = (Y + 0.5 - Y0) / ry;
        if (dx * dx + dy * dy <= 1) q.raw.clear(X, Y, 1, 1);
      }
    }
  }

  // 畳んだ茶巾を置いた形。deg は上から見た長い方の向き（0＝右、90＝手前）
  function chakinFlat(q, deg) {
    const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), LEN = 3.5, WID = 2.5;   // 半分に折った大きさ
    const W = q.canvas.width, H = q.canvas.height;
    const at = (X, Y, lift) => {                    // その点が茶巾の上の面か（lift だけ下にずらして厚みを描く）
      const u = X / S - 8, v = (Y / S - 6 - lift) / K;
      const al = u * c + v * s, ac = -u * s + v * c;
      return Math.abs(al) <= LEN && Math.abs(ac) <= WID ? { al, ac } : null;
    };
    for (let Y = 0; Y < H; Y++) for (let X = 0; X < W; X++) {
      const top = at(X + 0.5, Y + 0.5, 0);
      if (top) {
        let col = '#f3f0e7';
        if (top.al > LEN - 0.7) col = '#d2cec2';                            // 半分に折った「わ」（亭主側）
        else if (Math.abs(top.ac) < 0.35) col = '#e0dcd0';                  // 長い方の折り目
        else if (top.ac > WID - 0.6) col = '#dcd8cc';
        q.raw.px(X, Y, col);
      } else if (at(X + 0.5, Y + 0.5, 1.2)) q.raw.px(X, Y, '#c9c5b8');        // 厚み
    }
  }

  const hishakuType0 = st => /(^|-)ro($|-)/.test(String(st || '')) ? 'ro' : 'furo';

  const SIDE = {

    // 風炉（鉄・敷板の上）。亭主側の前が大きく開いていて、中の灰・五徳・釜の底が見える
    // 電熱器なので火は描かない。layer が 'front' のときは手前側だけ（開きと口の内側は描かない）
    furo: {
      w: 32, h: 56, ax: 16, ay: 40, layered: true, inner: 11,
      draw(q, state, layer) {
        const R = 0.8;                                    // 横幅の縮め具合（敷板 約32cm に合わせる）
        const cx = 16, ay = 40, cy0 = ay - 4;
        const prof = [15, 17, 18, 18.5, 19, 19, 19, 19, 19, 19, 18.8, 18.5, 18, 18, 18].map(v => v * R);
        const OW = 7 * R, OPEN_FROM = 4;                  // 前の開き：幅の半分と、下から何段目より上が開いているか
        const n = prof.length, topY = cy0 - (n - 1), bd = 16 * K;
        q.rect(0, ay - bd, 32, bd * 2, '#3a2018');        // 敷板（上の面・塗り）
        q.rect(0, ay - bd, 32, 0.5, '#5a342a');
        q.rect(0, ay + bd, 32, 2, '#1e100c');             // 敷板（手前の厚み）
        q.rect(cx - 10, cy0 + 6, 2.5, 3, '#241e1a'); q.rect(cx + 7.5, cy0 + 6, 2.5, 3, '#241e1a'); // 脚
        solid(q, cx, cy0, prof, IRONW);
        flat(q, cx, topY, 18 * R, '#7a6656');             // 口縁
        flat(q, cx, topY, 15.5 * R, '#17130f');           // 口の内側
        // 開きの部分（各段の手前半分のうち、真ん中の幅 OW）
        const floorY = cy0 - OPEN_FROM + prof[OPEN_FROM] * K;
        const inOpen = (xl, yl) => {
          for (let f = OPEN_FROM; f <= n - 1 + 1e-9; f += 1 / S) {
            const hw = profAt(prof, f), ry = hw * K, dx = xl - cx, dy = yl - (cy0 - f);
            if (dy > 0 && Math.abs(dx) <= OW && (dx * dx) / (hw * hw) + (dy * dy) / (ry * ry) <= 1) return true;
          }
          return false;
        };
        for (let Y = Math.floor((topY - 12) * S); Y < Math.ceil((floorY + 2) * S); Y++) {
          for (let X = Math.floor((cx - OW - 1) * S); X <= Math.ceil((cx + OW + 1) * S); X++) {
            const xl = (X + 0.5) / S, yl = (Y + 0.5) / S;
            if (!inOpen(xl, yl)) continue;
            if (layer === 'front') { q.raw.clear(X, Y, 1, 1); continue; }
            q.raw.px(X, Y, yl >= floorY - 5 ? '#b8ac94' : yl >= floorY - 5.5 ? '#8a8070' : '#2e2620'); // 下は灰、上は奥の壁
          }
        }
        if (layer === 'front') { clearMouth(q, cx, topY, 15.5 * R); return; }
        q.speckleRect(cx - OW, floorY - 5, OW * 2, 5, '#cfc4ac', 0.2, 21);  // 灰の肌
        q.rect(cx - 4.5, floorY - 11, 0.5, 9, '#3a342c'); q.rect(cx + 4, floorY - 11, 0.5, 9, '#3a342c'); // 五徳の脚
      }
    },

    // 釜（state: closed / kiru（蓋を手前に切る）/ open）。直径 約20cm
    kama: {
      w: 22, h: 40, ax: 11, ay: 36, top: 19,        // top：口の高さ（置き柄杓の合を掛ける）
      draw(q, state) {
        const R = 10 / 13;                                // 横幅の縮め具合
        const cx = 11, ay = 36;
        const prof = [4, 6.5, 8.5, 10, 11, 12, 12.5, 13, 13, 13, 13, 13, 13, 12.5, 12, 11, 9.5].map(v => v * R);
        solid(q, cx, ay, prof, IRON);
        for (const i of [10, 12, 14]) {                   // 霰（肩のあたり）
          for (let dx = -8; dx <= 8; dx += 2) {
            const hw = prof[i], t = dx / hw;
            if (Math.abs(t) < 0.9) q.pt(cx + dx, ay - i + Math.sqrt(1 - t * t) * hw * K - 0.5, '#2a2622');
          }
        }
        q.rect(0, ay - 14.5, 1.5, 2.5, '#2a2622'); q.rect(20.5, ay - 14.5, 1.5, 2.5, '#2a2622'); // 鐶付
        const mouth = solid(q, cx, ay - 17, [7, 7], MOUTH); // 口
        const lid = dy => {
          const t = solid(q, cx, mouth + dy, [6.5, 6.5, 5.8, 4], LID);
          flat(q, cx, t, 3.5, '#6e5c46');
          slice(q, cx, t - 1, 1.2, KNOB);                 // つまみ
          q.pt(cx - 0.5, t - 1.6, '#7a6a50');
        };
        if (state === 'open' || state === 'kiru') {
          flat(q, cx, mouth, 6.2, '#0d1216');
          flat(q, cx, mouth, 5.4, '#2a4a5c');
          q.pt(cx - 2.5, mouth - 1.5, '#8ab8cc'); q.pt(cx - 2, mouth - 1.5, '#8ab8cc'); q.pt(cx - 1.5, mouth - 2, '#8ab8cc');
        }
        if (state === 'kiru') {
          lid(2);                                           // 亭主の方（手前＝下）へずらす
          steam(q, cx - 1, mouth - 10);
        } else if (state === 'open') {
          steam(q, cx - 3, mouth - 10); steam(q, cx + 2, mouth - 9);
        } else {
          lid(0);
        }
      }
    },

    // 菓子器（陶器の丸い器）。state はお菓子の種類（manju / sakura / momiji / kinton）
    kashiki: {
      w: 26, h: 20, ax: 13, ay: 17, top: 8, inner: 5,
      draw(q, state) {
        const cx = 13, ay = 17;
        const top = solid(q, cx, ay, [6, 8.5, 10.5, 11.5, 12, 12, 11.5], CERAMIC);   // 丸い器
        flat(q, cx, top, 11.5, '#ebe3cf');                       // ふち
        flat(q, cx, top, 9.4, '#dcd2bb');                        // 内側
        const c = SWEET_COLOR[state] || SWEET_COLOR.manju;
        [[-6, 0.4], [-2, -1.2], [2.5, 0.4], [6, -1], [0, 1.6]].forEach(([dx, dy], i) => {   // 同じお菓子を盛る
          q.ellipse(cx + dx, top + dy - 1, 2.2, 1.7, c[i % 2 ? 1 : 0]);
          q.ellipse(cx + dx - 0.3, top + dy - 1.5, 1, 0.6, '#ffffff');
        });
        for (let a = 0; a < 360; a += 40) q.pt(cx + Math.cos(a * Math.PI / 180) * 7.5, ay - 4.5 + Math.sin(a * Math.PI / 180) * 7.5 * K, '#7a98c0'); // 染付の点
      }
    },

    // 炉の釜（炉にはまっていて、羽から上だけが見える）。state: closed / kiru / open
    kama_ro: {
      w: 32, h: 30, ax: 16, ay: 24, top: 11, inner: 1, mouth: { dy: 6, rx: 6.5 },   // 口に入れた柄杓の合は、釜の手前のふちに隠れる
      draw(q, state) {
        const cx = 16, ay = 24;
        q.ellipse(cx, ay, 14, 14 * K, '#1a1816');         // 羽（炉縁の内側に広がるつば）
        q.ellipse(cx, ay - 0.6, 13, 13 * K, '#3e3a35');
        const prof = [10.5, 10.8, 10.5, 9.6, 8.4, 7].map(v => v);
        const top = solid(q, cx, ay - 1, prof, IRON);
        for (const dx of [-7, -4, -1, 2, 5, 8]) q.pt(cx + dx, ay - 4, '#2a2622');   // 霰
        const mouth = solid(q, cx, top + 1, [6.5, 6.5], MOUTH);
        const lid = dx => {
          const t = solid(q, cx + dx, mouth + 1, [6, 6, 5.4, 3.8], LID);
          flat(q, cx + dx, t, 3.3, '#6e5c46');
          slice(q, cx + dx, t - 1, 1.2, KNOB);
        };
        if (state === 'open' || state === 'kiru') {
          flat(q, cx, mouth, 5.8, '#0d1216'); flat(q, cx, mouth, 5, '#2a4a5c');
        }
        if (state === 'kiru') { lid(-2); steam(q, cx + 2, mouth - 9); }
        else if (state === 'open') { steam(q, cx - 2, mouth - 9); steam(q, cx + 2, mouth - 8); }
        else lid(0);
      }
    },

    // 釜の蓋（単体）。直径 約13cm
    kamafuta: {
      w: 14, h: 18, ax: 7, ay: 11, top: 3,
      draw(q) {
        const t = solid(q, 7, 11, [6.5, 6.5, 5.8, 4], LID);
        flat(q, 7, t, 3.5, '#6e5c46');
        slice(q, 7, t - 1, 1.2, KNOB);
      }
    },

    // 水指の蓋（水指の左側に立てかけた形。横から見ると細い楕円）。基準点は下の端
    mizusashi_futa: {
      w: 6, h: 18, ax: 3, ay: 17,
      draw(q) {
        q.ellipse(3, 9, 2.4, 8, '#a8a49a');
        q.ellipse(3, 9, 1.9, 7.6, '#e2ded2');
        q.rect(2, 3, 0.8, 11, '#f6f3ea');
        q.pt(3, 9, '#4a6aa8');
      }
    },

    // 蓋置（竹）
    futaoki: {
      w: 8, h: 15, ax: 4, ay: 11, height: 9, top: 9,
      draw(q) {
        const t = solid(q, 4, 11, [3, 3, 3, 3, 3, 3, 3, 3, 3], FUTAOKI);
        frontArc(q, 4, 11 - 7, 3, '#8a7238');             // 節（風炉用は上寄り）
        flat(q, 4, t, 3, '#d8c27a');
        flat(q, 4, t, 2, '#3a2e18');                      // 筒の中
      }
    },

    // 茶碗（state: empty / yu / matcha / matcha_yu / usucha）
    chawan: {
      w: 20, h: 22, ax: 10, ay: 18, mouth: { dy: 9, rx: 7.8 }, top: 9, inner: 4,
      draw(q, state) {
        const cx = 10;
        solid(q, cx, 18, [4.5, 4.5], KODAI);              // 高台
        const t = solid(q, cx, 16, [6.5, 7.8, 8.5, 8.8, 9, 9, 9, 9], GLAZE); // 低く口の広い形
        q.pt(6, 15, '#8a6638'); q.pt(6, 15.5, '#8a6638'); q.pt(13.5, 14.5, '#8a6638'); // 釉のむら
        flat(q, cx, t, 9, '#c4a068');                     // 口縁
        flat(q, cx, t, 7.8, '#6e5030');                   // 内側（手前の壁は影）
        flat(q, cx, t + 0.8, 7, '#94733f');               // 向こうの壁
        flat(q, cx, t + 2, 4.6, '#b38c58');               // 見込み
        flat(q, cx, t + 2.2, 1.6, '#a07d4c');             // 茶溜まり
        const liquid = { yu: '#9fb8bb', matcha_yu: '#6c8c38', usucha: '#8db04a' }[state];
        if (liquid) flat(q, cx, t + 1, 6.6, liquid);
        if (state === 'yu') { q.pt(cx - 3, t - 0.5, '#e4f0f0'); q.pt(cx - 2.5, t - 0.5, '#e4f0f0'); }
        if (state === 'usucha') q.speckleDisc(cx, t + 1, 5.5, '#c6dc8c', 0.3, 7);
        if (state === 'matcha') flat(q, cx, t + 2.2, 2.4, '#5d8a2c');
      }
    },

    // 茶巾（畳んで置いた形）。長い方を亭主の方へ向ける。基準点は底の中心
    //   chakin        … まっすぐ前後
    //   chakin_naname … 右手前へ斜め（蓋置の上の釜の蓋に置いたとき。柄杓と同じ向き。上からの画面で rot 125）
    chakin: { w: 16, h: 12, ax: 8, ay: 6, top: 1, draw(q) { chakinFlat(q, 90); } },
    chakin_naname: { w: 16, h: 12, ax: 8, ay: 6, top: 1, draw(q) { chakinFlat(q, 35); } },

    // 茶巾（畳んで、茶碗の奥の壁に立て掛けた形）
    chakin_tate: {
      w: 12, h: 9, ax: 6, ay: 8,
      draw(q) {
        q.rect(1, 0.5, 10, 7.5, '#f3f0e7');
        q.speckleRect(1, 0.5, 10, 7.5, '#fbf9f2', 0.15, 4);
        q.rect(1, 0.5, 10, 0.5, '#fdfbf5');
        q.rect(1, 3, 10, 0.5, '#e2ded2'); q.rect(1, 5.5, 10, 0.5, '#e2ded2'); // 畳んだ折り目
        q.rect(10.5, 0.5, 0.5, 7.5, '#d4d0c4');
        q.rect(1, 7.5, 10, 0.5, '#c9c5b8');
      }
    },

    // 茶筅（穂先が上に立てた形）
    chasen: {
      w: 10, h: 22, ax: 5, ay: 20,
      draw(q) {
        solid(q, 5, 20, [2, 2, 2, 2, 2, 2], BAMBOO);       // 柄
        slice(q, 5, 14, 2.6, KNOB);                       // 糸
        const t = solid(q, 5, 13, [3, 3.8, 4.3, 4.5, 4.5, 4.3, 3.8, 3.2], TINES);
        [-3, -1.5, 0, 1.5, 3].forEach(dx => q.fine(5 + dx * 0.7, 13, 5 + dx, 7.5, '#cfc29c')); // 穂の筋
        flat(q, 5, t, 2, '#a89a70');                      // 内穂
      }
    },

    // 茶筅を茶碗に仕組んだ形。穂先を奥の茶巾にあずけ、柄が亭主の方を向く（基準点は糸のあたり）
    chasen_shikumi: {
      w: 14, h: 21, ax: 7, ay: 11,
      draw(q) {
        q.ellipse(7, 7, 4.6, 4.2, '#cfc19a');             // 穂の外形
        q.ellipse(7, 7, 4, 3.7, '#ece2c8');
        for (let a = 190; a <= 350; a += 12) {            // 糸から広がる外穂
          const r = a * Math.PI / 180;
          q.fine(7, 11, 7 + Math.cos(r) * 4.4, 7 + Math.sin(r) * 4, '#c4b388');
        }
        q.ellipse(7, 7.8, 1.8, 2.2, '#c8b080');           // 内穂
        q.ellipse(7, 11.2, 2.6, 1.1, '#2a2010');          // 糸
        q.pt(5.5, 10.8, '#5a4a30');
        q.rect(5.2, 11.8, 3.6, 5.2, '#c9a96c');           // 柄（手前へ伸びる）
        q.rect(5.2, 11.8, 1, 5.2, '#e2c890'); q.rect(7.8, 11.8, 1, 5.2, '#8a6a3a');
        q.ellipse(7, 17.2, 2.1, 1.5, '#e8d098');          // 柄の切り口
        q.ellipse(7, 17.2, 1.1, 0.8, '#6e5230');
      }
    },

    // 茶筅通し：茶碗の中で横に構えた茶筅。穂先が左、柄（茶筅の後ろ）が右へ。基準点は糸のあたり
    chasen_toshi: {
      w: 22, h: 16, ax: 12, ay: 8,
      draw(q) {
        q.ellipse(7.5, 8, 5.4, 4.6, '#cfc19a');          // 穂の外形
        q.ellipse(7.5, 8, 4.8, 4.1, '#ece2c8');
        for (let a = 150; a <= 210; a += 10) {           // 糸から左へ広がる外穂
          const r = a * Math.PI / 180;
          q.fine(12, 8, 12 + Math.cos(r) * 5.2, 8 + Math.sin(r) * 4.4, '#c4b388');
        }
        q.ellipse(7, 8, 2, 2.4, '#c8b080');              // 内穂
        q.rect(11.4, 6.4, 1.2, 3.4, '#2a2010');          // 糸
        q.rect(12.6, 6.6, 7, 2.8, '#c9a96c');            // 柄（右へ）
        q.rect(12.6, 6.6, 7, 0.8, '#e2c890'); q.rect(12.6, 8.6, 7, 0.8, '#8a6a3a');
        q.ellipse(19.8, 8, 0.8, 1.4, '#6e5230');         // 柄の切り口
      }
    },

    // 茶杓（亭主から見て前後の向き。上が櫂先＝向こう、ay の行が節）。state: fuse（伏せ）/ up（上向き）
    chashaku: {
      w: 6, h: 22, ax: 3, ay: 11,
      draw(q, state) {
        q.rect(2, 3.5, 1.5, 16.5, '#c9a96c');
        q.rect(2, 3.5, 0.5, 16.5, '#e2c890');
        q.ellipse(2.75, 3, 1.6, 1.3, '#c9a96c');          // 櫂先
        if (state === 'up') {
          q.ellipse(2.75, 3.2, 0.9, 0.7, '#9a7a46');      // くぼみが見える
          q.rect(2, 1.5, 1.5, 0.5, '#e8d098');            // 先が反り上がる
        } else {
          q.pt(2.5, 2.5, '#e8d098');                      // 背が見える
        }
        q.rect(2, 10.75, 1.5, 0.5, '#8a6a3a');            // 節
        q.rect(2, 19.5, 1.5, 0.5, '#7a5a30');             // 切止
      }
    },

    // 棗（利休型 中棗・真塗）。裾が少しすぼまり、肩が丸く、甲はなだらか
    natsume: {
      w: 12, h: 18, ax: 6, ay: 15, top: 10.5,
      draw(q) {
        const t = solid(q, 6, 15, [4.8, 5.2, 5.5, 5.6, 5.6, 5.6, 5.6, 5.5, 5.2, 4.6, 3.6], LACQUER);
        frontArc(q, 6, 15 - 6.2, 5.6, '#3a322c');         // 蓋の合わせ目
        flat(q, 6, t, 3.6, '#2a2420');                    // 甲
        q.pt(3.5, t + 0.5, '#8a8078'); q.pt(4, t, '#8a8078');   // 艶
        q.pt(2, 15 - 3, '#4a423c'); q.pt(2, 15 - 4, '#4a423c');
      }
    },

    // 水指（染付・共蓋）。state: closed / open。直径 約22cm
    mizusashi: {
      w: 22, h: 28, ax: 11, ay: 23, top: 12, inner: 2,
      draw(q, state) {
        const cx = 11, ay = 23;
        const PORC = { dark: '#a8a49a', base: '#e2ded2', light: '#f6f3ea' };
        const t = solid(q, cx, ay, [9, 9.8, 10, 10, 10, 10, 10, 10, 10, 9.8, 9.6], PORC);
        frontArc(q, cx, ay - 2, 9.8, '#2e4c8c'); frontArc(q, cx, ay - 8, 10, '#2e4c8c'); // 染付の帯
        for (let dx = -7; dx <= 7; dx += 3) {             // 胴の模様
          const tt = dx / 10;
          q.pt(cx + dx, ay - 5 + Math.sqrt(1 - tt * tt) * 10 * K - 1, '#4a6aa8');
          q.pt(cx + dx + 1, ay - 4 + Math.sqrt(1 - tt * tt) * 10 * K - 1, '#2e4c8c');
        }
        flat(q, cx, t, 9.6, '#d8d4c8');                   // 口縁
        if (state === 'open') {
          flat(q, cx, t, 8.6, '#3a6a86');
          q.speckleDisc(cx, t, 5, '#4f82a0', 0.2, 9);
          q.pt(cx - 3, t - 1.5, '#a8d0e0'); q.pt(cx - 2.5, t - 1.5, '#a8d0e0');
        } else {
          const lt = solid(q, cx, t, [9.2, 9.2], PORC);   // 共蓋（本体と同じ焼き物）
          flat(q, cx, lt, 8.8, '#ece8de');
          frontArc(q, cx, lt, 6.5, '#4a6aa8');            // 蓋の染付の輪
          slice(q, cx, lt - 0.5, 1.6, PORC);              // つまみ
          q.pt(cx, lt - 1, '#2e4c8c');
        }
      }
    },

    // 建水（唐銅）
    kensui: {
      w: 16, h: 18, ax: 8, ay: 14, top: 7, inner: 2,
      draw(q, state) {
        const t = solid(q, 8, 14, [5.3, 6.5, 7.2, 7.6, 7.6, 7.6, 7.6], { dark: '#4a3b20', base: '#8a7240', light: '#bba062' });
        flat(q, 8, t, 7.6, '#c8ae70');                    // 口縁
        flat(q, 8, t, 6.4, '#33291a');                    // 内側
        flat(q, 8, t + 1, 4.6, '#3c3020');
        if (state === 'nigori') { flat(q, 8, t + 0.5, 6, '#7d7a5a'); flat(q, 8, t + 0.5, 4.8, '#9c9a74'); }   // 少し濁った水
      }
    },

    // 風炉先屏風。直角に折って、向こうの面は正面に、勝手付の面は左にまっすぐ立って見える
    // 基準点は蝶番の下（点前畳の向こう・勝手付の角）
    furosaki: {
      w: 112, h: 112, ax: 22, ay: 54,               // 屏風は釜より高い（約50cm）
      draw(q) {
        const HX = 22, TOP = 4, BOT = 54, LEN = 88;       // 蝶番の位置・屏風の上下・1面の幅
        const SW = 3, SB = BOT + LEN * K;                 // 勝手付の面：見える厚さ（畳の縁と同じ）と、手前の下端
        // 勝手付の面（まっすぐな長方形）
        q.rect(HX - SW, TOP, SW, SB - TOP, '#3a2a1c');                    // 枠
        q.rect(HX - SW + 1, TOP + 1, SW - 2, SB - TOP - 2, '#e2d8bf');    // 紙
        q.speckleRect(HX - SW + 1, TOP + 1, SW - 2, SB - TOP - 2, '#f0e8d4', 0.08, 6);
        q.rect(HX - SW + 1, SB - 9, SW - 2, 8, '#cbbb96');                // 腰張り
        q.rect(HX - SW + 1, SB - 9.5, SW - 2, 0.5, '#3a2a1c');
        // 向こうの面
        q.rect(HX, TOP, LEN, BOT - TOP, '#3a2a1c');                       // 枠
        q.rect(HX + 1, TOP + 1, LEN - 2, BOT - TOP - 2, '#e9e0c8');       // 紙
        q.speckleRect(HX + 1, TOP + 1, LEN - 2, BOT - TOP - 2, '#f4eedc', 0.08, 5);
        q.rect(HX + 1, BOT - 9, LEN - 2, 8, '#d8c8a4');                   // 腰張り
        q.rect(HX + 1, BOT - 9.5, LEN - 2, 0.5, '#3a2a1c');
        q.rect(HX - 0.5, TOP, 2, BOT - TOP, '#2a1c12');                   // 折れ目（蝶番）
      }
    },

    // 柄杓を横に寝かせた形（左が合、右へ柄）。state: furo / ro
    // 風炉用：合が小さく柄が短い。切止は内側（身）を斜めに切る
    // 炉用  ：合が大きく柄が長い。切止は外側（皮目）を斜めに切る
    hishaku_yoko: {
      w: 64, h: 18, ax: 6, ay: 13,
      draw(q, state) {
        const ro = hishakuType0(state) === 'ro', fuse = String(state || '').includes('fuse');
        const cupR = ro ? 5.5 : 4.5, cupH = ro ? 7 : 6, handle = ro ? 50 : 36, cx = 6;
        const x0 = cx + cupR, x1 = x0 + handle;
        q.line(x0, 13 - cupH + 2, x1, 13, '#e2c890', 0.5);        // 柄（皮目＝上）
        q.line(x0, 13 - cupH + 2.5, x1, 13.5, '#b8975a', 0.5);    // 柄（身＝下）
        const X1 = Math.round(x1 * S), Yt = Math.round(13 * S);
        if (ro) { q.raw.clear(X1 - 3, Yt - 1, 5, 1); q.raw.clear(X1 - 1, Yt, 3, 1); }  // 炉用：上（皮目）を斜めに
        else { q.raw.clear(X1 - 3, Yt + 1, 5, 1); q.raw.clear(X1 - 1, Yt, 3, 1); }      // 風炉用：下（身）を斜めに
        const t = solid(q, cx, 13, new Array(cupH).fill(cupR), BAMBOO); // 合
        flat(q, cx, t, cupR, '#e8d098');
        if (fuse) flat(q, cx, t, cupR - 0.8, '#c9a96c');          // 伏せた形：合の底が上になる
        else flat(q, cx, t, cupR - 0.8, '#5a4022');
      }
    },

    // 合を蓋置にあずけ、柄を亭主の方（手前）へ引いた形。基準点は合の底
    hishaku_hiki: {
      w: 14, h: 56, ax: 7, ay: 13,
      draw(q, state) {
        const ro = state === 'ro';
        const cupR = ro ? 5.5 : 4.5, cupH = ro ? 7 : 6, len = ro ? 50 : 36;
        const end = 13 + 9 + len * K;                       // 柄の先（畳の上、手前）
        q.rect(6.25, 11, 1.5, end - 11, '#b8975a');       // 柄
        q.rect(6.25, 11, 0.5, end - 11, '#e2c890');
        q.rect(6.25, end - 0.5, 1.5, 0.5, '#8a6a3a');     // 切止
        const t = solid(q, 7, 13, new Array(cupH).fill(cupR), BAMBOO);
        flat(q, 7, t, cupR, '#e8d098');
        flat(q, 7, t, cupR - 0.8, '#5a4022');
      }
    },

    // 合を蓋置にあずけ、柄を亭主の左膝の前へ斜めに向けた形（風炉）。基準点は合の底
    // 上からの画面で rot 125（柄が右下へ約35度）に合わせてある
    hishaku_naname: {
      w: 44, h: 40, ax: 7, ay: 13,
      draw(q, state) {
        const ro = state === 'ro';
        const cupR = ro ? 5.5 : 4.5, cupH = ro ? 7 : 6, len = ro ? 50 : 36, a = 35 * Math.PI / 180;
        const x1 = 7 + len * Math.cos(a), y1 = 13 + 9 + len * Math.sin(a) * K;   // 柄の先（畳の上）
        q.line(7, 11, x1, y1, '#b8975a', 0.75);           // 柄
        q.line(7, 10.6, x1, y1 - 0.4, '#e2c890', 0.25);
        const t = solid(q, 7, 13, new Array(cupH).fill(cupR), BAMBOO);
        flat(q, 7, t, cupR, '#e8d098');
        flat(q, 7, t, cupR - 0.8, '#5a4022');
      }
    },

    // 置き柄杓：合を釜の口に掛け、柄をまっすぐ手前（亭主の方）へ向けて置いた形（風炉）。基準点は合の底
    // 上からの画面で rot 180（柄が手前へまっすぐ）に合わせてある
    hishaku_oki: {
      w: 14, h: 44, ax: 7, ay: 13,
      draw(q, state) {
        const ro = state === 'ro';
        const cupR = ro ? 5.5 : 4.5, cupH = ro ? 7 : 6, len = ro ? 50 : 36, a = 90 * Math.PI / 180;
        const x0 = 7, y0 = 11;
        const x1 = x0 + len * Math.cos(a), y1 = y0 + len * Math.sin(a) * K + 8;   // 柄の先（少し下がる）
        q.line(x0, y0, x1, y1, '#b8975a', 0.75);          // 柄
        q.line(x0 - 0.4, y0, x1 - 0.4, y1, '#e2c890', 0.25);
        const t = solid(q, 7, 13, new Array(cupH).fill(cupR), BAMBOO);
        flat(q, 7, t, cupR, '#e8d098');
        flat(q, 7, t, cupR - 0.8, '#5a4022');
      }
    },

    // 建水の上に、合を伏せて置いた形。柄は手前（亭主の方）へまっすぐ。基準点は合の口（伏せたので下）
    hishaku_fuse: {
      w: 14, h: 58, ax: 7, ay: 33,
      draw(q, state) {
        const ro = hishakuType0(state) === 'ro';
        const cupR = ro ? 5.5 : 4.5, cupH = ro ? 7 : 6, len = ro ? 50 : 36;
        const t = solid(q, 7, 33, new Array(cupH).fill(cupR), BAMBOO); // 合（伏せてあるので底が上）
        flat(q, 7, t, cupR, '#c9a96c');
        flat(q, 7, t, cupR - 1, '#b8975a');
        const y0 = 33 - cupH + 3, yEnd = y0 + len * K;    // 柄の先（手前）
        q.rect(6.25, y0, 1.5, yEnd - y0, '#b8975a');      // 柄
        q.rect(6.25, y0, 0.5, yEnd - y0, '#e2c890');
        q.rect(6.25, yEnd - 0.5, 1.5, 0.5, '#8a6a3a');    // 切止
      }
    },

    // 鏡柄杓：柄杓をまっすぐ立てて持ち、合の内側を自分に向けた形。基準点は柄の先（右手で持つ所）
    hishaku_kagami: {
      w: 14, h: 48, ax: 7, ay: 46,
      draw(q, state) {
        const ro = hishakuType0(state) === 'ro';
        const cupR = ro ? 5.5 : 4.5, len = ro ? 50 : 36;
        const yCup = 46 - len;                            // 合の中心
        q.rect(6.25, yCup, 1.5, len, '#b8975a');          // 柄
        q.rect(6.25, yCup, 0.5, len, '#e2c890');
        q.rect(6.25, 46 - len * 0.45, 1.5, 0.5, '#8a6a3a'); // 節
        q.rect(6.25, 45.5, 1.5, 0.5, '#8a6a3a');          // 切止
        q.ellipse(7, yCup, cupR, cupR, '#a8884e');        // 合（内側をこちらに向けている）
        q.ellipse(7, yCup, cupR - 0.6, cupR - 0.6, '#e8d098');
        q.ellipse(7.2, yCup + 0.2, cupR - 1.4, cupR - 1.4, '#6e5230');
        q.ellipse(7.4, yCup + 0.4, cupR - 2.4, cupR - 2.4, '#5a4022');
      }
    },

    // 切止の拡大図（大きさは誇張。上が皮目、下が身）。state: furo / ro
    kiridome: {
      w: 16, h: 8, ax: 0, ay: 0,
      draw(q, state) {
        q.rect(0, 2, 16, 2, '#a8884e');                   // 皮目
        q.rect(0, 4, 16, 2, '#e2c890');                   // 身
        for (let Y = 4; Y < 12; Y++) {
          const cut = state === 'ro' ? Math.round((11 - Y) * 0.8) : Math.round((Y - 4) * 0.8);
          if (cut > 0) q.raw.clear(32 - cut, Y, cut, 1);
        }
      }
    }
  };

  // 描いた絵を覚えておく。layer が 'front' のときは器の手前側だけ
  const cache = {};
  function sprite(name, state, layer) {
    const def = SIDE[name];
    if (!def) return PixelArt.sprite('_unknown');
    const key = `${name}|${state || ''}|${layer || ''}`;
    if (!cache[key]) {
      const q = painterS(def.w, def.h);
      def.draw(q, state, layer);
      if (layer === 'front' && def.mouth && !def.layered) clearMouth(q, def.ax, def.ay - def.mouth.dy, def.mouth.rx);
      cache[key] = q.canvas;
    }
    return cache[key];
  }

  // 基準点 (x, y) に置く（x, y は上からの画面と同じ単位。描く先の画用紙は S 倍の大きさ）
  function put(ctx, name, state, x, y, layer) {
    const def = SIDE[name];
    ctx.drawImage(sprite(name, state, layer), Math.round((x - def.ax) * S), Math.round((y - def.ay) * S));
  }

  return { sprite, put, has: name => !!SIDE[name], SIDE, K, S };
})();
