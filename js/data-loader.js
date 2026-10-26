/*
 * データ読み込み係
 * data フォルダのファイルは registerTools(...) / registerTemae(...) を呼んで
 * 自分の中身をここに登録します。書き間違いがあれば、どのファイルか分かるように記録します。
 */
(function () {
  const store = window.DataStore = {
    tools: [],          // 道具の配列
    toolsFiles: [],     // 道具を登録したファイル名
    temaeList: [],      // お点前の配列
    errors: [],         // 動かなくなる重大な問題
    warnings: [],       // 動くけれど直したほうがよい問題
    onError: null       // 画面側がエラー表示用に設定する
  };

  // いま読み込み中のファイル名（index.html に書いた src のまま）
  function currentFile() {
    const s = document.currentScript;
    return s ? (s.getAttribute('src') || '(index.html の中)') : '(不明なファイル)';
  }

  function addError(msg) {
    if (!store.errors.includes(msg)) store.errors.push(msg);
    if (store.onError) store.onError();
  }

  // ---- data/tools.js から呼ばれる ----
  window.registerTools = function (data) {
    const file = currentFile();
    if (!data || !Array.isArray(data.tools)) {
      addError(`「${file}」：中身が registerTools({ "tools": [ ... ] }) の形になっていません。`);
      return;
    }
    // 道具を複数のファイルに分けて書いても、まとめて使えるようにする
    store.tools.push(...data.tools);
    store.toolsFiles.push(file);
  };

  // ---- data/quiz.js から呼ばれる（三択の問題集） ----
  window.registerQuiz = function (data) {
    const file = currentFile();
    if (!data || !Array.isArray(data.questions)) {
      addError(`「${file}」：中身が registerQuiz({ "questions": [ ... ] }) の形になっていません。`);
      return;
    }
    store.quiz = (store.quiz || []).concat(data.questions.map(q => Object.assign({ _file: file }, q)));
  };

  // 三択の問題1つ分の点検（手順の中の三択にも、問題集にも使う）
  store.checkQuiz = function (q, where, out) {
    if (!q.question) out.push(`${where}：question（問題文）がありません。`);
    if (!Array.isArray(q.choices) || q.choices.length < 2) out.push(`${where}：choices（選択肢）を2つ以上書いてください。`);
    else if (!q.choices.includes(q.answer)) out.push(`${where}：answer（正解）が choices のどれとも同じ文字になっていません。`);
  };

  // ---- data/museum.js から呼ばれる（お道具の美術館） ----
  window.registerMuseum = function (data) {
    const file = currentFile();
    if (!data || !Array.isArray(data.rooms)) {
      addError(`「${file}」：中身が registerMuseum({ "rooms": [ ... ] }) の形になっていません。`);
      return;
    }
    store.museum = data;
    store.museumFile = file;
  };

  // ---- data/temae/*.js から呼ばれる ----
  window.registerTemae = function (data) {
    const file = currentFile();
    if (!data || typeof data !== 'object') {
      addError(`「${file}」：中身が registerTemae({ ... }) の形になっていません。`);
      return;
    }
    data._file = file;
    store.temaeList.push(data);
  };

  // ---- 読み込みエラーを拾う ----
  window.addEventListener('error', function (e) {
    const t = e.target;
    if (t && t.tagName === 'SCRIPT') {
      addError(`ファイル「${t.getAttribute('src')}」が見つかりません。ファイル名や置き場所を確認してください。`);
      return;
    }
    const file = e.filename ? e.filename.replace(/^.*?\/((data|js)\/.*)$/, '$1') : '';
    const msg = e.message || '';
    if (file && file.startsWith('data/')) {
      addError(`「${file}」の ${e.lineno} 行目付近に書き間違いがあります（${msg}）。カンマの付け忘れ、" の閉じ忘れ、{ } や [ ] の数を確認してください。`);
    } else if (file) {
      addError(`「${file}」の ${e.lineno} 行目でエラー：${msg}`);
    } else {
      addError(`読み込み中にエラーが起きました：${msg}`);
    }
  }, true);

  // ---- 全部読み終わったあとの確認 ----
  store.finalize = function () {
    // 書き間違いで register… まで届かなかったファイルを探す
    const mentioned = f => store.errors.some(m => m.includes(f));
    document.querySelectorAll('script[data-tools]').forEach(s => {
      const src = s.getAttribute('src');
      if (!store.toolsFiles.includes(src) && !mentioned(src)) {
        addError(`「${src}」を読み込めませんでした。書き間違い（カンマ・" ・カッコ）がないか確認してください。`);
      }
    });
    document.querySelectorAll('script[data-temae]').forEach(s => {
      const src = s.getAttribute('src');
      if (!store.temaeList.some(t => t._file === src) && !mentioned(src)) {
        addError(`「${src}」を読み込めませんでした。書き間違い（カンマ・" ・カッコ）がないか確認してください。`);
      }
    });
  };

  // 場所の指定は "名前" でも { "place": "名前", "dx": 0, "dy": 0 } でもよい
  store.placeName = function (ref) {
    if (typeof ref === 'string') return ref;
    if (ref && typeof ref === 'object') return ref.place;
    return undefined;
  };

  // ---- 中身の点検（足りない項目・存在しない道具名など） ----
  store.validate = function (spriteExists) {
    const w = store.toolWarnings = [];
    const ids = new Set();
    store.tools.forEach((t, i) => {
      const where = `道具 ${i + 1} 番目${t && t.id ? `（${t.id}）` : ''}`;
      if (!t || !t.id) { w.push(`${where}：id がありません。`); return; }
      if (ids.has(t.id)) w.push(`${where}：id「${t.id}」が重複しています。`);
      ids.add(t.id);
      if (!t.name) w.push(`${where}：name（名前）がありません。`);
      if (t.zukan !== false && !t.pos) w.push(`${where}：pos（図鑑での位置）がありません。`);
      if (t.pos && t.pos.on === undefined && (typeof t.pos.x !== 'number' || typeof t.pos.y !== 'number')) w.push(`${where}：pos には "x" と "y"（数字）を書いてください。`);
      const sp = t.sprite || t.id;
      if (!spriteExists(sp)) w.push(`${where}：ドット絵「${sp}」がありません（仮の四角で表示します）。`);
    });
    store.tools.forEach((t, i) => {
      if (t && t.pos && t.pos.on !== undefined && !ids.has(t.pos.on)) w.push(`道具 ${i + 1} 番目（${t.id}）：pos の on「${t.pos.on}」が見つかりません。`);
    });

    store.temaeList.forEach(tm => {
      const tw = tm._warnings = [];
      const places = tm.places || {};
      const checkTool = (id, where) => {
        if (!ids.has(id)) tw.push(`${where}：道具「${id}」が tools.js にありません。`);
      };
      // 置き場所："名前" / { place: 名前 } / { on: 道具のid }
      const checkPlace = (ref, where) => {
        if (ref === undefined || ref === null || ref === '') return;
        if (typeof ref === 'object' && ref.on !== undefined) { checkTool(ref.on, where); return; }
        const p = store.placeName(ref);
        if (!p || !places[p]) tw.push(`${where}：場所「${p}」が places にありません。`);
      };
      if (!tm.id) tw.push('お点前の id がありません。');
      if (!tm.title) tw.push('お点前の title（名前）がありません。');
      Object.keys(tm.setup || {}).forEach(tid => {
        checkTool(tid, `setup の「${tid}」`);
        checkPlace(tm.setup[tid], `setup の「${tid}」`);
      });
      if (!Array.isArray(tm.steps)) { tw.push('steps（手順）が [ ... ] の形になっていません。'); return; }
      const sids = new Set();
      tm.steps.forEach((s, i) => {
        const where = `手順 ${i + 1}（${s && s.id ? s.id : 'id なし'}）`;
        if (!s.id) tw.push(`${where}：id がありません。`);
        else if (sids.has(s.id)) tw.push(`${where}：id が重複しています。`);
        sids.add(s.id);
        if (!s.name && s.type !== 'banner') tw.push(`${where}：name（手順名）がありません。`);
        if (s.view && !['top', 'host'].includes(s.view)) tw.push(`${where}：view は "top" か "host" にしてください。`);
        if (s.type === 'quiz') store.checkQuiz(s, where, tw);
        else if (s.type === 'banner') { if (!s.text) tw.push(`${where}：text（表示する文字）がありません。`); }
        else if (s.type === 'game') { if (s.game !== 'chasen') tw.push(`${where}：game は "chasen" にしてください。`); }
        else if (!s.target) tw.push(`${where}：target（クリックする道具）がありません。`);
        else if (String(s.target).startsWith('place:')) checkPlace(s.target.slice(6), where);
        else checkTool(s.target, where);
        (Array.isArray(s.alsoOk) ? s.alsoOk : []).forEach(id => checkTool(id, where + ' の alsoOk'));
        if (s.moveTo) checkPlace(s.moveTo, `${where} の moveTo`);
        (s.effects || []).forEach((ef, j) => {
          const ew = `${where} の effects ${j + 1}`;
          if (!['move', 'state', 'show', 'hide'].includes(ef.type)) tw.push(`${ew}：type「${ef.type}」は使えません（move / state / show / hide）。`);
          if (ef.tool) checkTool(ef.tool, ew); else tw.push(`${ew}：tool がありません。`);
          if (ef.type === 'move' && ef.to === undefined && ef.on === undefined) tw.push(`${ew}：to（行き先）がありません。`);
          if (ef.type === 'move' || ef.type === 'show') checkPlace(ef.on !== undefined ? { on: ef.on } : ef.to, ew);
        });
      });
    });
    const quizW = [];
    (store.quiz || []).forEach((q, i) => store.checkQuiz(q, `「${q._file}」問題 ${i + 1}（${q.id || 'id なし'}）`, quizW));
    store.warnings = w.map(m => `「data/tools.js」${m}`).concat(quizW)
      .concat(...store.temaeList.map(tm => (tm._warnings || []).map(m => `「${tm._file}」${m}`)));
  };
})();
