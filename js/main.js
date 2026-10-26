/*
 * 起動とモード切り替え
 */
(function () {
  const $ = id => document.getElementById(id);
  let mode = 'zukan';
  let currentTemae = null;

  // エラーの表示
  function showErrors() {
    const banner = $('error-banner');
    const errs = DataStore.errors;
    if (!errs.length) { banner.hidden = true; return; }
    banner.innerHTML = '<b>データの読み込みで問題がありました</b><ul>' +
      errs.map(m => `<li>${Zukan.text(m)}</li>`).join('') + '</ul>';
    banner.hidden = false;
  }

  function setMode(m) {
    if ((m === 'guide' || m === 'honban') && !currentTemae) return;
    mode = m;
    document.querySelectorAll('#mode-tabs button').forEach(b => b.classList.toggle('active', b.dataset.mode === m));
    const isSteps = m === 'steps';
    $('stage-wrap').hidden = isSteps;
    $('panel').hidden = isSteps;
    $('steps-view').hidden = !isSteps;
    if (m !== 'guide' && m !== 'honban') Temae.stop();
    if (m !== 'quiz') QuizMode.leave();
    if (m === 'zukan') Zukan.enter();
    if (m === 'quiz') QuizMode.enter();
    if (m === 'guide' || m === 'honban') Temae.start(currentTemae, m);
    if (isSteps) StepsView.render(currentTemae);
    Views.layout();
  }

  document.addEventListener('DOMContentLoaded', () => {
    DataStore.onError = showErrors;
    DataStore.finalize();
    DataStore.validate(PixelArt.has);
    showErrors();

    const tools = DataStore.tools;
    if (!tools.length) {
      $('main').innerHTML = '<p class="fatal">道具のデータ（data/tools.js）が読み込めないため、表示できません。上のメッセージを確認してください。</p>';
      return;
    }

    // お点前の選択肢
    const sel = $('temae-select');
    DataStore.temaeList.forEach((tm, i) => {
      const o = document.createElement('option');
      o.value = i; o.textContent = tm.title || tm.id || `お点前 ${i + 1}`;
      sel.appendChild(o);
    });
    currentTemae = DataStore.temaeList[0] || null;
    sel.addEventListener('change', () => {
      currentTemae = DataStore.temaeList[sel.value];
      setMode(mode);
    });

    Views.init({ wrap: $('stage-wrap'), tip: $('tooltip'), cTop: $('view-top'), cHost: $('view-host'), swapBtn: $('swap-view') }, tools);
    Zukan.init(tools, $('panel'));
    StepsView.init($('steps-view'), tools);
    Temae.init(tools, { panel: $('panel'), bar: $('step-bar'), finishEl: $('finish'), bannerEl: $('banner') });
    QuizMode.init({ area: $('quiz-area'), panel: $('panel') });

    $('show-labels').addEventListener('change', e => Views.setLabels(e.target.checked));
    document.querySelectorAll('#mode-tabs button').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));

    // データに注意点があれば、手順一覧のタブに印をつける
    if (DataStore.warnings.length) {
      const tab = document.querySelector('#mode-tabs [data-mode="steps"]');
      tab.textContent += `（注意 ${DataStore.warnings.length}）`;
      console.warn('データの注意点:\n' + DataStore.warnings.join('\n'));
    }

    setMode('zukan');
  });
})();
