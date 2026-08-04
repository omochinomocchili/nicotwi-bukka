// =============================================================
// timeline.js — 投稿(ツイート)の表示・削除・DOM操作
// 投稿カードの生成/更新/削除、引用カード生成、もっと見る/折りたたみ、
// テキストエクスポート機能など、タイムラインの見た目に関する処理。
// 依存: utils.js, ranking.js(scheduleUpdateUserStats), settings.js,
//       comments.js(enqueueSpeech, showFloatingComment等), firebase.js(toggleReaction, fetchQuotedTweetInfo等)
// =============================================================

  const tweetStream = document.getElementById('tweetStream');
  const logContainer = document.getElementById('logContainer');
  const MAX_LOG_COMMENT_LENGTH = 150;
  let allTweets = {};
  const tweetDomCache = new Map(); // key → DOM要素キャッシュ // child_addedクエリ参照（off()用） // 全ツイートデータのキャッシュ

  // 引用ジャンプで直近移動した投稿のキー。新着投稿による100件超過削除から一時的に保護する
  let protectedTweetKey = null;
  let protectedTweetTimer = null;
  function protectTweetFromEviction(key) {
      protectedTweetKey = key;
      if (protectedTweetTimer) clearTimeout(protectedTweetTimer);
      protectedTweetTimer = setTimeout(() => {
          protectedTweetKey = null;
          protectedTweetTimer = null;
      }, 8000); // 8秒間はジャンプ先の投稿を新着による自動削除から守る
  }
     /**
 * スクロールコメントの件数をチェックし、タイムスタンプに基づいて古いコメントを削除する
 */
