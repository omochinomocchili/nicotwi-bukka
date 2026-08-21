// =============================================================
// layout.js — 画面サイズ・レイアウト計算
// 縦画面/横画面の判定、リサイズ対応、transform: scale()による
// 全体スケール調整、ヘッダー(タイトルとランキング)のバランス調整。
// 依存: settings.js(toggleLogDisplayCheckbox), timeline.js(allTweets, updateTweetDisplay),
//       comments.js(updateCenterFixedCommentPositions) ※いずれも関数内での遅延参照
// =============================================================

  const nicoArea = document.getElementById('nicoArea');
  const twiAreaEl = document.getElementById('twiArea'); 

  // ---- 一時的なデバッグ表示 (原因調査用。解決したら削除する) ----
  // bodyのtransform:scale()の影響を受けないよう<html>直下に直接ぶら下げる
  window.__jsErrors = [];
  window.addEventListener('error', (e) => {
      window.__jsErrors.push((e.message || 'unknown error') + ' @ ' + (e.filename || '?') + ':' + (e.lineno || '?'));
      if (window.__jsErrors.length > 5) window.__jsErrors.shift();
  });

  function setupDebugOverlay() {
      const box = document.createElement('div');
      box.id = '__debugOverlay';
      box.style.cssText = [
          'position:fixed', 'top:0', 'left:0', 'z-index:999999',
          'background:rgba(0,0,0,0.85)', 'color:#0f0',
          'font-family:monospace', 'font-size:11px', 'line-height:1.35',
          'padding:6px 8px', 'white-space:pre', 'pointer-events:none',
          'transform:none', 'max-width:100vw', 'max-height:100vh', 'overflow:hidden'
      ].join(';');
      document.documentElement.appendChild(box);

      function update() {
          const c = document.getElementById('container');
          const rect = c ? c.getBoundingClientRect() : null;
          const bodyCs = getComputedStyle(document.body);
          const vv = window.visualViewport;

          const h1 = document.querySelector('#headerSection h1');
          const topUsersEl = document.getElementById('topUsers');
          const headerSection = document.getElementById('headerSection');
          const h1Rect = h1 ? h1.getBoundingClientRect() : null;
          const tuRect = topUsersEl ? topUsersEl.getBoundingClientRect() : null;

          const lines = [
              `innerW/H: ${window.innerWidth} x ${window.innerHeight}`,
              `visualViewport: ${vv ? Math.round(vv.width) + 'x' + Math.round(vv.height) : 'なし'}`,
              `devicePixelRatio: ${window.devicePixelRatio}`,
              `body transform: ${bodyCs.transform}`,
              `container style W/H: ${c ? c.style.width : '?'} / ${c ? c.style.height : '?'}`,
              `container rect W/H: ${rect ? Math.round(rect.width) + ' x ' + Math.round(rect.height) : '?'}`,
              `grid cols: ${c ? getComputedStyle(c).gridTemplateColumns : '?'}`,
              `grid rows: ${c ? getComputedStyle(c).gridTemplateRows : '?'}`,
              `--- header ---`,
              `balanceHeader status: ${window.__balanceHeaderStatus || '(未実行)'}`,
              `headerSection clientW: ${headerSection ? headerSection.clientWidth : '?'}`,
              `h1 fontSize(computed): ${h1 ? getComputedStyle(h1).fontSize : '?'}`,
              `h1 rect W/H: ${h1Rect ? Math.round(h1Rect.width) + ' x ' + Math.round(h1Rect.height) : '?'}`,
              `topUsers rect W/H: ${tuRect ? Math.round(tuRect.width) + ' x ' + Math.round(tuRect.height) : '?'}`,
              `orientation: ${window.innerWidth <= window.innerHeight ? 'portrait' : 'landscape'}`,
              `--- errors (最新5件) ---`,
              ...(window.__jsErrors.length ? window.__jsErrors : ['(なし)']),
          ];
          box.textContent = lines.join('\n');
      }

      update();
      window.addEventListener('resize', update);
      window.addEventListener('orientationchange', () => setTimeout(update, 50));
      setInterval(update, 300); // ポーリングでも保険をかけておく
  }
  setupDebugOverlay();
  // ---- デバッグ表示ここまで ----



  let resizeTimeout;
  let immediateFrameRequested = false;
  const RESIZE_DEBOUNCE_TIME = 150; // 重い再計算(balanceHeader等)の間引き用。以前は500msだった

  // 軽量パート: transform:scale・コンテナの論理サイズ・グリッド比率など、
  // window.innerWidth/Height から直接書き込むだけで済む(measure-then-writeの
  // 往復が要らない)部分。resizeのたびにrAFで間引きつつ即座に反映することで、
  // 「比率を変えてから見た目が追いつくまでのラグ」を最小化する。
  function applyImmediateLayout() {
    const container = document.getElementById('container');

    if (!container) {
        console.warn("container element not found. Skipping scale adjustment.");
        return;
    }

    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    let scale;

    if (!toggleLogDisplayCheckbox.checked) { 
        scale = Math.min(windowWidth / 800, windowHeight / 600);
        scale = Math.min(scale, 1.0);
    } else { 
        scale = (windowHeight * 1.5) / Math.max(windowWidth, windowHeight);
        scale = Math.max(0.5, scale);
        scale = Math.min(1.0, scale);
    }
    
    document.body.style.transform = `scale(${scale})`;

    const scaledLogicalWidth = windowWidth / scale;
    const scaledLogicalHeight = windowHeight / scale;

    container.style.width = `${scaledLogicalWidth}px`;
    container.style.height = `${scaledLogicalHeight}px`;
    container.style.maxWidth = `${scaledLogicalWidth}px`;
    container.style.maxHeight = `${scaledLogicalHeight}px`;

    // ログ表示中の比率調整
    const isPortrait = windowWidth <= windowHeight;
    const logShown = toggleLogDisplayCheckbox.checked;
    if (isPortrait && logShown) {
        // 縦長: nicoArea高さ = 幅 × 9/16 → フローティングエリアが 縦:横 = 9:16 になる
        // grid-template-rows は [nico, header, form, twi] の1カラム構成。
        // nicoだけ固定高さにし、header/formは中身なりに、残りをtwiのflex:1(1fr)で吸収する。
        const targetCommentH = Math.min(scaledLogicalWidth * 9 / 16, scaledLogicalHeight * 0.85);
        container.style.gridTemplateRows = `${targetCommentH}px auto auto 1fr`;
        container.style.gridTemplateColumns = '';
    } else if (!isPortrait && logShown) {
        // 横長: 右カラム(ヘッダー+twiArea)幅 = 高さ × 9/16 → 左カラム(nicoArea)側が 縦:横 = 16:9 相当になる
        const targetMainW = scaledLogicalHeight * 9 / 16;
        container.style.gridTemplateColumns = `1fr ${targetMainW}px`;
        container.style.gridTemplateRows = '';
    } else {
        // ログ非表示 → 両方リセット（CSS側のデフォルト比率に戻す）
        container.style.gridTemplateColumns = '';
        container.style.gridTemplateRows = '';
    }

    // コメントの位置を再調整（activeな中央固定コメント数個分の軽い計算のみ）
    updateCenterFixedCommentPositions();
  }

  // rAFで「1フレームに1回まで」に間引きながら即時レイアウトを反映する
  function requestImmediateLayout() {
    if (immediateFrameRequested) return;
    immediateFrameRequested = true;
    requestAnimationFrame(() => {
        immediateFrameRequested = false;
        applyImmediateLayout();
    });
  }

  function adjustOverallScale() {
    // 即時パートを同期的にも実行しておく(直接呼ばれた場合の一貫性を保つため)
    applyImmediateLayout();

    // h1サイズを再調整（二分探索を伴う重い処理）
    balanceHeader();

    // レイアウト確定後に投稿の折りたたみ判定を再評価（5000兆円に限らず全投稿が対象）
    setTimeout(() => {
        Object.keys(allTweets).forEach((key) => {
            const tweet = allTweets[key];
            const div = document.querySelector(`.tweet[data-key="${key}"]`);
            if (div && div.querySelector('.tweet-text-content')) {
                updateTweetDisplay(div, tweet);
            }
        });
    }, 250); // RESIZE_DEBOUNCE_TIME(150ms)より長く設定
  }

  // ヘッダーバランス調整:
  //   「h1幅 + topUsers幅 = 全体幅」かつ「h1高さ = topUsers高さ」を同時に満たすよう
  //   topUsersスケール s をバイナリサーチで求める。
  function balanceHeader() {
      try {
          balanceHeaderInner();
          window.__balanceHeaderStatus = 'OK (run #' + (window.__balanceHeaderRunCount = (window.__balanceHeaderRunCount || 0) + 1) + ')';
      } catch (e) {
          window.__balanceHeaderStatus = 'ERROR: ' + (e && e.stack ? e.stack : String(e));
      }
  }
  function balanceHeaderInner() {
      const h1 = document.querySelector('#headerSection h1');
      const topUsersEl = document.getElementById('topUsers');
      const headerSection = document.getElementById('headerSection');
      if (!h1 || !topUsersEl || !headerSection) return;

      // h1をflexから外してscrollWidthを正確に計測できるようにする
      h1.style.flex = 'none';
      h1.style.width = 'auto';

      // headerSection自身がpaddingを持つため、clientWidth(=content+padding)から
      // padding分を引いた「flexの子要素が実際に使える幅」を基準にする
      const hsStyle = getComputedStyle(headerSection);
      const hsPadX = (parseFloat(hsStyle.paddingLeft) || 0) + (parseFloat(hsStyle.paddingRight) || 0);
      const totalWidth = headerSection.clientWidth - hsPadX;
      const h3 = topUsersEl.querySelector('h3');
      const lis = topUsersEl.querySelectorAll('li:not(.equal-rank-info)');
      const H3_BASE = 18, LI_BASE = 15;
      const _portrait = window.innerWidth <= window.innerHeight;

      const TOPUSERS_SCALE = 0.6; // ランキングサイズの調整係数（二分探索収束後に適用）
      function applyScale(s) {
          if (h3) h3.style.fontSize = (H3_BASE * s) + 'px';
          lis.forEach(li => li.style.fontSize = (LI_BASE * s) + 'px');
      }

      // h1がmaxW幅に収まる最大フォントサイズ
      function h1FontForWidth(maxW) {
          let lo = 1, hi = 600;
          while (lo < hi) {
              const mid = Math.ceil((lo + hi) / 2);
              h1.style.fontSize = mid + 'px';
              if (h1.scrollWidth <= maxW) lo = mid;
              else hi = mid - 1;
          }
          h1.style.fontSize = lo + 'px';
          return lo;
      }

      // h1がtargetH高さに収まる最大フォントサイズ
      function h1FontForHeight(targetH) {
          let lo = 1, hi = 600;
          while (lo < hi) {
              const mid = Math.ceil((lo + hi) / 2);
              h1.style.fontSize = mid + 'px';
              if (h1.offsetHeight <= targetH) lo = mid;
              else hi = mid - 1;
          }
          h1.style.fontSize = lo + 'px';
          return lo;
      }

      // topUsersスケール s のバイナリサーチ
      let slo = 0.2, shi = 8.0;
      for (let iter = 0; iter < 50; iter++) {
          const smid = (slo + shi) / 2;
          applyScale(smid);
          const tuW = topUsersEl.offsetWidth;
          const tuH = topUsersEl.offsetHeight;
          const remW = totalWidth - tuW;

          if (remW < 10) { shi = smid; continue; }

          const fw = h1FontForWidth(remW);
          const fh = h1FontForHeight(tuH);

          if (fw > fh) slo = smid;
          else shi = smid;

          if (shi - slo < 0.005) break;
      }

      // 均衡点をフルスケールで記録（h1の高さ制約に使う）
      const sEquil = (slo + shi) / 2;
      applyScale(sEquil);
      const tuHEquil = topUsersEl.offsetHeight; // TOPUSERS_SCALE適用前の高さ

      // 横長時のみTOPUSERS_SCALEを適用してtopUsersを縮小
      const LANDSCAPE_MARGIN = 30; // ランキングの右余白(px)
      applyScale(sEquil * (_portrait ? 1.0 : TOPUSERS_SCALE));

      // h1: 縮小後の残り幅からLANDSCAPE_MARGINを引き、高さは均衡点基準
      const remWFinal = totalWidth - topUsersEl.offsetWidth
                        - (_portrait ? 0 : LANDSCAPE_MARGIN);
      const fwFinal = h1FontForWidth(remWFinal);
      const fhFinal = h1FontForHeight(tuHEquil); // 均衡点の高さで制約
      h1.style.fontSize = Math.min(fwFinal, fhFinal) + 'px';
      // 幅を明示固定して被りを完全に防ぐ
      h1.style.width = remWFinal + 'px';
      // ランキング右余白（横長時のみ）
      topUsersEl.style.marginRight = _portrait ? '' : LANDSCAPE_MARGIN + 'px';

      // 横長時: topUsersの幅いっぱいまでテキストを拡大して密度を上げる
      if (!_portrait) {
          const boxW = topUsersEl.clientWidth;
          const allLis = Array.from(topUsersEl.querySelectorAll('li:not(.equal-rank-info)'));
          if (allLis.length > 0) {
              let flo = 1, fhi = 300;
              while (flo < fhi) {
                  const fmid = Math.ceil((flo + fhi) / 2);
                  allLis.forEach(li => li.style.fontSize = fmid + 'px');
                  const maxW = Math.max(...allLis.map(li => li.scrollWidth));
                  if (maxW <= boxW) flo = fmid;
                  else fhi = fmid - 1;
              }
              allLis.forEach(li => li.style.fontSize = flo + 'px');
              // h3はliと文字数が大きく異なるため、同じ比率では箱に収まらないことがある。
              // liと同様にboxW基準で独立に二分探索して、確実にtopUsersの幅に収める。
              if (h3) {
                  let h3lo = 1, h3hi = 300;
                  while (h3lo < h3hi) {
                      const h3mid = Math.ceil((h3lo + h3hi) / 2);
                      h3.style.fontSize = h3mid + 'px';
                      if (h3.scrollWidth <= boxW) h3lo = h3mid;
                      else h3hi = h3mid - 1;
                  }
                  h3.style.fontSize = h3lo + 'px';
              }
          }
      }
  }

  function debounceAdjustScale() {
      console.log('[layout] resize検知、再計算を予約');
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
          try {
              adjustOverallScale();
              console.log('[layout] adjustOverallScale実行完了');
          } catch (e) {
              console.error('[layout] adjustOverallScaleでエラー:', e);
          }
      }, RESIZE_DEBOUNCE_TIME);
  }

  // 初回の adjustOverallScale() 呼び出しは、settings.js/timeline.js/comments.js の
  // 読み込み完了後でないと中の参照(toggleLogDisplayCheckbox等)がエラーになるため、
  // 最後に読み込まれる firebase.js 側で呼び出す。ここではイベント登録のみ行う。
  //
  // resizeイベントごとに、まずrequestImmediateLayout()で骨格(scale/コンテナサイズ/
  // グリッド比率)を即座に反映し、その少し後にdebounceAdjustScale()で重い調整
  // (balanceHeader等)を行う。こうすることで「比率を変えてから見た目が追いつくまで」
  // の体感ラグを大きく減らせる。
  window.addEventListener('resize', () => {
      requestImmediateLayout();
      debounceAdjustScale();
  });

  // 画面回転（縦長⇔横長の切り替え）対応：
  // orientationchangeは端末やブラウザによってresizeが確実に発火するとは限らないため、
  // 別途こちらでも再計算をトリガーする。
  //
  // 回転直後はwindow.innerWidth/innerHeightがまだ回転前の値のことがあり、その値で
  // scaleを計算してしまうと文字サイズ等が誤って固定されてしまう。値が安定するまでの
  // 時間は端末や回転の向き(縦→横 / 横→縦)によってバラつくため、固定の待ち時間で
  // 決め打ちするのではなく、window.innerWidth/innerHeightの変化を実際に監視して、
  // 値が変化している間はrequestImmediateLayout()で骨格だけ都度反映しつつ、
  // 値が落ち着いた（連続で同じ値が読めた）タイミングでadjustOverallScale()を
  // 確定実行する。万一いつまでも安定しない場合に備えて、最大1000msで打ち切る。
  //
  // 回転アニメーションの途中で一時的に値が足踏みする端末があると、それを
  // 「安定した」と誤認してしまう恐れがあるため、連続で同じ値が読めた回数の
  // しきい値は多少余裕を持たせている。それでも取りこぼした場合に備えて、
  // 確定後にもう一度だけ検証し直す保険もかけておく。
  let orientationSettleInterval = null;
  let orientationVerifyTimeout = null;

  function handleOrientationChange() {
      if (orientationSettleInterval) {
          clearInterval(orientationSettleInterval);
          orientationSettleInterval = null;
      }
      if (orientationVerifyTimeout) {
          clearTimeout(orientationVerifyTimeout);
          orientationVerifyTimeout = null;
      }

      let lastW = -1, lastH = -1;
      let stableCount = 0;
      const startTime = Date.now();
      const MAX_WAIT_MS = 1000;
      const POLL_INTERVAL_MS = 50;
      const STABLE_POLLS_NEEDED = 4; // 連続200ms値が変わらなければ「安定」とみなす

      orientationSettleInterval = setInterval(() => {
          const w = window.innerWidth;
          const h = window.innerHeight;
          const elapsed = Date.now() - startTime;

          if (w === lastW && h === lastH) {
              stableCount++;
          } else {
              stableCount = 0;
              lastW = w;
              lastH = h;
              requestImmediateLayout(); // 値が変わるたびに骨格だけ即時反映
          }

          if (stableCount >= STABLE_POLLS_NEEDED || elapsed >= MAX_WAIT_MS) {
              clearInterval(orientationSettleInterval);
              orientationSettleInterval = null;
              requestImmediateLayout();
              adjustOverallScale(); // 値が安定した状態で重い調整も込みで最終確定

              // 保険: 回転アニメーションの一時停止を誤って「安定」と判定していた場合に
              // 備えて、少し後にもう一度だけ最新の値で確認し直す
              orientationVerifyTimeout = setTimeout(() => {
                  requestImmediateLayout();
                  adjustOverallScale();
              }, 400);
          }
      }, POLL_INTERVAL_MS);
  }

  window.addEventListener('orientationchange', handleOrientationChange);
  if (window.screen && window.screen.orientation) {
      window.screen.orientation.addEventListener('change', handleOrientationChange);
  }




