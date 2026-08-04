// =============================================================
// layout.js — 画面サイズ・レイアウト計算
// 縦画面/横画面の判定、リサイズ対応、transform: scale()による
// 全体スケール調整、ヘッダー(タイトルとランキング)のバランス調整。
// 依存: settings.js(toggleLogDisplayCheckbox), timeline.js(allTweets, updateTweetDisplay),
//       comments.js(updateCenterFixedCommentPositions) ※いずれも関数内での遅延参照
// =============================================================

  const nicoArea = document.getElementById('nicoArea');
  const twiAreaEl = document.getElementById('twiArea'); 




  let resizeTimeout;
  const RESIZE_DEBOUNCE_TIME = 500; 

  function adjustOverallScale() {
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
        const targetCommentH = Math.min(scaledLogicalWidth * 9 / 16, scaledLogicalHeight * 0.85);
        nicoArea.style.flex = 'none';
        nicoArea.style.width = '';
        nicoArea.style.height = `${targetCommentH}px`;
        // twiAreaはリセット（残り高さをflex:1で取る）
        twiAreaEl.style.flex = '';
        twiAreaEl.style.width = '';
    } else if (!isPortrait && logShown) {
        // 横長: twiArea幅 = 高さ × 9/16 → ログエリアが 縦:横 = 16:9 になる
        const targetMainW = scaledLogicalHeight * 9 / 16;
        twiAreaEl.style.flex = 'none';
        twiAreaEl.style.width = `${targetMainW}px`;
        // nicoAreaはリセット（残り幅をflex:1で取る）
        nicoArea.style.flex = '';
        nicoArea.style.width = '';
        nicoArea.style.height = '';
    } else {
        // ログ非表示 → 両方リセット
        nicoArea.style.flex = '';
        nicoArea.style.width = '';
        nicoArea.style.height = '';
        twiAreaEl.style.flex = '';
        twiAreaEl.style.width = '';
    }

    // スケール調整後にコメントの位置を再調整
    updateCenterFixedCommentPositions();

    // h1サイズを再調整
    balanceHeader();

    // スケール調整後に5000兆円ツイートの省略を再評価（レイアウト確定後）
    setTimeout(() => {
        Object.keys(allTweets).forEach((key) => {
            const tweet = allTweets[key];
            if (tweet.color === '5000trillion' || tweet.color === 'split_custom') {
                const div = document.querySelector(`.tweet[data-key="${key}"]`);
                if (div) updateTweetDisplay(div, tweet);
            }
        });
    }, 600); // RESIZE_DEBOUNCE_TIME(500ms)より長く設定
  }

  // ヘッダーバランス調整:
  //   「h1幅 + topUsers幅 = 全体幅」かつ「h1高さ = topUsers高さ」を同時に満たすよう
  //   topUsersスケール s をバイナリサーチで求める。
  function balanceHeader() {
      const h1 = document.querySelector('#twiArea h1');
      const topUsersEl = document.getElementById('topUsers');
      const headerSection = document.getElementById('headerSection');
      if (!h1 || !topUsersEl || !headerSection) return;

      // h1をflexから外してscrollWidthを正確に計測できるようにする
      h1.style.flex = 'none';
      h1.style.width = 'auto';

      const totalWidth = headerSection.clientWidth;
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
              if (h3) h3.style.fontSize = Math.round(flo * H3_BASE / LI_BASE) + 'px';
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
  window.addEventListener('resize', debounceAdjustScale);

  // 画面回転（縦長⇔横長の切り替え）対応：
  // orientationchangeは端末やブラウザによってresizeが確実に発火するとは限らないため、
  // 別途こちらでも再計算をトリガーする。回転直後はwindow.innerWidth/innerHeightが
  // まだ回転前の値のことがあるため、少し待ってから実行する。
  window.addEventListener('orientationchange', () => {
      setTimeout(debounceAdjustScale, 300);
  });
  if (window.screen && window.screen.orientation) {
      window.screen.orientation.addEventListener('change', () => {
          setTimeout(debounceAdjustScale, 300);
      });
  }