function limitComments() {
    // コメントが流れるコンテナのIDは "tweetStream" であることをコードから確認済み
    const commentContainer = document.getElementById('tweetStream'); 
    const MAX_COMMENTS = 100;

    // コンテナが見つからない場合は処理を終了（エラー防止）
    if (!commentContainer) {
        console.warn("#tweetStream が見つかりません。コメント制限は実行されません。");
        return;
    }

    // 現在表示されている全てのコメント要素を取得
    const allComments = Array.from(commentContainer.children);
    
    // 100件以下なら何もしない
    if (allComments.length <= MAX_COMMENTS) {
        return; 
    }

    // タイムスタンプ（data-timestamp属性）を基に、古い順にソートする
    allComments.sort((a, b) => {
        // data-timestampを数値に変換（属性がない要素は0として扱い、エラーを防ぐ）
        const timeA = parseInt(a.getAttribute('data-timestamp')) || 0;
        const timeB = parseInt(b.getAttribute('data-timestamp')) || 0;
        return timeA - timeB; // 昇順（タイムスタンプが小さい（古い）順）
    });

    // 削除するコメントの数を計算 (例: 105件あれば 5件削除)
    const commentsToRemoveCount = allComments.length - MAX_COMMENTS;

    // ソートされた配列の先頭から、削除すべき件数分だけDOMから削除
    for (let i = 0; i < commentsToRemoveCount; i++) {
        const commentToRemove = allComments[i];
        if (commentToRemove) {
            commentContainer.removeChild(commentToRemove);
        }
    }
    
    if (commentsToRemoveCount > 0) {
        console.log(`コメント数が${MAX_COMMENTS}件を超えたため、古いコメント${commentsToRemoveCount}件を削除しました。`);
    }
}

  function updateTweetDisplay(tweetElement, tweetData) {
    const tweetTextElement = tweetElement.querySelector('.tweet-text-content');
    const toggleButton = tweetElement.querySelector('.toggle-text-button');
    const tweetFooter = tweetElement.querySelector('.tweet-footer');

    if (!tweetTextElement) {
        console.warn("tweetTextElement not found for tweet key:", tweetElement.getAttribute('data-key'));
        return;
    }

    // 引用(#数字)がある場合は、appendTweetToStreamと同じく本文表示からその部分を取り除く
    const quoteStrippedText = tweetData.quote ? stripQuoteMarker(tweetData.text, tweetData.quote) : tweetData.text;

    // 虹色と通常色の表示を正しく処理
    const sanitizedText = DOMPurify.sanitize(quoteStrippedText, { USE_PROFILES: { html: false } });
    if (tweetData.color === 'rainbow') {
        tweetTextElement.innerHTML = toRainbowText(sanitizedText);
        tweetTextElement.style.color = 'initial';
    } else if (tweetData.color === '5000trillion' || tweetData.color === 'split_custom') {
        // appendTweetToStream で既にHTMLをセット済みのため何もしない
    } else {
        tweetTextElement.innerHTML = linkifyMentions(sanitizedText);
        tweetTextElement.style.color = tweetData.color || '#FFFFFF';
    }

    // 判定のために、一時的に短縮表示のスタイルを適用
    const is5000 = tweetData.color === '5000trillion' || tweetData.color === 'split_custom';
    const tempClass = is5000 ? 'temp-clamp-2' : 'temp-clamp';
    if (is5000) tweetTextElement.classList.add('clamp-2');
    else tweetTextElement.classList.remove('clamp-2');

    if (is5000) {
        const splitSpecial = tweetTextElement.querySelector('.split-special');
        if (!splitSpecial) {
            tweetTextElement.classList.add('no-toggle');
            return;
        }

        // clamped クラスをリセット
        splitSpecial.classList.remove('clamped');
        tweetTextElement.classList.remove('clamp-2');
        tweetTextElement.style.maxHeight = '';
        tweetTextElement.style.overflow = '';

        // DOMが確実にレイアウトされた後に高さを測定するためrAFを2回ネスト
        requestAnimationFrame(() => requestAnimationFrame(() => {
            const pu = splitSpecial.querySelector('.part-upper');
            const pl = splitSpecial.querySelector('.part-lower');

            if (!pu || !pl) {
                tweetTextElement.classList.add('no-toggle');
                return;
            }

            const lineHeight = parseFloat(getComputedStyle(pu).lineHeight) || 34.1;
            const twoLineHeight = lineHeight * 2;

            // maxHeightをリセットして正確な高さを取得
            tweetTextElement.style.maxHeight = '';
            tweetTextElement.style.overflow = '';
            // .tweet内ではsplit-specialがinline表示になっているため
            // 測定前だけ一時的にflex縦並びに戻して正確な高さを取得する
            splitSpecial.style.display = 'flex';
            splitSpecial.style.flexDirection = 'column';
            const puTemp = splitSpecial.querySelector('.part-upper');
            const plTemp = splitSpecial.querySelector('.part-lower');
            if (puTemp) puTemp.style.display = 'block';
            if (plTemp) plTemp.style.display = 'block';

            void splitSpecial.offsetHeight; // 強制reflow
            const measuredHeight = splitSpecial.offsetHeight;

            // 表示を元に戻す
            splitSpecial.style.display = '';
            splitSpecial.style.flexDirection = '';
            if (puTemp) puTemp.style.display = '';
            if (plTemp) plTemp.style.display = '';

            const needsClamp = measuredHeight > twoLineHeight * 1.05;

            let existingButton = tweetElement.querySelector('.toggle-text-button');

            if (needsClamp) {
                tweetTextElement.style.maxHeight = `${twoLineHeight}px`;
                tweetTextElement.style.overflow = 'hidden';
                tweetTextElement.classList.add('clamp-2');
                tweetTextElement.classList.remove('no-toggle');

                if (!existingButton) {
                    existingButton = document.createElement('button');
                    existingButton.className = 'toggle-text-button';
                    tweetTextElement.insertAdjacentElement('afterend', existingButton);
                }
                existingButton.style.display = 'block';
                existingButton.textContent = tweetTextElement.classList.contains('expanded') ? '折りたたむ' : 'もっと見る';
                existingButton.onclick = () => {
                    const isExpanded = tweetTextElement.classList.toggle('expanded');
                    tweetTextElement.style.maxHeight = isExpanded ? '' : `${twoLineHeight}px`;
                    tweetTextElement.style.overflow = isExpanded ? '' : 'hidden';
                    existingButton.textContent = isExpanded ? '折りたたむ' : 'もっと見る';
                };
            } else {
                tweetTextElement.style.maxHeight = '';
                tweetTextElement.style.overflow = '';
                tweetTextElement.style.display = '';
                tweetTextElement.classList.remove('expanded', 'clamp-2');
                tweetTextElement.classList.add('no-toggle');
                splitSpecial.classList.remove('clamped');
                const allButtons = tweetElement.querySelectorAll('.toggle-text-button');
                allButtons.forEach(b => b.style.display = 'none');
            }
        }));
        return;
    }

    tweetTextElement.classList.add(tempClass);
    
    requestAnimationFrame(() => {
        const isOverflown = tweetTextElement.scrollHeight > tweetTextElement.clientHeight;
        tweetTextElement.classList.remove(tempClass);

        if (isOverflown) {
            // もし、ボタンがまだなければ作成
            if (!toggleButton) {
                const newButton = document.createElement('button');
                newButton.className = 'toggle-text-button';
                tweetTextElement.insertAdjacentElement('afterend', newButton);
            }

            const existingButton = tweetElement.querySelector('.toggle-text-button');
            if (existingButton) {
                existingButton.style.display = 'block';
                tweetTextElement.classList.remove('no-toggle');

                if (tweetTextElement.classList.contains('expanded')) {
                    existingButton.textContent = '折りたたむ';
                } else {
                    existingButton.textContent = 'もっと見る';
                }

                existingButton.onclick = () => {
                    tweetTextElement.classList.toggle('expanded');
                    if (tweetTextElement.classList.contains('expanded')) {
                        existingButton.textContent = '折りたたむ';
                    } else {
                        existingButton.textContent = 'もっと見る';
                    }
                };
            }
        } else {
            // 短縮表示が不要な場合
            if (toggleButton) {
                toggleButton.style.display = 'none';
            }
            tweetTextElement.classList.remove('expanded');
            tweetTextElement.classList.add('no-toggle');
        }
    });
}
// ↓↓↓ appendTweetToLog 関数 ↓↓↓
function appendTweetToLog(key, text, color, timestamp, user) {
    const logCommentDiv = document.createElement('div');
    logCommentDiv.className = 'log-comment';
    logCommentDiv.setAttribute('data-key', key);

    const displayTime = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const userSpan = document.createElement('span');
    userSpan.className = 'log-user';
    userSpan.textContent = user + ': ';
    userSpan.style.color = '#FFFFFF';

    const contentSpan = document.createElement('span');
    contentSpan.className = 'log-content';
    // __SPLIT__フォーマットの場合はパーツを分解して表示用テキストを生成
    let displayTextForLog = text;
    if (text && text.startsWith('__SPLIT__')) {
        const parts = text.replace('__SPLIT__', '').split('\n');
        displayTextForLog = `【五千兆】${parts[0]} ${parts[1] || ''}`;
    }
    let originalText = DOMPurify.sanitize(displayTextForLog, { USE_PROFILES: { html: false } });

    if (color === 'rainbow') {
        contentSpan.innerHTML = toRainbowText(originalText);
    } else if (color === '5000trillion' || color === 'split_custom') {
        // 5000兆円はログでは特別な色付きテキストで表示
        contentSpan.innerHTML = toRainbowText(originalText);
    } else {
        contentSpan.textContent = originalText;
        contentSpan.style.color = color || '#E0E0E0';
    }

    logCommentDiv.appendChild(document.createTextNode(`[${displayTime}] `));
    logCommentDiv.appendChild(userSpan);
    logCommentDiv.appendChild(contentSpan);

    // DOMに追加してから高さをチェック
    logContainer.insertBefore(logCommentDiv, logContainer.firstChild);

    // 短縮表示が必要かどうかのチェック
    // CSSのline-clampが適用された後、scrollHeightがclientHeightより大きいかを判定
    // NOTE: このチェックは非同期で行う必要がある場合があります。
    // requestAnimationFrameを使用することで、DOM描画後の正確な値を取得できます。
    requestAnimationFrame(() => {
        const is5000 = color === '5000trillion' || color === 'split_custom';
        const shortenedClass = is5000 ? 'shortened-5000' : 'shortened';

        let isOverflowing;
        if (is5000) {
            // spanの塊にはscrollHeight計測が効かないため文字数で判定
            const plainLen = DOMPurify.sanitize(originalText, { ALLOWED_TAGS: [] }).length;
            isOverflowing = plainLen > 20;
        } else {
            contentSpan.classList.add(shortenedClass);
            isOverflowing = contentSpan.scrollHeight > contentSpan.clientHeight;
            contentSpan.classList.remove(shortenedClass);
        }

        if (isOverflowing) {
            contentSpan.classList.add(shortenedClass);

            const toggleLink = document.createElement('a');
            toggleLink.href = 'javascript:void(0)';
            toggleLink.className = 'log-toggle-link';
            toggleLink.textContent = 'もっと見る';
            contentSpan.insertAdjacentElement("afterend", toggleLink);

            toggleLink.onclick = function() {
                if (contentSpan.classList.contains(shortenedClass)) {
                    contentSpan.classList.remove(shortenedClass);
                    contentSpan.classList.add('expanded');
                    toggleLink.textContent = '折りたたむ';
                } else {
                    contentSpan.classList.add(shortenedClass);
                    contentSpan.classList.remove('expanded');
                    toggleLink.textContent = 'もっと見る';
                }
            };
        }
    });
}
// ↑↑↑ appendTweetToLog 関数 ↑↑↑
function appendTweetToStream(key, data, tweetIndex, isNewTweet = false) {
    // 引用(#数字)がある場合、表示用テキストからその「#数字」部分を取り除く
    // （引用カードが内容を表示するので、本文側は残りのコメント部分だけにする）
    const quoteStrippedText = data.quote ? stripQuoteMarker(data.text, data.quote) : data.text;
    // __SPLIT__フォーマットの場合はプレフィックスを除いたテキストでチェック
    const rawText = (quoteStrippedText && quoteStrippedText.startsWith('__SPLIT__'))
        ? quoteStrippedText.replace('__SPLIT__', '').replace('\n', ' ')
        : quoteStrippedText;
    const sanitizedText = DOMPurify.sanitize(rawText);
    const now = Date.now();
    // 「#数字」だけの投稿で、取り除いた後に本文が残らない場合は引用カードのみ表示する
    const isQuoteOnly = !!data.quote && sanitizedText.trim() === '';

    // フィルタリングロジック（__SPLIT__除去後のテキストでチェック）
    if (containsSpam(sanitizedText) || containsForbiddenHtmlTags(sanitizedText) ||
        sanitizedText.length > NORMAL_COMMENT_MAX_LENGTH ||
        (data.type !== 'center_fixed' && isPostIntervalViolated(data.name, data.timestamp)) ||
        isSameContentRateLimited(data.name, sanitizedText, data.timestamp)) {
        console.log(`禁止コメントをスキップ： ${sanitizedText}`);
        removeTweetFromDOMAndMaps(key);
        delete allTweets[key];
        return;
    }

    let div = tweetDomCache.get(key) || document.querySelector(`.tweet[data-key="${key}"]`);
    if (!div) {
        div = document.createElement("div");
        div.className = "tweet";
        tweetDomCache.set(key, div);
        div.setAttribute('data-key', key);
        div.setAttribute('data-timestamp', data.timestamp);

        let inserted = false;
        const tweets = Array.from(tweetStream.children);
        for (let i = 0; i < tweets.length; i++) {
            const existingKey = tweets[i].getAttribute('data-key');
            if (parseInt(key) > parseInt(existingKey)) {
                tweetStream.insertBefore(div, tweets[i]);
                inserted = true;
                break;
            }
        }
        if (!inserted) {
            tweetStream.appendChild(div);
        }
    }

    const formattedTime = formatTimestamp(data.timestamp);
    const reacted = data.reactedUsers && data.reactedUsers[currentUser];
    const reactionCount = data.reactions || 0;
    const originalName = data.name
    // 投稿者名が匿名かどうかをチェック
    const isAnonymousPost = !originalName || originalName.trim() === '';
    const maxNameLength = 15;
    const displayUserName = originalName.length > maxNameLength ? originalName.substring(0, maxNameLength) + '...' : originalName;
    const currentTweetNumber = data.tweetNumber || tweetIndex || 0;
    const isLongText = sanitizedText.length > MAX_LOG_COMMENT_LENGTH;
    const isOverFlow = isLongText; // 暫定的な判断。日本語対応は後述のJSで実施。
    const tweetElementWidth = div.offsetWidth;

    let commentContentHtml = '';
    let pStyle = '';
    let textContentExtraClass = '';

    if (data.color === 'rainbow') {
        commentContentHtml = toRainbowText(sanitizedText);
        pStyle = 'style="color: initial;"';
    } else if (data.color === '5000trillion' || data.color === 'split_custom') {
        // __SPLIT__フォーマットを投稿ストリーム用にHTMLに変換
        if (quoteStrippedText && quoteStrippedText.startsWith('__SPLIT__')) {
            const parts = quoteStrippedText.replace('__SPLIT__', '').split('\n');
            const p1 = linkifyMentions(DOMPurify.sanitize(parts[0] || ''));
            const p2 = linkifyMentions(DOMPurify.sanitize(parts[1] || ''));
            commentContentHtml = `<div class="split-special"><span class="part-upper">${p1}</span><span class="part-lower">${p2}</span></div>`;
        } else {
            commentContentHtml = linkifyMentions(sanitizedText);
        }
        pStyle = 'style="color: initial; overflow: visible;"';
    } else if (data.color === 'dot') {
        commentContentHtml = linkifyMentions(sanitizedText);
        pStyle = 'style="color: #FFFFFF;"';
        textContentExtraClass = ' dot-font'; // dot-fontは本文だけに適用する（投稿全体には付けない）
    } else {
        commentContentHtml = linkifyMentions(sanitizedText);
        pStyle = `style="color: ${data.color || '#FFFFFF'};"`;
    }

    const quoteCardHtml = data.quote ? `<div class="quote-card" data-quote-number="${data.quote}"><div class="quote-card-loading">読み込み中…</div></div>` : '';
    // 「#数字」だけの投稿（引用のみ）なら本文欄自体を出さない
    const textContentHtml = isQuoteOnly ? '' : `<div class="tweet-text-content size-${data.size || 'medium'}${textContentExtraClass}" ${pStyle}>${commentContentHtml}</div>`;

    div.innerHTML = `
    <div class="tweet-header">
        <strong><span class="quote-number" onclick="insertQuoteIntoForm(${currentTweetNumber})" title="この投稿を引用">#${currentTweetNumber}</span> @${displayUserName}</strong>
    </div>
    ${quoteCardHtml}
    ${textContentHtml}
    <div class="log-actions" style="display: ${(isOverFlow && !isQuoteOnly) ? 'flex' : 'none'};">
        <button class="toggle-log-btn">もっと見る</button>
    </div>
    <div class="tweet-footer">
        <div class="actions">
            <button class="reaction-btn" style="color: ${reacted ? '#87CEEB' : '#ccc'};" ${isAnonymousPost ? 'disabled' : ''}>
                👍️ ${reactionCount}
            </button>
            <button type="button" class="requote-btn" onclick="insertQuoteIntoForm(${currentTweetNumber})" title="この投稿を引用">🔄</button>
        </div>
        <div class="timestamp">${formattedTime}</div>
    </div>
`;

    if (data.quote) {
        renderQuoteCard(div, data.quote);
    }

    if (!isQuoteOnly) {
        updateTweetDisplay(div, data);
    }

    if (!toggleLogDisplayCheckbox.checked) {
        div.style.display = 'none';
    } else {
        div.style.display = 'block';
    }

    const reactionBtn = div.querySelector(".actions .reaction-btn");
    if (reactionBtn) {
        // いいねの実処理（Firebaseへの反映）は firebase.js の toggleReaction() が担当する
        reactionBtn.onclick = () => toggleReaction(key, data);
    } // ここでif(reactionBtn)のブロックが閉じます
    
    scheduleUpdateUserStats();

    if (isNewTweet) {
        // フローティング表示より先にキューに積んで遅延を最小化
        enqueueSpeech(data.text, data.color);
        if (data.type === 'center_fixed') {
            showCenterFixedComment(key, data.text, data.color, data.timestamp, false, data.size || 'medium');
        } else if (data.quote) {
            buildFloatingTextWithQuote(data).then(quotedText => {
                showFloatingComment(key, quotedText, data.color, data.timestamp, false, data.size || 'medium');
            });
        } else {
            showFloatingComment(key, data.text, data.color, data.timestamp, false, data.size || 'medium');
        }
    }
} // ここで関数全体が閉じます

  // 引用元投稿の色・フォント設定(rainbow/5000兆円/dot/カスタムカラー)を再現したHTMLを作る（引用カード表示用。全文表示）
  function buildQuoteCardContentHtml(quotedData) {
      const rawText = quotedData.text || '';
      const color = quotedData.color;
      if ((color === '5000trillion' || color === 'split_custom') && rawText.startsWith('__SPLIT__')) {
          const parts = rawText.replace('__SPLIT__', '').split('\n');
          const p1 = DOMPurify.sanitize(parts[0] || '');
          const p2 = DOMPurify.sanitize(parts[1] || '');
          return `<div class="split-special"><span class="part-upper">${p1}</span><span class="part-lower">${p2}</span></div>`;
      }
      const sanitized = DOMPurify.sanitize(rawText);
      if (color === 'rainbow') {
          return toRainbowText(sanitized);
      }
      if (color === 'dot') {
          return `<span class="dot-font">${sanitized}</span>`;
      }
      if (color && /^#[0-9a-fA-F]{6}$/.test(color)) {
          return `<span style="color: ${color};">${sanitized}</span>`;
      }
      return sanitized;
  }

  // 引用元投稿を取得し、投稿カード上部の引用カードに表示する（全文表示。2行を超える場合はもっと見る/折りたたむを付ける）
  async function renderQuoteCard(div, quoteNumber) {
      const cardEl = div.querySelector('.quote-card');
      const found = await fetchQuotedTweetInfo(quoteNumber);

      // 本文中の「#quoteNumber」を引用元の内容に置換する（クリックでのジャンプ機能はそのまま）
      const mentionEls = div.querySelectorAll(`.quote-mention[data-quote-number="${quoteNumber}"]`);
      if (found) {
          const plainSnippet = buildQuotePlainSnippet(found.data);
          mentionEls.forEach(el => {
              el.textContent = `「${plainSnippet}」`;
          });
      }

      if (!cardEl) return;
      if (!found) {
          cardEl.innerHTML = `<div class="quote-card-missing">#${quoteNumber} の投稿が見つかりません</div>`;
          return;
      }
      const quotedName = (found.data.name && found.data.name.trim()) ? found.data.name : '名無し';
      const bodyHtml = buildQuoteCardContentHtml(found.data);
      cardEl.innerHTML = `<div class="quote-card-header"><span class="quote-card-number">#${quoteNumber}</span> <span class="quote-card-name">@${quotedName}</span></div><div class="quote-card-body">${bodyHtml}</div>`;
      cardEl.classList.add('quote-card-clickable');
      cardEl.addEventListener('click', () => jumpToTweetByNumber(quoteNumber));

      // 2行に収まらない場合、もっと見る/折りたたむトグルを付ける（通常投稿と同じ仕組み）
      requestAnimationFrame(() => {
          const bodyEl = cardEl.querySelector('.quote-card-body');
          if (!bodyEl) return;
          if (bodyEl.scrollHeight <= bodyEl.clientHeight + 1) return; // 2行に収まっている

          const toggleBtn = document.createElement('span');
          toggleBtn.className = 'quote-card-toggle';
          toggleBtn.textContent = 'もっと見る';
          toggleBtn.onclick = (e) => {
              e.stopPropagation(); // カード自体のジャンプクリックを誘発しない
              const expanded = bodyEl.classList.toggle('quote-card-expanded');
              toggleBtn.textContent = expanded ? '折りたたむ' : 'もっと見る';
          };
          cardEl.appendChild(toggleBtn);
      });
  }

  // 指定tweetNumberの投稿が「直近100件」の表示範囲内にあれば、その投稿までスクロールして移動する
  function jumpToTweetByNumber(quoteNumber) {
      let targetKey = null;
      for (const k in allTweets) {
          if (allTweets[k] && Number(allTweets[k].tweetNumber) === Number(quoteNumber)) {
              targetKey = k;
              break;
          }
      }
      const targetDiv = targetKey ? (tweetDomCache.get(targetKey) || document.querySelector(`.tweet[data-key="${targetKey}"]`)) : null;
      if (!targetDiv) {
          alert(`元投稿（#${quoteNumber}）は直近100件の表示範囲外のため移動できません。`);
          return;
      }
      targetDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
      targetDiv.classList.add('quote-jump-highlight');
      protectTweetFromEviction(targetKey);
      setTimeout(() => targetDiv.classList.remove('quote-jump-highlight'), 1500);
  }

  // 投稿フォームに「#番号 」を書き入れて、引用投稿をしやすくする
  function insertQuoteIntoForm(tweetNumber) {
      const splitContainer = document.getElementById('splitInputContainer');
      const isSplitMode = splitContainer && splitContainer.style.display !== 'none';
      const targetInput = isSplitMode ? document.getElementById('comment_part1') : document.getElementById('comment');
      if (!targetInput) return;
      const quoteTag = `#${tweetNumber} `;
      const existingMarkerRegex = /#\d+\s*/;
      if (existingMarkerRegex.test(targetInput.value)) {
          // 既に「#番号」が入っていれば、それを新しい#番号に置き換える（併記はしない）
          targetInput.value = targetInput.value.replace(existingMarkerRegex, quoteTag);
      } else {
          targetInput.value = quoteTag + targetInput.value;
      }
      targetInput.focus();
      const len = targetInput.value.length;
      targetInput.setSelectionRange(len, len);
      const formEl = document.getElementById('tweetForm');
      if (formEl) formEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      updateQuotePreview(); // ボタンから入れた時もその場でプレビュー表示する
  }
  // ▲ここまで▲

  // 投稿フォームに「#数字」を入力した瞬間、引用元のプレビューを表示する（送信前に内容を確認できるように）
  let quotePreviewTimer = null;
  async function updateQuotePreview() {
      const previewEl = document.getElementById('quotePreviewContainer');
      if (!previewEl) return;

      const commentInput = document.getElementById('comment');
      const commentPart1 = document.getElementById('comment_part1');
      const splitContainer = document.getElementById('splitInputContainer');
      const isSplitMode = splitContainer && splitContainer.style.display !== 'none';
      const text = (isSplitMode ? (commentPart1 ? commentPart1.value : '') : (commentInput ? commentInput.value : ''));

      const match = text.match(/#(\d+)/);
      if (!match) {
          previewEl.style.display = 'none';
          previewEl.innerHTML = '';
          return;
      }

      const quoteNumber = parseInt(match[1], 10);
      const found = await fetchQuotedTweetInfo(quoteNumber);

      // 入力中にさらに文字が変わっている可能性があるので、今も同じ#番号を指しているか確認する
      const currentText = (isSplitMode ? (commentPart1 ? commentPart1.value : '') : (commentInput ? commentInput.value : ''));
      const currentMatch = currentText.match(/#(\d+)/);
      if (!currentMatch || parseInt(currentMatch[1], 10) !== quoteNumber) return;

      if (!found) {
          previewEl.innerHTML = `<div class="quote-preview-header">#${quoteNumber} の投稿が見つかりません</div>`;
          previewEl.style.display = 'block';
          return;
      }

      const quotedName = (found.data.name && found.data.name.trim()) ? found.data.name : '名無し';
      const bodyHtml = buildQuoteCardContentHtml(found.data);
      previewEl.innerHTML = `<div class="quote-preview-header">#${quoteNumber} @${quotedName}</div><div class="quote-preview-body">${bodyHtml}</div>`;
      previewEl.style.display = 'block';
  }

  function scheduleQuotePreviewUpdate() {
      clearTimeout(quotePreviewTimer);
      quotePreviewTimer = setTimeout(updateQuotePreview, 300);
  }

  const commentInputForPreview = document.getElementById('comment');
  const commentPart1ForPreview = document.getElementById('comment_part1');
  if (commentInputForPreview) commentInputForPreview.addEventListener('input', scheduleQuotePreviewUpdate);
  if (commentPart1ForPreview) commentPart1ForPreview.addEventListener('input', scheduleQuotePreviewUpdate);


  function removeTweetFromDOMAndMaps(key) {
      tweetDomCache.delete(key);
      const existingDiv = document.querySelector(`.tweet[data-key="${key}"]`);
      if (existingDiv) {
          existingDiv.remove();
      }
      if (activeCenterFixedComments.has(key)) {
          activeCenterFixedComments.get(key).element.remove();
          activeCenterFixedComments.delete(key);
          updateCenterFixedCommentPositions();
      }
      if (activeFloatingComments.has(key)) {
          activeFloatingComments.get(key).element.remove();
          activeFloatingComments.delete(key);
      }
  }

  function openExportModal() {
    const modal = document.getElementById('exportModal');
    // bodyのtransform: scale()の影響を完全に逃がすため、<html>直下に移動する
    if (modal.parentElement !== document.documentElement) {
        document.documentElement.appendChild(modal);
    }
    document.getElementById('exportModalStatus').textContent = '';
    // ボタンを有効状態に戻す
    ['exportBtnRecent','exportBtnToday','exportBtnAll'].forEach(id => {
        const btn = document.getElementById(id);
        btn.disabled = false;
        btn.classList.remove('loading');
    });
    modal.classList.add('open');
  }

  function closeExportModal() {
    document.getElementById('exportModal').classList.remove('open');
  }

  // モーダル外クリックで閉じる
  document.getElementById('exportModal').addEventListener('click', function(e) {
    if (e.target === this) closeExportModal();
  });

  /**
   * tweetsデータ（オブジェクト）をtxtに変換してダウンロード
   * @param {Object} tweetsObj  - { key: tweetData, ... }
   * @param {string} suffix     - ファイル名サフィックス（'recent' | 'today' | 'all'）
   */
  function downloadTweetsAsTxt(tweetsObj, suffix) {
    const sortedKeys = Object.keys(tweetsObj).sort((a, b) => {
        return (tweetsObj[a].timestamp || 0) - (tweetsObj[b].timestamp || 0);
    });

    if (sortedKeys.length === 0) {
        document.getElementById('exportModalStatus').textContent = '該当する投稿がありません。';
        return;
    }

    const lines = sortedKeys.map((key) => {
        const t = tweetsObj[key];
        const num = t.tweetNumber || key;
        const dt = formatTimestamp(t.timestamp || 0);
        const name = (t.name || '匿名').replace(/\r?\n/g, ' ');
        const colorTag = t.color || '#ffffff';
        const typeTag  = t.type  || 'normal';
        const sizeTag  = t.size  || 'medium';
        let content = '';
        if (t.text && t.text.startsWith('__SPLIT__')) {
            const parts = t.text.replace('__SPLIT__', '').split('\n');
            content = `【五千兆】${(parts[0] || '').trim()} ${(parts[1] || '').trim()}`.trim();
        } else if (t.color === 'dot') {
            content = `【ドット】${(t.text || '').replace(/\r?\n/g, ' ')}`;
        } else {
            content = (t.text || '').replace(/\r?\n/g, ' ');
        }
        return `#${num} [${dt}] ${name}: ${content} |color:${colorTag}|type:${typeTag}|size:${sizeTag}`;
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const fileName = `nicotwi_${suffix}_${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}.txt`;
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    document.getElementById('exportModalStatus').textContent = `✅ ${lines.length}件を書き出しました`;
    setTimeout(closeExportModal, 1200);
  }

  /**
   * tweetsデータ（オブジェクト）をJSONのままダウンロードする。
   * FirebaseのJSONエクスポート/インポートと同じ「{key: tweetData, ...}」形式なので、
   * そのままFirebaseへの再インポートにも使える。txt書き出しと違い、全フィールドを保持する（無劣化）。
   * @param {Object} tweetsObj  - { key: tweetData, ... }
   * @param {string} suffix     - ファイル名サフィックス（'recent' | 'today' | 'all'）
   */
  function downloadTweetsAsJson(tweetsObj, suffix) {
    const keyCount = Object.keys(tweetsObj).length;
    if (keyCount === 0) {
        document.getElementById('exportModalStatus').textContent = '該当する投稿がありません。';
        return;
    }

    const jsonStr = JSON.stringify(tweetsObj, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const fileName = `nicotwi_${suffix}_${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}.json`;
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    document.getElementById('exportModalStatus').textContent = `✅ ${keyCount}件をJSONで書き出しました`;
    setTimeout(closeExportModal, 1200);
  }

  // 選択中の書き出し形式（txt/json）にあわせて、どちらかの関数を呼び分ける
  function downloadTweetsInSelectedFormat(tweetsObj, suffix) {
    const checked = document.querySelector('input[name="exportFormat"]:checked');
    const format = checked ? checked.value : 'txt';
    if (format === 'json') {
        downloadTweetsAsJson(tweetsObj, suffix);
    } else {
        downloadTweetsAsTxt(tweetsObj, suffix);
    }
  }

  async function runExport(mode) {
    const statusEl = document.getElementById('exportModalStatus');
    // ボタンをローディング状態に
    ['exportBtnRecent','exportBtnToday','exportBtnAll'].forEach(id => {
        const btn = document.getElementById(id);
        btn.disabled = true;
        btn.classList.add('loading');
    });

    if (mode === 'recent') {
        // メモリ上のallTweets（直近100件）をそのまま使う
        statusEl.textContent = '準備中...';
        downloadTweetsInSelectedFormat(allTweets, 'recent');

    } else if (mode === 'today') {
        // Firebaseから全件取得し、今日（JST）のものだけ絞り込む
        statusEl.textContent = 'Firebaseから取得中...';
        try {
            const JST_OFFSET = 9 * 60 * 60 * 1000;
            const nowJST = Date.now() + JST_OFFSET;
            const todayStartJST = Math.floor(nowJST / (24*60*60*1000)) * (24*60*60*1000) - JST_OFFSET;
            const snapshot = await db.ref('tweets').once('value');
            const todayObj = {};
            snapshot.forEach(child => {
                const t = child.val();
                if ((t.timestamp || 0) >= todayStartJST) todayObj[child.key] = t;
            });
            downloadTweetsInSelectedFormat(todayObj, 'today');
        } catch (e) {
            statusEl.textContent = '取得失敗: ' + e.message;
            return;
        }

    } else if (mode === 'all') {
        // Firebaseから全件取得
        statusEl.textContent = 'Firebaseから取得中...';
        try {
            const snapshot = await db.ref('tweets').orderByKey().once('value');
            await incrementReadCount();
            const data = snapshot.val() || {};
            downloadTweetsInSelectedFormat(data, 'all');
        } catch (err) {
            console.error('全件取得エラー:', err);
            statusEl.textContent = '❌ 取得に失敗しました。';
            ['exportBtnRecent','exportBtnToday','exportBtnAll'].forEach(id => {
                const btn = document.getElementById(id);
                btn.disabled = false;
                btn.classList.remove('loading');
            });
        }
    }
  }
