/*
 * 手順一覧：お点前データの中身を表にして確認する画面
 * （手順を編集したあと、ここで正しく読み込めているか確かめられます）
 */
const StepsView = (() => {
  let el, tools = [];
  const text = s => Zukan.text(s);

  function init(container, toolList) { el = container; tools = toolList; }

  function toolName(id) {
    const t = tools.find(t => t.id === id);
    return t ? t.name : `<span class="bad">${text(id)}（見つかりません）</span>`;
  }

  function placeLabel(tm, ref) {
    if (!ref) return '';
    if (typeof ref === 'object' && ref.on !== undefined) {
      return `${toolName(ref.on)}の${ref.how === 'in' ? '中' : '上'}`;
    }
    const name = DataStore.placeName(ref);
    const p = (tm.places || {})[name];
    return p ? text(p.label || name) : `<span class="bad">${text(name)}（見つかりません）</span>`;
  }

  function targetLabel(tm, target) {
    if (!target) return '<span class="bad">（なし）</span>';
    const s = String(target);
    return s.startsWith('place:') ? `場所：${placeLabel(tm, s.slice(6))}` : toolName(s);
  }

  function render(tm) {
    if (!tm) { el.innerHTML = '<p>お点前のデータがありません。</p>'; return; }
    const steps = Array.isArray(tm.steps) ? tm.steps : [];
    const warns = (DataStore.toolWarnings || []).map(m => `道具データ：${m}`).concat(tm._warnings || []);
    el.innerHTML = `
      <div class="steps-head">
        <h2>${text(tm.title)}</h2>
        <p>編集するファイル：<code>${text(tm._file)}</code>　手順の数：${steps.length}</p>
        ${tm.note ? `<p class="small">${text(tm.note)}</p>` : ''}
        ${warns.length ? `<div class="warn-box"><b>確認が必要な点（${warns.length}件）</b><ul>${warns.map(w => `<li>${text(w)}</li>`).join('')}</ul></div>`
                       : '<p class="ok">データの形に問題は見つかりませんでした。</p>'}
        <p class="small">ファイルを書き換えて保存したら、<button id="reload-btn">再読み込み</button> を押すと反映されます。</p>
      </div>
      <table class="steps-table">
        <thead><tr><th>#</th><th>id</th><th>手順名</th><th>画面</th><th>クリックする道具</th><th>移動先</th><th>説明・問題</th><th>ヒント・解説</th></tr></thead>
        <tbody>
          ${steps.map((s, i) => `<tr>
            <td>${i + 1}</td>
            <td><code>${text(s.id)}</code></td>
            <td class="name">${text(s.name)}</td>
            <td>${s.type === 'quiz' ? '三択' : s.type === 'banner' ? '文字' : s.type === 'game' ? 'ミニゲーム' : s.view === 'host' ? '亭主の目線' : s.view === 'top' ? '上から' : ''}</td>
            ${s.type === 'quiz' ? `
            <td colspan="2">正解：${text(s.answer)}</td>
            <td>${text(s.question)}<br><span class="small">選択肢：${(s.choices || []).map(text).join(' ／ ')}</span></td>
            <td>${text(s.explain)}</td>` : s.type === 'banner' ? `
            <td colspan="4">「${text(s.text)}」を大きく表示</td>` : `
            <td>${targetLabel(tm, s.target)}</td>
            <td>${placeLabel(tm, s.moveTo)}</td>
            <td>${text(s.description)}</td>
            <td>${text(s.hint)}</td>`}
          </tr>`).join('')}
        </tbody>
      </table>`;
    el.querySelector('#reload-btn').addEventListener('click', () => location.reload());
  }

  return { init, render };
})();
