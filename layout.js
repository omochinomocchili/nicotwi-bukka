// =============================================================
// layout.js — 画面サイズ・レイアウト計算
// 縦画面/横画面の判定、リサイズ対応、transform: scale()による
// 全体スケール調整、ヘッダー(タイトルとランキング)のバランス調整。
// 依存: settings.js(toggleLogDisplayCheckbox), timeline.js(allTweets, updateTweetDisplay),
//       comments.js(updateCenterFixedCommentPositions) ※いずれも関数内での遅延参照
// =============================================================

  const nicoArea = document.getElementById('nicoArea');
  const twiAreaEl = document.getElementById('twiArea'); 




  let immediateFrameRequested = false;

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

    // 縦長/横長に加えて、1:1付近の「正方形帯」を専用の第3レイアウトとして扱う。
    // scaleの計算・grid-templateの設定どちらでも使うため、先にまとめて判定しておく。
    // 縦長・横長それぞれの閾値・計算式自体は変更しない。
    const aspectRatio = windowWidth / windowHeight;
    const SQUARE_MIN_RATIO = 4 / 5; // 0.8
    const SQUARE_MAX_RATIO = 5 / 4; // 1.25
    const isPortrait = aspectRatio < SQUARE_MIN_RATIO;
    const isSquare = aspectRatio >= SQUARE_MIN_RATIO && aspectRatio <= SQUARE_MAX_RATIO;
    const logShown = toggleLogDisplayCheckbox.checked;

    let scale;

    if (!logShown) {
        scale = Math.min(windowWidth / 800, windowHeight / 600);
        scale = Math.min(scale, 1.0);
    } else if (isSquare) {
        // 正方形帯: タブのページズームを50%にすると全体のバランスが良くなる、
        // という手動での確認結果を式に組み込んだもの。
        // ページズーム50%は実質的にwindow.innerWidth/innerHeightが2倍になった状態と
        // 等価で、それを下の通常式に通すと「windowWidth/800によるクランプの効きが
        // windowWidth/400相当になる」→ 結果的に「通常のクランプ上下限(0.5〜1.0)を
        // そのまま半分(0.25〜0.5)にし、windowWidth/800の閾値はそのまま」と同じ値になる
        // ことが計算で確認できたため、ズーム操作なしで直接その式を使う。
        scale = (windowHeight * 1.5) / Math.max(windowWidth, windowHeight);
        scale = Math.max(0.25, scale);
        scale = Math.min(0.5, scale);
        if (windowWidth < windowHeight) {
            scale = Math.min(scale, windowWidth / 800);
        }
    } else {
        scale = (windowHeight * 1.5) / Math.max(windowWidth, windowHeight);
        scale = Math.max(0.5, scale);
        scale = Math.min(1.0, scale);
        // 縦長の場合、上の式は windowHeight の値に関わらず常に 1.5→上限の1.0 になってしまう
        // (h*1.5/max(w,h) は h>=w の間ずっと定数1.5のため)。つまり画面の実際の幅を
        // 一切見ておらず、スマホのような横幅が狭い端末でも縮小がまったくかからず
        // 「全体的に大きすぎる」結果になっていた。非表示時と同じ800px基準の上限を
        // 追加でかけて、狭い端末ではちゃんと縮小されるようにする。
        if (windowWidth < windowHeight) {
            scale = Math.min(scale, windowWidth / 800);
        }
    }
    
    document.body.style.transform = `scale(${scale})`;

    const scaledLogicalWidth = windowWidth / scale;
    const scaledLogicalHeight = windowHeight / scale;

    container.style.width = `${scaledLogicalWidth}px`;
    container.style.height = `${scaledLogicalHeight}px`;
    container.style.maxWidth = `${scaledLogicalWidth}px`;
    container.style.maxHeight = `${scaledLogicalHeight}px`;

    // ログ表示中の比率調整。
    if (isPortrait && logShown) {
        // 縦長: nicoArea高さ = 幅 × 9/16 → フローティングエリアが 縦:横 = 9:16 になる
        // grid-template-rows は [nico, header, form, twi] の1カラム構成。
        // nicoだけ固定高さにし、header/formは中身なりに、残りをtwiのflex:1(1fr)で吸収する。
        const targetCommentH = Math.min(scaledLogicalWidth * 9 / 16, scaledLogicalHeight * 0.85);
        container.style.gridTemplateRows = `${targetCommentH}px auto auto 1fr`;
        container.style.gridTemplateColumns = '';
    } else if (isSquare && logShown) {
        // 正方形帯(1:1付近): 上段にnicoAreaを固定高さで、下段を
        // 左(ヘッダー+フォーム)/右(twiArea)に分割する第3レイアウト。
        // nicoAreaの高さ = 画面高さ × 9/24。
        // grid-template-areasはstyle.css側の専用メディアクエリで
        // "nico nico" / "header twi" / "form twi" に定義済みなので、
        // ここでは行の高さ配分（nico固定・header中身なり・twiが残り1frで吸収）だけを渡す。
        const targetNicoH = scaledLogicalHeight * 9 / 24;
        container.style.gridTemplateRows = `${targetNicoH}px auto 1fr`;
        container.style.gridTemplateColumns = '';
    } else if (!isPortrait && !isSquare && logShown) {
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
    // comments.jsの読み込みより前にresizeが発火した場合はまだ未定義のためスキップする
    if (typeof updateCenterFixedCommentPositions === 'function') {
        updateCenterFixedCommentPositions();
    }
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
    }, 250); // レイアウトが確定してから少し余裕を持たせて実行
  }

  // ヘッダーバランス調整:
  //   「h1幅 + topUsers幅 = 全体幅」かつ「h1高さ = topUsers高さ」を同時に満たすよう
  //   topUsersスケール s をバイナリサーチで求める。
  function balanceHeader() {
      const h1 = document.querySelector('#headerSection h1');
      const topUsersEl = document.getElementById('topUsers');
      const headerSection = document.getElementById('headerSection');
      if (!h1 || !topUsersEl || !headerSection) return;

      // h1の中身がロゴ画像かどうかで、サイズ調整の方式を分ける
      // （画像はfont-sizeでは大きさが変わらないため）
      const h1Img = h1.querySelector('img');

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
      const LANDSCAPE_MARGIN = 30; // ランキングの右余白(px)

      if (h1Img) {
          // ロゴ画像版: フォントサイズの代わりに、アスペクト比を保ったimgの幅で
          // 「残り幅(remW) を使い切った時の高さ」と「topUsersの高さ」が
          // 釣り合う点をtopUsersスケールsの二分探索で求める。
          const naturalW = h1Img.naturalWidth;
          const naturalH = h1Img.naturalHeight;
          if (!naturalW || !naturalH) return; // 画像未読込。load時に再実行されるので今回は何もしない
          const aspectRatio = naturalW / naturalH;

          let slo = 0.2, shi = 8.0;
          for (let iter = 0; iter < 50; iter++) {
              const smid = (slo + shi) / 2;
              applyScale(smid);
              const tuW = topUsersEl.offsetWidth;
              const tuH = topUsersEl.offsetHeight;
              const remW = totalWidth - tuW;

              if (remW < 10) { shi = smid; continue; }

              // remW幅いっぱいに画像を広げたときの高さ vs topUsersの高さ
              const widthBasedHeight = remW / aspectRatio;
              if (widthBasedHeight > tuH) slo = smid; // 幅基準の方が高くなる→高さがネック→sを増やす
              else shi = smid;

              if (shi - slo < 0.005) break;
          }

          const sEquil = (slo + shi) / 2;
          applyScale(sEquil);
          const tuHEquil = topUsersEl.offsetHeight; // TOPUSERS_SCALE適用前の高さ

          // 横長時のみTOPUSERS_SCALEを適用してtopUsersを縮小
          applyScale(sEquil * (_portrait ? 1.0 : TOPUSERS_SCALE));

          // img: 縮小後の残り幅からLANDSCAPE_MARGINを引き、高さは均衡点基準
          const remWFinal = totalWidth - topUsersEl.offsetWidth
                            - (_portrait ? 0 : LANDSCAPE_MARGIN);
          const heightConstrainedWidth = tuHEquil * aspectRatio;
          const finalWidth = Math.max(1, Math.min(remWFinal, heightConstrainedWidth));

          h1Img.style.width = finalWidth + 'px';
          h1Img.style.height = 'auto';
          h1.style.width = remWFinal + 'px';
      } else {
          // テキスト版（従来ロジック）
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
          applyScale(sEquil * (_portrait ? 1.0 : TOPUSERS_SCALE));

          // h1: 縮小後の残り幅からLANDSCAPE_MARGINを引き、高さは均衡点基準
          const remWFinal = totalWidth - topUsersEl.offsetWidth
                            - (_portrait ? 0 : LANDSCAPE_MARGIN);
          const fwFinal = h1FontForWidth(remWFinal);
          const fhFinal = h1FontForHeight(tuHEquil); // 均衡点の高さで制約
          h1.style.fontSize = Math.min(fwFinal, fhFinal) + 'px';
          // 幅を明示固定して被りを完全に防ぐ
          h1.style.width = remWFinal + 'px';
      }

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

  // h1がロゴ画像の場合、画像の読み込みが遅れて先にbalanceHeader()が
  // 呼ばれてしまう（naturalWidth等が取れず何もしない）ことがあるため、
  // 読み込み完了時に一度だけ再計算する。
  (function watchHeaderLogoLoad() {
      const headerImg = document.querySelector('#headerSection h1 img');
      if (headerImg && !headerImg.complete) {
          headerImg.addEventListener('load', () => balanceHeader(), { once: true });
      }
  })();

  // resize / orientationchange 共通の「値が安定するまで待ってから確定」処理。
  //
  // 以前はresizeイベントが単純な150msデバウンス、orientationchangeイベントが
  // 値の安定待ち+検証つきのポーリング、という2つの独立した仕組みになっていた。
  // 実機の回転では両方のイベントが発生することがあり、この2つが競合すると、
  // orientationchange側が正しい値で確定した直後に、resize側の単純デバウンスが
  // 古い(不安定な)値で上書きしてしまうことがあった。これが「縦→横の回転だけ
  // まだ崩れる」の原因と考えられる。resize/orientationchangeのどちらから来ても
  // 同じ経路で処理するよう統一し、この競合を無くす。
  //
  // 値が変化している間はrequestImmediateLayout()で骨格だけ都度即時反映しつつ、
  // 値が連続で安定して読めたタイミングでadjustOverallScale()を確定実行する。
  // 通常のウィンドウドラッグ操作でも、連続してresizeが発火している間は
  // 都度リセットされるため、実質的に「操作が止まったら確定」というデバウンスと
  // 同じように働く。万一いつまでも安定しない場合は最大1000msで打ち切り、
  // さらに念のため確定後400ms後にもう一度だけ検証し直す。
  let settleInterval = null;
  let verifyTimeout = null;

  function scheduleSettledFinalize() {
      if (settleInterval) {
          clearInterval(settleInterval);
          settleInterval = null;
      }
      if (verifyTimeout) {
          clearTimeout(verifyTimeout);
          verifyTimeout = null;
      }

      let lastW = -1, lastH = -1;
      let stableCount = 0;
      const startTime = Date.now();
      const MAX_WAIT_MS = 1000;
      const POLL_INTERVAL_MS = 50;
      const STABLE_POLLS_NEEDED = 4; // 連続200ms値が変わらなければ「安定」とみなす

      settleInterval = setInterval(() => {
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
              clearInterval(settleInterval);
              settleInterval = null;
              requestImmediateLayout();
              adjustOverallScale(); // 値が安定した状態で重い調整も込みで最終確定

              // 保険: 一時的な足踏みを誤って「安定」と判定していた場合に備えて、
              // 少し後にもう一度だけ最新の値で確認し直す
              verifyTimeout = setTimeout(() => {
                  requestImmediateLayout();
                  adjustOverallScale();
              }, 400);
          }
      }, POLL_INTERVAL_MS);
  }

  // 初回の adjustOverallScale() 呼び出しは、settings.js/timeline.js/comments.js の
  // 読み込み完了後でないと中の参照(toggleLogDisplayCheckbox等)がエラーになるため、
  // 最後に読み込まれる firebase.js 側で呼び出す。ここではイベント登録のみ行う。
  window.addEventListener('resize', () => {
      requestImmediateLayout();
      scheduleSettledFinalize();
  });

  window.addEventListener('orientationchange', () => {
      requestImmediateLayout();
      scheduleSettledFinalize();
  });
  if (window.screen && window.screen.orientation) {
      window.screen.orientation.addEventListener('change', () => {
          requestImmediateLayout();
          scheduleSettledFinalize();
      });
  }





