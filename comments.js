// =============================================================
// comments.js — ニコニコ風コメント(流れる/中央固定)と読み上げ
// フローティングコメントの表示・アニメーション、中央固定コメント、
// 投稿再現(リプレイ)機能、Web Speech APIによる読み上げ。
// 依存: utils.js, layout.js(nicoArea), firebase.js(db, fetchQuotedTweetInfo)
// =============================================================

  const FLOATING_COMMENT_HEIGHT = 60; // フローティングコメント1つあたりの高さ（フォントサイズ+余白）
  const FLOATING_COMMENT_MARGIN = 10; // フローティングコメント間の垂直方向の隙



  let floatingCommentLines = []; // 各レーンの可用性（利用可能になる時刻）を管理
  let activeFloatingComments = new Map(); // 現在表示中のフローティングコメントのMap (key -> {element, animationEndTime, key})
  let activeCenterFixedComments = new Map(); 

  const CENTRAL_COMMENT_LIFESPAN = 20000; // 20秒

// activeFloatingCommentsMap はグローバルな activeFloatingComments を指す

function getFloatingCommentYPosition(durationMs) { // durationMs が正確か確認
    const nicoAreaHeight = nicoArea.offsetHeight;
    const currentTime = Date.now(); // 現在時刻をミリ秒で取得

    // レーン数を計算 (現在の画面の高さから何レーン確保できるか)
    const numLines = Math.floor(nicoAreaHeight / (FLOATING_COMMENT_HEIGHT + FLOATING_COMMENT_MARGIN));

    // レーン配列の初期化またはサイズ変更
    if (floatingCommentLines.length !== numLines) {
        floatingCommentLines = Array(numLines).fill(null).map(() => ({ availableTime: 0 })); // nullではなくオブジェクトで初期化
    }

    let bestLineIndex = -1;
    let earliestAvailableTime = Infinity;

    // 最も早く利用可能になるレーンを探す
    for (let i = 0; i < numLines; i++) {
        // レーンが現在利用可能（availableTimeが現在時刻以下）な場合
        if (floatingCommentLines[i].availableTime <= currentTime) {
            bestLineIndex = i; // すぐに利用可能なレーンがあればそれを優先
            break; // 見つかったらすぐにループを抜ける
        }
        // まだ利用可能でないが、最も早く空くレーンを探す
        if (floatingCommentLines[i].availableTime < earliestAvailableTime) {
            earliestAvailableTime = floatingCommentLines[i].availableTime;
            bestLineIndex = i;
        }
    }

    if (bestLineIndex !== -1) {
        const yPos = bestLineIndex * (FLOATING_COMMENT_HEIGHT + FLOATING_COMMENT_MARGIN);
        // !!! ここが最も重要 !!!
        // このレーンが、コメントが完全に画面外に出るまで占有されるように、availableTimeを更新
        floatingCommentLines[bestLineIndex].availableTime = currentTime + durationMs;
        return yPos; // 割り当てられたY座標を返す
    } else {
        // 利用可能なレーンがない場合（画面がコメントでいっぱいの時など）
        console.warn("フローティングコメントの配置に利用可能なレーンがありませんでした。コメントが重なる可能性があります。");
        // この場合でも、最低限のY位置を返すか、エラーとして処理するかを決定
        // 例: 最上段に強制的に表示（重なりを許容する場合）
        return 0; // 最上段に表示
        // または null を返して showFloatingComment 側で表示しない判断をさせる
        // return null;
    }
}


  // ---- リプレイ機能 ----
  let replayTimer = null;

  function showFloatingCommentReplay(key, text, color, size = 'medium') {
    // 通常の弾幕表示と同じコードパスを使用（DOMPurify・タイムスタンプチェックをスキップ）
    showFloatingComment(key, text, color, Date.now(), true, size);
  }

  async function startReplay() {
    if (replayTimer) stopReplay();
    const from = Math.max(1, parseInt(document.getElementById('replayFrom').value) || 1);
    const to   = Math.max(from, parseInt(document.getElementById('replayTo').value) || 10);
    const interval = parseInt(document.getElementById('replayInterval').value) || 1000;
    const status = document.getElementById('replayStatus');

    status.textContent = `Firebaseからtweetナンバー${from}〜${to}を取得中...`;
    document.getElementById('replayStartBtn').disabled = true;
    document.getElementById('replayStopBtn').disabled = false;

    // tweetNumberで範囲指定して取得
    let snapshot;
    try {
        snapshot = await db.ref('tweets')
            .orderByChild('tweetNumber')
            .startAt(from)
            .endAt(to)
            .once('value');
    } catch(e) {
        status.textContent = '取得失敗: ' + e.message;
        document.getElementById('replayStartBtn').disabled = false;
        document.getElementById('replayStopBtn').disabled = true;
        return;
    }

    const entries = [];
    snapshot.forEach(child => { entries.push({ key: child.key, data: child.val() }); });
    // tweetNumber昇順でソート
    entries.sort((a, b) => (a.data.tweetNumber || 0) - (b.data.tweetNumber || 0));

    if (entries.length === 0) {
        status.textContent = `tweetナンバー${from}〜${to}の投稿がありません`;
        document.getElementById('replayStartBtn').disabled = false;
        document.getElementById('replayStopBtn').disabled = true;
        return;
    }

    let idx = 0;
    async function playNext() {
        if (idx >= entries.length) {
            status.textContent = `再現完了 (tweetナンバー${from}〜${to}、${entries.length}件)`;
            stopReplay();
            return;
        }
        const { key, data } = entries[idx];
        status.textContent = `再現中: tweetナンバー${data.tweetNumber} (${idx + 1}/${entries.length}件)`;
        if (data) {
            if (data.type === 'center_fixed') {
                showCenterFixedComment(key + '_r' + idx, data.text, data.color, Date.now(), true, data.size || 'medium');
            } else {
                const quotedText = await buildFloatingTextWithQuote(data);
                showFloatingCommentReplay(key + '_r' + idx, quotedText, data.color, data.size || 'medium');
            }
        }
        idx++;
        replayTimer = setTimeout(playNext, interval);
    }
    playNext();
  }

  function stopReplay() {
    if (replayTimer) { clearTimeout(replayTimer); replayTimer = null; }
    document.getElementById('replayStartBtn').disabled = false;
    document.getElementById('replayStopBtn').disabled = true;
    document.getElementById('replayTxtStartBtn').disabled = false;
  }

  /**
   * txt一行をパースして { text, color, type, size } を返す
   * 書式: #NUM [日時] 名前: 内容 |color:XXX|type:YYY|size:ZZZ
   * ※ |size:ZZZ は旧バージョンのtxtには存在しないため省略可（その場合はmedium扱い）
   */
  function parseTxtLine(line) {
    // 末尾のメタタグを取り出す（sizeは旧形式との互換のため任意）
    const metaMatch = line.match(/\|color:([^\|]+)\|type:([^\|]+)(?:\|size:([^\|]+))?\s*$/);
    let savedColor = null;
    let savedType  = 'normal';
    let savedSize  = 'medium';
    let body = line;
    if (metaMatch) {
        savedColor = metaMatch[1].trim();
        savedType  = metaMatch[2].trim();
        savedSize  = metaMatch[3] ? metaMatch[3].trim() : 'medium';
        body = line.slice(0, metaMatch.index); // メタ部分を除いた行
    }

    // "#NNN [日時] 名前: 内容" の形式
    const m = body.match(/^#\S+\s+\[.*?\]\s+.+?:\s(.+)$/);
    if (!m) return null;
    let content = m[1].trim();
    let text, color, type, size;

    if (content.startsWith('【五千兆】')) {
        const bodyPart = content.replace('【五千兆】', '').trim();
        const spIdx = bodyPart.indexOf(' ');
        const part1 = spIdx >= 0 ? bodyPart.slice(0, spIdx) : bodyPart;
        const part2 = spIdx >= 0 ? bodyPart.slice(spIdx + 1) : '';
        text  = `__SPLIT__${part1}\n${part2}`;
        color = savedColor || '5000trillion';
        type  = savedType;
        size  = savedSize;
    } else if (content.startsWith('【ドット】')) {
        text  = content.replace('【ドット】', '');
        color = savedColor || 'dot';
        type  = savedType;
        size  = savedSize;
    } else {
        text  = content;
        color = savedColor || '#ffffff';
        type  = savedType;
        size  = savedSize;
    }
    return { text, color, type, size };
  }

  async function startTxtReplay() {
    const fileInput = document.getElementById('replayTxtFile');
    const status    = document.getElementById('replayStatus');
    if (!fileInput.files || fileInput.files.length === 0) {
        status.textContent = 'txt/jsonファイルを選択してください';
        return;
    }
    if (replayTimer) stopReplay();

    const interval = parseInt(document.getElementById('replayInterval').value) || 500;
    document.getElementById('replayTxtStartBtn').disabled = true;
    document.getElementById('replayStartBtn').disabled = true;
    document.getElementById('replayStopBtn').disabled = false;
    status.textContent = 'ファイル読み込み中...';

    const file = fileInput.files[0];
    const rawText = await file.text();
    const isJson = file.name.toLowerCase().endsWith('.json');

    let targets = [];
    if (isJson) {
        // JSON形式に対応:
        // ①アプリのJSON書き出し（{ key: tweetData, ... }そのもの）
        // ②Firebaseの「JSONをエクスポート」で落としたルート丸ごと（{ tweets: {...}, config: {...}, quoteIndex: {...}, ... }）
        try {
            const parsed = JSON.parse(rawText);
            const data = (parsed && typeof parsed === 'object' && parsed.tweets && typeof parsed.tweets === 'object')
                ? parsed.tweets  // ルートエクスポートの場合は tweets ノードだけを取り出す
                : parsed;        // それ以外は、渡されたオブジェクト自体が投稿一覧だとみなす
            const sortedKeys = Object.keys(data).sort((a, b) => (data[a].timestamp || 0) - (data[b].timestamp || 0));
            targets = sortedKeys
                .map(key => data[key])
                .filter(t => t && t.text)
                .map(t => ({
                    text: t.text,
                    color: t.color || '#ffffff',
                    type: t.type || 'normal',
                    size: t.size || 'medium'
                }));
        } catch (e) {
            status.textContent = 'JSONの読み込みに失敗しました（形式が違う可能性があります）';
            document.getElementById('replayTxtStartBtn').disabled = false;
            document.getElementById('replayStartBtn').disabled = false;
            document.getElementById('replayStopBtn').disabled = true;
            return;
        }
    } else {
        // txt形式（アプリのtxt書き出しと同じ「#番号 [日時] 名前: 内容 |color:...|type:...|size:...」形式）
        const lines = rawText.split(/\r?\n/).filter(l => l.trim() !== '');
        targets = lines.map(l => parseTxtLine(l)).filter(t => t !== null);
    }

    if (targets.length === 0) {
        status.textContent = '再生できる投稿がありません（形式が違う可能性があります）';
        document.getElementById('replayTxtStartBtn').disabled = false;
        document.getElementById('replayStartBtn').disabled = false;
        document.getElementById('replayStopBtn').disabled = true;
        return;
    }

    let idx = 0;
    function playNextTxt() {
        if (idx >= targets.length) {
            status.textContent = `再現完了（${targets.length}件）`;
            stopReplay();
            return;
        }
        const parsed = targets[idx];
        status.textContent = `再現中: ${idx + 1} / ${targets.length}件目`;
        if (parsed) {
            const key = 'txt_' + idx + '_' + Date.now();
            if (parsed.type === 'center_fixed') {
                showCenterFixedComment(key, parsed.text, parsed.color, Date.now(), true, parsed.size || 'medium');
            } else {
                showFloatingCommentReplay(key, parsed.text, parsed.color, parsed.size || 'medium');
            }
        }
        idx++;
        replayTimer = setTimeout(playNextTxt, interval);
    }
    playNextTxt();
  }

  function showFloatingComment(key, text, color, timestamp, skipSanitize = false, size = 'medium') {
    // skipSanitize=true のとき（リプレイ時）はDOMPurifyをスキップしてサロゲートペア文字を保持
    const sanitizedText = skipSanitize ? (text || '') : DOMPurify.sanitize(text, { USE_PROFILES: { html: true } });
    if (!skipSanitize && (containsSpam(sanitizedText) || containsForbiddenHtmlTags(text))) {
        console.log(`禁止コメントをスキップ（フローティング）: ${sanitizedText}`);
        return;
    }

    let displayText = sanitizedText;
    if (displayText.startsWith('__SPLIT__')) {
        const parts = displayText.replace('__SPLIT__', '').split('\n');
        displayText = `<div class="split-special">
            <span class="part-upper">${parts[0]}</span>
            <span class="part-lower">${parts[1] || ''}</span>
        </div>`;
    } else if (displayText.length > NORMAL_COMMENT_MAX_LENGTH) {
        displayText = displayText.substring(0, NORMAL_COMMENT_MAX_LENGTH) + "...";
    }

    // 5秒以上前のコメントは表示しない（タイムラグ対策）、リプレイ時(skipSanitize=true)はスキップ
    if (!skipSanitize && Date.now() - timestamp > 5000) {
        return;
    }


    if (activeFloatingComments.has(key)) {
        const existingCommentData = activeFloatingComments.get(key);
        if (existingCommentData.element && existingCommentData.element.parentNode) {
            existingCommentData.element.remove();
        }
        activeFloatingComments.delete(key);
    }

    const commentElement = document.createElement('div');
    commentElement.className = 'floating-comment';
    commentElement.classList.add('size-' + (size || 'medium'));
    commentElement.setAttribute('data-key', key); // Firebaseキーをデータ属性として設定

    if (color === 'rainbow') {
        commentElement.innerHTML = toRainbowText(displayText);
        commentElement.style.color = '';
    } else if (color === 'split_custom' || color === '5000trillion') {
        // 5000兆円のときは色を固定しない（CSSのグラデーションを優先する）
        commentElement.innerHTML = displayText;
        commentElement.style.color = ''; 
    } else if (color === 'dot') {
        commentElement.innerHTML = displayText;
        commentElement.style.color = '#FFFFFF';
        commentElement.classList.add('dot-font');
    } else {
        commentElement.innerHTML = displayText;
        commentElement.style.color = color || '#FFFFFF';
    }

    // ★★★ここを修正します★★★
    // 新しいフローティングコメントの親要素を取得
    const floatingCommentsWrapper = document.getElementById('floatingCommentsWrapper');
    if (floatingCommentsWrapper) {
        floatingCommentsWrapper.appendChild(commentElement); // 新しい親要素に追加
    } else {
        // フォールバック（もし floatingCommentsWrapper が見つからなかった場合）
        // 開発環境でデバッグしやすくするため、console.warn を追加しています
        nicoArea.appendChild(commentElement); // 以前の nicoArea に追加
        console.warn("Element with ID 'floatingCommentsWrapper' not found. Appending to 'nicoArea' as fallback.");
    }
    // ★★★ここまで修正★★★

    // コメントの幅と親要素の幅を取得する際には、新しい親要素の幅を使うべきです。
    // floatingCommentsWrapper があればその幅を、なければ nicoArea の幅を使用します。
    const parentWidth = floatingCommentsWrapper ? floatingCommentsWrapper.offsetWidth : nicoArea.offsetWidth;

    const commentWidth = commentElement.offsetWidth;
    // nicoAreaWidth は parentWidth に変更
    // const nicoAreaWidth = nicoArea.offsetWidth; // この行は不要になるか、parentWidthで代用

    const animationDurationMs = 10 * 1000; // 常に10秒 (ミリ秒単位)

    const startX = parentWidth; // 親要素の右端からスタート

    // getFloatingCommentYPosition 関数も、もし必要なら
    // floatingCommentsWrapper の高さに基づいて調整する必要があるかもしれません。
    // 現在は nicoArea の高さを基準にしている可能性があるので、確認が必要です。
    const assignedY = getFloatingCommentYPosition(animationDurationMs);

    if (assignedY === null) {
        commentElement.remove();
        return;
    }
    commentElement.style.top = `${assignedY}px`;
    commentElement.style.left = `0px`;
    commentElement.style.transform = `translateX(${startX}px)`;
    commentElement.style.willChange = 'transform';

    const startTime = performance.now();
    const animationEndTime = startTime + animationDurationMs;

    activeFloatingComments.set(key, {
        element: commentElement,
        animationEndTime: animationEndTime,
        key: key,
        lineIndex: assignedY / (FLOATING_COMMENT_HEIGHT + FLOATING_COMMENT_MARGIN)
    });

    function animateFloatingComment() {
        const now = performance.now();
        const elapsed = now - startTime;

        if (elapsed < animationDurationMs) {
            const currentX = startX - (elapsed / animationDurationMs) * (startX + commentWidth);
            commentElement.style.transform = `translateX(${currentX}px)`;
            requestAnimationFrame(animateFloatingComment);
        } else {
            if (commentElement.parentNode) {
                commentElement.remove();
            }
            activeFloatingComments.delete(key);
        }
    }

    requestAnimationFrame(animateFloatingComment);
}

  function showCenterFixedComment(key, text, color, timestamp, skipSanitize = false, size = 'medium') {
    // skipSanitize=true（リプレイ時）: DOMPurifyをスキップしてサロゲートペア文字を保持
    const sanitizedText = skipSanitize ? (text || '') : DOMPurify.sanitize(text);

    // 表示前に各種フィルターを適用（リプレイ時はスキップ）
    if (!skipSanitize && (containsSpam(sanitizedText) || containsForbiddenHtmlTags(sanitizedText))) {
        console.log(`禁止コメントをスキップ（中央固定）: ${sanitizedText}`);
        return;
    }

    // リプレイ時はタイムスタンプチェックをスキップ
    if (!skipSanitize && Date.now() - timestamp > CENTRAL_COMMENT_LIFESPAN) {
        return;
    }

    // すでに存在する場合は更新
    if (activeCenterFixedComments.has(key)) {
        const existing = activeCenterFixedComments.get(key);
        existing.timestamp = timestamp;

        // 文字サイズクラスを更新
        existing.element.classList.remove('size-small', 'size-medium', 'size-large');
        existing.element.classList.add('size-' + (size || 'medium'));
        existing.element.dataset.size = size || 'medium';

        // ★★★ 既存のコメントを更新する部分を修正 ★★★
        if (color === 'rainbow') {
            existing.element.innerHTML = toRainbowText(sanitizedText);
            existing.element.style.color = '';
        } else if (color === '5000trillion' || color === 'split_custom') {
            const parts = text.replace('__SPLIT__', '').split('\n');
            const p1 = skipSanitize ? (parts[0] || '') : DOMPurify.sanitize(parts[0] || '');
            const p2 = skipSanitize ? (parts[1] || '') : DOMPurify.sanitize(parts[1] || '');
            existing.element.innerHTML = `<div class="split-special"><span class="part-upper">${p1}</span><span class="part-lower">${p2}</span></div>`;
            existing.element.style.color = '';
        } else {
            existing.element.innerHTML = sanitizedText;
            existing.element.style.color = color || '#FFFFFF';
        }

        adjustCenterFixedCommentFontSize(existing.element);
        updateCenterFixedCommentPositions();
        return;
    }

    const div = document.createElement('div');
    div.className = 'center-fixed-comment';
    div.classList.add('size-' + (size || 'medium'));
    div.dataset.size = size || 'medium';

    // ★★★ 新規コメントを作成する部分を修正 ★★★
    if (color === 'rainbow') {
        div.innerHTML = toRainbowText(sanitizedText);
        div.style.color = '';
    } else if (color === '5000trillion' || color === 'split_custom') {
        const parts = text.replace('__SPLIT__', '').split('\n');
        const p1 = skipSanitize ? (parts[0] || '') : DOMPurify.sanitize(parts[0] || '');
        const p2 = skipSanitize ? (parts[1] || '') : DOMPurify.sanitize(parts[1] || '');
        div.innerHTML = `<div class="split-special"><span class="part-upper">${p1}</span><span class="part-lower">${p2}</span></div>`;
        div.style.color = '';
    } else if (color === 'dot') {
        div.innerHTML = sanitizedText;
        div.style.color = '#FFFFFF';
        div.classList.add('dot-font');
    } else {
        div.innerHTML = sanitizedText;
        div.style.color = color || '#FFFFFF';
    }

    const floatingCommentsWrapper = document.getElementById('floatingCommentsWrapper');
    (floatingCommentsWrapper || nicoArea).appendChild(div);
    activeCenterFixedComments.set(key, { element: div, timestamp: timestamp });

    adjustCenterFixedCommentFontSize(div);
    updateCenterFixedCommentPositions();

    // 指定時間経過後にコメントを削除
    setTimeout(() => {
        if (activeCenterFixedComments.has(key)) {
            activeCenterFixedComments.get(key).element.remove();
            activeCenterFixedComments.delete(key);
            updateCenterFixedCommentPositions(); // コメント削除後に位置を再調整
        }
    }, CENTRAL_COMMENT_LIFESPAN - (Date.now() - timestamp));
}
     
  function adjustCenterFixedCommentFontSize(element) {
      const targetWidth = nicoArea.clientWidth * 0.9;
      const sizeScale = getSizeScale(element.dataset.size);
      const baseNormalSize = 70 * sizeScale;
      const baseSplitSize = 70 * sizeScale;

      const partUpper = element.querySelector('.part-upper');
      const partLower = element.querySelector('.part-lower');

      if (partUpper && partLower) {
          const splitSpecial = element.querySelector('.split-special');
          if (splitSpecial) {
              splitSpecial.style.flexWrap = 'nowrap';
              splitSpecial.style.whiteSpace = 'nowrap';
          }

          // 測定用の一時要素をbodyに追加して実幅を確実に取得
          const testDiv = document.createElement('div');
          testDiv.style.cssText = `
              position: fixed;
              top: -9999px;
              left: -9999px;
              visibility: hidden;
              white-space: nowrap;
              font-family: serif;
              font-weight: 900;
              font-style: italic;
              display: flex;
              flex-direction: row;
              gap: 8px;
          `;
          const testUpper = document.createElement('span');
          const testLower = document.createElement('span');
          testUpper.textContent = partUpper.textContent;
          testLower.textContent = partLower.textContent;
          testDiv.appendChild(testUpper);
          testDiv.appendChild(testLower);
          document.body.appendChild(testDiv);

          testUpper.style.fontSize = `${baseSplitSize}px`;
          testLower.style.fontSize = `${baseSplitSize}px`;
          const totalW = testDiv.offsetWidth;
          document.body.removeChild(testDiv);

          if (totalW > targetWidth && totalW > 0) {
              const scale = targetWidth / (totalW + 20); // 20px余裕を持たせて見切れ防止
              const newSize = Math.max(10, Math.floor(baseSplitSize * scale));
              partUpper.style.fontSize = `${newSize}px`;
              partLower.style.fontSize = `${newSize}px`;
          } else {
              partUpper.style.fontSize = `${baseSplitSize}px`;
              partLower.style.fontSize = `${baseSplitSize}px`;
          }

      } else {
          // 通常コメント
          element.style.whiteSpace = 'nowrap';
          // 測定用一時要素で実幅取得
          const testDiv = document.createElement('div');
          testDiv.style.cssText = `
              position: fixed;
              top: -9999px;
              left: -9999px;
              visibility: hidden;
              white-space: nowrap;
              font-size: ${baseNormalSize}px;
              font-weight: bold;
          `;
          testDiv.textContent = element.textContent;
          document.body.appendChild(testDiv);
          const textW = testDiv.offsetWidth;
          document.body.removeChild(testDiv);

          if (textW > targetWidth && textW > 0) {
              const scale = targetWidth / textW;
              const newSize = Math.max(10, Math.floor(baseNormalSize * scale));
              element.style.fontSize = `${newSize}px`;
          } else {
              element.style.fontSize = `${baseNormalSize}px`;
          }
      }
  }


  function updateCenterFixedCommentPositions() {
      const now = Date.now();
      const floatingCommentsWrapper = document.getElementById('floatingCommentsWrapper');
      const containerEl = floatingCommentsWrapper || nicoArea;

      // 古いコメントを削除
      activeCenterFixedComments.forEach((comment, key) => {
          if (now - comment.timestamp > CENTRAL_COMMENT_LIFESPAN) {
              comment.element.remove();
              activeCenterFixedComments.delete(key);
          }
      });

      // 残った有効なコメントを新しい順にソート（新しいものほど下）
      const sortedComments = Array.from(activeCenterFixedComments.entries())
          .filter(([, comment]) => now - comment.timestamp <= CENTRAL_COMMENT_LIFESPAN)
          .sort(([, a], [, b]) => b.timestamp - a.timestamp);

      if (sortedComments.length === 0) {
          return;
      }

      const overlapOffset = 20; // コメントが重なる量
      let currentYFromBottom = 0;
      const containerHeight = containerEl.clientHeight;

      sortedComments.forEach(([key, comment]) => {
          if (!comment.element.parentNode) {
              comment.element.style.position = 'absolute';
              comment.element.style.visibility = 'hidden';
              comment.element.style.left = '50%';
              comment.element.style.bottom = '0';
              comment.element.style.transform = 'translateX(-50%)';
              containerEl.appendChild(comment.element);
          }

          // visibility:hidden のままレイアウトを計算
          comment.element.style.visibility = 'hidden';
          const commentHeight = comment.element.clientHeight;

          if (currentYFromBottom + commentHeight > containerHeight) {
              comment.element.remove();
              activeCenterFixedComments.delete(key);
              return;
          }

          comment.element.style.bottom = `${currentYFromBottom}px`;
          comment.element.style.left = '50%';
          comment.element.style.transform = 'translateX(-50%)';
          comment.element.style.visibility = 'visible';

          currentYFromBottom += commentHeight - overlapOffset;
      });
  }

  // 中央固定コメントの位置更新と20秒後の削除を、500ミリ秒（0.5秒）ごとに行う
  setInterval(updateCenterFixedCommentPositions, 500);

  document.getElementById('replayStartBtn').addEventListener('click', startReplay);
  document.getElementById('replayStopBtn').addEventListener('click', stopReplay);
  document.getElementById('replayTxtStartBtn').addEventListener('click', startTxtReplay);
  document.getElementById('replayInterval').addEventListener('input', function() {
      document.getElementById('replayIntervalLabel').textContent = (this.value / 1000).toFixed(1) + '秒';
  });


  // 引用付き投稿を流れる/中央固定コメントとして表示する際の本文を組み立てる
  // nicoAreaでは「#番号」は消さず、そのすぐ後ろに引用元の内容を挿入する（__SPLIT__＝五千兆円フォーマットでも本文中の#番号の位置に挿入）
  async function buildFloatingTextWithQuote(data) {
      if (!data.quote) return data.text;
      const rawText = data.text || '';
      const found = await fetchQuotedTweetInfo(data.quote);
      if (!found) return rawText;
      const snippet = buildQuotePlainSnippet(found.data);
      const markerRegex = new RegExp('#' + data.quote + '\\s*');
      const insertion = `#${data.quote}　${snippet}　`;
      if (markerRegex.test(rawText)) {
          return rawText.replace(markerRegex, insertion);
      }
      // 万一本文中に#番号が見当たらない場合は先頭に付ける
      return insertion + rawText;
  }

  // =============================================
  // 読み上げ機能 (Web Speech API / SpeechSynthesis)
  // =============================================
  const toggleSpeechCheckbox = document.getElementById('toggleSpeechCheckbox');
  let speechEnabled = false;
  let speechQueue = []; // 読み上げキュー
  let isSpeaking = false;

  toggleSpeechCheckbox.addEventListener('change', function() {
      speechEnabled = this.checked;
      if (!speechEnabled) {
          speechQueue = [];
          isSpeaking = true; // onendが発火しても再開しないよう先にブロック
          window.speechSynthesis.cancel();
          isSpeaking = false;
      }
  });

  /**
   * コメントデータからプレーンテキストを生成して読み上げキューに追加する
   * @param {string} name - 投稿者名
   * @param {string} rawText - Firebaseの生テキスト（__SPLIT__含む）
   * @param {string} color - カラー種別
   */
  function enqueueSpeech(rawText, color) {
      if (!speechEnabled) return;

      let plainText = '';
      if (rawText && rawText.startsWith('__SPLIT__')) {
          const parts = rawText.replace('__SPLIT__', '').split('\n');
          plainText = `${parts[0] || ''} ${parts[1] || ''}`.trim();
      } else {
          plainText = rawText || '';
      }

      plainText = DOMPurify.sanitize(plainText, { ALLOWED_TAGS: [] });
      if (!plainText) return;

      // キューが10件以上たまったら古いものを切り捨て
      if (speechQueue.length >= 10) {
          speechQueue.splice(0, speechQueue.length - 9);
      }
      speechQueue.push(plainText);
      processSpeechQueue();
  }

  function processSpeechQueue() {
      if (isSpeaking || speechQueue.length === 0) return;

      const text = speechQueue.shift();
      isSpeaking = true;

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ja-JP';
      utterance.rate = 1.6;
      utterance.pitch = 1.0;

      if (cachedJaVoice) utterance.voice = cachedJaVoice;

      let done = false;
      const onDone = () => {
          if (done) return;
          done = true;
          isSpeaking = false;
          processSpeechQueue();
      };
      utterance.onend = onDone;
      utterance.onerror = onDone;

      window.speechSynthesis.speak(utterance);
  }

  // 音声をキャッシュして毎回getVoicesを呼ばないようにする
  let cachedJaVoice = null;
  function cacheVoice() {
      const voices = window.speechSynthesis.getVoices();
      cachedJaVoice = voices.find(v => v.lang === 'ja-JP') || voices.find(v => v.lang.startsWith('ja')) || null;
  }
  window.speechSynthesis.onvoiceschanged = cacheVoice;
  cacheVoice();
  // =============================================
  // 読み上げ機能ここまで
  // =============================================

